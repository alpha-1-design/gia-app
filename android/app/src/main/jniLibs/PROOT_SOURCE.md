# proot binaries in this directory

Source: https://github.com/green-green-avk/build-proot-android (packages/proot-android-aarch64.tar.gz)
Upstream: https://github.com/green-green-avk/proot — a fork of termux/proot with
Android-specific adaptations (unbundled relocatable loader, --link2symlink,
--bind-memfd, seccomp workarounds).

Why this fork and not upstream proot-me/proot: upstream's loader is embedded
in the single proot binary and gets extracted to a temp file at runtime to be
exec'd — but on Android 10+ (targetSdk 29+), the OS blocks execution of any
binary written to the app's own writable storage (W^X / SELinux app_data_file
policy), which is exactly the "execve(...): Permission denied" failure this
app was hitting on every guest command (env, sh, apk, ...).

This fork ships the loader as a *separate* file specifically so it can be
placed in the app's nativeLibraryDir (extracted from jniLibs/ at install time,
which Android always marks executable, install-verified, unaffected by W^X).
Once proot and its loader both run from there, the loader manually maps and
runs everything else in the guest rootfs without further execve()/mmap(PROT_EXEC)
of files in the non-executable app-private rootfs directory.

Files:
  libproot.so         -> root/bin/proot            (renamed so Android's APK
  libprootloader.so   -> root/libexec/proot/loader     packager extracts it to
  libprootloader32.so -> root/libexec/proot/loader32    nativeLibraryDir; none
                                                          of these are real JNI
                                                          libraries)

Same technique used in production by e.g. feelfreelinux/octo4a via
feelfreelinux/android-linux-bootstrap, which uses this exact proot build.
