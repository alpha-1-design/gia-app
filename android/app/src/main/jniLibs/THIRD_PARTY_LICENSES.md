# Third-party binaries in this directory

## PRoot (Termux fork)

- **Files:** `libproot.so`, `libproot-loader.so`, `libproot-loader32.so`
- **Source:** https://github.com/termux/proot, commit `4dba3afbf3a63af89b4d9c1a59bf2bda10f4d10f`
- **License:** GPL-2.0
- **Copyright:** Copyright (C) PRoot developers

PRoot is a user-space implementation of chroot, mount --bind, and
binfmt_misc. It is used to run an Alpine/Ubuntu Linux environment inside
this app without requiring root access. PRoot is executed as a separate
process and is not linked into the application code.

The full GPL-2.0 license text is available at:
https://www.gnu.org/licenses/old-licenses/gpl-2.0.html

## talloc

- **Files:** `libtalloc.so`
- **Source:** https://talloc.samba.org/ (version 2.4.3)
- **License:** LGPL-3.0
- **Copyright:** Copyright (C) Andrew Tridgell, Stefan Metzmacher, and contributors

talloc is a hierarchical memory allocator used as a dependency of PRoot.
It is dynamically linked.

The full LGPL-3.0 license text is available at:
https://www.gnu.org/licenses/lgpl-3.0.html

---

## Provenance notes (why these specific binaries)

Two earlier proot builds were tried before this one and both hit an
unresolved issue on real devices where every guest command failed with
`execve(...): Permission denied` and then, after fixing that,
`execve(...): No such file or directory` / `chdir: Function not
implemented` cascading from `ptrace(PEEKDATA): I/O error`.

These binaries — and the invocation pattern in GIATerminalService.java —
are copied from the equivalent files and code in
[SimonSchubert/Kai](https://github.com/SimonSchubert/Kai) (`androidApp/src/main/jniLibs/arm64-v8a/`
and `ProotLauncher.kt`), a real, actively-maintained Android app doing the
same thing (Alpine/Ubuntu via proot, no root) at production scale. Reused
under the terms of the upstream GPL-2.0/LGPL-3.0 licenses above; Kai's own
build script (`build-proot.sh`) documents the exact build process and
source commit if these ever need rebuilding.

Files (matching Kai's own naming, so an APK inspector or future engineer
can find the same names in Kai's source):
  libproot.so           -> compiled proot binary
  libproot-loader.so    -> proot's Android-unbundled loader (64-bit)
  libproot-loader32.so  -> proot's Android-unbundled loader (32-bit)
  libtalloc.so          -> proot's memory-allocator dependency

All four are placed in jniLibs/ (not real JNI libraries — this is a
naming trick so Android's APK packager extracts them into the app's
nativeLibraryDir, which stays executable regardless of Android version,
unlike files extracted into the app's normal writable storage post-install).
