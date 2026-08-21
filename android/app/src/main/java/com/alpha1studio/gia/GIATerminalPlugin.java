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

    private static final String ALPINE_MIRROR_BASE = "https://dl-cdn.alpinelinux.org/alpine/v3.21/releases";
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

        // Step 1: Download rootfs tarball from CDN
        String downloadUrl = ALPINE_MIRROR_BASE + "/" + arch + "/alpine-minirootfs-3.21.0-" + arch + ".tar.gz";
        emitProgress("downloading", 0, "Downloading Alpine rootfs from CDN...");
        Log.i(TAG, "Downloading rootfs from: " + downloadUrl);

        HttpURLConnection conn = (HttpURLConnection) new URL(downloadUrl).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        conn.setRequestProperty("User-Agent", "GIA/2.3.3");

        int responseCode = conn.getResponseCode();
        if (responseCode != 200) {
            throw new IOException("HTTP " + responseCode + " fetching rootfs");
        }

        long totalBytes = conn.getContentLengthLong();
        if (totalBytes <= 0) totalBytes = 2_000_000; // fallback estimate

        try (InputStream in = conn.getInputStream();
             FileOutputStream out = new FileOutputStream(archiveFile)) {
            byte[] buf = new byte[8192];
            long downloaded = 0;
            int n;
            int lastProgress = -1;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
                downloaded += n;
                int pct = (int) (downloaded * 40 / totalBytes); // 0-40% for download
                if (pct != lastProgress) {
                    lastProgress = pct;
                    emitProgress("downloading", pct,
                        "Downloading... " + (downloaded / 1024) + "KB / " + (totalBytes / 1024) + "KB");
                }
            }
        }
        conn.disconnect();
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

        // Step 5: Install base packages via proot
        emitProgress("installing", 81, "Installing base packages (this may take a few minutes)...");
        String prootPath = GIATerminalService.resolveProotPath(ctx);
        String prootCmd = prootPath
            + " -r " + rootfsDir.getAbsolutePath()
            + " -0"
            + " -b /proc -b /sys -b /dev -b /dev/pts"
            + " -b /system -b /data -b /mnt -b /storage"
            + " -w /root"
            + " /usr/bin/env -i"
            + " TERM=xterm-256color HOME=/root"
            + " PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
            + " SHELL=/bin/sh"
            + " /bin/sh -c 'apk update && apk add --no-cache bash git curl wget python3 nodejs npm openssh build-base sudo vim jq ripgrep fd tree zip unzip 2>&1'";

        try {
            ProcessBuilder pb = new ProcessBuilder("sh", "-c", prootCmd);
            pb.redirectErrorStream(true);
            File prootTmpDir = new File(ctx.getCacheDir(), "proot-tmp");
            prootTmpDir.mkdirs();
            pb.environment().put("PROOT_NO_SECCOMP", "1");
            pb.environment().put("PROOT_TMP_DIR", prootTmpDir.getAbsolutePath());
            pb.environment().put("TMPDIR", prootTmpDir.getAbsolutePath());
            Process proc = pb.start();
            // Stream output as progress
            Thread outputThread = new Thread(() -> {
                try (InputStream procOut = proc.getInputStream()) {
                    byte[] buf = new byte[4096];
                    int n;
                    while ((n = procOut.read(buf)) != -1) {
                        String line = new String(buf, 0, n).trim();
                        if (!line.isEmpty()) {
                            emitProgress("installing", 85, "apk: " + line);
                        }
                    }
                } catch (IOException ignored) {}
            });
            outputThread.start();
            proc.waitFor();
            outputThread.join(5000);
            emitProgress("installing", 95, "Base packages installed");
        } catch (Exception e) {
            Log.w(TAG, "Package install step failed (non-fatal): " + e.getMessage());
            emitProgress("installing", 95, "Package install skipped — you can install packages manually");
        }

        // Step 6: Verify
        emitProgress("verifying", 96, "Verifying installation...");
        boolean ok = GIATerminalService.rootfsHasCriticalBinaries(rootfsDir);
        if (ok) {
            File marker = new File(rootfsDir, ".gia-rootfs-ok");
            marker.createNewFile();
            emitProgress("ready", 100, "Terminal installed and ready!");
            Log.i(TAG, "On-device rootfs setup complete");
        } else {
            emitProgress("error", 0, "Installation incomplete — critical binaries missing");
            throw new IOException("Rootfs extraction incomplete — /bin/sh or /usr/bin/env missing");
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
