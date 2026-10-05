import { describe, it, expect } from 'vitest';
import { AGENT_ICONS, getAgentIcon } from '../agentIcons';
import { Bot } from 'lucide-react';

describe('agentIcons', () => {
  it('resolves every icon name the built-in agents use', () => {
    for (const n of ['TrendingUp','AlertTriangle','GitMerge','Navigation2','ShieldCheck','Thermometer','Heart','Handshake','CircleDot']) {
      expect(AGENT_ICONS.some(i => i.name === n), n).toBe(true);
      expect(getAgentIcon(n)).not.toBe(Bot);
    }
  });
  it('falls back to Bot for unknown names', () => {
    expect(getAgentIcon('NopeNotAnIcon')).toBe(Bot);
  });
});
