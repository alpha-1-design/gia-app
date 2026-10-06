# Chat, templates, and agents

GIA's Chat module is the main workspace for asking questions, drafting, and
delegating multi-step work. The composer supports prompt templates, file and
image attachments, provider selection, and opt-in tools and modes.

![GIA chat with agentic tool activity](../screenshots/chat-agentic-tools.png)

## Prompt studio

Choose **Templates** beside the composer to open Prompt Studio. Search and filter
the starting points, then add one to the composer for editing. Selecting a
template does not send it automatically. Frequently used templates move higher
in the list and show their actual use count.

## Specialist agents

Nexus coordinates focused sub-agent tasks and shows the progress and results of
the current or most recent run. GIA ships with specialist personas for research,
analysis, validation, coding, planning, and synthesis. Locally saved custom
agents can add their own instructions and an explicit list of tools; those tools
remain subject to GIA's normal permission and approval checks.

![GIA specialist personas](../screenshots/agents-persona-1.png)

## Collaboration

When Multi-Provider Collaboration is enabled, GIA checks configured cloud
endpoints, asks up to three reachable providers for perspectives, and synthesizes
their responses. The Chat activity panel shows endpoint checks, provider work,
tool/research activity, failures, and synthesis as the run progresses. Local
providers are not part of this cloud-provider fan-out.

For model setup and endpoint behavior, see
[Providers and collaboration](./providers-and-collaboration.md). For MCP tools
and local agent configuration, see [Nexus and MCP](./nexus-and-mcp.md).
