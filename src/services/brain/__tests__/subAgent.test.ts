import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentStore } from '../../../store/useAgentStore';

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));

vi.mock('../../GiaBrain', () => ({
  default: { generate },
}));

vi.mock('../toolSchemas', () => ({
  getAllToolSchemas: () => ({
    web_search: { description: 'Search the web.', required: ['query'], properties: { query: { description: 'Search query' } } },
    read_url: { description: 'Read a URL.', required: ['url'], properties: { url: { description: 'Full URL' } } },
    wikipedia: { description: 'Search Wikipedia.', required: ['query'], properties: { query: { description: 'Topic' } } },
    filesystem_read: { description: 'Read a file.', required: ['path'], properties: { path: { description: 'File path' } } },
    list_files: { description: 'List files.', required: [], properties: { path: { description: 'Directory path' } } },
    terminal_run: { description: 'Run code.', required: ['command'], properties: { command: { description: 'Code' } } },
    'mcp__github__search_repositories': { description: 'Search connected GitHub data.', required: ['query'], properties: { query: { description: 'Repository query' } } },
  }),
}));

const { delegateTask, SUB_AGENT_TOOL_IDS } = await import('../subAgent');

describe('delegateTask', () => {
  beforeEach(() => {
    generate.mockReset();
    generate.mockResolvedValue({ text: '## Findings\nReviewed the supplied context.' });
    useAgentStore.setState({ agents: [], chatSessions: {} });
  });

  it('uses the shared generation and tool-safety path with a bounded specialist prompt', async () => {
    const result = await delegateTask('openai', 'Review this question', undefined, 'Atlas');

    expect(result).toContain('Reviewed the supplied context.');
    const request = generate.mock.calls[0][0];
    expect(request.providerId).toBe('openai');
    expect(request.systemPromptMode).toBe('replace');
    expect(request.allowedToolIds).toEqual(SUB_AGENT_TOOL_IDS);
    expect(request.systemPrompt).toContain('Be direct, creative, and appropriately thorough');
    expect(request.systemPrompt).toContain('Do not claim a tool ran unless you received its result');
    expect(request.systemPrompt).not.toContain('You cannot write or edit files');
    expect(request.systemPrompt).not.toContain('full tool access');
  });

  it('adds only tools assigned to a locally saved agent and uses its instructions', async () => {
    useAgentStore.setState({
      agents: [{
        id: 'agent-release',
        name: 'Release Scout',
        description: 'Research release notes and repository changes',
        systemPrompt: 'Prioritize upstream changelogs and cite release versions.',
        icon: 'Bot',
        createdAt: Date.now(),
        files: [],
        tools: ['mcp__github__search_repositories', 'terminal_run'],
      }],
      chatSessions: {},
    });

    await delegateTask('openai', 'Find the project release history', undefined, 'Release Scout');

    const request = generate.mock.calls[0][0];
    expect(request.allowedToolIds).toContain('mcp__github__search_repositories');
    expect(request.allowedToolIds).toContain('web_search');
    expect(request.allowedToolIds).toContain('terminal_run');
    expect(request.systemPrompt).toContain('Prioritize upstream changelogs');
  });
});
