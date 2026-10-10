# GIA — Open Issues & Roadmap

Working tracker of everything raised in the current round of review that
isn't resolved yet, plus what's already shipped for context. Not auto-synced
with GitHub Issues — this is a single running document, updated as items
land. Each item notes: what's wrong, why, where in the code, and current
status.

Last updated: 2026-10-08 · Current release: v2.4.0.16 (PR #48 merged
2026-10-06 and verified in the app: terminal mirror pre-check, binary
verification, scoped Settings crash boundaries, collapsible provider matrix,
MCP auto-connect fix, and Update Packages). This round added: #18 API key
loss (fixed in tree), #19 battery drain, #20 stale Terminal tabs, and #5
Shell-tab update.

---

## 🔴 Open — Bugs

### 1. Settings module crash (React error #185)
**Symptom:** `Minified React error #185` ("Maximum update depth exceeded" —
an infinite setState loop) crashed the Settings module during a live
session. Stack trace only shows minified `vendor-react` internals, no app
frames, so the exact trigger couldn't be identified from the trace alone.

**Investigation so far:** Swept the obvious suspects — `SettingsModule.tsx`'s
own effects, `NeuraPage.tsx`'s canvas/RAF loop (confirmed it uses refs, not
React state, inside the per-frame tick — not the source), `CommandPalette`,
`AppNavigation`, `useClipboardMonitor`, `useAutomationBridge`,
`useNativeIntents`, and store selectors across the app (no unguarded
object-literal Zustand selectors found; `useShallow` is used correctly
where needed). Nothing found via static read-through.

**Reported as recurring in multiple places**, not just Settings — "from
when I open the app, to many places" — which points at something
global/shared rather than a Settings-local bug, but no shared culprit has
been confirmed yet.

**Mitigation shipped (PR #48):** every Settings sub-page now has its own
`ErrorBoundary` (`src/modules/SettingsModule.tsx`) instead of one boundary
around the whole module, so a crash on one screen no longer strands the
user out of all of Settings. This contains the blast radius but does **not**
fix the root cause.

**Next step:** needs a live repro — ideally the non-minified dev build (as
the React error message itself suggests) or a React DevTools Profiler
session, since static analysis has been exhausted without a hit. Worth
instrumenting a global `console.error` listener that captures a
`console.trace()` the moment #185 fires, to get a real app-code stack next
time it happens.

---

### 2. Distro switch silently destroys the previous install
**Symptom:** Alpine and Ubuntu share a single rootfs path
(`android/app/src/main/java/com/alpha1studio/gia/GIATerminalService.java`,
`ROOTFS_DIR = "rootfs"` — not distro-namespaced). Tapping "Install Ubuntu
instead" while Alpine is installed wipes the folder
(`deleteRecursive(rootfsDir)`) and extracts the new tarball from scratch.
Confirmed in `GIATerminalPlugin.java`'s `doDownloadRootfs` /
`extractAndVerify`.

**Impact:** any packages installed, files created in `/workspace`, or shell
history in the current distro are gone — permanently — the moment the user
switches or reinstalls. No warning beyond the UI copy "(replaces current
rootfs)", no backup, no way to have both installed at once.

**Fix direction:** separate rootfs directories per distro
(`rootfs-alpine/`, `rootfs-ubuntu/`), switching between them without
deletion. Needs native-side changes (Java) plus a migration path for
users who already have a rootfs under the old shared path. Not started.

---

### 3. No way to update already-installed packages
**Status: FIXED in PR #48.** Previously the Packages tab only had one-way
"install" buttons — no update/upgrade path existed at all. Added
`runUpdatePackages()` in `src/services/terminalInstall.ts` (mirror
pre-check, index refresh with retries, `apk upgrade` / `apt-get upgrade -y`,
real summary of what changed) and an "Update Packages" button in
`SandboxSetupPanel.tsx`, shown once anything is installed. 3 new tests.

---

### 4. Full Install reliability (mirror blind spot + DB/binary mismatch)
**Status: FIXED in PR #48** (building on the batching/locking fix already
merged in PR #44 / v2.4.0.14).

- Added `selectReachableMirror()`: tests 3 Alpine mirrors (CDN + two
  regional) before touching the package index, instead of discovering a
  dead mirror only after `apk update` fails mid-install.
- Added `verifyBinaries()`: after install, actually runs `gcc --version`,
  `node --version`, etc. instead of trusting `apk info -e` (the package
  database) alone. This closes the specific gap where Full Install reported
  success for `build-base` while Settings → Mical reported it missing — a
  package can have a database record from an interrupted install while the
  real binary is absent.

Both in `src/services/terminalInstall.ts`, 20 tests total in
`src/services/__tests__/terminalInstall.test.ts`.

---

### 5. No real interactive terminal — only GIA can run commands
**Symptom:** The "Root Terminal & Linux Shell" screen
(`src/components/SandboxSetupPanel.tsx`, `TerminalPage.tsx`) has System /
Packages / Files / MCPs tabs, a progress bar, and a read-only Live Output
log. There is **no text input anywhere for the user to type a shell command
directly.** Confirmed via full-text search — no `xterm`, no command-input
field, nothing. The only way to execute a command is to ask GIA in chat and
have her call the terminal tool; the result is then rendered read-only in a
terminal-styled block (`ClaudeTerminalBlock.tsx`) in the transcript.

There's also no "@gia" mention syntax anywhere in the app — that doesn't
exist as a feature; normal chat is the only interface.

**Impact:** an app literally named "Root Terminal & Linux Shell" has no
actual terminal a user can type into. For anyone who wants to run a quick
command themselves rather than asking GIA to do it, there's no path.

**Fix direction:** add a real interactive shell input to the Terminal
screen, reusing the same `execCommand` plumbing already used internally
(`useSandboxSetup.ts`).

**Update 2026-10-08:** largely shipped — the **Shell** tab
(`src/components/ShellPanel.tsx`, commit `dbf3eb83`, 10 tests) now gives
the user a real command input with history, live output, cwd tracking and
a stop button. What remains from this issue: no PTY (nano/vim/top still
unsupported, documented in the panel), and the web fallback is a message
only. See also item 20 for the state of the other tabs.

---

### 18. API key lost after app resume (data loss)
**Symptom (live user report):** connected an API key on the phone, left
the app, came back to what looked like a fresh app — provider showed **no
API key connected**, chats intact.

**Root cause:** provider and credential state persist through
`src/store/idb-storage.ts`, whose `setItem` only *schedules* a write
(debounced 300 ms). A WebView backgrounded/killed before the timer fired —
or before the async flush on `visibilitychange`/`appStateChange`
committed — dropped the write. Chat state survives because it is
rewritten constantly, while a key is written exactly once. The key itself
was usually still alive in the native vault
(`CredentialVault.set` → Android EncryptedSharedPreferences, written
immediately on save), just not re-read anywhere.

**Fix (in working tree, 2026-10-08):**
1. `idbStorageWriteThrough` (`src/store/idb-storage.ts`) — write-through,
   no debounce — now backs `useProviderStore` and `useCredentialStore`;
   a save commits as soon as the transaction runs.
2. `src/services/credentialRecovery.ts` — boot-time self-heal: after
   `loadProviders()` + hydration, any provider with an empty key is
   re-seeded from the credential store, then the native vault; wired in
   `App.tsx`. Live keys are never overwritten.
3. Tests: write-through behavior (`idb-storage.test.ts`), recovery paths
   (`credentialRecovery.test.ts`, 6 tests) — all mutation-verified.

**Status:** fixed in working tree, not yet committed/PR'd.

---

### 19. Battery drain on phone (live user report)
**Symptom:** the app eats battery while open/foregrounded.

**Ranked suspects (static audit, 2026-10-08):**
1. **Indefinite `PARTIAL_WAKE_LOCK`** — `GIACoreService.java:119`
   acquires with no timeout, `START_STICKY`, 5-min re-acquire watchdog
   (`:132-148`), re-armed at boot (`BootReceiver`). CPU never suspends.
   Worse: `MainActivity.java:43-47` calls `webView.resumeTimers()` on
   pause whenever keep-alive is on — **JS timers deliberately run while
   backgrounded**.
2. **Wake-word engine** — `GIAWakeWordService.java:281-317` continuous
   mic read + ~12.5 ONNX inferences/sec, `START_STICKY`, and the native
   `enabled=true` pref re-arms it at every boot even though the JS
   default is off.
3. **Terminal foreground service** — started from
   `GIATerminalPlugin.java:39` on every launch with a rootfs present;
   `stopSelf()` only on error paths, never on idle.
4. **Telegram polling** — `public/sw.js:256` runs a 3 s interval with a
   25 s long-poll exactly when no client is open (i.e. backgrounded);
   `MessagingBridge.ts:214-237` forces the native keep-alive service.
5. **Eight ungated boot-started intervals** with no `document.hidden`
   pausing anywhere: `ProactiveEngine.ts:16` (30 s),
   `AutomationEngine.ts:52` (30 s, `stop()` never called),
   `useClipboardMonitor.ts:13` (5 s), `KeepaliveService.ts:18` (25 s),
   `App.tsx:546` (300 s), `GIACoreServices.ts:238` (1 h),
   `useProactiveMessage.ts:14` (60 s), `unimindClient.ts:199` (60 s).

**Next step:** pause the JS interval set on `document.hidden`, bound the
wake lock with `acquire(timeout)` + release on idle, add an idle stop for
the terminal service, and re-check the wake-word sticky pref on boot.

---

## 🟡 Open — Architecture / Design Gaps

### 6. Provider/model catalog — 22 providers, unverified accuracy
**Claim to investigate:** "most of them were not implemented correctly,"
added to pad the count (raised against the larger 71-provider GIA Cowork
list; this app's own registry has 22 entries), similar to how other
multi-provider CLIs are sometimes criticized for padding provider counts.

**What was checked:** confirmed all 22 entries in
`src/services/ProviderRegistry.ts` have a real `baseUrl` and route through
one of a small number of real request-format handlers
(`src/services/providers/openai.ts`, `gemini.ts`, `anthropic.ts`, plus
Ollama/HuggingFace/local paths) — this "many providers, few real
implementations" pattern is legitimate and standard (same approach
OpenRouter, LiteLLM, and opencode CLI itself use), **not** inherently fake.

**What was NOT checked** (this environment can't reach
`api.openai.com`/`api.groq.com`/etc. — only a short domain allowlist is
network-accessible from here): whether each provider's `defaultModel` is
current and not a deprecated/renamed model ID, whether the handful of
providers needing non-OpenAI-standard request shapes (e.g. auth header
quirks) are handled correctly, and whether the provider actually works
end-to-end with a real key. No live verification has been done.

**Fix direction:** a research pass cross-checking each provider's current
model lineup against its own docs (via web search, not live API calls from
this sandboxed environment), flagging stale `defaultModel` values; longer
term, a background "smoke test" when a user adds a key, with a visible
verified/unverified badge per provider instead of a static trusted list.
Not started.

---

### 7. App has no dedicated, user-visible storage/workspace architecture
**Complaint:** "there's no way to choose a dedicated folder for the app...
the app is just loose on many ends" — compared against Operit, OpenClaw,
NemoClaw, Kimi Claw (not yet researched for comparison).

**Current state:** `runFullInstall` creates
`/workspace/{projects,downloads,scripts,documents,data,tools}` inside the
Linux rootfs, but that's scoped to the terminal sandbox only — it doesn't
cover GIA's own app data (chat history, memory, generated files, downloads)
or give the user any way to pick/see a single root location for everything
the app touches.

**Fix direction:** needs real scoping work — survey what Operit/
OpenClaw/NemoClaw/Kimi Claw actually do for storage model (not done yet,
no web research performed), then design a single configurable root with
clear subfolders for chat data, generated files, terminal workspace, and
downloads. Should likely be bundled with issue #2 (per-distro rootfs
separation) since both are "the filesystem layout needs a real design."
Not started.

---

### 8. Sub-agents exist but are never actually used; no visible delegation
**Current state:** `sub_agent_call` tool and a parallel manager with ~20
personas exist in the tools layer, but the only nudge toward using them is
one line in the system prompt — models mostly ignore it. No UI shows
agents being spun up/working in parallel (the "Grok-style swarm" the user
referenced).

**Fix direction:** (a) a planning step that decides upfront whether to
split a request across sub-agents, (b) a live "swarm" card showing each
agent's name/status/result as they run, (c) a synthesis step at the end.
Not started. Speed will depend on provider rate limits regardless of UI
work.

---

### 9. Reasoning/tool-step UI is stacked, not interleaved
**Current state:** each reply's thinking + tool calls render as one block
above the final text, rather than interleaved as they actually happened
(think → tool → more text → next tool). A partial interleaved component
(`SegmentedReasoning`) exists but isn't the default path. Intermediate
assistant text can appear duplicated in the stacked view (seen in the
original screenshot report).

**Fix direction:** rebuild as a true timeline using the existing segmented
component as the default, not the exception. Not started.

---

### 10. Chat's own activity indicator lags the "agents activity" panel
**Root cause identified:** `ProtocolPanel.tsx` (the fast-feeling panel)
subscribes directly to `useProtocolStore`, written to **synchronously** the
instant a tool reports progress
(`src/services/brain/toolRunner.ts`: `onProgress` →
`useProtocolStore.getState().setProgress(...)`). Chat's own in-message
indicator depends on the matching `onThought` callback bubbling through
several more layers (tool runner → brain pipeline → eventually a
`setMessages([...])` call replacing the whole messages array), which is a
heavier re-render and visibly lags behind.

**Fix direction:** have the in-message tool/thought display
(`WorkLog.tsx`, `ReasoningChain.tsx`, `ToolTray.tsx`) read live from
`useProtocolStore` by `protocolId` directly, instead of waiting for the
full message object to update. Touches multiple files plus the brain
pipeline — not started.

---

### 11. Neura (knowledge graph) is slow and feels "less smart" with scale
**Performance cause identified, not yet fixed:** `MAX_ENTITIES = 2000`
(`src/store/useKnowledgeGraphStore.ts`). `NeuraPage.tsx`'s canvas renderer
draws every node every frame at 60fps with a full radial-gradient glow
per node (`ctx.createRadialGradient`, not cheap) and no level-of-detail
cap — genuinely expensive at anywhere near the 2,000-node ceiling.

**Fix direction (identified, not implemented):** LOD rendering — full
glow/label treatment only for the closest/most relevant N nodes, simple
dots for the rest beyond a count threshold.

**"Not as smart" is a separate, uninvestigated claim** — likely dilution
of retrieval/ranking quality as low-value singleton entities accumulate
in a 2,000-entity graph, not a performance issue. No work done here;
needs a look at the recall/ranking logic in the knowledge-graph search
path, and possibly a pruning/decay mechanism for low-mention-count old
entities.

---

### 12. No calendar access; GIA is reactive, not proactive
**Current state:** Calendar integration only works through a Google
Calendar login — GIA has no access to the device's native calendar (no
Android calendar permission, no native plugin). Reminders already work via
the native `set_alarm` tool. The proactive engine
(`src/services/autonomy/ProactiveEngine.ts`) only watches for stuck
autonomy-goal steps; a separate notification engine just shows canned
greetings/tips — neither checks the calendar or sends useful nudges
("meeting in 30 minutes", a morning brief).

**Fix direction:** native calendar read/write plugin + tools, and extend
the proactive engine to actually use it. Not started.

---

### 20. Terminal tabs feel stale — MCPs is decorative, Files is static
**Symptom (live user report):** System / Shell / Packages / Files / MCPs
tabs "don't do anything, doesn't even open."

**Facts (audit 2026-10-08):** all five tabs *are* wired —
`SandboxSetupPanel.tsx:312` sets tab state, branches render at `:326 /
:531 / :533 / :639 / :692` — and nothing is gated on AI/project activity;
the only gate is `isNative` (`:286`), so on web the tabs never appear at
all. The "does nothing" impression is accurate for two tabs:
- **MCPs** (`:692-716`): a hard-coded 8-entry `MCP_CATALOG` (`:102-111`)
  of label + description + GitHub source link. No install, no
  enable/disable, no connection to `useMCPStore` or the real MCP manager
  (`MCPPage.tsx`). Purely decorative.
- **Files** (`:639-689`): six static folder tiles + a hard-coded path
  list; no file browser, listing, opening, or editing. Tile counts only
  refresh when the rootfs is installed, otherwise "Not created yet".
- Packages `refreshInstalled()` (`:186-191`) has no try/catch — with no
  rootfs the native call rejects silently and the tab shows zeros.
- The Settings menu card promises "Manual command shell · **chat with
  GIA** · packages & root environment" (`SettingsModule.tsx:349-351`),
  but `TerminalPage.tsx:21` renders only `SandboxSetupPanel` — no chat
  surface exists there.

**Fix direction:** wire the MCPs tab to the real MCP store (or drop the
tab — `MCPPage.tsx` already exists in Settings); give Files a real
read-only browser over the existing `/fs/*` or native fs calls (or drop
it); surface refresh errors instead of silent zeros; fix the menu copy.
Also: `src/components/settings/SandboxSubPage.tsx` is defined but never
imported — dead code, delete.

---

## 🟢 Open — Feature Requests (not yet investigated/started)

### 13. Mock phone demo in the About section isn't realistic
Asked to redesign the mock phone mockup to look like a real, working
device with an actual demo rather than a static graphic. Location not yet
confirmed — could be the in-app About page or the landing page's
`MockUI.tsx`/`DesktopMock.tsx`. Not investigated.

### 14. "/" command menu is missing a Skill Creator entry
A `skill_create` **tool** already exists
(`src/services/tools/skills.ts`), so GIA can create a skill if asked in
natural language — but there's no quick action for it in `CommandPalette`
("/" menu), so it isn't discoverable. Confirmed via search: no "skill
creator" entry anywhere in `CommandPalette.tsx`. Needs a slash-command
entry wired to the existing tool. Not started.

### 15. No self-editable config for GIA's own persona/customization
Asked for a `.json` (or similar) file GIA can read and edit to customize
her own persona/behavior, that persists. Confirmed via search: no such
feature exists anywhere in the codebase today. Not started — needs design
(what's editable, where it's stored, how it affects the system prompt).

### 16. MCP servers GIA creates don't survive restart
**Status: FIXED in PR #48.** Root cause confirmed: the `mcp_server_add`
tool (`src/services/tools/mcp.ts`) hardcoded `autoConnect: false`. The
server *was* being persisted correctly (Zustand + IndexedDB via
`useMCPStore`), but `MCPManager.ts`'s launch-time connect pass only
reconnects servers where `enabled && autoConnect` — so a GIA-created
server would sit there unconnected after every restart until someone
found Settings → MCP Servers and flipped the toggle by hand. Now defaults
to `autoConnect: true`.

### 17. Provider Capabilities matrix always rendered, collapsible
**Status: FIXED in PR #48.** The matrix (70+ provider rows, each computing
capability flags) rendered unconditionally on every visit to Settings
main. Now collapsed by default behind a tap-to-expand toggle
(`SettingsModule.tsx`), cutting real render cost on a page that's already
heavy.

---

## ✅ Recently shipped (for context)

- **v2.4.0.14** (current release): Full Install batching/lock/retry fix,
  Packages-tab installed-count fix, chat replies full width instead of an
  85%-capped card, `check_website` tool (GIA can check her own site, shows
  as a visible work-log step), website stat/feature-card accuracy fixes,
  live-fetched version badge on the landing page, Dependabot bump.
- Chat message layout: assistant replies are full width with the avatar
  moved into the header line, matching the expanded view (previously an
  85%-capped card with a side avatar column).
- Website: live `check_website` self-check tool; corrected "Tool Actions"
  stat (35+ → 200+, matching the real tool-registry count of 227); added
  the missing Root Terminal & Linux Shell feature card.

---

## How to use this file

Each numbered item should move to "Recently shipped" with its PR number
once merged, not be deleted — keep the history of what was wrong and why,
the same way items 3, 4, 16, and 17 above are written up even though
they're already fixed. When starting work on an open item, it's fine to
add a "**In progress:**" line under it rather than waiting until it's done
to update this file.
