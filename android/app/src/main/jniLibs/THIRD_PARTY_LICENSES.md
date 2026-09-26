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

---

## ⚠️ Local modification: `libproot.so` (DT_NEEDED patched)

**`libproot.so` in this directory is NOT a byte-identical copy of the
upstream/Kai binary. It carries a local patch. Do not treat it as
pristine, and re-apply the patch if you ever replace the file.**

### What was changed

One ELF `DT_NEEDED` entry was rewritten with patchelf:

    patchelf --replace-needed libtalloc.so.2 libtalloc.so libproot.so

### Why

Upstream `libproot.so` declares a dependency on **`libtalloc.so.2`**, but
the bundled allocator is stored as **`libtalloc.so`** (no version
suffix) — almost certainly a rename that happened when these binary
assets were restored.

Android's linker resolves `DT_NEEDED` by *exact filename* in
`nativeLibraryDir`; unlike desktop glibc it does not consult the
dependency's embedded `DT_SONAME`. So every proot invocation failed at
`execve`:

    CANNOT LINK EXECUTABLE libproot.so: library libtalloc.so.2 not
    found: needed by main executable

That single mismatch is what broke Terminal "Full Install" for *every*
package (python3, nodejs, git, ...) — one root cause, not many
failures.

### Why patch the binary rather than rename the file

The bundled `libtalloc.so` genuinely *is* talloc 2.4.3 — its own
`DT_SONAME` reads `libtalloc.so.2`. Renaming the file to `libtalloc.so.2`
would therefore also have fixed the mismatch, and would have kept both
binaries pristine.

The patch was applied instead because it keeps Kai's original filenames
intact (see the naming list above) and avoids any chance of the rename
conflicting with a Gradle `jniLibs` packaging rule. If you would
rather not carry a rebuilt third-party binary, the rename is a valid
alternative — but then `libproot.so` must be reverted to its original
bytes so the two agree.

### Verification performed

- `readelf -d` confirms `NEEDED` is now `libtalloc.so`, matching the
  filename actually present in `lib/arm64-v8a/` in a built APK
- `readelf -h` still reports `AArch64` / `DYN (Position-Independent
  Executable)`, with `.interp` = `/system/bin/linker64`
- All four original `PT_LOAD` segments and all 23 section headers are
  preserved; `text`/`data`/`bss` sizes are unchanged (+13 bytes of
  `text` for the rebuilt dynamic section). The file grew 208,368 ->
  263,817 bytes because patchelf appends a new segment to hold the
  patched headers.

**Not verified:** proot has not been executed from a patched APK on a
real device. Run a Full Install and confirm `apk` works before relying
on this.

All four are placed in jniLibs/ (not real JNI libraries — this is a
naming trick so Android's APK packager extracts them into the app's
nativeLibraryDir, which stays executable regardless of Android version,
unlike files extracted into the app's normal writable storage post-install).
