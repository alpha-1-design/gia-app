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
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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
    private static final String ROOTFS_DIR = "rootfs";

    /**
     * Active terminal sessions. Key = session ID (UUID), Value = session info.
     */
    private static final ConcurrentHashMap<String, TerminalSession> sessions = new ConcurrentHashMap<>();

    private boolean isExtracted = false;

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

        public boolean isRunning() {
            return process.isAlive();
        }

        public int exitCode() {
            return done ? process.exitValue() : -1;
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
        startForeground(NOTIFICATION_ID, buildNotification(0));
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
                } catch (IOException e) {
                    Log.e(TAG, "Failed to extract terminal assets", e);
                }
            }, "term-extract").start();
        }

        // Update notification with session count
        Notification notification = buildNotification(sessions.size());
        startForeground(NOTIFICATION_ID, notification);

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
    private void extractAssets() throws IOException {
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
            prootFile.setExecutable(true);
            Log.i(TAG, "Extracted proot binary to " + prootFile.getAbsolutePath());
        }

        // Extract and unpack Alpine minirootfs
        File rootfsDir = new File(terminalDir, ROOTFS_DIR);
        if (!rootfsDir.exists()) {
            rootfsDir.mkdirs();
            File archive = new File(terminalDir, ALPINE_ARCHIVE);
            try (InputStream in = am.open("terminal/" + ALPINE_ARCHIVE);
                 FileOutputStream out = new FileOutputStream(archive)) {
                copyStream(in, out);
            }
            Log.i(TAG, "Extracted Alpine archive to " + archive.getAbsolutePath());

            // Extract tar.gz into rootfs
            untar(archive, rootfsDir);
            archive.delete();
            Log.i(TAG, "Unpacked Alpine rootfs to " + rootfsDir.getAbsolutePath());
        }
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

    // -------------------------------------------------------------------------
    // Session management
    // -------------------------------------------------------------------------

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

        // Build proot command: run Alpine's /bin/sh -c "<command>"
        String prootCmd = buildProotCommand(context, command);

        // Setup I/O pipes — PipedOutputStream connects TO PipedInputStream
        PipedInputStream stdinIn = new PipedInputStream();
        PipedOutputStream stdinOut = new PipedOutputStream(stdinIn);
        // We'll capture stdout+stderr merged; use ProcessBuilder redirectErrorStream(true)
        ProcessBuilder pb = new ProcessBuilder();
        pb.command("sh", "-c", prootCmd);
        pb.redirectErrorStream(true);
        pb.environment().put("TERM", "xterm-256color");
        pb.environment().put("HOME", "/root");
        pb.environment().put("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
        pb.environment().put("SHELL", "/bin/sh");

        Process process = pb.start();

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

    private static String buildProotCommand(Context context, String command) {
        File terminalDir = new File(context.getFilesDir(), TERMINAL_DIR);
        String prootPath = new File(terminalDir, PROOT_BINARY).getAbsolutePath();
        String rootfsPath = new File(terminalDir, ROOTFS_DIR).getAbsolutePath();

        return prootPath
                + " -r " + rootfsPath
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

    private static void untar(File archive, File destDir) throws IOException {
        // We handle .tar.gz: decompress gzip then untar
        try (InputStream fis = new FileInputStream(archive);
             InputStream gzIn = new GZIPInputStream(fis)) {
            // Simple tar extraction
            byte[] buf = new byte[8192];
            java.io.SequenceInputStream sis = new java.io.SequenceInputStream(
                    gzIn, new java.io.SequenceInputStream(
                            new java.io.ByteArrayInputStream(new byte[0]),
                            new java.io.ByteArrayInputStream(new byte[0])
                    )
            );
            // Actually do proper tar extraction
            extractTar(gzIn, destDir);
        }
    }

    private static void extractTar(InputStream in, File destDir) throws IOException {
        // Read tar format entries
        byte[] buf = new byte[8192];
        // Tar format: each entry is 512-byte header + data blocks
        byte[] header = new byte[512];
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
            } else if (fileType == '2' || fileType == 'L') {
                // Symlink or long name — skip for simplicity
                // Actually handle long name: GNU tar uses '././@LongLink'
                if (name.equals("././@LongLink")) {
                    // Read the long name
                    byte[] nameBuf = new byte[(int) size];
                    in.read(nameBuf, 0, (int) size);
                    // The next header is the actual file
                    // Skip padding
                    long padding = (512 - (size % 512)) % 512;
                    in.skip(padding);
                    continue;
                }
                // Skip symlinks
                if (size > 0) {
                    long remaining = size;
                    while (remaining > 0) {
                        long skipped = in.skip(Math.min(remaining, 8192));
                        remaining -= skipped;
                    }
                }
            } else {
                // Regular file
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
            }

            // Skip padding to next 512-byte boundary
            long padding = (512 - (size % 512)) % 512;
            long remaining = padding;
            while (remaining > 0) {
                long skipped = in.skip(Math.min(remaining, 8192));
                remaining -= skipped;
            }
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
