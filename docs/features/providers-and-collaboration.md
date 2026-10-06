# Providers and collaboration

GIA connects to AI services through provider adapters. Configure a provider and
model in **Settings → Providers**; API credentials are stored in the app's local
provider settings. Requests go to the configured provider endpoint.

![GIA chat provider selector](../screenshots/chat-agentic-tools.png)

## Provider choices

The registry includes cloud providers, OpenAI-compatible endpoints, and local
options such as Ollama and LM Studio. Provider catalogs may be fetched live;
curated model choices are also available when live listing is unavailable.
Availability, model IDs, capabilities, and pricing are controlled by each
provider and can change independently of GIA.

OpenCode Zen is configured at `https://opencode.ai/zen/v1`. Its curated catalog
uses current Zen model IDs, including `deepseek-v4.1-flash`,
`deepseek-v4-flash`, and `deepseek-v4-pro`. Existing installations using the
retired `deepseek-v4-flash-free` selection are migrated to the current default
when provider settings load.

## Multi-Provider Collaboration

Enable collaboration in **Settings → Reliability**. GIA prioritizes the active
provider, considers at most three configured cloud providers, and checks their
endpoints before sending the collaboration request. It skips unreachable
endpoints, returns the available provider's answer when only one responds, and
uses the primary configured provider to synthesize when multiple providers
respond.

Collaboration requires working provider credentials and endpoints. It is not a
guarantee of independent verification or factual consensus; review cited
evidence and disagreements in the final response.

See [Chat, templates, and agents](./chat-and-agents.md) for the live activity
display and [Privacy and platforms](./privacy-and-platforms.md) for local-data
and network details.
