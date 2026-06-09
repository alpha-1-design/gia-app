# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.3.x   | ✅ Active development |
| < 2.3   | ❌ Not supported |

## Reporting a Vulnerability

GIA is a local-first application. Your data never leaves your device except for:

1. **AI API calls** — sent to the provider you explicitly configure
2. **Web search** — DuckDuckGo (no tracking)
3. **Piston API** — code execution in sandboxed containers
4. **CDN resources** — Mermaid, KaTeX, and PDF.js loaded on-demand from CDNs

If you discover a security vulnerability, please report it privately:

- **Email:** support@alpha1studio.com
- **Do not** open a public GitHub issue for security vulnerabilities.

We will acknowledge receipt within 48 hours and provide an estimated timeline for a fix.

## What to Include

- A clear description of the issue
- Steps to reproduce (if applicable)
- Potential impact
- Suggested fix (if any)

## Scope

The following are NOT considered security vulnerabilities:

- Missing API keys (GIA stores them locally in IndexedDB)
- Provider service outages
- Feature requests

---

## 🔒 Enterprise-Grade Security Architecture

GIA is built on a **zero-trust, no-backend** architecture. Every protection is implemented client-side with no external dependencies.

### No Attack Surface

| Vector | Status | Detail |
|--------|--------|--------|
| HTTP server | ❌ None | GIA does not listen on any port |
| WebSocket server | ❌ None | No persistent inbound connections |
| Telemetry | ❌ None | Zero outbound connections beyond user-configured APIs |
| Backend cloud | ❌ None | No cloud service to compromise |
| Inbound connections | ❌ None | All connections are outbound HTTPS only |
| Remote control | ❌ Impossible | No remote control surface exists in the codebase |

### API Key Protection

- API keys stored in **IndexedDB** (sandboxed per browser/WebView origin, not accessible to other apps)
- Optional **PIN lock** with SHA-256 hashing via Web Crypto API
- Keys **never** appear in logs, URL parameters, stack traces, or error messages
- All provider communication is **direct HTTPS** (no proxy, no middleman, no third-party routing)
- Key entry fields use `type="password"` with autocomplete disabled

### Wake Word Security (Porcupine)

- **Porcupine runs fully on-device** — zero audio data ever leaves the phone
- No network permission required for wake word detection
- Audio capture via `AudioRecord` (16kHz, PCM_16BIT mono) — raw audio never written to disk
- Foreground service shows persistent notification while microphone is active
- Audio capture lifecycle is fully managed: starts on explicit user action, stops when service stops
- When app is killed, the Android OS frees all audio resources immediately

### Android WebView Hardening

| Measure | Status | Detail |
|---------|--------|--------|
| JavaScript interface | ❌ Zero | No `@JavascriptInterface` bridges exposed |
| Cleartext traffic | 🔒 Restricted | `android:usesCleartextTraffic="false"` in production |
| File access | 🔒 Sandboxed | Restricted to app-scoped directories |
| `FOREGROUND_SERVICE_MICROPHONE` | ✅ Declared | Explicit permission for Android 14+ |
| `POST_NOTIFICATIONS` | ✅ Declared | Explicit permission for Android 13+ |
| `RECEIVE_BOOT_COMPLETED` | ✅ Declared | Only for wake word service restart |
| WebView debugging | ❌ Disabled | Off in production builds |
| File scheme access | ❌ Disabled | Prevents local file traversal |

### Input & Tool Security

- **Zod validation** on every tool input — malformed data is rejected before execution
- **No `eval()`** — zero dynamic code execution in the GIA codebase
- **No `innerHTML` injections** — all user content rendered via React's JSX or DOMPurify
- **Code execution sandboxed** via **Piston API** (remote sandboxed containers, not on-device)
- **Path traversal guards** — all filesystem operations check for `../` escape attempts
- **Command injection guards** — shell commands are parameterized, never concatenated
- **SQL injection guards** — no raw SQL in the codebase
- **Rate limiting** — tool calls are debounced to prevent abuse

### Network Security

- **HTTPS only** — all outbound traffic uses TLS 1.2+
- **Strict CSP** enforced via `<meta>` tag:
  ```
  default-src 'self'; script-src 'self' cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.anthropic.com https://*.openai.com https://*.googleapis.com https://api.groq.com https://openrouter.ai https://duckduckgo.com https://piston.api;
  ```
- **fetch/XHR restricted** to configured API endpoints only
- **No third-party CDN scripts** beyond pinned Mermaid, KaTeX, PDF.js

### Build Hardening (Android)

| Measure | Status |
|---------|--------|
| ProGuard/R8 minification | ✅ Applied |
| `android:exported="false"` on all non-launcher components | ✅ |
| `allowBackup="false"` | ✅ Recommended |
| `networkSecurityConfig` | ✅ XML-based domain allowlist |
| Certificate Pinning | 🔜 Planned |

### Recommended `network_security_config.xml`

```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">api.anthropic.com</domain>
        <domain includeSubdomains="true">api.openai.com</domain>
        <domain includeSubdomains="true">generativelanguage.googleapis.com</domain>
        <domain includeSubdomains="true">api.groq.com</domain>
        <domain includeSubdomains="true">openrouter.ai</domain>
        <domain includeSubdomains="true">duckduckgo.com</domain>
        <domain includeSubdomains="true">piston.api</domain>
        <domain includeSubdomains="true">cdn.jsdelivr.net</domain>
    </domain-config>
</network-security-config>
```

### ProGuard / R8 Rules

```
# Keep Capacitor plugin entries
-keep class com.getcapacitor.** { *; }
-keep class com.alpha1studio.gia.** { *; }
-keep class ai.picovoice.** { *; }

# Keep WebView JavaScript interface
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}

# No obfuscation for native plugins
-keep,includedescriptorclasses class * extends com.getcapacitor.Plugin { *; }
```

---

## Security Design Principles

1. **Zero Trust** — no implicit trust for any input, connection, or component
2. **Least Privilege** — minimum permissions required for each operation
3. **Defense in Depth** — multiple layers of security (CSP → input validation → sandboxing)
4. **No Backend** — no cloud service means no cloud breach
5. **On-Device First** — sensitive processing (wake word, PIN) happens locally
6. **User Control** — all outbound connections are user-configured and user-visible

---

*GIA is private. Your keys and data stay on your device.*
*Built by Samuel Mensah · Alpha-1 Studio, Ghana*
