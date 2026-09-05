# GIA bug hunt — Sept 5 2026 session

Working on `main` (confirmed the active branch: 15 commits ahead of `staging`,
`dev` and `fix/bug-hunt-and-widget-wiring` are ~190 commits stale — not used).

## Status legend: 🔴 open · 🟡 in progress · 🟢 fixed (needs device confirm) · ⚪ not a code bug

1. 🔴 **Version confusion (2.4.0.1)** — every version string in `main` already
   reads 2.4.0.1 (package.json, build.gradle, About page, footer, etc.) — no
   mismatch found in source. The APK on your phone was built from an older
   commit. Not a code bug — will be resolved once you rebuild + reinstall from
   this session's `main`. Will re-check after other fixes land in case a
   rebuild surfaces a real mismatch.

2. 🟢 **"Absolute paths are not allowed" on filesystem_write** — fixed:
   `isPathSafe()` no longer hard-rejects a leading `/`, `normalizePath()`
   strips it instead (path traversal `..` is still blocked). Tool
   descriptions for `filesystem_read`/`filesystem_write`/`list_files` now
   say paths are relative to Documents. — root cause:
   `isPathSafe()` in `src/services/tools/helpers.ts` hard-rejects any path
   starting with `/`, but the `filesystem_write`/`filesystem_read`/`list_files`
   tool descriptions never tell the model paths must be relative — so the
   model tries `/foo.json`, gets rejected, and thrashes retrying. Fix:
   auto-normalize a leading slash instead of hard-failing, and document the
   rule in the tool schema description.

3. 🟢 **Terminal claims "installed" but commands fail** — root cause found:
   `TerminalService.ts` is a module-level singleton
   (`export default new TerminalService()`), and its constructor resolved the
   native `GIATerminal` Capacitor plugin exactly once, at first import. If
   that import happens (as part of normal bundle evaluation) before
   Capacitor's native bridge has finished attaching, `getPlugin()` returns
   null and gets cached forever — every later `exec()` call permanently
   hits the "plugin not available" fallback, even though the plugin becomes
   real moments later. This is exactly why Settings (which re-checks the
   plugin fresh in a `useEffect` on mount, by which time the bridge is long
   since up) correctly shows "Linux Installed" while chat's bash/JS tools
   (which go through this singleton) fail immediately. Fixed: plugin
   resolution is now lazy and retried on every call until it succeeds,
   instead of being frozen at construction time.

4. 🟢 **Package installation in Terminal settings is fake** — not actually
   fake: `installPackage`/the native `apk add` plumbing is real and correctly
   returns `{output, exitCode}`. The bug was in `SandboxSetupPanel.tsx`'s
   full-install loop — it called `installPackage()` for each package and
   completely ignored the result, so it always marched through the whole
   list and said "Done!" even when every install failed (e.g. no network
   route into the sandbox yet — see #6). Fixed: the loop now checks
   `exitCode` per package and surfaces exactly which ones failed instead of
   silently pretending success.

5. 🟢 **Files tab / workspace folders don't work** — found one real bug in
   that area: the workspace-folder creation command was
   `mkdir -p /workspace/{projects,downloads,scripts,documents,data,tools}`.
   That `{a,b,c}` brace expansion is a bash feature — the sandbox's shell is
   busybox `ash`, which doesn't support it, so it silently created one
   literally-named directory instead of six real ones. Fixed by passing
   each path as its own `mkdir -p` argument instead of relying on brace
   expansion. The Files tab's folder tiles themselves are just static
   labels (not yet wired to read real directory contents) — noting that
   separately below as a follow-up, since it's a smaller cosmetic gap, not
   the "nothing works" bug.

5b. 🔴 **Files tab shows static folder tiles, not real directory contents** —
    follow-up from #5: `~/projects`, `~/downloads`, etc. in the Files tab are
    a hardcoded list, not read from the actual rootfs. Lower priority than
    the install-loop bugs above; will wire this up if time allows.

6. 🟢 **Contradiction: Terminal tab says "Linux Installed", Security tab says
   "Setup Required"** — these track two genuinely different things (base
   rootfs presence vs. dev-toolchain packages actually being installed in
   it), so showing them separately isn't itself wrong. But the Security
   tab's "Set Up Environment" (`SandboxEnvService.provision`) configures
   `/etc/resolv.conf` before running `apk add`, while the Terminal tab's
   "Full Install" never did — so its `apk add` calls had no DNS and failed
   silently (same underlying cause as #4). Added the same DNS step to the
   Terminal tab's full-install flow, so both paths can now actually
   succeed and their status converges instead of permanently disagreeing.

7. 🟢 **Thinking renders one word per line** — fixed. Root cause was:
   `src/services/providers/{anthropic,gemini,openai}.ts` route incremental
   native reasoning/thinking stream deltas through `req.onThought`, which is
   meant for discrete whole log lines (toolRunner's "🧠 tool → args" style
   messages) and forces a `\n` before every call
   (`appendThought` in `streamParser.ts`). Since reasoning deltas arrive as
   tiny fragments (often single words), every fragment lands on its own line.
   This affects every provider's Thinking UI, not just the free model in the
   screenshot. Fixed: added `onThinkingDelta` (raw concatenation, no forced
   separator) to `BrainRequest`, switched Anthropic/Gemini/OpenAI-compatible
   provider adapters to call it for native reasoning deltas instead of
   `onThought`, and wired it at all 4 generation call sites in
   `useChatGeneration.ts` plus the collaborative-generation synthesis path.
   `onThought` itself is untouched — tool lifecycle lines still get their
   newline separators.

8. 🟢 **Collapsed thought/tool trail preview shows just "The"** — same root
   cause as #7: `ThinkingBlock`'s preview does
   `segment.content.trim().split('\n')[0]` — with the newline-per-token bug,
   the first "line" was one word. Fixed by #7; no separate change needed.

9. 🟢 **Per-item expand/collapse on the actions/thoughts trail** — confirmed
   fixed: this was never broken code, `SegmentedReasoning.tsx` already gives
   each block independent state. It only *looked* broken because #7/#8 made
   every header show garbage. Nothing left to change here.

10. 🟢 **File edit shows as a floating card instead of inline in chat** —
    fixed: `LiveFileEditor.tsx` was `position: fixed; bottom-4 right-4`,
    pinned to the viewport corner. Changed to relative/full-width so it lays
    out inline in the chat body where it already sits in the DOM (right
    after the tool-execution cards, at the point where the live-editing
    turn is happening).

11. 🟢 **Floating orb says "not implemented"** — found a real bug, though not
    literally that error message (that phrase turned up in a code comment
    about an already-fixed, unrelated plugin-registration bug — worth
    knowing your APK might be old enough to still hit that class of issue,
    see #1). The actual bug: `showOrb()` (native) started the overlay
    service unconditionally with no check for the "Draw over other apps"
    permission (`SYSTEM_ALERT_WINDOW`), which Android requires the user to
    grant explicitly in system settings — declaring it in the manifest
    isn't enough. If it's not granted, the overlay's `addView()` call fails
    inside a `catch (Exception ignored) {}` — service "starts" fine, nothing
    ever appears, no error anywhere. Fixed: `showOrb()` now checks
    `Settings.canDrawOverlays()` first and opens the permission screen if
    it's missing, mirroring the exact pattern `GIAOverlayPlugin` already
    uses correctly for the same permission. Also fixed the JS toggle
    (`WidgetSection.tsx`) trusting `showOrb()` resolving as proof the orb
    is visible — it now re-checks `isOrbShowing()` afterward before
    reporting success.

12. 🟢 **Assistant message bubble alignment** — found a real, concrete bug:
    the main chat renderer (`MessageList.tsx`) never applied a max-width to
    the message bubble at all (plain block div, no cap), so it always
    stretched to fill the entire row regardless of message length — and
    assistant bubbles additionally had zero background/border, so there was
    nothing visible marking where they actually started or ended. The
    correct pattern already exists and is used correctly elsewhere
    (`AgentsModule.tsx`'s `max-w-[85%]` + `.msg-user`/`.msg-assistant`
    classes) — `MessageList.tsx` just never got it. Added `max-w-[85%]` and
    a visible background/border for assistant bubbles (matching the
    existing `--gia-surface-2`/`--gia-border` tokens already used for the
    avatar in this same file, not the bolder `.msg-assistant` gradient, to
    avoid changing the established color language). If this still doesn't
    match what you're seeing after rebuilding, send a screenshot of it
    specifically — I was working from your description here, not a picture
    of this exact issue.

13. 🟢 **Visualization stuck on "Generating visualization..." forever** —
    root cause: ` ```visual ` code blocks get parsed as JSON as they stream
    in; while parsing fails, the UI shows the loading spinner, which is
    correct *while more tokens are still coming* (the closing fence hasn't
    arrived yet). But `RenderVisualByType` had no way to know when the
    message was actually finished — so if the model's output got cut off
    mid-block (exactly what happened in your Bentley scene screenshot) and
    the JSON never became valid, the spinner had no way to ever resolve.
    Fixed: threaded an `isStreaming` flag down from `MessageList` through
    `MarkdownRenderer` into the visual renderer — once the message is done
    and parsing still fails, it now shows a real error explaining the
    output was cut off, instead of spinning forever.

14. 🟢 **Gia-look setup wizard** — ported the redesigned "Welcome to GIA" step
    from `alpha-1-design/Gia-look-` (only that step, not the rest of the
    wizard): spirit-wave animated backdrop with a toggle, new hero/insignia,
    capability badges, and the two-card provider/local-AI choice. Copied
    `SpiritWaveBackdrop.tsx` + its background image, updated icon imports.
    Type-checks clean, no test regressions.

Will delete this file once everything above is 🟢 and pushed.
