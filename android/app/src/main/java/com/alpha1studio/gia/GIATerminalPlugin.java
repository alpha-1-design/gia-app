package com.alpha1studio.gia;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * GIATerminalPlugin - Capacitor bridge to GIATerminalService.
 *
 * Provides exec, kill, listSessions, getFSInfo, and getStatus methods
 * that manage proot+Alpine terminal sessions running in a foreground service.
 */
@CapacitorPlugin(name = "GIATerminal")
public class GIATerminalPlugin extends Plugin {

    private static final String TAG = "GIATerminalPlugin";

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "GIATerminalPlugin loaded");
        startTerminalService();
    }

    /**
     * Start the foreground terminal service.
     *
     * Deliberately swallows any exception here. This runs inside load(),
     * which Capacitor calls while registering the plugin with the bridge —
     * an uncaught exception at this point can knock the plugin registration
     * itself out, which is what makes JS see "GIATerminal plugin is not
     * implemented on android" instead of a real error from exec(). Service
     * start failures now surface as a normal call rejection the next time
     * exec() is used, instead of poisoning plugin availability app-wide.
     */
    private void startTerminalService() {
        try {
            Context context = getContext();
            Intent serviceIntent = new Intent(context, GIATerminalService.class);
            context.startForegroundService(serviceIntent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start GIATerminalService: " + e.getMessage(), e);
        }
    }

    /**
     * Execute a command inside a proot+Alpine terminal session.
     *
     * @param call Expects: command (string, required), workdir (string, optional),
     *             env (JSObject, optional), timeout (number, optional),
     *             sessionId (string, optional — auto-generated if omitted)
     */
    @PluginMethod
    public void exec(PluginCall call) {
        String command = call.getString("command");
        if (command == null || command.isEmpty()) {
            call.reject("command is required");
            return;
        }

        String sessionId = call.getString("sessionId");
        if (sessionId == null || sessionId.isEmpty()) {
            sessionId = UUID.randomUUID().toString();
        }
        int timeout = call.getInt("timeout", 30000); // default 30s

        try {
            // Start the session
            GIATerminalService.TerminalSession session =
                    GIATerminalService.startSession(getContext(), sessionId, command);

            // Wait for output with timeout
            String output = session.awaitOutput(timeout);

            // Give the OS a short grace window to reap the child before reading
            // its exit code. Previously we called process.exitValue() directly
            // after stream EOF, which races the JVM's reaper thread and throws
            // IllegalThreadStateException("process hasn't exited") — surfacing
            // as "Unexpected error: process hasn't exited" on every command.
            boolean exited = session.awaitExit(2000);
            int exitCode = session.exitCode();
            if (!exited) {
                output += "\n[command still running after " + timeout + "ms — session terminated]";
            }

            // Clean up the session
            GIATerminalService.killSession(sessionId);

            JSObject result = new JSObject();
            result.put("output", output);
            result.put("exitCode", exitCode);
            result.put("sessionId", sessionId);
            call.resolve(result);

        } catch (IOException e) {
            Log.e(TAG, "Failed to start session", e);
            call.reject("Failed to start terminal session: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Log.e(TAG, "Session interrupted", e);
            GIATerminalService.killSession(sessionId);
            call.reject("Terminal session interrupted", e);
        } catch (Exception e) {
            Log.e(TAG, "Unexpected error in exec", e);
            GIATerminalService.killSession(sessionId);
            call.reject("Unexpected error: " + e.getMessage(), e);
        }
    }

    /**
     * Start a command in the background and return immediately (run-detached).
     *
     * Unlike exec(), the session is NOT awaited and NOT killed when this call
     * returns — it stays alive in the service's session map so long-running
     * processes (dev servers, watchers, downloads) survive between calls. Poll
     * its output with readOutput() and stop it with kill().
     *
     * @param call Expects: command (string, required), workdir (string, optional)
     */
    @PluginMethod
    public void spawn(PluginCall call) {
        String command = call.getString("command");
        if (command == null || command.isEmpty()) {
            call.reject("command is required");
            return;
        }

        String sessionId = UUID.randomUUID().toString();
        try {
            GIATerminalService.TerminalSession session =
                    GIATerminalService.startSession(getContext(), sessionId, command);

            JSObject result = new JSObject();
            result.put("sessionId", sessionId);
            result.put("command", command);
            result.put("running", session.isRunning());
            call.resolve(result);
        } catch (IOException e) {
            Log.e(TAG, "Failed to spawn background session", e);
            GIATerminalService.killSession(sessionId);
            call.reject("Failed to start background session: " + e.getMessage(), e);
        } catch (Exception e) {
            Log.e(TAG, "Unexpected error in spawn", e);
            GIATerminalService.killSession(sessionId);
            call.reject("Unexpected error: " + e.getMessage(), e);
        }
    }

    /**
     * Read (and drain) the output produced so far by a background session.
     *
     * Non-blocking — returns whatever the session has buffered since the last
     * read. When the underlying process has exited, the session is removed
     * from the map so it can't leak; subsequent reads report gone=true.
     *
     * @param call Expects: sessionId (string, required)
     */
    @PluginMethod
    public void readOutput(PluginCall call) {
        String sessionId = call.getString("sessionId");
        if (sessionId == null || sessionId.isEmpty()) {
            call.reject("sessionId is required");
            return;
        }

        GIATerminalService.TerminalSession session = GIATerminalService.getSession(sessionId);
        if (session == null) {
            JSObject result = new JSObject();
            result.put("output", "");
            result.put("running", false);
            result.put("gone", true);
            result.put("exitCode", -1);
            call.resolve(result);
            return;
        }

        boolean running = session.isRunning();
        String output = session.drainOutput();
        int exitCode = session.exitCode();
        if (!running) {
            // Process finished — reap it from the map so the session doesn't leak.
            GIATerminalService.killSession(sessionId);
        }

        JSObject result = new JSObject();
        result.put("output", output);
        result.put("running", running);
        result.put("gone", false);
        result.put("exitCode", exitCode);
        call.resolve(result);
    }

    /**
     * Kill a terminal session by sessionId.
     *
     * @param call Expects: sessionId (string, required)
     */
    @PluginMethod
    public void kill(PluginCall call) {
        String sessionId = call.getString("sessionId");
        if (sessionId == null || sessionId.isEmpty()) {
            call.reject("sessionId is required");
            return;
        }

        try {
            GIATerminalService.killSession(sessionId);
            JSObject result = new JSObject();
            result.put("killed", true);
            result.put("sessionId", sessionId);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to kill session " + sessionId, e);
            call.reject("Failed to kill session: " + e.getMessage(), e);
        }
    }

    /**
     * List all active terminal sessions.
     */
    @PluginMethod
    public void listSessions(PluginCall call) {
        try {
            List<Map<String, Object>> sessions = GIATerminalService.listSessions();
            JSArray jsSessions = new JSArray();

            for (Map<String, Object> s : sessions) {
                JSObject obj = new JSObject();
                obj.put("sessionId", (String) s.get("sessionId"));
                obj.put("command", (String) s.get("command"));
                obj.put("createdAt", (Long) s.get("createdAt"));
                obj.put("running", (Boolean) s.get("running"));
                jsSessions.put(obj);
            }

            JSObject result = new JSObject();
            result.put("sessions", jsSessions);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to list sessions", e);
            call.reject("Failed to list sessions: " + e.getMessage(), e);
        }
    }

    /**
     * Get filesystem info for the terminal directory.
     */
    @PluginMethod
    public void getFSInfo(PluginCall call) {
        try {
            Map<String, Object> fsInfo = GIATerminalService.getFSInfo(getContext());

            JSObject result = new JSObject();
            result.put("totalBytes", (Long) fsInfo.get("totalBytes"));
            result.put("freeBytes", (Long) fsInfo.get("freeBytes"));
            result.put("usedBytes", (Long) fsInfo.get("usedBytes"));
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get FS info", e);
            call.reject("Failed to get filesystem info: " + e.getMessage(), e);
        }
    }

    /**
     * Get terminal service status: running state and session count.
     */
    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            int sessionCount = GIATerminalService.getSessionCount();

            JSObject result = new JSObject();
            result.put("running", true);
            result.put("sessionCount", sessionCount);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get status", e);
            call.reject("Failed to get status: " + e.getMessage(), e);
        }
    }

    /**
     * Force-delete the rootfs and re-extract from assets on a background thread.
     * 
     * This breaks the chicken-and-egg where a broken rootfs prevents
     * provisioning (which needs a working terminal) but a working terminal
     * needs a good rootfs.
     */
    @PluginMethod
    public void reinstallRootfs(PluginCall call) {
        new Thread(() -> {
            try {
                boolean ok = GIATerminalService.forceReextractRootfs(getContext());
                if (ok) {
                    JSObject result = new JSObject();
                    result.put("success", true);
                    result.put("message", "Rootfs re-extracted successfully");
                    call.resolve(result);
                } else {
                    call.reject("Rootfs re-extraction completed but critical binaries are missing");
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to reinstall rootfs", e);
                call.reject("Failed to reinstall rootfs: " + e.getMessage(), e);
            }
        }, "rootfs-reinstall").start();
    }

    // -----------------------------------------------------------------------
    // Generic command execution (for workspace setup, etc.)
    // -----------------------------------------------------------------------

    @PluginMethod
    public void execCommand(PluginCall call) {
        String command = call.getString("command");
        if (command == null || command.isEmpty()) {
            call.reject("command is required");
            return;
        }
        int timeout = call.getInt("timeout", 30000);
        String prootCmd = buildPackageCmd(command);
        runProotCommand(call, prootCmd, timeout);
    }

    // -----------------------------------------------------------------------
    // On-device rootfs download with progress (Kai 9000 style)
    // -----------------------------------------------------------------------

    /** CDN mirror list — primary + fallbacks for mobile networks that block certain domains */
    private static final String[] ALPINE_MIRRORS = {
        "https://dl-cdn.alpinelinux.org/alpine/v3.21/releases",
        "https://dl-3.alpinelinux.org/alpine/v3.21/releases",
        "https://dl-4.alpinelinux.org/alpine/v3.21/releases",
        "https://cdn-mirror.getalpine.org/alpine/v3.21/releases",
        "https://mirror.math.princeton.edu/pub/alpine/v3.21/releases",
    };
    private static final int MAX_RETRIES = 3;
    private static final int RETRY_DELAY_MS = 2000;
    private final AtomicBoolean downloadInProgress = new AtomicBoolean(false);

    /**
     * Download Alpine rootfs from CDN with real-time progress events.
     * Emits 'rootfsProgress' events: { phase, progress, message, bytesDownloaded, totalBytes }
     * Phases: 'downloading', 'extracting', 'materializing', 'verifying', 'ready', 'error'
     */
    @PluginMethod
    public void downloadRootfs(PluginCall call) {
        if (downloadInProgress.getAndSet(true)) {
            call.reject("Download already in progress");
            return;
        }

        String arch = call.getString("arch", "aarch64");
        int archId = call.getInt("archId", 0);

        new Thread(() -> {
            try {
                doDownloadRootfs(arch, archId);
                downloadInProgress.set(false);
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("message", "Terminal installed successfully");
                call.resolve(result);
            } catch (Exception e) {
                downloadInProgress.set(false);
                Log.e(TAG, "Rootfs download failed: " + e.getMessage(), e);
                emitProgress("error", 0, "Error: " + e.getMessage());
                call.reject("Download failed: " + e.getMessage(), e);
            }
        }, "rootfs-download").start();
    }

    private void doDownloadRootfs(String arch, int archId) throws IOException {
        Context ctx = getContext();
        File terminalDir = new File(ctx.getFilesDir(), "terminal");
        File rootfsDir = new File(terminalDir, "rootfs");
        File archiveFile = new File(terminalDir, "alpine-minirootfs.tar.gz");

        terminalDir.mkdirs();
        rootfsDir.mkdirs();

        // Step 1: Download rootfs tarball from CDN with mirror fallback
        String filename = "alpine-minirootfs-3.21.0-" + arch + ".tar.gz";
        boolean downloaded = false;
        Exception lastError = null;

        for (String mirror : ALPINE_MIRRORS) {
            String downloadUrl = mirror + "/" + arch + "/" + filename;
            emitProgress("downloading", 0, "Trying " + mirror.replace("https://", "") + "...");
            Log.i(TAG, "Downloading rootfs from: " + downloadUrl);

            for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    HttpURLConnection conn = (HttpURLConnection) new URL(downloadUrl).openConnection();
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(30000);
                    conn.setRequestProperty("User-Agent", "GIA/2.4.0");

                    int responseCode = conn.getResponseCode();
                    if (responseCode != 200) {
                        conn.disconnect();
                        throw new IOException("HTTP " + responseCode);
                    }

                    long totalBytes = conn.getContentLengthLong();
                    if (totalBytes <= 0) totalBytes = 2_000_000; // fallback estimate

                    // Clear any partial file from previous attempt
                    if (archiveFile.exists()) archiveFile.delete();

                    try (InputStream in = conn.getInputStream();
                         FileOutputStream out = new FileOutputStream(archiveFile)) {
                        byte[] buf = new byte[8192];
                        long bytesSoFar = 0;
                        int n;
                        int lastProgress = -1;
                        while ((n = in.read(buf)) != -1) {
                            out.write(buf, 0, n);
                            bytesSoFar += n;
                            int pct = (int) (bytesSoFar * 40 / totalBytes); // 0-40% for download
                            if (pct != lastProgress) {
                                lastProgress = pct;
                                emitProgress("downloading", pct,
                                    "Downloading... " + (bytesSoFar / 1024) + "KB / " + (totalBytes / 1024) + "KB");
                            }
                        }
                    }
                    conn.disconnect();
                    downloaded = true;
                    break;
                } catch (Exception e) {
                    lastError = e;
                    Log.w(TAG, "Attempt " + attempt + "/" + MAX_RETRIES + " failed for " + mirror + ": " + e.getMessage());
                    if (attempt < MAX_RETRIES) {
                        emitProgress("downloading", 0, "Retry " + attempt + "/" + MAX_RETRIES + "...");
                        try { Thread.sleep(RETRY_DELAY_MS); } catch (InterruptedException ignored) {}
                    }
                }
            }
            if (downloaded) break;
        }

        if (!downloaded) {
            String errMsg = lastError != null ? lastError.getMessage() : "unknown error";
            throw new IOException("Could not download rootfs from any mirror: " + errMsg);
        }

        emitProgress("downloading", 40, "Download complete — " + (archiveFile.length() / 1024) + "KB");
        Log.i(TAG, "Rootfs downloaded: " + archiveFile.length() + " bytes");

        // Step 2: Extract tar.gz
        emitProgress("extracting", 41, "Extracting rootfs...");
        if (rootfsDir.exists() && rootfsDir.listFiles() != null && rootfsDir.listFiles().length > 0) {
            GIATerminalService.deleteRecursive(rootfsDir);
            rootfsDir.mkdirs();
        }

        List<String[]> failedSymlinks = new java.util.ArrayList<>();
        GIATerminalService.untar(archiveFile, rootfsDir, failedSymlinks);
        archiveFile.delete();
        emitProgress("extracting", 60, "Extraction complete");
        Log.i(TAG, "Rootfs extracted to " + rootfsDir.getAbsolutePath());

        // Step 3: Materialize broken symlinks
        emitProgress("materializing", 61, "Fixing symlinks...");
        GIATerminalService.materializeSymlinks(rootfsDir, failedSymlinks);
        emitProgress("materializing", 70, "Symlinks fixed");

        // Step 4: Post-extraction hardening
        File busybox = new File(rootfsDir, "bin/busybox");
        if (busybox.exists()) busybox.setExecutable(true, false);
        File homeDir = new File(rootfsDir, "root");
        if (!homeDir.exists()) homeDir.mkdirs();
        File resolv = new File(rootfsDir, "etc/resolv.conf");
        if (!resolv.exists()) {
            resolv.getParentFile().mkdirs();
            try (FileOutputStream fos = new FileOutputStream(resolv)) {
                fos.write("nameserver 8.8.8.8\nnameserver 1.1.1.1\n".getBytes());
            }
        }
        emitProgress("materializing", 80, "Hardening rootfs...");

        // Step 5: Verify rootfs has critical binaries (skip proot package install —
        // do that from the Packages tab instead, since proot during setup is fragile)
        emitProgress("installing", 81, "Verifying rootfs integrity...");
        
        // Debug: log what's actually in the rootfs
        File busyboxCheck = new File(rootfsDir, "bin/busybox");
        File shCheck = new File(rootfsDir, "bin/sh");
        File envCheck = new File(rootfsDir, "usr/bin/env");
        File binDir = new File(rootfsDir, "bin");
        Log.i(TAG, "Rootfs verification: busybox=" + busyboxCheck.exists()
            + " sh=" + shCheck.exists() + " env=" + envCheck.exists());
        if (binDir.exists() && binDir.listFiles() != null) {
            Log.i(TAG, "bin/ contents: " + java.util.Arrays.toString(binDir.list()));
        }

        // If symlinks weren't materialized during extraction, do it now
        boolean hasBusybox = busyboxCheck.exists();
        boolean hasSh = shCheck.exists();
        boolean hasEnv = envCheck.exists();
        
        if (hasBusybox && (!hasSh || !hasEnv)) {
            emitProgress("installing", 85, "Fixing missing symlinks...");
            // Manually create busybox applet copies for missing critical binaries
            if (!hasSh) {
                shCheck.getParentFile().mkdirs();
                try {
                    GIATerminalService.copyFile(busyboxCheck, shCheck);
                    shCheck.setExecutable(true, false);
                    hasSh = true;
                    Log.i(TAG, "Manually created /bin/sh from busybox");
                } catch (IOException e) {
                    Log.e(TAG, "Failed to create /bin/sh: " + e.getMessage());
                }
            }
            if (!hasEnv) {
                File usrBin = envCheck.getParentFile();
                if (usrBin != null) usrBin.mkdirs();
                try {
                    GIATerminalService.copyFile(busyboxCheck, envCheck);
                    envCheck.setExecutable(true, false);
                    hasEnv = true;
                    Log.i(TAG, "Manually created /usr/bin/env from busybox");
                } catch (IOException e) {
                    Log.e(TAG, "Failed to create /usr/bin/env: " + e.getMessage());
                }
            }
        }

        emitProgress("installing", 95, "Rootfs verified");

        // Step 6: Final verification
        emitProgress("verifying", 96, "Verifying installation...");
        boolean ok = GIATerminalService.rootfsHasCriticalBinaries(rootfsDir);
        if (ok) {
            File marker = new File(rootfsDir, ".gia-rootfs-ok");
            marker.createNewFile();
            emitProgress("ready", 100, "Terminal installed and ready! Use the Packages tab to install tools.");
            Log.i(TAG, "On-device rootfs setup complete");
        } else {
            // List what we DO have for debugging
            String missing = "";
            if (!busyboxCheck.exists()) missing += "busybox ";
            if (!shCheck.exists()) missing += "/bin/sh ";
            if (!envCheck.exists()) missing += "/usr/bin/env ";
            Log.e(TAG, "Rootfs verification failed — missing: " + missing);
            emitProgress("error", 0, "Rootfs extraction incomplete — missing: " + missing.trim());
            throw new IOException("Rootfs extraction incomplete — missing: " + missing.trim());
        }
    }

    /**
     * Install a single Alpine package via the sandbox.
     */
    @PluginMethod
    public void installPackage(PluginCall call) {
        String packageName = call.getString("packageName");
        if (packageName == null || packageName.isEmpty()) {
            call.reject("packageName is required");
            return;
        }
        String prootCmd = buildPackageCmd("apk add --no-cache " + packageName);
        runProotCommand(call, prootCmd, 300000);
    }

    /**
     * Remove an Alpine package.
     */
    @PluginMethod
    public void removePackage(PluginCall call) {
        String packageName = call.getString("packageName");
        if (packageName == null || packageName.isEmpty()) {
            call.reject("packageName is required");
            return;
        }
        String prootCmd = buildPackageCmd("apk del " + packageName);
        runProotCommand(call, prootCmd, 60000);
    }

    /**
     * Search for available Alpine packages.
     */
    @PluginMethod
    public void searchPackages(PluginCall call) {
        String query = call.getString("query", "");
        String prootCmd = buildPackageCmd("apk search " + query);
        runProotCommand(call, prootCmd, 30000);
    }

    /**
     * List currently installed Alpine packages.
     */
    @PluginMethod
    public void listInstalledPackages(PluginCall call) {
        String prootCmd = buildPackageCmd("apk list --installed 2>/dev/null | sort");
        runProotCommand(call, prootCmd, 15000);
    }

    /**
     * Update Alpine package index.
     */
    @PluginMethod
    public void updatePackageIndex(PluginCall call) {
        String prootCmd = buildPackageCmd("apk update");
        runProotCommand(call, prootCmd, 60000);
    }

    private String buildPackageCmd(String cmd) {
        Context ctx = getContext();
        String prootPath = GIATerminalService.resolveProotPath(ctx);
        File rootfsDir = new File(new File(ctx.getFilesDir(), "terminal"), "rootfs");
        return prootPath
            + " -r " + rootfsDir.getAbsolutePath()
            + " -0"
            + " -b /proc -b /sys -b /dev -b /dev/pts"
            + " -b /system -b /data -b /mnt -b /storage"
            + " -w /root"
            + " /usr/bin/env -i"
            + " TERM=xterm-256color HOME=/root"
            + " PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
            + " SHELL=/bin/sh"
            + " SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt"
            + " /bin/sh -c '" + cmd.replace("'", "'\\''") + "'";
    }

    private void runProotCommand(PluginCall call, String prootCmd, int timeout) {
        new Thread(() -> {
            try {
                ProcessBuilder pb = new ProcessBuilder("sh", "-c", prootCmd);
                pb.redirectErrorStream(true);
                File prootTmpDir = new File(getContext().getCacheDir(), "proot-tmp");
                prootTmpDir.mkdirs();
                pb.environment().put("PROOT_NO_SECCOMP", "1");
                pb.environment().put("PROOT_TMP_DIR", prootTmpDir.getAbsolutePath());
                pb.environment().put("TMPDIR", prootTmpDir.getAbsolutePath());
                Process proc = pb.start();
                StringBuilder output = new StringBuilder();
                Thread reader = new Thread(() -> {
                    try (InputStream in = proc.getInputStream()) {
                        byte[] buf = new byte[4096];
                        int n;
                        while ((n = in.read(buf)) != -1) {
                            output.append(new String(buf, 0, n));
                        }
                    } catch (IOException ignored) {}
                });
                reader.start();
                boolean finished = proc.waitFor(timeout, java.util.concurrent.TimeUnit.MILLISECONDS);
                reader.join(3000);
                int exitCode = finished ? proc.exitValue() : -1;
                if (!finished) proc.destroyForcibly();

                JSObject result = new JSObject();
                result.put("output", output.toString());
                result.put("exitCode", exitCode);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Command failed: " + e.getMessage(), e);
            }
        }, "pkg-cmd").start();
    }

    /**
     * Get the status of the on-device terminal installation.
     */
    @PluginMethod
    public void getSetupStatus(PluginCall call) {
        Context ctx = getContext();
        File rootfsDir = new File(new File(ctx.getFilesDir(), "terminal"), "rootfs");
        File marker = new File(rootfsDir, ".gia-rootfs-ok");
        File busybox = new File(rootfsDir, "bin/busybox");
        File sh = new File(rootfsDir, "bin/sh");

        boolean installed = marker.exists() && busybox.exists() && sh.exists();
        long rootfsSize = getDirSize(rootfsDir);

        JSObject result = new JSObject();
        result.put("installed", installed);
        result.put("rootfsPath", rootfsDir.getAbsolutePath());
        result.put("rootfsSizeBytes", rootfsSize);
        result.put("hasBusybox", busybox.exists());
        result.put("hasShell", sh.exists());
        call.resolve(result);
    }

    private long getDirSize(File dir) {
        if (!dir.exists()) return 0;
        long size = 0;
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                if (f.isDirectory()) size += getDirSize(f);
                else size += f.length();
            }
        }
        return size;
    }

    private void emitProgress(String phase, int progress, String message) {
        JSObject data = new JSObject();
        data.put("phase", phase);
        data.put("progress", progress);
        data.put("message", message);
        data.put("timestamp", System.currentTimeMillis());
        notifyListeners("rootfsProgress", data);
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        Log.i(TAG, "GIATerminalPlugin destroyed");
    }
}
