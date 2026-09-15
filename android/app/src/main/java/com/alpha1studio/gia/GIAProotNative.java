package com.alpha1studio.gia;

import android.util.Log;

import java.io.File;

/**
 * Dead code — kept only as a record of an approach that was never finished.
 *
 * This class describes a genuine JNI bridge (System.loadLibrary + a native
 * proot_main() JNI export) that was never actually built: the file that
 * shipped as jniLibs/arm64-v8a/libproot.so was just the plain proot
 * *executable* renamed to .so, which is not a valid loadable JNI library and
 * has no such exported symbol — System.loadLibrary("proot") here would fail.
 * Nothing in the app calls execute()/prootMain(); GIATerminalService is the
 * real code path and never touches this class.
 *
 * The actual, working fix for the Android 10+ W^X problem this class was
 * trying to solve lives in GIATerminalService: libproot.so is still placed
 * in jniLibs (so nativeLibraryDir extraction makes it executable) but is
 * invoked as a normal subprocess via ProcessBuilder, not via JNI/dlopen —
 * see GIATerminalService.resolveProotPath()/resolveLoaderPath() and the
 * PROOT_LOADER/PROOT_LOADER_32 env vars in startSession() for how the guest
 * rootfs's own binaries (which do live in non-executable app storage) get to
 * run despite that.
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
            "-0", // fake root UID/GID -- see the identical comment in
                  // GIATerminalService.buildProotCommand(). Note: this file
                  // (GIAProotNative) is currently dead code -- nothing in
                  // the app calls execute()/prootMain(), and libproot.so
                  // isn't actually built/bundled (see the class doc comment
                  // above). PROOT_NO_SECCOMP can't be set here at all since
                  // there's no ProcessBuilder for an in-process JNI call;
                  // that would need setenv() added to the native C JNI
                  // wrapper itself, which doesn't exist in this repo.
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
