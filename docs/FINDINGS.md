# GIA — Findings & Troubleshooting Notes

This document records root causes and fixes for issues worked on across the
staging sessions. **When something regresses, start here.** Each entry lists
the symptom, the actual root cause, the fix, and the files involved.

---

## 1. Android home-screen widget — CI Build APK failure (Glance API)

**Symptom:** `Build APK` workflow failed at `compileDebugKotlin` with ~60
unresolved-reference errors in `GIAAppWidget.kt` / `GIAWidgetPlugin.kt`.

**Root cause:** The widget was written against the modern Glance 1.1.x API
(`dp`/`sp`/`em`, `Arrangement`, `weight`, `Preferences`, `updateAppWidgetState`,
`updateAllInstances`, `TextOverflow`, `letterSpacing`, `provideContent`), but
the `androidx.glance:glance:1.1.1` artifacts that CI resolves expose a
**pre-1.0-era API** containing none of those symbols. Verified byte-identical
across dl.google.com, the Aliyun mirror, and Google's published sha1 — and
`1.2.0-alpha01` is the same old API. No version bump could fix it; the earlier
`fix(android)` commits (Kotlin/Compose plugin, `kotlin_version`) were fighting
the wrong battle.

**Fix:** Dropped Glance entirely. The widget is now a classic
`AppWidgetProvider` + `RemoteViews` in Java, matching the rest of the native
code (all Java):
- `android/app/src/main/java/com/alpha1studio/gia/widget/GIAWidgetProvider.java` (new)
- `android/app/src/main/java/com/alpha1studio/gia/GIAWidgetPlugin.java` (new — same
  FQCN + `update()` API as the old Kotlin plugin, so `WidgetSyncService.ts` and
  `MainActivity` needed zero changes)
- `res/layout/widget_gia.xml` + drawables; `res/xml/gia_widget_info.xml` now
  points at `@layout/widget_gia` (was `glance_default_loading_layout`, which only
  exists inside the Glance AAR)
- `AndroidManifest.xml` receiver → `.widget.GIAWidgetProvider`
- `android/app/build.gradle` + root `android/build.gradle`: removed Glance/
  Compose/datastore/WorkManager deps and the Compose compiler classpath. Kotlin
  classpath kept — the generated `capacitor-cordova-android-plugins` module reads
  `rootProject.ext.kotlin_version`.

**Troubleshooting links:** `GIAWidgetPlugin.java` (plugin contract),
`WidgetSyncService.ts` (JS side), `useNativeIntents.ts` → `handleWidgetAction()`
(action extras: `voice_start` / `screen_capture` / `open_chat`).

---

## 2. On-device terminal — proot `'/usr/bin/env' not found` (the big one)

**Symptom (every command in Shell tab):**
```
proot warning: can't chdir("/root/.") in the guest rootfs: No such file or directory
proot error: '/usr/bin/env' not found (root = .../files/terminal/rootfs, ...)
fatal error: see `libproot.so --help`.
```

**Root cause (two compounding bugs in `GIATerminalService.extractTar`):**
1. **Symlinks never materialized.** Alpine minirootfs ships every binary as a
   busybox symlink (`/bin/sh`, `/usr/bin/env`, … → `/bin/busybox`). The extractor
   used `Files.createSymbolicLink()`, which Android refuses in app data
   (`Operation not permitted`), and the exception was swallowed — so the rootfs
   extracted its directories but had **zero executables**. proot boots, tries to
   exec `/usr/bin/env`, finds nothing, and dies.
2. **File modes were never applied.** The tar mode field (bytes 100–107) was
   ignored, so even the real binary (`/bin/busybox`) extracted non-executable.
3. The `.gia-rootfs-ok` marker only checked `bin/`/`etc/` **directories** existed,
   so a broken rootfs was never re-extracted (self-healing was impossible).

**Fix (all in `android/.../GIATerminalService.java`):**
- Symlinks: best-effort `Files.createSymbolicLink`; on failure, materialize as a
  real content copy of the already-extracted target (busybox), else record for a
  post-extraction `materializeSymlinks()` pass that copies busybox for applet
  paths (`bin/`, `sbin/`, `usr/bin/`, `usr/sbin/` — note tar names carry a `./`
  prefix, stripped in `isAppletPath`).
- File modes: `parseOctal(header, 100)` applied via
  `setExecutable/setWritable/setReadable`.
- Marker validation: `rootfsHasCriticalBinaries()` requires
  `bin/busybox`, `bin/sh`, `usr/bin/env` to exist. A broken rootfs on an
  installed device is detected and **re-extracted automatically on next launch**.
- Race: sessions now wait on a static `extractionLatch` (60s) before exec —
  the first command on a fresh install waits for the few-second extraction
  instead of hitting an empty rootfs.
- Hardening: force `busybox` executable, create `/root`, write
  `etc/resolv.conf` (DNS).

**Key facts verified in-repo:**
- `assets/terminal/proot` and `jniLibs/arm64-v8a/libproot.so` are identical
  **statically-linked arm64 ELF EXEC**s (no PT_INTERP) — they run on any arm64
  Android without a dynamic linker. No JNI export (`prootMain` absent) — the
  `GIAProotNative` JNI bridge is a dead path that fails gracefully; the
  subprocess path (`ProcessBuilder` + `sh -c`) is the real one.
- `assets/terminal/alpine-minirootfs.tar.gz` is a valid gzip containing busybox
  + all applet symlinks.
- On-device layout: rootfs lives at
  `/data/data/com.alpha1studio.gia/files/terminal/rootfs/`; proot binary at
  `.../files/terminal/proot` or `nativeLibraryDir/libproot.so` (preferred).
  `PROOT_TMP_DIR`/`TMPDIR` point at `cacheDir/proot-tmp` (proot needs a writable
  scratch dir; Android has no `/tmp`).

**Troubleshooting links:** `GIATerminalService.java` (extraction + sessions),
`GIATerminalPlugin.java` (Capacitor bridge), `TerminalService.ts` (JS wrapper),
`SandboxEnvService.ts` (status/provision/repair/reset), `TerminalPage.tsx` (Shell/
Packages tabs). To force a clean re-extract on a device: delete
`files/terminal/rootfs` (or tap **Reset** in Settings → Terminal → Alpine Sandbox
section) and restart the app.

---

## 3. Sandbox status lied — green checks next to `fatal error` text

**Symptom:** "Pre-installed Environment Packages" and "Alpine Sandbox" showed
green checkmarks / a green **Ready** badge while every package line read
`fatal error: see libproot.so --help`.

**Root cause:** `SandboxEnvService.parseVersion()` took the last non-empty line
of command output as the "version". proot's fatal error line survived the
`2>/dev/null || true` wrapper and `exitCode 0`, so `node --version` "succeeded"
with a version of `fatal error: see libproot.so --help`.

**Fix:** `SandboxEnvService.ts` now detects proot failure markers
(`fatal error`, `libproot`, `proot error/warning`, `can't chdir`,
`/usr/bin/env` not found) in `parseVersion()`, the resolv probe, and the package
loop — a broken proot reports `available: false` / packages `ok: false`
(amber/red UI) instead of green checks. `TerminalPage.tsx` shows `unavailable`
instead of `checking...` once a status has actually been fetched.

---

## 4. Chat header / toolbar cleanup

**Symptoms (user feedback):**
- Trash icon in the header wiped the **entire chat history** (`clearSession`).
- "All Tools" wrench button in the header opened a sheet that felt buried;
  tools should live with the Web Search / Hands-off controls at the bottom.
- The active-skill pill cluttered the header; the search-activity globe badge
  stacked up (`9+`) as searches accumulated.

**Fixes (`ChatModule.tsx`, `ComposerToolsSheet.tsx`):**
- Removed the header trash button (per-chat delete still lives in the Chats
  history panel).
- Moved **All Tools** into the bottom **Tools & Modes** sheet (sliders icon):
  `ComposerToolsSheet` gained a `footer` prop; the footer row opens
  `ToolsCatalogSheet` with the live tool count (`giaTools.getAllTools().length`).
- Active skill chip moved from the header to the composer row (next to the
  "N active" pill) and also appears as a row in the Tools & Modes sheet
  (tap → `SkillPicker`).
- `SearchActivityButton` badge reduced to a quiet dot (title carries the count).

---

## 5. Tool-call leak into new chat sessions

**Symptom:** A fresh chat showed "Used 2 tools — Web Search · web f…", tool
output cards, and `Rate limit on opencode — retrying…` steps from the previous
session.

**Root cause:** `useProtocolStore.consoleProtocols` is **persisted to IndexedDB**
and rendered globally by `RecentToolExecutions` in `ChatModule`. It was only
cleared at the start of a new send (`handleSend`), never on session switch.

**Fix:** `useChatState.ts` session-change effect now calls
`useProtocolStore.getState().clearConsoleProtocols()` when `activeSessionId`
changes. Tool cards keyed by `messageId` inside `MessageList` were already
session-correct.

---

## 6. Model & Provider sheet — blank model pane

**Symptom:** Active provider (e.g. OpenRouter) showed **no models at all**, even
after tapping Refresh — with a green "● Live model list from API" label.

**Root cause:** `fetchModels()` marked the list `live` even when the API returned
zero models, and the sheet displayed `availableModels[selected] ?? []` — an
empty array — without falling back to the curated catalog.

**Fix:**
- `useProviderStore.fetchModels`: only `markLive()` when the API actually
  returned models; empty responses now `markCatalog(fallbackModels)`.
- `ModelSwitcherSheet`: when connected but the live list is empty, display the
  curated catalog so the pane is never blank.

---

## 7. Provider icons looked fake

**Fix (`ProviderIcon.tsx`):** replaced hand-drawn marks with official
simple-icons brand logos where they exist (react-icons/si): Anthropic, DeepSeek,
Gemini, OpenRouter, xAI, HuggingFace, Ollama, LM Studio, NVIDIA, Perplexity,
Replicate, Meta. OpenAI/Groq/Cerebras/Mistral keep the custom marks — simple-icons
has no entry for them (checked the installed pack).

---

## 8. Exa / Browserless keys "not reachable" by the AI

**Symptom:** Keys configured in Settings → Search worked in `web_search`, but
when asked "what's connected?", GIA's tool call reported `not configured`.

**Root cause:** `search_provider_status` / `search_provider_configure` tools read
and wrote a **legacy localStorage key** (`gia-search-exa`), while the Settings
screen writes `useSearchStore` (IndexedDB). The AI and the UI were looking at two
different stores.

**Fix (`searchConfig.ts`):** both tools now read/write `useSearchStore` — the
same store Settings uses — and configure also enables + activates the provider
(and mirrors the legacy localStorage key for anything still reading it).

---

## 9. Follow-up suggestion chips rarely appeared

**Root cause:** `SUGGESTION_MIN_LEN = 120` in `useChatGeneration.ts` — most
answers never qualified, and the background generation fails silently.

**Fix:** threshold lowered to 80 chars, so tappable chips appear on most
completed answers. (Chips render in `MessageList.tsx`; click → `sendText`.)

---

## 10. Build Mode preview felt like a floating overlay

**Fix (`ChatModule.tsx`):** when Build Mode is on and a preview URL is live, an
inline **Live preview** card (iframe + refresh + expand) renders in the chat flow
under the response, instead of only existing as the floating `BuildPreviewSheet`.

---

## Operations cheatsheet

- **Commands (order matters):** `npm ci --legacy-peer-deps` → `npm run lint` →
  `npm run test:run` → `npm run build` (tsc + vite). `npx cap sync android`
  after build for APK work.
- **CI:** `.github/workflows/` runs `ci.yml` (lint/test/build) and
  `build-apk.yml` (debug + signed release APKs, GitHub release). Push to
  `staging` triggers both.
- **Android build caveats:** root `android/build.gradle` must keep the Kotlin
  classpath (`capacitor-cordova-android-plugins` reads `rootProject.ext.kotlin_version`).
  No Glance/Compose deps. `CapacitorHttp.enabled = false` is critical for
  streaming.
- **Terminal on-device reset:** Settings → Terminal → Alpine Sandbox → Reset, or
  delete `files/terminal/rootfs` and restart the app — the marker validation in
  `GIATerminalService.extractAssets()` re-extracts automatically.
