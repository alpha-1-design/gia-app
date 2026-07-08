package com.alpha1studio.gia;

import android.util.Log;

import java.io.File;

/**
 * JNI bridge to libproot.so — proot compiled as a shared native library.
 *
 * On Android 10+ (API 29+), SELinux W^X policy blocks execution of binaries
 * in app-private data directories (/data/data/.../files/). The traditional
 * proot binary extracted from assets cannot be started via ProcessBuilder.
 *
 * Fix: compile proot as a shared library (libproot.so) using the Android NDK,
 * package it in jniLibs/arm64-v8a/, and load it here via System.loadLibrary().
 * The JNI function proot_main() wraps proot's main() entry point so it can be
 * called from Java without an execve() syscall.
 *
 * Build instructions:
 *   1. Clone https://github.com/proot-me/proot
 *   2. Add JNI wrapper (proot_jni.c) that calls proot's main() with argv
 *   3. Compile with: ndk-build APP_ABI=arm64-v8a APP_PLATFORM=android-24
 *   4. Copy libs/arm64-v8a/libproot.so to android/app/src/main/jniLibs/arm64-v8a/
 */
public class GIAProotNative {

    private static final String TAG = "GIAProotNative";
    private static boolean libraryLoaded = false;

    static {
        try {
            System.loadLibrary("proot");
            libraryLoaded = true;
            Log.i(TAG, "libproot.so loaded successfully");
        } catch (UnsatisfiedLinkError e) {
            Log.w(TAG, "libproot.so not available: " + e.getMessage());
            libraryLoaded = false;
        }
    }

    /**
     * JNI wrapper for proot's main() — executes proot with the given argv.
     *
     * @param argv Null-terminated argument array (argv[0] = "proot", ...)
     * @return Exit code from proot's main()
     */
    public static native int prootMain(String[] argv);

    /**
     * Returns whether libproot.so was successfully loaded.
     */
    public static boolean isAvailable() {
        return libraryLoaded;
    }

    /**
     * Resolve the proot binary path, trying native library directory first,
     * then falling back to asset extraction path. Mirrors the logic in
     * GIATerminalService.resolveProotPath() but can be called without a Context
     * if libraryLoaded is true (the JNI path).
     *
     * @param context Android context for fallback file resolution
     * @return Absolute path to the proot binary, or "libproot.so" if JNI-loaded
     */
    public static String resolveProotPath(android.content.Context context) {
        if (libraryLoaded) {
            return "libproot.so";
        }
        // Fall back to extracted proot binary from assets
        return new File(new File(context.getFilesDir(), "terminal"), "proot")
                .getAbsolutePath();
    }

    /**
     * Execute a command inside the proot+Alpine sandbox via the JNI bridge.
     *
     * @param rootfsPath Absolute path to the Alpine rootfs directory
     * @param workdir    Working directory inside the sandbox
     * @param command    Shell command to execute
     * @return Exit code from the proot process
     */
    public static int execute(String rootfsPath, String workdir, String command) {
        if (!libraryLoaded) {
            Log.e(TAG, "libproot.so not loaded — cannot execute command");
            return -1;
        }

        String[] argv = {
            "proot",
            "-r", rootfsPath,
            "-b", "/proc",
            "-b", "/sys",
            "-b", "/dev",
            "-b", "/dev/pts",
            "-b", "/system",
            "-b", "/data",
            "-b", "/mnt",
            "-b", "/storage",
            "-b", "/proc/self/fd:/dev/fd",
            "-w", workdir != null ? workdir : "/root",
            "/usr/bin/env", "-i",
            "TERM=xterm-256color",
            "HOME=/root",
            "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "SHELL=/bin/sh",
            "/bin/sh", "-c", command
        };

        try {
            return prootMain(argv);
        } catch (Exception e) {
            Log.e(TAG, "prootMain failed: " + e.getMessage());
            return -1;
        }
    }
}
