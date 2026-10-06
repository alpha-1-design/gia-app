# Mobile App Exploratory QA

**Date:** 2026-10-06  
**App:** GIA v2.4.0.14  
**Environment:** Web preview at `http://localhost:3000`, mobile-sized browser viewports (390×844 and 320×720). This is not a physical Android-device test.  
**Scope:** Navigated the main modules and Settings pages, checked visible states and safe controls, and reviewed browser logs. No code was changed. No settings were saved, providers or MCP servers connected, permissions changed, or destructive actions performed.

## Confirmed issues

### QA-01 — Settings > Connections crashes

**Priority:** High  
**Status:** Reproduced

Opening **Settings → Connections** replaced the settings page with the error boundary:

> Settings crashed — Maximum update depth exceeded.

The console reported “The result of getSnapshot should be cached to avoid an infinite loop” and identified `CredentialVaultSection` as the component that failed. The page offered only **Retry** and **Copy error**. I left it without retrying.

**Impact:** The Connections settings destination cannot be used in this session.

### QA-02 — Provider status disagrees with request behavior; requests fail at browser CORS

**Priority:** High  
**Status:** Reproduced in the browser session

- During the initial walkthrough, Chat showed **“Online — connecting to provider…”** while also showing no provider configured. The header status tooltip now reports **“No AI provider connected”** when no provider is connected.
- The selected provider was OpenCode Zen, while Engine Room showed **0/71 connected**.
- Browser logs showed POSTs to `https://opencode.ai/zen/v1/chat/completions` blocked by CORS. Attempts through `corsproxy.io` also failed their CORS preflight.
- Logs showed repeated retries from `AnalystModule` (through attempt 5/5) and `ExamModule` (attempt 1/3). The captured requests show the selected OpenCode endpoint and its CORS proxy; they do **not** show a successful switch to a different fallback model.

**Impact:** The UI suggests a connection attempt is active although no provider is configured, and requests are retried when the browser blocks the endpoint. The actual fallback behavior is unclear from the UI and this log evidence.

### QA-03 — Engine Room back control is obscured by the app header on mobile

**Priority:** High  
**Status:** Fixed in this pass; overlay and Back hit target updated

Opening Engine Room displayed its full-screen content, but its **Back** control at the top-left was behind the fixed GIA app header. Browser hit-testing reported the header intercepting clicks on Back. The Engine Room overlay now layers above the app header, and Back has a 44px minimum touch target with an accessible label.

**Impact:** The Engine Room view can be difficult to leave using its own navigation on a phone.

### QA-04 — Chat offered Exam Prep in the no-provider empty state

**Priority:** Medium  
**Status:** Fixed in this pass; manually verified in the mobile preview

The original Chat welcome state said there was no connected provider but still displayed an **Exam Prep** quick-action card. The disconnected state now offers only Local AI setup and provider connection; it no longer shows the Exam Prep prompt, generic rotating tip, or a second redundant no-provider banner.

## Setup or environment limits observed

### QA-05 — Sandbox-dependent features are unavailable in this preview

**Priority:** Medium  
**Status:** Environment confirmed; not an app build failure by itself

- The sandbox health endpoint returned `ok: false` and `backendReady: false`.
- Mical displayed **Sandbox Connection Pending**, **Setup Required**, and **Sandbox unavailable**. Sandbox-dependent actions were disabled.
- The Terminal settings page explains that web uses a sandbox server; the sandbox root filesystem could not be initialized in this workspace environment.

**Impact:** Terminal execution and sandbox-backed actions could not be verified here. Do not treat their behavior in this preview as evidence about a configured Android installation.

### QA-06 — MCP page lists local `localhost` servers as offline

**Priority:** Medium  
**Status:** Reproduced

MCP showed **0/2 connected**. Both listed servers were Offline:

- GIA Stdio Bridge — SSE at `http://localhost:3080`
- Local Ollama — SSE at `http://localhost:11434`

The page explains that a browser can connect to hosted HTTP/SSE servers and that local stdio requires a desktop or configured local runtime. The listed local addresses still need a reachable service in the environment where the app is running; neither server was available in this preview. I did not attempt to connect.

### QA-07 — Native-only calls produce repeated warnings in the web preview

**Priority:** Low  
**Status:** Reproduced

Module navigation repeatedly logged `GIACore.stopCoreService()` as unimplemented on web. Other platform-related warnings included `App.getInfo` during update checks and `GIATerminal` being unavailable. The browser also logged a missing `pwa-camera-modal` and a file-chooser user-activation warning during the session.

**Impact:** These expected web/native mismatches add noise to the console and make actionable failures, such as QA-01 and QA-02, harder to spot.

## Module-by-module notes

These are observations from empty/setup states. I did not claim successful AI generation where a working provider was unavailable.

| Module / page | Observed state | Verification limit / note |
|---|---|---|
| **Chat** | Empty welcome state, local-AI/provider calls to action, Exam Prep card, composer, tool/mode controls. | Composer accepted and cleared text. No successful answer or streaming response was verified. Provider mismatch and CORS failures are QA-02. |
| **Build** | Build Mode intro and sample prompts for a to-do app, quiz game, and landing page. | Did not submit a build request; provider and sandbox execution were not available. |
| **Exam** | Setup and Reference tabs; WASSCE/BECE/JAMB/CUSTOM, study modes and subjects. Start Study Session was disabled in the initial state. Reference showed no uploaded assessment files and no exam history. | Did not generate or start an exam. Provider retry failures appeared in the browser logs. |
| **Analyst** | Empty analysis prompt with a Feed data control; CSV/JSON support is described. | Did not submit a new analysis. Existing session logs showed provider retry/CORS failures. |
| **Writer** | Format choices, target-length choices, web research control, and a writing prompt. | Did not generate a draft. |
| **Planner** | Plan and Schedule views, goal prompt, and empty-state explanation. | Did not submit a goal or create schedule data. |
| **Agents** | Empty state said 0 custom agents, 0 tools, and 0 files. Create Agent opened a long form with a 232-tool picker. | Did not save an agent. The tool list is extensive on a phone and may warrant a more compact/searchable picker. |
| **Autonomy** | ON state, 0 active goals, and a 50% proactiveness slider. | No toggle or slider changes were made; no goal execution was tested. |
| **Settings home / Engine Room** | Settings showed 0/71 connected. Engine Room displayed provider entries and its own interface. | Back control issue is QA-03. No credentials were entered. |
| **Settings > Terminal** | Web explanation says terminal uses a sandbox server; no usable terminal controls appeared in the observed page. | Sandbox was unavailable; see QA-05. |
| **Settings > MCP Servers** | Two offline local SSE entries; Filesystem, GitHub, and Memory appear as presets/suggestions. | No server was added or connected; see QA-06. |
| **Settings > GIA Capabilities** | Provider, local AI, Linux terminal, and MCP showed Needs setup; browser fallback capabilities were identified separately. | Consistent with this unconfigured web preview. |
| **Settings > Profile & Identity** | No profile set; GIA Identity, Neural Skills (6 active, 0 custom), Brain Export, and Memory (0). | No profile or identity changes made. |
| **Settings > Connections** | Error boundary crash. | See QA-01. |
| **Settings > Knowledge Base** | 0 documents and 0 chunks; Add Documents entry point. | No files uploaded. |
| **Settings > System & Performance** | Security, code execution, approval, voice, power, and reliability controls. The page explicitly says wake-word detection is disabled in this build and its toggle currently has no effect. | Did not change settings or run tests. |
| **Settings > Permissions** | Permission controls defaulted to “Ask every time.” | No permissions changed. |
| **Settings > Local AI** | Local model/vision setup and downloads offered. | No model download or load was started. |
| **Settings > App & Extensions** | Widgets, modules, plugins, code history, APK install, and developer settings described. | No install or developer action performed. |
| **Settings > Skills Marketplace** | Initially showed “Loading skills”; after waiting, loaded 44 available skills and 0 installed. | No skill installed or created. |
| **Settings > Dashboard** | Local analytics dashboard showed 2 chats, 0 tool calls, 0 model runs, 0 errors and no tracked tool/model usage. | Values are the preview’s current local state, not a broader reliability measurement. |
| **Settings > About** | Changelog, feedback, analytics, and Clear All Chats are present. | Destructive action was not used. |
| **Settings > Unimind** | Relay disconnected, no devices online, Connect disabled until relay URL is entered. | No pairing or connection attempted. |
| **Settings > Neura** | 0 nodes and 0 edges; empty “The sphere is dark” state. | Empty state only; no data to inspect. |
| **Settings > Nexus** | 20 agents / 20 active, with built-in agent descriptions. | Agents module separately reports 0 custom agents; these appear to be separate counts (built-in vs custom), but the distinction could be clearer. |
| **Settings > Mical** | Sandbox setup required/connection pending; several sandbox/network actions disabled. | Consistent with QA-05. No scans, network actions, setup, repair, or reset were triggered. |

## Mobile layout and user feedback

- The sampled screens fit at 390×844 and 320×720 without document-level horizontal overflow.
- This is only a layout check; it does not establish that each screen or action works on a physical phone.
- Product-navigation idea from the walkthrough: make the GIA mark in the upper-left an animated toggle for the navigation side panel. **Implemented in this pass:** the GIA mark animates between the brand and a three-line hamburger while opening/closing the drawer. The drawer remains below the persistent header so the control stays tappable. The avatar remains a secondary toggle; verification is covered by the targeted navigation test.
- The user also questioned whether the welcome check-in and other empty-state content should appear while no AI provider is connected. QA-04 captures the specific Exam Prep inconsistency; provider-state clarity is covered by QA-02.

## What remains unverified

- A successful model connection, prompt response, and streamed answer.
- Actual fallback-model selection and whether retries should happen for an unconfigured provider.
- Provider-backed generation in Build, Exam, Analyst, Writer, and Planner.
- Android-native terminal, voice, camera, permission, wake-word, and lifecycle behavior.
- MCP connections to reachable hosted servers and local services on a physical device.
- Sandbox setup, package operations, build execution, security scans, and network actions on a configured device.
