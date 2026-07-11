import { AGENT_ROLES } from '../services/brain/SubAgentManager';
import { useAgentStore } from '../store/useAgentStore';

export interface MentionableAgent {
  id: string;
  name: string;
  icon: string;
  description: string;
  builtIn: boolean;
}

/**
 * @mention was only ever checking useAgentStore (user-created custom
 * agents, empty for everyone by default) — never the built-in Nexus
 * roster (Atlas, Nova, Onyx, ...) that Settings -> Nexus actually shows.
 * That's why typing "@" showed nothing for most people unless they'd
 * separately built a custom agent. This merges both so @mention can
 * reach the agents people actually see and expect to be able to summon.
 */
export function getMentionableAgents(): MentionableAgent[] {
  const builtIn: MentionableAgent[] = AGENT_ROLES.map(a => ({
    id: a.name.toLowerCase(),
    name: a.name,
    icon: a.icon,
    description: `${a.role} — ${a.style}`,
    builtIn: true,
  }));

  const custom: MentionableAgent[] = useAgentStore.getState().agents.map(a => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    description: a.description,
    builtIn: false,
  }));

  return [...builtIn, ...custom];
}
