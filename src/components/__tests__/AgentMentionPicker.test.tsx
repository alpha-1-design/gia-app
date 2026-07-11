import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import AgentMentionPicker from '../AgentMentionPicker';
import { useAgentStore } from '../../store/useAgentStore';

vi.mock('../../services/ProviderMonitor', () => ({
  providerMonitor: { getHealth: () => ({ status: 'healthy' }) },
}));

describe('AgentMentionPicker', () => {
  beforeEach(() => {
    useAgentStore.setState({ agents: [] });
  });

  it('shows the built-in agent roster even when no custom agents exist', () => {
    // Reported bug: typing "@" showed nothing at all unless the user had
    // separately created a custom agent, because the picker only checked
    // an always-empty-by-default store.
    const { container } = render(<AgentMentionPicker query="" onSelect={() => {}} />);
    expect(container.textContent).toContain('Atlas');
    expect(container.textContent).toContain('Nova');
  });

  it('filters the roster as the user types a query', () => {
    const { container } = render(<AgentMentionPicker query="atl" onSelect={() => {}} />);
    expect(container.textContent).toContain('Atlas');
    expect(container.textContent).not.toContain('Nova');
  });
});
