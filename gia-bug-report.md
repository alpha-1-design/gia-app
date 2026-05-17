# GIA v2.2.0 — Full Bug Report & Improvement Spec
## For the fixing agent · Prepared from codebase audit · May 2026

---

## 🔴 CRITICAL BUGS (Broken Features)

---

### BUG-01 · Listen Mode — Microphone Keeps Calling Repeatedly
**File:** `src/hooks/useVoiceControl.ts`
**Root Cause:**
`listenOnce()` calls `SpeechRecognition.start()` and then recursively schedules itself with `setTimeout(listenOnce, 300)` — regardless of whether the user actually said anything. On Android, `SpeechRecognition.start()` is a blocking one-shot call that returns when it finishes. The loop runs again 300ms later, fires the mic permission, starts again, and so on — infinitely as long as `activeRef.current` is true. There is no idle/back-off gate.

**Also:** `AmbientInput.tsx` has its own *separate* duplicate microphone implementation (`toggleListening()`) that also calls `SpeechRecognition.start()` directly, independent of `useVoiceControl`. So there are **two** mic call loops potentially running at once — one from the hook, one from the input button.

**Fix:**
```bash
# In useVoiceControl.ts → listenOnce():
# Add a debounce + activity gate. Only re-arm the loop if the last
# call actually returned a result. Add minimum 2s back-off between sessions.
# 
# In AmbientInput.tsx:
# Remove the entire inline SpeechRecognition implementation from toggleListening().
# AmbientInput's mic button should call voiceControl.startListening() / stopListening()
# from the hook passed as a prop — not run its own parallel mic session.
```

---

### BUG-02 · Listen Mode — onTranscript AND onResult Both Fire
**File:** `src/hooks/useVoiceControl.ts` → `processTranscript()`
**Root Cause:**
```ts
onResult?.(text);      // fires
onTranscript?.(text);  // ALSO fires
```
Both callbacks are called for every transcript. In `ChatModule.tsx`, `onTranscript` is wired to `handleVoiceTranscript` (which polishes and sets input). `onResult` is not passed in that call site, but the hook also fires `onResult` internally — meaning if any future caller passes both, the transcript is processed twice. The `onResult` callback is redundant; it serves the same purpose as `onTranscript`. This is a design bug.

**Fix:** Remove `onResult` from `processTranscript`. Keep only `onTranscript`. Update the interface.

---

### BUG-03 · File Creation — GIA Says "Saved" But Nothing Was Saved
**File:** `src/services/GiaTools.ts` → `filesystem_write` tool
**Root Cause:**
When running in a browser (not native Capacitor), `filesystem_write` triggers a `<a download>` click and returns `success: true` with the message `"File is ready for download. Your browser should have prompted you to save it."` — but on Android WebView inside Capacitor, `document.createElement('a')` download links **do not trigger the Android download manager**. They silently fail. GIA then reports success to the LLM, the LLM tells the user the file was saved, but it was never written anywhere.

**Fix:**
```bash
# In filesystem_write, the isNativePlatform() check must be the FIRST gate:
# - If native → always use Filesystem.writeFile (Capacitor plugin)
# - If web browser (not native) → use the blob/anchor download
# 
# The current code already does this... BUT the isNativePlatform() helper
# reads window.Capacitor but NOT Capacitor.isNativePlatform(). On Android
# WebView, window.Capacitor exists but isNativePlatform() can return false
# during early boot before the bridge is ready.
# 
# Fix: use a more reliable check:
#   (window as any).Capacitor?.getPlatform?.() === 'android'
# instead of isNativePlatform() in GiaTools.ts
```

---

### BUG-04 · Thinking / Extended Thinking — Not Visible During Streaming
**File:** `src/modules/ChatModule.tsx`
**Root Cause:**
`thoughtsAccumulated` is passed to `updateMessage()` during streaming, which is correct. BUT — the message bubble only shows the "Show thinking" button when `msg.thoughts` exists **and the message is already finalized**. During streaming, `msg.thinking = true` (the 3-dot spinner shows), but the actual thought content is invisible. There is no live thought preview while the model is reasoning. The user sees nothing until the full response lands.

Additionally: for non-Anthropic providers, "extended thinking" only appends a `<think>` instruction to the system prompt. The model may or may not wrap its reasoning in `<think></think>`. The parser at line ~434 only processes `<think>` if it arrives inline during streaming — but if the model emits the `<think>` block before the main response (common with DeepSeek, QwQ), it gets mixed into `accumulated` instead of `thoughtsAccumulated`.

**Fix:**
```bash
# 1. Show a live "Thinking..." collapsible panel during streaming when
#    thoughtsAccumulated has content. Don't wait for the message to finalize.
#
# 2. For the <think> parser: process the stream character-by-character to
#    detect <think> opening before any text accumulates in the main buffer.
#    Once <think> is opened, route ALL subsequent tokens to thoughtsAccumulated
#    until </think> is found.
#
# 3. Add a pulsing indicator in the message bubble when thoughts are being
#    written live (similar to the 3-dot thinking dots but labeled "Reasoning...").
```

---

### BUG-05 · Stop / Kill Response — Leaves Ghost Message on Partial Stop
**File:** `src/modules/ChatModule.tsx` → `handleStop()`
**Root Cause:**
`handleStop()` checks: if the ghost message has no content OR `msg.thinking === true`, delete it. But if the user stops mid-stream (after some tokens arrived, so `ghost.content` is non-empty), the partial message stays with an incomplete response and no indicator that it was cut off. The user can't tell if GIA stopped intentionally or crashed.

Also: `handleStop()` only aborts `abortRef.current`, but the `loading` state is set to false and `streamingMsgId` cleared — however if `handleStop` is called while the `generate()` loop is in a tool execution (between `await tool.execute()` and the next XHR), the abort signal won't cancel the already-running tool. The tool finishes, tries to `updateMessage`, finds the message was removed, and throws an unhandled error.

**Fix:**
```bash
# 1. When stop fires mid-stream (ghost.content exists):
#    - Keep the partial message
#    - Append "\n\n*[Response stopped]*" to the content
#    - Mark msg.error = false, add a distinct 'stopped' flag or style
#
# 2. Add AbortSignal checks inside each tool execute() call in GiaBrain.ts
#    at the start of the tool loop iteration.
#
# 3. After abort, wrap the tool result updateMessage in a try/catch that
#    checks if the session message still exists before updating.
```

---

### BUG-06 · Silent Response Failure — Empty String Returned, UI Shows Nothing
**File:** `src/services/GiaBrain.ts` → `callAnthropic()` + `callGeminiNative()`
**Root Cause:**
Both streaming paths return `{ text: '', ... }` when `req.signal?.aborted` at the start. This is correct for abort. But they ALSO return `{ text: '' }` if the XHR fires `onload` before any `onprogress` events delivered tokens (network race condition, zero-byte chunk). The `fullText` is empty, `ChatModule` calls `updateMessage(id, '')`, and the message bubble is blank — no error, no retry hint.

Separately: if the Anthropic response has `content_block_start` with `type: 'thinking'` as the FIRST block (extended thinking), the `thinking` field is on the block object, not the delta. The current parser checks `parsed.content_block?.type === 'thinking'` but only reads `parsed.content_block.thinking` — which doesn't exist on the start event (it's empty until deltas come). The actual content comes via `content_block_delta` with `type: 'thinking_delta'`, which IS handled. So this is mostly fine, but the `content_block_start` branch is dead code that reads a field that doesn't exist.

**Fix:**
```bash
# 1. After streaming completes in all providers:
#    if (fullText.trim() === '') {
#      reject/throw with a descriptive error: "Empty response received from [provider]"
#    }
#
# 2. Remove the dead content_block_start.thinking read in callAnthropic.
#
# 3. In ChatModule catch blocks for voice/continue handlers (lines ~277, ~282):
#    The continue handler shows the raw error string as the message content.
#    Wrap it: updateMessage(id, `⚠️ ${msg}`, undefined, true /* isError */)
#    so the error is visually distinct, not just raw text.
```

---

### BUG-07 · ZIP Bundling — Android Path Never Triggers Browser Download Cleanup
**File:** `src/services/GiaTools.ts` → `zip_project` tool
**Root Cause:**
On native Android, after `Filesystem.writeFile()` saves the ZIP, the code never calls `URL.revokeObjectURL(url)`. The blob URL created by `URL.createObjectURL(blob)` and the `<a>` element click both run *before* the native write path:

```ts
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename;
document.body.appendChild(a);
a.click();             // ← fires on Android WebView (no-op, but still runs)
document.body.removeChild(a);
// Then enters the isNativePlatform() branch — URL is never revoked
```

So on Android: the blob URL leaks memory, AND the `a.click()` runs (a no-op in WebView but wastes cycles). The native write may also fail silently if the base64 FileReader conversion fails — there's no error handling on the FileReader `onerror`.

**Fix:**
```bash
# Restructure zip_project:
# if (isNativePlatform()) {
#   // Skip the anchor/blob download entirely
#   const base64 = await blobToBase64(blob);  // with proper error handling
#   await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Documents });
#   addNotification(`✅ ${filename} saved to Documents`);
#   return { success: true, content: `Saved ${filename} to your Documents folder.` };
# } else {
#   // Browser: blob URL + anchor click + revokeObjectURL
# }
```

---

### BUG-08 · Voice Transcript — Polishing Fires a Full AI Request Every Time
**File:** `src/modules/ChatModule.tsx` → `handleVoiceTranscript()` + `AmbientInput.tsx` → `refineSpeech()`
**Root Cause:**
Every single voice transcript — even 2-word phrases — triggers a full `GiaBrain.generate()` call with `maxTokens: 1000` just to "polish" the speech. On low-data connections (the target GIA market: Ghana, Nigeria), this is wasteful. Short phrases under 5 words don't benefit from polishing. There's also no timeout — if the polish request hangs, the user's input box stays empty until it resolves or errors.

Additionally: `AmbientInput.tsx` has its own `refineSpeech()` function that ALSO calls `GiaBrain.generate()` — so if the AmbientInput mic button is used (not listen mode), a second polish request fires in parallel from a different code path. Two polish requests for the same transcript.

**Fix:**
```bash
# 1. Add a word-count gate: only polish if transcript.split(' ').length >= 8
#
# 2. Add a 5-second timeout to the polish GiaBrain call. On timeout, fall back
#    to raw transcript with a soft notification.
#
# 3. Consolidate: remove refineSpeech() from AmbientInput.tsx entirely.
#    AmbientInput should call a shared hook method, not run its own brain call.
```

---

## 🟡 FEATURES REGISTERED BUT NOT WORKING CORRECTLY

---

### FEAT-01 · Extended Thinking — Only Works for Anthropic, Broken for Others
**File:** `src/services/GiaBrain.ts` → `callOpenAICompat()` with `useExtendedThinking`
**Root Cause:**
For non-Anthropic providers, "extended thinking" just appends this to the system prompt:
```
Think step-by-step before answering. Show your reasoning inside <think> tags
```
This works inconsistently — models like GPT-4o ignore `<think>` tags and just reply normally. The thought is never separated from the response content. The `<think>` parser in ChatModule expects the model to literally wrap reasoning in `<think>...</think>` but GPT-4o doesn't do this natively.

**Fix:**
```bash
# For OpenAI/Groq/OpenRouter: use a two-message approach:
# Message 1 to model: "Reason through this step by step. Output ONLY your reasoning."
# Message 2 (chained): take that reasoning + original prompt → generate final answer.
# OR: use OpenAI's "o1"/"o3" models which have native reasoning support.
# Show a UI note: "Extended Thinking works best with Claude or o1/o3 models."
```

---

### FEAT-02 · Hands-Off Mode — Tool Execution Gate Allows Clarification Unconditionally
**File:** `src/services/GiaBrain.ts` → `generate()` loop
**Root Cause:**
`request_clarification` bypasses the `isHandsOff` check entirely — it always executes even when Hands-Off is OFF. This is intentional per the comment, but it means GIA can pop a clarification dialog mid-conversation even when the user expects GIA to stay passive. If hands-off is off and GIA uses a tool, the system pushes an OBSERVATION telling it to respond without tools — but then the model may loop again and call `request_clarification` again, which always fires, creating a clarification loop.

**Fix:**
```bash
# Add a max clarification attempts counter (max 1 per generate() call).
# If clarification already fired once, block subsequent clarification calls
# and force GIA to respond directly.
```

---

### FEAT-03 · sub_agent_call Tool — Registered But Always Returns "Delegation request sent to brain loop"
**File:** `src/services/GiaTools.ts`
**Root Cause:**
The `sub_agent_call` tool's `execute()` returns immediately with `{ success: true, content: 'Delegation request sent to brain loop' }` — it does nothing. The actual delegation logic is in `GiaBrain.generate()` via the `delegateTask()` method. But if GIA emits a `sub_agent_call` tool block and it goes through `GiaTools.getTool('sub_agent_call').execute()` instead of the special `toolCall.id === 'sub_agent_call'` branch in the loop... the loop uses `getTool()` first, which means the delegation never runs — it hits the `execute()` stub and returns the fake message.

**Root cause:** In the `generate()` loop, the code checks for `sub_agent_call` with `else if (toolCall.id === 'sub_agent_call')` AFTER the `if (tool)` branch — but `getTool('sub_agent_call')` returns the stub tool, so the `if (tool)` branch fires first. The `else if` never runs.

**Fix:**
```bash
# In GiaBrain.generate() loop, check for sub_agent_call BEFORE calling getTool():
# if (toolCall.id === 'sub_agent_call') { ... delegateTask ... }
# else if (toolCall.id === 'request_clarification') { ... }
# else { const tool = GiaTools.getTool(toolCall.id); ... }
#
# Remove sub_agent_call from GiaTools.registerBuiltInTools() entirely —
# it doesn't need to be in the tool registry since it's handled inline.
```

---

### FEAT-04 · AmbientInput Mic Button — Duplicate, Disconnected System
**File:** `src/components/AmbientInput.tsx`
**Root Cause:**
AmbientInput has a Mic button (`toggleListening`) that runs its own complete SpeechRecognition session separate from the `useVoiceControl` hook in ChatModule. This means:
- The Listen mode toggle in the toolbar (useVoiceControl) is one system
- The Mic button in the input bar (AmbientInput) is a completely separate system
- They can both be active at the same time
- Neither knows about the other's state
- The `isListening` state in AmbientInput never syncs with `voiceEnabled` in ChatModule

**Fix:**
```bash
# Pass voiceControl.isListening and voiceControl.startListening/stopListening
# as props to AmbientInput. Replace the entire toggleListening() implementation
# with just: voiceControl.startListening() / voiceControl.stopListening().
# Delete the local isListening state and the duplicate SpeechRecognition code.
```

---

## 🟠 AREAS OF IMPROVEMENT (Things That Work But Badly)

---

### IMP-01 · No Real-Time Thinking Indicator During Reasoning
Currently: the 3-dot spinner shows while thinking. But users don't know if GIA is thinking deeply or just slow. If extended thinking is ON, there's no visible "Reasoning..." live panel like Claude.ai shows.

**Improvement:**
```bash
# Show a collapsible live "💭 Reasoning..." panel that streams thought tokens
# in real time while the main response is empty. Once the main response starts
# streaming, collapse the thoughts panel to a "Show thinking" button.
# Use amber color (already defined) to distinguish thought from response.
```

---

### IMP-02 · Stop Button Visibility — Only Shows in AmbientInput, Not in Message Feed
The stop button (Square icon) is only in AmbientInput's bottom bar. On long responses the user scrolls up and can't reach the stop button easily. No floating stop button.

**Improvement:**
```bash
# Add a floating "Stop" button that appears fixed at the bottom-center of the
# message list (above AmbientInput) whenever loading=true. This should be
# z-indexed above the message list. Tap stops generation.
```

---

### IMP-03 · File Write Success Confirmation — No Verification
When `filesystem_write` succeeds on native Android, it returns `"File written to {path}"` but never verifies the file actually exists after writing. If the Capacitor Filesystem plugin silently fails (permission edge case), GIA reports success.

**Improvement:**
```bash
# After Filesystem.writeFile(), immediately call Filesystem.stat({ path })
# to verify the file exists and has size > 0.
# Only return success if stat succeeds.
```

---

### IMP-04 · ZIP Progress Notifications Are Noisy and Unreliable
`zip_project` fires notifications at every 25% of zip generation (so 4 notifications). These are toast notifications that stack. On a large zip, 4 popups appear in quick succession.

**Improvement:**
```bash
# Replace the 4 progress notifications with a single persistent status in the
# message bubble (update the assistant message content with "Packaging... 25%",
# "Packaging... 50%", etc.) instead of toast stacking.
```

---

### IMP-05 · Voice Wake Word — wakeWordRef Never Updates Live
`wakeWordRef` is initialized once at mount from `localStorage`. If the user changes the wake word in Settings while the chat is open, the change never takes effect until a full app restart.

**Improvement:**
```bash
# Replace wakeWordRef with a reactive store value.
# Add 'wakeWord' to useGiaStore and read it directly in the useVoiceControl config.
# When the user updates it in Settings, the hook auto-receives the new value.
```

---

### IMP-06 · No Offline / No-API-Key Graceful Handling
If the user opens GIA without an API key configured, the error only surfaces when they try to send a message: `"No provider connected. Go to Settings → Engine Room and type: connect"`. The message appears as a raw error string in the chat.

**Improvement:**
```bash
# On app load, check if any provider is configured.
# If not, show a banner at the top of ChatModule:
# "⚡ No AI provider configured — tap here to set up your API key"
# that deep-links to Settings. Don't wait for the first failed send.
```

---

### IMP-07 · Streaming Race — lastProcessed Can Skip Tokens
In `callOpenAICompat` streaming (XHR onprogress), `lastProcessed = xhr.responseText.length` is set AFTER `processLines(newData)`. If `onprogress` fires again before `processLines` returns (overlapping events), the `newData` slice may include already-processed bytes. This is unlikely in practice but is a race condition in the progress accounting.

**Improvement:**
```bash
# Set lastProcessed BEFORE processLines (not after), capturing the length
# of what we're about to process, not what we just processed.
# Or: switch to a cursor-based buffer approach that tracks processed line endings.
```

---

### IMP-08 · Memory Leak — Blob URLs in filesystem_write (Browser Path)
`filesystem_write` calls `URL.revokeObjectURL(url)` after 10s timeout. But if the component unmounts or the user navigates away within 10s, the timeout still fires on the detached DOM. On a long session with many file writes, many blob URLs accumulate.

**Improvement:**
```bash
# Track all blob URLs in a module-level Set.
# On each new write, revoke any previously created blob URLs immediately.
# Add a cleanup on GiaTools initialization / app teardown.
```

---

## 🔵 MISSING FEATURES (GIA Has the Infrastructure, Feature Was Never Wired)

---

### MISS-01 · Download Button for Code Blocks — Listed as Capability, Never Confirmed Working
The system prompt tells GIA: "Code blocks with syntax highlighting — the user can Run, Copy, or Download code."
`CodeBlock.tsx` should have a Download button. Verify it's actually implemented and the download triggers correctly on Android.

```bash
# Audit: grep -n "download\|Download" src/components/CodeBlock.tsx
# If missing: add a Download button that calls filesystem_write with the code
# content and filename derived from the language (e.g., code.py, code.js).
```

---

### MISS-02 · TTS (Text-to-Speech) — Speak Called But TTSService Might Be Stub
`TTSService.speak(accumulated)` is called after every response. Check if `TTSService` is fully implemented or a stub.

```bash
# Audit: cat src/services/TTSService.ts
# Verify it actually calls the native TTS plugin and not just console.log.
# Add a settings toggle: "Read responses aloud" that gates the speak() calls.
```

---

### MISS-03 · SchedulerService — Imported Nowhere in Active Code
`src/services/SchedulerService.ts` exists but grep shows it's not imported in ChatModule, PlannerModule, or anywhere active. Scheduled tasks are a listed capability.

```bash
# Audit: grep -rn "SchedulerService\|import.*Scheduler" src/
# Wire SchedulerService into PlannerModule so scheduled tasks actually fire.
```

---

### MISS-04 · get_environment_info Reports zipBundling: true, fileDownloads: true — Verify Both Work on Android
The `get_environment_info` tool hardcodes `zipBundling: true` and `fileDownloads: true` in its uiCapabilities. These should be dynamically derived from `isNativePlatform()` since file downloads don't work the same way on Android vs browser.

```bash
# Make uiCapabilities reflect actual platform:
# fileDownloads: isNativePlatform() (native uses Filesystem, browser uses anchor)
# zipBundling: true (works on both)
# filesystemAccess: isNativePlatform()
```

---

## SUMMARY TABLE

| ID | Severity | File | Issue |
|----|----------|------|-------|
| BUG-01 | 🔴 Critical | useVoiceControl.ts + AmbientInput.tsx | Mic loops infinitely, two parallel mic sessions |
| BUG-02 | 🔴 Critical | useVoiceControl.ts | onResult + onTranscript both fire (double processing) |
| BUG-03 | 🔴 Critical | GiaTools.ts | File "saved" but never actually written on Android WebView |
| BUG-04 | 🔴 Critical | ChatModule.tsx | Thinking content invisible during streaming |
| BUG-05 | 🟠 High | ChatModule.tsx | Stop leaves ghost messages, tool mid-exec not cancelled |
| BUG-06 | 🟠 High | GiaBrain.ts | Empty response = silent blank message, no error shown |
| BUG-07 | 🟠 High | GiaTools.ts | ZIP on Android: blob URL leak, anchor fires, FileReader no onerror |
| BUG-08 | 🟡 Medium | ChatModule.tsx + AmbientInput.tsx | Polish AI call fires on every transcript, even 2-word phrases |
| FEAT-01 | 🟠 High | GiaBrain.ts | Extended thinking only works for Anthropic, broken for others |
| FEAT-02 | 🟡 Medium | GiaBrain.ts | Clarification bypasses hands-off, can loop |
| FEAT-03 | 🔴 Critical | GiaTools.ts + GiaBrain.ts | sub_agent_call never executes, stub intercepts first |
| FEAT-04 | 🟠 High | AmbientInput.tsx | Mic button is a duplicate disconnected system |
| IMP-01 | 🟡 Medium | ChatModule.tsx | No live thinking stream visible to user |
| IMP-02 | 🟡 Medium | ChatModule.tsx | Stop button unreachable when scrolled up |
| IMP-03 | 🟡 Medium | GiaTools.ts | File write success not verified after write |
| IMP-04 | 🟢 Low | GiaTools.ts | ZIP progress = 4 stacked toasts |
| IMP-05 | 🟡 Medium | ChatModule.tsx | Wake word change doesn't apply without restart |
| IMP-06 | 🟡 Medium | ChatModule.tsx | No no-API-key banner on load |
| IMP-07 | 🟢 Low | GiaBrain.ts | Streaming race in lastProcessed tracking |
| IMP-08 | 🟢 Low | GiaTools.ts | Blob URL memory leak on file writes |
| MISS-01 | 🟡 Medium | CodeBlock.tsx | Download button may not work on Android |
| MISS-02 | 🟡 Medium | TTSService.ts | TTS may be a stub |
| MISS-03 | 🟠 High | SchedulerService.ts | Scheduler not wired to any module |
| MISS-04 | 🟢 Low | GiaTools.ts | Environment info hardcodes capabilities instead of detecting |
