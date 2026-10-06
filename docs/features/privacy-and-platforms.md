# Privacy and platforms

GIA is designed as a local-first workspace. Core application state is persisted
on the device using IndexedDB. GIA does not require a central application
backend for ordinary provider requests; when you configure a cloud AI provider,
the prompts and attachment text you send are transmitted to that provider under
its terms and privacy policy.

![GIA app icon](../screenshots/gia-icon-hero.png)

## Data and connections

- Provider credentials and app state are stored locally by the app.
- Cloud provider calls, MCP servers, connectors, and configured messaging
  services involve external endpoints you choose to connect.
- Local models can be used without sending prompts to a cloud AI provider when
  configured and selected. Model downloads may still contact their hosting CDN.
- Review tool approval requests before allowing tools that change data or use
  external services.

## Android and web

GIA's primary native target is Android through Capacitor. The web build supports
browser-compatible features; native capabilities such as terminal access,
device integrations, and some permissions are not available in an ordinary
browser.

For setup and local development commands, see
[Development](./development.md). For features, see the
[GIA manual](../../manual.md).
