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

## Security Design

GIA is built on a **local-first architecture**:

- No telemetry, analytics, or data collection
- API keys stored on-device (IndexedDB)
- PIN lock via SHA-256 (Web Crypto API)
- All AI provider communication is direct (no proxy/middleman)
- No backend servers or cloud dependency
