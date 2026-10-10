# GIA — Generative Interface Agent

GIA is a local-first AI workspace for chat, writing, analysis, planning, agents,
and device-aware workflows. Connect a cloud provider or use a supported local
model; when collaboration is enabled, GIA can send a request to up to three
configured cloud providers.

Part of the GIA family: [GIA Cowork](https://github.com/alpha-1-design/gia-cowork)
(desktop, real shell and screen control) · [GIA CLI](https://github.com/alpha-1-design/gia-cli)
(terminal coding agent).

![GIA app icon](docs/screenshots/gia-icon-hero.png)

[![CI](https://github.com/alpha-1-design/gia-app/actions/workflows/ci.yml/badge.svg)](https://github.com/alpha-1-design/gia-app/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.4.0.17-amber.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Web-blue.svg)](capacitor.config.ts)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

## Start here

- [GIA manual](manual.md) — how to use the app and its modules.
- [Feature guides](docs/features/README.md) — focused guides for Chat, providers,
  Nexus, documents, privacy, and development.
- [Latest releases](https://github.com/alpha-1-design/gia-app/releases) — Android
  builds and release notes.
- [Report a bug](https://github.com/alpha-1-design/gia-app/issues/new/choose) · [Contributing](CONTRIBUTING.md)

## Explore GIA

| Chat and tools | Nexus agents |
| --- | --- |
| ![Chat with agentic tool use](docs/screenshots/chat-agentic-tools.png) | ![Nexus agent personas](docs/screenshots/agents-persona-2.png) |

| Analysis | Android sandbox |
| --- | --- |
| ![Analyst charts](docs/screenshots/analyst-bar.png) | ![Terminal execution](docs/screenshots/terminal-execution.png) |

## Feature guides

| Area | Guide |
| --- | --- |
| Chat, Prompt Studio, agents, collaboration | [Chat, templates, and agents](docs/features/chat-and-agents.md) |
| Model providers and multi-provider runs | [Providers and collaboration](docs/features/providers-and-collaboration.md) |
| Local custom agents and MCP servers | [Nexus and MCP](docs/features/nexus-and-mcp.md) |
| File attachments, PDF extraction, sandbox | [Documents and workspace](docs/features/documents-and-workspace.md) |
| Local data, cloud calls, Android and web | [Privacy and platforms](docs/features/privacy-and-platforms.md) |

## Development

Requires Node.js and npm. Install dependencies and start the development server:

```bash
npm ci --legacy-peer-deps
npm run dev
```

Run the checks before submitting changes:

```bash
npm run lint
npm run test:run
npm run build
```

See the [development guide](docs/features/development.md) for the architecture
map and Android sync command.

## License

GIA is distributed under the [Apache License 2.0](LICENSE).
