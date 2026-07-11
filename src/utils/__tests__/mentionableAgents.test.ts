import { describe, it, expect, beforeEach } from 'vitest';
import { getMentionableAgents } from '../mentionableAgents';
import { useAgentStore } from '../../store/useAgentStore';

describe('getMentionableAgents', () => {
  beforeEach(() => {
    useAgentStore.setState({ agents: [] });
  });

  it('includes the built-in Nexus agent roster even with no custom agents created', () => {
    // This is the actual reported bug: @mention showed nothing at all
    // because it only ever looked at custom agents (empty by default),
    // never the built-in roster visible in Settings -> Nexus.
    const agents = getMentionableAgents();
    expect(agents.length).toBeGreaterThan(0);
    expect(agents.some(a => a.name === 'Atlas' && a.builtIn)).toBe(true);
    expect(agents.some(a => a.name === 'Nova' && a.builtIn)).toBe(true);
  });

  it('gives built-in agents stable, lowercase, predictable ids', () => {
    const atlas = getMentionableAgents().find(a => a.name === 'Atlas');
    expect(atlas?.id).toBe('atlas');
  });

  it('also includes user-created custom agents alongside the built-in roster', () => {
    useAgentStore.setState({
      agents: [{
        id: 'custom-1',
        name: 'MyHelper',
        description: 'a custom helper',
        systemPrompt: '...',
        icon: 'Bot',
        createdAt: Date.now(),
        files: [],
        tools: [],
      }],
    });

    const agents = getMentionableAgents();
    expect(agents.some(a => a.name === 'Atlas' && a.builtIn)).toBe(true);
    expect(agents.some(a => a.name === 'MyHelper' && !a.builtIn)).toBe(true);
  });
});
