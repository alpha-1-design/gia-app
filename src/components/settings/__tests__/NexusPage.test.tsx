import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NexusPage } from '../NexusPage';
import { useNexusStore } from '../../../store/useNexusStore';

describe('NexusPage', () => {
  beforeEach(() => {
    useNexusStore.setState({ activeRun: null });
  });

  afterEach(() => {
    cleanup();
    useNexusStore.setState({ activeRun: null });
  });

  it('explains sub-agent delegation and does not offer fake enable controls', () => {
    render(<NexusPage onBack={vi.fn()} />);

    expect(screen.getByText('Sub-agent coordination')).toBeInTheDocument();
    expect(screen.getByText('No delegation running')).toBeInTheDocument();
    expect(screen.getByText('Specialist roster')).toBeInTheDocument();
    expect(screen.getByText('Personas GIA assigns automatically based on the task')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /custom agent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('shows live run statuses and can clear a completed run', () => {
    useNexusStore.setState({
      activeRun: {
        id: 'run-1',
        sessionId: 'chat-1',
        isGodMode: false,
        startedAt: Date.now(),
        finishedAt: Date.now(),
        synthesizing: false,
        agents: [
          {
            id: 'agent-1',
            name: 'Atlas',
            color: '#a855f7',
            icon: 'Search',
            role: 'Researcher',
            task: 'Find relevant sources',
            status: 'completed',
            result: 'Found three useful sources.',
            duration: 1200,
            startedAt: Date.now(),
          },
        ],
      },
    });

    render(<NexusPage onBack={vi.fn()} />);

    expect(screen.getByText('Last run')).toBeInTheDocument();
    expect(screen.getAllByText('Atlas')).toHaveLength(2);
    expect(screen.getByText('Complete')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear last sub-agent run' }));
    expect(screen.getByText('No delegation running')).toBeInTheDocument();
  });
});
