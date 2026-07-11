import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import AgentSwarmDashboard from '../AgentSwarmDashboard';
import { useNexusStore } from '../../store/useNexusStore';
import { useGiaStore } from '../../store/useGiaStore';

function makeAgent(id: string) {
  return {
    id,
    name: 'Atlas',
    color: '#a855f7',
    icon: 'Search',
    role: 'Researcher',
    task: 'do the thing',
    startedAt: Date.now(),
  };
}

describe('AgentSwarmDashboard — session scoping', () => {
  beforeEach(() => {
    useNexusStore.setState({ activeRun: null });
  });

  it('renders a run launched from the currently active session', () => {
    useGiaStore.setState({ activeSessionId: 'session-A' });
    useNexusStore.getState().startRun('run-1', 'session-A', false, [makeAgent('a1')]);

    const { container } = render(<AgentSwarmDashboard />);
    expect(container.textContent).toContain('Nexus');
  });

  it('does not render a run launched from a different (old) session', () => {
    // Simulate: user was in session-A when a Nexus run kicked off...
    useNexusStore.getState().startRun('run-1', 'session-A', false, [makeAgent('a1')]);
    // ...then switched to a brand new chat session before it finished.
    useGiaStore.setState({ activeSessionId: 'session-B' });

    const { container } = render(<AgentSwarmDashboard />);
    expect(container.textContent).not.toContain('Nexus');
  });

  it('shows the new session run once one starts there instead', () => {
    useNexusStore.getState().startRun('run-1', 'session-A', false, [makeAgent('a1')]);
    useGiaStore.setState({ activeSessionId: 'session-B' });
    useNexusStore.getState().startRun('run-2', 'session-B', false, [makeAgent('a2')]);

    const { container } = render(<AgentSwarmDashboard />);
    expect(container.textContent).toContain('Nexus');
  });

  it('stacks agent cards vertically at full width instead of a horizontal-scroll strip', () => {
    useGiaStore.setState({ activeSessionId: 'session-A' });
    useNexusStore.getState().startRun('run-1', 'session-A', false, [makeAgent('a1'), makeAgent('a2')]);

    const { container } = render(<AgentSwarmDashboard />);
    // The old horizontal-scroll strip class should be gone entirely.
    expect(container.querySelector('.overflow-x-auto')).toBeNull();

    const cards = container.querySelectorAll('[style*="width: 100%"]');
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });
});
