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

6. 🔴 **Contradiction: Terminal tab says "Linux Installed", Security tab says
   "Setup Required"** — two separate install-state flags for what should be
   one Alpine sandbox, not kept in sync. Investigating `SandboxSubPage.tsx` /
   `SecuritySection.tsx`.

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

9. 🔴 **Per-item expand/collapse on the actions/thoughts trail** — code for
   this already exists and looks correct (`SegmentedReasoning.tsx` gives each
   `ThinkingBlock`/`ToolBlock` its own independent `open` state) — likely was
   reading as "doesn't work" only because of #7/#8 making every header show
   junk. Re-checking after the fix; will confirm independently.

10. 🟢 **File edit shows as a floating card instead of inline in chat** —
    fixed: `LiveFileEditor.tsx` was `position: fixed; bottom-4 right-4`,
    pinned to the viewport corner. Changed to relative/full-width so it lays
    out inline in the chat body where it already sits in the DOM (right
    after the tool-execution cards, at the point where the live-editing
    turn is happening).

11. 🔴 **Floating orb says "not implemented"** — investigating.

12. 🔴 **Assistant message bubble doesn't reach the left edge / alignment
    looks off vs the right side** — investigating message bubble CSS.

13. 🔴 **Visualization stuck on "Generating visualization..." forever** —
    investigating `ThreeVisual.tsx` / visualization dispatch.

14. 🟢 **Gia-look setup wizard** — ported the redesigned "Welcome to GIA" step
    from `alpha-1-design/Gia-look-` (only that step, not the rest of the
    wizard): spirit-wave animated backdrop with a toggle, new hero/insignia,
    capability badges, and the two-card provider/local-AI choice. Copied
    `SpiritWaveBackdrop.tsx` + its background image, updated icon imports.
    Type-checks clean, no test regressions.

Will delete this file once everything above is 🟢 and pushed.
