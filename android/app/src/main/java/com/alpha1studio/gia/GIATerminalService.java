package com.alpha1studio.gia;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetManager;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.zip.GZIPInputStream;

/**
 * GIATerminalService - Android foreground service that manages proot + Alpine
 * terminal sessions. Handles extracting proot binary and Alpine minirootfs
 * from APK assets, managing process lifecycle, and I/O piping.
 */
public class GIATerminalService extends Service {

    private static final String TAG = "GIATerminal";
    private static final String CHANNEL_ID = "gia_terminal_channel";
    private static final int NOTIFICATION_ID = 1002;
    private static final String TERMINAL_DIR = "terminal";
    private static final String PROOT_BINARY = "proot";
    private static final String ALPINE_ARCHIVE = "alpine-minirootfs.tar.gz";
    private static final String UBUNTU_ARCHIVE = "ubuntu-rootfs.tar.gz";
    private static final String ROOTFS_DIR = "rootfs";

    /**
     * Active terminal sessions. Key = session ID (UUID), Value = session info.
     */
    private static final ConcurrentHashMap<String, TerminalSession> sessions = new ConcurrentHashMap<>();

    private boolean isExtracted = false;

    /**
     * Rootfs extraction gate. Sessions started before extraction finishes would
     * run proot against an empty/missing rootfs and fail with "'/usr/bin/env'
     * not found". exec() now blocks on this latch so the very first command on
     * a fresh install waits for the (few-second) extraction to complete.
     */
    private static final CountDownLatch extractionLatch = new CountDownLatch(1);
    private static volatile boolean extractionFailed = false;

    // -------------------------------------------------------------------------
    // Inner class representing a single terminal session
    // -------------------------------------------------------------------------
    public static class TerminalSession {
        public final String id;
        public final String command;
        public final long createdAt;
        public final Process process;
        public final PipedOutputStream stdinOut;

        private final PipedInputStream stdinIn;
        private final InputStream stdout;
        private final StringBuilder outputBuffer;
        private Thread readerThread;
        private volatile boolean done;

        TerminalSession(String id, String command, Process process,
                        PipedOutputStream stdinOut, PipedInputStream stdinIn,
                        InputStream stdout) {
            this.id = id;
            this.command = command;
            this.createdAt = System.currentTimeMillis();
            this.process = process;
            this.stdinOut = stdinOut;
            this.stdinIn = stdinIn;
            this.stdout = stdout;
            this.outputBuffer = new StringBuilder();
            this.done = false;

            // Start reader threads to drain stdout/stderr into the buffer
            this.readerThread = new Thread(() -> {
                try {
                    byte[] buf = new byte[4096];
                    int n;
                    while ((n = stdout.read(buf)) != -1) {
                        synchronized (outputBuffer) {
                            outputBuffer.append(new String(buf, 0, n));
                        }
                    }
                } catch (IOException ignored) {
                } finally {
                    synchronized (this) {
                        done = true;
                        notifyAll();
                    }
                }
            }, "term-stdout-" + id.substring(0, 8));
            readerThread.setDaemon(true);
            readerThread.start();
        }

        /**
         * Returns all output captured so far, then clears the buffer.
         */
        public String drainOutput() {
            synchronized (outputBuffer) {
                String out = outputBuffer.toString();
                outputBuffer.setLength(0);
                return out;
            }
        }

        /**
         * Blocks until the process finishes and returns the full output.
         */
        public String awaitOutput(long timeoutMs) throws InterruptedException {
            long deadline = System.currentTimeMillis() + timeoutMs;
            synchronized (this) {
                while (!done && System.currentTimeMillis() < deadline) {
                    wait(Math.max(1, deadline - System.currentTimeMillis()));
                }
            }
            return drainOutput();
        }

        /**
         * Blocks until the underlying process has actually been reaped, or the
         * grace window elapses.
         *
         * <p>Stream EOF (which flips {@code done}) and process reaping are not
         * the same event: the JVM's reaper thread can lag behind the child
         * closing its stdout by a few milliseconds. Calling
         * {@link Process#exitValue()} in that window throws
         * {@code IllegalThreadStateException("process hasn't exited")} — which
         * is exactly the failure users saw on every command. Using
         * {@link Process#waitFor(long, TimeUnit)} makes the race impossible.
         *
         * @return true if the process exited within the window
         */
        public boolean awaitExit(long timeoutMs) throws InterruptedException {
            if (!process.isAlive()) return true;
            return process.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
        }

        public boolean isRunning() {
            return process.isAlive();
        }

        public int exitCode() {
            try {
                return process.exitValue();
            } catch (IllegalThreadStateException e) {
                // Process not reaped yet (or still running) — treat as no exit code.
                return -1;
            }
        }

        void cleanup() {
            if (readerThread != null) {
                readerThread.interrupt();
                readerThread = null;
            }
            try { stdinIn.close(); } catch (IOException ignored) {}
            try { stdout.close(); } catch (IOException ignored) {}
            process.destroyForcibly();
        }
    }

    // -------------------------------------------------------------------------
    // Service lifecycle
    // -------------------------------------------------------------------------
    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        try {
            startForeground(NOTIFICATION_ID, buildNotification(0));
        } catch (Exception e) {
            // On API 34+, a specialUse foreground service without a declared
            // PROPERTY_SPECIAL_USE_FGS_SUBTYPE throws here and takes the whole
            // process down with it if unguarded. Log and stop cleanly instead
            // so a missing manifest property degrades to "terminal unavailable"
            // rather than crashing plugin registration for the whole app.
            Log.e(TAG, "startForeground failed in onCreate: " + e.getMessage(), e);
            stopSelf();
            return;
        }
        Log.i(TAG, "GIATerminalService created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Ensure terminal assets are extracted
        if (!isExtracted) {
            new Thread(() -> {
                try {
                    extractAssets();
                    isExtracted = true;
                    Log.i(TAG, "Terminal assets extracted successfully");
                } catch (Exception e) {
                    Log.e(TAG, "Failed to extract terminal assets", e);
                    extractionFailed = true;
                } finally {
                    extractionLatch.countDown();
                }
            }, "term-extract").start();
        } else {
            // Already extracted in this process — make sure nobody is still waiting.
            extractionLatch.countDown();
        }

        // Update notification with session count
        Notification notification = buildNotification(sessions.size());
        try {
            startForeground(NOTIFICATION_ID, notification);
        } catch (SecurityException e) {
            Log.e(TAG, "startForeground failed: " + e.getMessage());
            stopSelf();
            return START_NOT_STICKY;
        }

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        // Kill all active sessions
        for (Map.Entry<String, TerminalSession> entry : sessions.entrySet()) {
            try {
                entry.getValue().cleanup();
            } catch (Exception e) {
                Log.w(TAG, "Error cleaning up session " + entry.getKey(), e);
            }
        }
        sessions.clear();
        Log.i(TAG, "GIATerminalService destroyed");
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // -------------------------------------------------------------------------
    // Asset extraction (proot binary + Alpine minirootfs)
    // -------------------------------------------------------------------------
    void extractAssets() throws IOException {
        File terminalDir = getTerminalDir();
        if (!terminalDir.exists()) {
            terminalDir.mkdirs();
        }

        AssetManager am = getAssets();

        // Extract proot binary
        File prootFile = new File(terminalDir, PROOT_BINARY);
        if (!prootFile.exists()) {
            try (InputStream in = am.open("terminal/" + PROOT_BINARY);
                 FileOutputStream out = new FileOutputStream(prootFile)) {
                copyStream(in, out);
            }
            prootFile.setExecutable(true, false);
            prootFile.setWritable(false);
            Log.i(TAG, "Extracted proot binary to " + prootFile.getAbsolutePath());
        }

        // Extract and unpack rootfs archive — prefer Ubuntu (preinstalled stack),
        // fall back to Alpine minirootfs when Ubuntu isn't bundled.
        File rootfsDir = new File(terminalDir, ROOTFS_DIR);
        File marker = new File(rootfsDir, ".gia-rootfs-ok");

        // The marker alone is not proof of a usable rootfs: older builds wrote it
        // after extracting bin/etc dirs even when every busybox symlink
        // (/bin/sh, /usr/bin/env) silently failed to materialize. Re-extract
        // whenever the critical first-executable is missing.
        boolean markerValid = marker.exists() && rootfsHasCriticalBinaries(rootfsDir);
        if (!markerValid) {
            if (rootfsDir.exists()) {
                // Previous extraction was partial/failed — retry clean
                deleteRecursive(rootfsDir);
            }
            rootfsDir.mkdirs();

            String archiveName = null;
            String distroLabel = null;
            if (assetExists(am, "terminal/" + UBUNTU_ARCHIVE)) {
                archiveName = UBUNTU_ARCHIVE;
                distroLabel = "Ubuntu";
            } else if (assetExists(am, "terminal/" + ALPINE_ARCHIVE)) {
                archiveName = ALPINE_ARCHIVE;
                distroLabel = "Alpine";
            }

            if (archiveName != null) {
                File archive = new File(terminalDir, archiveName);
                try (InputStream in = am.open("terminal/" + archiveName);
                     FileOutputStream out = new FileOutputStream(archive)) {
                    copyStream(in, out);
                }
                Log.i(TAG, "Extracted " + distroLabel + " archive to " + archive.getAbsolutePath());

                // Extract tar.gz into rootfs
                List<String[]> failedSymlinks = new ArrayList<>();
                untar(archive, rootfsDir, failedSymlinks);
                archive.delete();

                // Alpine minirootfs ships nearly every binary as a busybox
                // symlink. Android routinely blocks symlink creation in app
                // data, so materialize any link we could not create as a real
                // copy of busybox — otherwise /bin/sh and /usr/bin/env are
                // missing and proot dies with "'/usr/bin/env' not found".
                materializeSymlinks(rootfsDir, failedSymlinks);

                // Hardening: executable bits the tar may not have survived
                // with, a HOME dir, and DNS so apk/ping work out of the box.
                File busybox = new File(rootfsDir, "bin/busybox");
                if (busybox.exists()) {
                    busybox.setExecutable(true, false);
                }
                File homeDir = new File(rootfsDir, "root");
                if (!homeDir.exists()) {
                    homeDir.mkdirs();
                }
                File resolv = new File(rootfsDir, "etc/resolv.conf");
                if (!resolv.exists()) {
                    resolv.getParentFile().mkdirs();
                    try (FileOutputStream out = new FileOutputStream(resolv)) {
                        out.write("nameserver 8.8.8.8\nnameserver 1.1.1.1\n".getBytes());
                    }
                }

                // Sentinel so a partial/failed extraction is retried next launch
                if (rootfsHasCriticalBinaries(rootfsDir)) {
                    marker.createNewFile();
                    Log.i(TAG, "Unpacked " + distroLabel + " rootfs to " + rootfsDir.getAbsolutePath());
                } else {
                    throw new IOException(distroLabel + " rootfs extraction incomplete — /bin/sh or /usr/bin/env missing");
                }
            } else {
                throw new IOException("No rootfs archive found in assets (expected terminal/ubuntu-rootfs.tar.gz or terminal/alpine-minirootfs.tar.gz)");
            }
        }
    }

    /**
     * True when the rootfs actually contains the binaries proot needs to boot
     * the guest: /bin/busybox (the real binary) plus /bin/sh and /usr/bin/env
     * (busybox applet links that extraction must materialize).
     */
    static boolean rootfsHasCriticalBinaries(File rootfsDir) {
        File busybox = new File(rootfsDir, "bin/busybox");
        File sh = new File(rootfsDir, "bin/sh");
        File env = new File(rootfsDir, "usr/bin/env");
        return busybox.exists() && sh.exists() && env.exists();
    }

    /**
     * Replace every symlink entry that failed to materialize with a real file:
     * copy the busybox binary for applet paths (bin/, sbin/, usr/bin/,
     * usr/sbin/), or mkdir for anything that looks like a directory link.
     */
    static void materializeSymlinks(File rootfsDir, List<String[]> failedSymlinks) throws IOException {
        if (failedSymlinks.isEmpty()) return;
        File busybox = new File(rootfsDir, "bin/busybox");
        for (String[] entry : failedSymlinks) {
            File link = new File(rootfsDir, entry[0]);
            if (link.exists()) continue; // created successfully after all
            link.getParentFile().mkdirs();
            if (busybox.exists() && isAppletPath(entry[0])) {
                copyFile(busybox, link);
                link.setExecutable(true, false);
            } else {
                link.mkdirs();
            }
        }
    }

    private static boolean isAppletPath(String name) {
        // Tar entries are usually stored as "./bin/sh" — strip the leading
        // "./" before matching applet directories.
        String n = name != null && name.startsWith("./") ? name.substring(2) : name;
        return n.startsWith("bin/") || n.startsWith("sbin/")
                || n.startsWith("usr/bin/") || n.startsWith("usr/sbin/");
    }

    private static boolean assetExists(AssetManager am, String path) {
        try {
            am.open(path).close();
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    static void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        File[] children = f.listFiles();
        if (children != null) {
            for (File c : children) deleteRecursive(c);
        }
        f.delete();
    }

    /**
     * Returns the app-private terminal directory.
     */
    public File getTerminalDir() {
        return new File(getFilesDir(), TERMINAL_DIR);
    }

    /**
     * Returns the rootfs directory.
     */
    public File getRootfsDir() {
        return new File(getTerminalDir(), ROOTFS_DIR);
    }

    /**
     * Returns the proot binary path.
     */
    public String getProotPath() {
        return new File(getTerminalDir(), PROOT_BINARY).getAbsolutePath();
    }

    /**
     * Force-delete the rootfs and re-extract from assets.
     * 
     * This breaks the chicken-and-egg where a broken rootfs prevents
     * provisioning but provisioning needs a working terminal. Called from
     * GIATerminalPlugin.reinstallRootfs().
     *
     * @return true if re-extraction succeeded and rootfs has critical binaries
     */
    public static synchronized boolean forceReextractRootfs(Context context) {
        try {
            File terminalDir = new File(context.getFilesDir(), TERMINAL_DIR);
            File rootfsDir = new File(terminalDir, ROOTFS_DIR);
            File marker = new File(rootfsDir, ".gia-rootfs-ok");

            // Delete marker and rootfs
            if (marker.exists()) marker.delete();
            if (rootfsDir.exists()) {
                deleteRecursive(rootfsDir);
            }
            rootfsDir.mkdirs();
            Log.i(TAG, "Rootfs cleared — re-extracting from assets");

            // Extract assets (same logic as extractAssets but for rootfs only)
            AssetManager am = context.getAssets();
            String archiveName = null;
            String distroLabel = null;
            if (assetExists(am, "terminal/" + UBUNTU_ARCHIVE)) {
                archiveName = UBUNTU_ARCHIVE;
                distroLabel = "Ubuntu";
            } else if (assetExists(am, "terminal/" + ALPINE_ARCHIVE)) {
                archiveName = ALPINE_ARCHIVE;
                distroLabel = "Alpine";
            }

            if (archiveName == null) {
                Log.e(TAG, "No rootfs archive found in assets");
                return false;
            }

            File archive = new File(terminalDir, archiveName);
            try (InputStream in = am.open("terminal/" + archiveName);
                 FileOutputStream out = new FileOutputStream(archive)) {
                copyStream(in, out);
            }

            List<String[]> failedSymlinks = new ArrayList<>();
            untar(archive, rootfsDir, failedSymlinks);
            archive.delete();

            materializeSymlinks(rootfsDir, failedSymlinks);

            // Harden
            File busybox = new File(rootfsDir, "bin/busybox");
            if (busybox.exists()) busybox.setExecutable(true, false);
            File homeDir = new File(rootfsDir, "root");
            if (!homeDir.exists()) homeDir.mkdirs();
            File resolv = new File(rootfsDir, "etc/resolv.conf");
            if (!resolv.exists()) {
                resolv.getParentFile().mkdirs();
                try (FileOutputStream out = new FileOutputStream(resolv)) {
                    out.write("nameserver 8.8.8.8\nnameserver 1.1.1.1\n".getBytes());
                }
            }

            boolean ok = rootfsHasCriticalBinaries(rootfsDir);
            if (ok) {
                marker.createNewFile();
                Log.i(TAG, "Re-extraction succeeded — " + distroLabel + " rootfs ready");
            } else {
                Log.e(TAG, "Re-extraction incomplete — critical binaries missing");
            }
            return ok;
        } catch (Exception e) {
            Log.e(TAG, "forceReextractRootfs failed", e);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // Session management
    // -------------------------------------------------------------------------

    /**
     * Resolve the proot binary path, trying native library directory first
     * (avoids Android 10+ W^X policy on app-private directories), then falling
     * back to asset extraction.
     */
    static String resolveProotPath(Context context) {
        // Native library directory is always executable on all Android versions
        String nativeLibPath = context.getApplicationInfo().nativeLibraryDir
                + File.separator + "libproot.so";
        File nativeProot = new File(nativeLibPath);
        if (nativeProot.exists() && nativeProot.canRead()) {
            Log.i(TAG, "Using proot from native lib dir: " + nativeLibPath);
            return nativeLibPath;
        }

        // Fall back: extracted from assets to app-private files/terminal/
        return new File(new File(context.getFilesDir(), TERMINAL_DIR), PROOT_BINARY).getAbsolutePath();
    }

    /**
     * Start a new terminal session running the given command inside proot+Alpine.
     *
     * @param sessionId Unique session identifier
     * @param command   Shell command(s) to execute
     * @return The TerminalSession, or throws if startup fails
     */
    public static TerminalSession startSession(Context context, String sessionId, String command)
            throws IOException {

        GIATerminalService service = null;
        if (context instanceof GIATerminalService) {
            service = (GIATerminalService) context;
        }

        // Never run proot against an empty/missing rootfs: block until the
        // (few-second) first-run extraction finishes, and fail with a clear
        // message instead of proot's cryptic "'/usr/bin/env' not found".
        try {
            if (!extractionLatch.await(60, TimeUnit.SECONDS)) {
                throw new IOException("Terminal rootfs extraction timed out — try again in a few seconds.");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Interrupted while waiting for terminal rootfs extraction", e);
        }
        if (extractionFailed) {
            throw new IOException("Terminal rootfs failed to extract — check the terminal setup in Settings and tap Set Up Environment.");
        }
        File rootfsDir = new File(new File(context.getFilesDir(), TERMINAL_DIR), ROOTFS_DIR);
        if (!rootfsHasCriticalBinaries(rootfsDir)) {
            throw new IOException("Terminal rootfs is missing critical binaries (/bin/sh, /usr/bin/env). Restart the app to re-extract, or tap Set Up Environment.");
        }

        String prootPath = resolveProotPath(context);
        String rootfsPath = new File(new File(context.getFilesDir(), TERMINAL_DIR), ROOTFS_DIR).getAbsolutePath();

        // Build proot command: run Alpine's /bin/sh -c "<command>"
        String prootCmd = buildProotCommand(prootPath, rootfsPath, command);

        // Setup I/O pipes — PipedOutputStream connects TO PipedInputStream
        PipedInputStream stdinIn = new PipedInputStream();
        PipedOutputStream stdinOut = new PipedOutputStream(stdinIn);
        // We'll capture stdout+stderr merged; use ProcessBuilder redirectErrorStream(true)
        ProcessBuilder pb = new ProcessBuilder();
        pb.command("sh", "-c", prootCmd);
        pb.directory(new File(rootfsPath));
        pb.redirectErrorStream(true);
        pb.environment().put("TERM", "xterm-256color");
        pb.environment().put("HOME", "/root");
        pb.environment().put("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
        pb.environment().put("SHELL", "/bin/sh");
        // proot needs a writable scratch directory to build its "glue" rootfs.
        // Android apps have no /tmp, and without this proot fails immediately
        // with "can't create temporary directory" before it ever gets to the
        // guest rootfs — which is also what was producing the downstream
        // "can't chdir /root/." and "/usr/bin/env not found" errors, since
        // proot's own initialization never completed.
        File prootTmpDir = new File(context.getCacheDir(), "proot-tmp");
        if (!prootTmpDir.exists()) {
            prootTmpDir.mkdirs();
        }
        pb.environment().put("PROOT_TMP_DIR", prootTmpDir.getAbsolutePath());
        pb.environment().put("TMPDIR", prootTmpDir.getAbsolutePath());
        // PROOT_NO_SECCOMP=1 is read by proot itself at startup (this must be
        // in the HOST process's env, not the "env -i ..." guest env inside
        // buildProotCommand -- that only reaches the guest shell after proot
        // has already initialized). Without it, proot's ptrace-based syscall
        // interception crashes or silently misbehaves on many Android
        // kernels' seccomp-bpf filters -- this is *the* most common
        // documented failure mode for proot on Android (same fix Termux
        // ships). Trivial commands like "echo ok" tend to survive fine,
        // which is exactly why this went unnoticed: isExecutable()'s probe
        // passes, but real work like "apk update && apk add ..." -- which
        // exercises far more syscalls -- fails or hangs partway through.
        // This is almost certainly why "Set Up Environment" never worked.
        pb.environment().put("PROOT_NO_SECCOMP", "1");

        Process process;
        try {
            process = pb.start();
        } catch (IOException e) {
            String msg = e.getMessage();
            if (msg != null && (msg.contains("error=13") || msg.contains("Permission denied") || msg.contains("EACCES"))) {
                // If native lib path failed, that's unexpected (it should always be executable)
                boolean fromNativeLib = prootPath.contains("libproot.so");
                if (fromNativeLib) {
                    // Fall back to asset extraction
                    Log.w(TAG, "Native lib path blocked by W^X, falling back to asset extraction");
                    File terminalDir = new File(context.getFilesDir(), TERMINAL_DIR);
                    File terminalProot = new File(terminalDir, PROOT_BINARY);
                    String fallbackRootfs = new File(terminalDir, ROOTFS_DIR).getAbsolutePath();
                    if (!terminalProot.exists()) {
                        throw new IOException(
                            "Cannot execute proot from native lib dir (W^X) and asset extraction " +
                            "not yet complete. Try again in a few seconds.",
                            e
                        );
                    }
                    prootCmd = buildProotCommand(terminalProot.getAbsolutePath(), fallbackRootfs, command);
                    pb.command("sh", "-c", prootCmd);
                    try {
                        process = pb.start();
                        Log.i(TAG, "Asset extraction fallback succeeded");
                    } catch (IOException e2) {
                        throw new IOException(
                            "Cannot execute proot from any location. " +
                            "Android W^X policy blocks binaries in app data directory. " +
                            "Fix: compile proot as libproot.so and use GIAProotNative JNI bridge.",
                            e2
                        );
                    }
                } else {
                    throw new IOException(
                        "Cannot execute proot: Android W^X policy blocks binaries in app data directory. " +
                        "Fix: compile proot as libproot.so and use GIAProotNative JNI bridge.",
                        e
                    );
                }
            } else {
                throw e;
            }
        }

        // Wire stdin to process
        OutputStream procStdin = process.getOutputStream();
        Thread stdinWriter = new Thread(() -> {
            try {
                byte[] buf = new byte[4096];
                int n;
                while ((n = stdinIn.read(buf)) != -1) {
                    procStdin.write(buf, 0, n);
                    procStdin.flush();
                }
            } catch (IOException ignored) {
            } finally {
                try { procStdin.close(); } catch (IOException ignored) {}
            }
        }, "term-stdin-" + sessionId.substring(0, 8));
        stdinWriter.setDaemon(true);
        stdinWriter.start();

        TerminalSession session = new TerminalSession(
                sessionId, command, process,
                stdinOut, stdinIn,
                process.getInputStream());

        sessions.put(sessionId, session);
        return session;
    }

    /**
     * Write data to a session's stdin.
     */
    public static void writeStdin(String sessionId, String data) throws IOException {
        TerminalSession session = sessions.get(sessionId);
        if (session == null) {
            throw new IOException("Session not found: " + sessionId);
        }
        session.stdinOut.write(data.getBytes());
        session.stdinOut.flush();
    }

    /**
     * Kill a terminal session.
     */
    public static void killSession(String sessionId) {
        TerminalSession session = sessions.remove(sessionId);
        if (session != null) {
            session.cleanup();
        }
    }

    /**
     * List all active sessions.
     */
    public static List<Map<String, Object>> listSessions() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, TerminalSession> entry : sessions.entrySet()) {
            TerminalSession s = entry.getValue();
            Map<String, Object> info = new HashMap<>();
            info.put("sessionId", s.id);
            info.put("command", s.command);
            info.put("createdAt", s.createdAt);
            info.put("running", s.isRunning());
            result.add(info);
        }
        return result;
    }

    /**
     * Get the number of active sessions.
     */
    public static int getSessionCount() {
        return sessions.size();
    }

    /**
     * Get a session by ID.
     */
    public static TerminalSession getSession(String sessionId) {
        return sessions.get(sessionId);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private static String buildProotCommand(String prootPath, String rootfsPath, String command) {
        return prootPath
                + " -r " + rootfsPath
                + " -0" // fake root UID/GID (0/0). Without this, the guest
                        // shell shows "root@..." in its own prompt string
                        // (that's just HOME=/root + a hardcoded banner) but
                        // is NOT actually running as UID 0 inside the
                        // sandbox -- it's still the app's real unprivileged
                        // Android UID. apk's package installs do real
                        // chown/chmod-to-root operations while unpacking
                        // packages; those silently fail (or apk aborts) 
                        // without proot's fake-root UID mapping, regardless
                        // of PROOT_NO_SECCOMP. This is very likely the other
                        // half of why "Set Up Environment" never worked.
                + " -b /proc"
                + " -b /sys"
                + " -b /dev"
                + " -b /dev/pts"
                + " -b /system"
                + " -b /data"
                + " -b /mnt"
                + " -b /storage"
                + " -b /proc/self/fd:/dev/fd"
                + " -w /root"
                + " /usr/bin/env -i"
                + " TERM=xterm-256color"
                + " HOME=/root"
                + " PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
                + " SHELL=/bin/sh"
                + " /bin/sh -c '" + command.replace("'", "'\\''") + "'";
    }

    private static void copyStream(InputStream in, OutputStream out) throws IOException {
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) {
            out.write(buf, 0, n);
        }
        out.flush();
    }

    static void untar(File archive, File destDir, List<String[]> failedSymlinks) throws IOException {
        // We handle .tar.gz: decompress gzip then untar
        try (InputStream fis = new FileInputStream(archive);
             InputStream gzIn = new GZIPInputStream(fis)) {
            extractTar(gzIn, destDir, failedSymlinks);
        }
    }

    private static void extractTar(InputStream in, File destDir, List<String[]> failedSymlinks) throws IOException {
        // Read tar format entries
        byte[] buf = new byte[8192];
        // Tar format: each entry is 512-byte header + data blocks
        byte[] header = new byte[512];
        String pendingLongName = null;
        while (true) {
            int read = in.read(header);
            if (read < 512) break;
            if (header[0] == 0) break; // end of archive

            // Parse file name (first 100 bytes, null-terminated)
            int nameEnd = 0;
            while (nameEnd < 100 && header[nameEnd] != 0) nameEnd++;
            if (nameEnd == 0) break;
            String name = new String(header, 0, nameEnd, "UTF-8");

            // Parse size (bytes 124-135 as octal)
            long size = 0;
            for (int i = 124; i < 136 && i < header.length && header[i] != 0 && header[i] != ' '; i++) {
                size = size * 8 + (header[i] - '0');
            }

            // Determine file type (byte 156)
            int fileType = header[156] & 0xff;

            // GNU long name entry (././@LongLink): read the real name from payload
            if (name.equals("././@LongLink") && (fileType == 'L' || fileType == 'K')) {
                byte[] nameBuf = new byte[(int) size];
                int got = 0;
                while (got < size) {
                    int n = in.read(nameBuf, got, (int) size - got);
                    if (n == -1) break;
                    got += n;
                }
                pendingLongName = new String(nameBuf, 0, got, "UTF-8").trim();
                skipPadding(in, size);
                continue;
            }

            // PAX extended header (x/g): parse key=value pairs, skip the payload
            if (fileType == 'x' || fileType == 'g') {
                byte[] paxBuf = new byte[(int) size];
                int got = 0;
                while (got < size) {
                    int n = in.read(paxBuf, got, (int) size - got);
                    if (n == -1) break;
                    got += n;
                }
                String pax = new String(paxBuf, 0, got, "UTF-8");
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("path=(.*)").matcher(pax);
                if (m.find()) {
                    String paxPath = m.group(1).replaceAll("\\s+$", "").trim();
                    if (!paxPath.isEmpty()) pendingLongName = paxPath;
                }
                skipPadding(in, size);
                continue;
            }

            if (pendingLongName != null) {
                name = pendingLongName;
                pendingLongName = null;
            }

            File entryFile = new File(destDir, name);

            // Security: prevent tar path traversal
            String canonicalDest = destDir.getCanonicalPath();
            String canonicalEntry = entryFile.getCanonicalPath();
            if (!canonicalEntry.startsWith(canonicalDest + File.separator)
                    && !canonicalEntry.equals(canonicalDest)) {
                throw new IOException("Tar entry escapes destination: " + name);
            }

            if (fileType == '5') {
                // Directory
                entryFile.mkdirs();
            } else if (fileType == '2') {
                // Symlink. Android commonly refuses to create symlinks in app
                // data (Operation not permitted), and silently skipping them
                // leaves /bin/sh, /usr/bin/env etc. missing — which is exactly
                // proot's "'/usr/bin/env' not found" fatal error. Best effort:
                // create the link, and when that fails materialize it as a
                // content copy (targets are usually busybox, already extracted)
                // or record it for the post-extraction pass.
                int linkEnd = 0;
                while (linkEnd < 100 && header[157 + linkEnd] != 0) linkEnd++;
                String linkTarget = new String(header, 157, linkEnd, "UTF-8");
                if (linkEnd > 0) {
                    entryFile.getParentFile().mkdirs();
                    boolean materialized = false;
                    // Resolve the target inside the extracted rootfs so far.
                    String targetRel = linkTarget.startsWith("/")
                            ? linkTarget.substring(1)
                            : linkTarget;
                    File targetFile = new File(destDir, targetRel);
                    if (targetFile.exists()) {
                        if (targetFile.isDirectory()) {
                            entryFile.mkdirs();
                            materialized = true;
                        } else {
                            // Copy target content (e.g. busybox) as a regular
                            // file, preserving executable-ness.
                            copyFile(targetFile, entryFile);
                            if (targetFile.canExecute() || isAppletPath(name)) {
                                entryFile.setExecutable(true, false);
                            }
                            materialized = true;
                        }
                    }
                    if (!materialized) {
                        try {
                            entryFile.delete();
                            Files.createSymbolicLink(
                                    entryFile.toPath(), new File(linkTarget).toPath());
                        } catch (Exception e) {
                            Log.w(TAG, "Symlink " + name + " -> " + linkTarget + " blocked (" + e.getMessage() + ") — will materialize");
                            failedSymlinks.add(new String[]{ name, linkTarget });
                        }
                    }
                }
            } else {
                // Regular file (or device/special — written as empty file)
                entryFile.getParentFile().mkdirs();
                try (FileOutputStream fout = new FileOutputStream(entryFile)) {
                    long remaining = size;
                    while (remaining > 0) {
                        int toRead = (int) Math.min(buf.length, remaining);
                        int n = in.read(buf, 0, toRead);
                        if (n == -1) break;
                        fout.write(buf, 0, n);
                        remaining -= n;
                    }
                }
                entryFile.setLastModified(
                        parseTarTimestamp(header, 136) * 1000L);
                // Tar stores the mode as octal in bytes 100-107. Without it,
                // executables (busybox!) come out non-executable and proot
                // reports "Permission denied" on every command.
                long mode = parseOctal(header, 100);
                if (mode > 0) {
                    entryFile.setExecutable((mode & 0111) != 0, false);
                    entryFile.setWritable((mode & 0222) != 0, false);
                    entryFile.setReadable((mode & 0444) != 0, false);
                }
            }

            // Skip padding to next 512-byte boundary
            skipPadding(in, size);
        }
    }

    private static long parseOctal(byte[] header, int offset) {
        long value = 0;
        for (int i = offset; i < offset + 8 && i < header.length && header[i] != 0 && header[i] != ' '; i++) {
            char c = (char) header[i];
            if (c < '0' || c > '7') break;
            value = value * 8 + (c - '0');
        }
        return value;
    }

    static void copyFile(File src, File dst) throws IOException {
        try (InputStream in = new FileInputStream(src);
             OutputStream out = new FileOutputStream(dst)) {
            copyStream(in, out);
        }
    }

    private static void skipPadding(InputStream in, long size) throws IOException {
        long padding = (512 - (size % 512)) % 512;
        long remaining = padding;
        while (remaining > 0) {
            long skipped = in.skip(Math.min(remaining, 8192));
            remaining -= skipped;
        }
    }

    private static long parseTarTimestamp(byte[] header, int offset) {
        long ts = 0;
        for (int i = offset; i < offset + 12 && i < header.length && header[i] != 0 && header[i] != ' '; i++) {
            ts = ts * 8 + (header[i] - '0');
        }
        return ts;
    }

    // -------------------------------------------------------------------------
    // Notification
    // -------------------------------------------------------------------------
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Terminal Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Terminal active");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(int sessionCount) {
        String text;
        if (sessionCount > 0) {
            text = sessionCount + " session" + (sessionCount != 1 ? "s" : "") + " active";
        } else {
            text = "Terminal active";
        }

        // Create a PendingIntent that opens the main activity (placeholder)
        Intent notificationIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("GIA Terminal")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_manage)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .build();
    }

    /**
     * Get filesystem info for the terminal directory.
     */
    public static Map<String, Object> getFSInfo(Context context) {
        Map<String, Object> info = new HashMap<>();
        try {
            GIATerminalService service = null;
            if (context instanceof GIATerminalService) {
                service = (GIATerminalService) context;
            }
            File terminalDir;
            if (service != null) {
                terminalDir = service.getTerminalDir();
            } else {
                terminalDir = new File(context.getFilesDir(), TERMINAL_DIR);
            }

            if (terminalDir.exists()) {
                java.io.File filesDir = context.getFilesDir();
                long totalBytes = filesDir.getTotalSpace();
                long freeBytes = filesDir.getFreeSpace();
                long usedBytes = totalBytes - freeBytes;
                info.put("totalBytes", totalBytes);
                info.put("freeBytes", freeBytes);
                info.put("usedBytes", usedBytes);
            } else {
                info.put("totalBytes", 0L);
                info.put("freeBytes", 0L);
                info.put("usedBytes", 0L);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting FS info", e);
            info.put("totalBytes", 0L);
            info.put("freeBytes", 0L);
            info.put("usedBytes", 0L);
        }
        return info;
    }
}
