import { delegateTask } from './subAgent';
import { useGiaStore } from '../../store/useGiaStore';
import { useNexusStore } from '../../store/useNexusStore';

export interface SubAgentIdentity {
  id: string;
  name: string;
  color: string;
  icon: string;
  role: string;
  style: string;
}

export interface SubAgentTask {
  provider: string;
  prompt: string;
}

export interface SubAgentProgress {
  id: string;
  name: string;
  color: string;
  icon: string;
  role: string;
  status: 'spawning' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  duration: number;
  startedAt: number;
}

interface AgentRole {
  name: string;
  color: string;
  icon: string;
  role: string;
  style: string;
  keywords: string[];
}

const AGENT_ROLES: AgentRole[] = [
  { name: 'Atlas',  color: '#a855f7', icon: 'Search',       role: 'Researcher',      style: 'Thorough, detail-oriented. Gather comprehensive data and verify sources.',             keywords: ['research', 'search', 'find', 'information', 'data', 'source'] },
  { name: 'Nova',   color: '#f59e0b', icon: 'TrendingUp',   role: 'Analyst',         style: 'Critical, logical. Break down problems and identify patterns.',                        keywords: ['analyze', 'analysis', 'pattern', 'trend', 'statistics', 'breakdown'] },
  { name: 'Onyx',   color: '#3b82f6', icon: 'AlertTriangle', role: 'Skeptic',        style: 'Challenge assumptions. Find flaws, edge cases, and counterarguments.',                 keywords: ['verify', 'check', 'flaw', 'edge', 'risk', 'problem', 'bug'] },
  { name: 'Flux',   color: '#ec4899', icon: 'Lightbulb',    role: 'Creative',        style: 'Think laterally. Generate novel approaches and unexpected connections.',                 keywords: ['creative', 'idea', 'innovate', 'brainstorm', 'imagine', 'design'] },
  { name: 'Vex',    color: '#10b981', icon: 'GitMerge',     role: 'Synthesizer',     style: 'Merge ideas. Combine findings from different angles into cohesive insights.',           keywords: ['synthesize', 'combine', 'merge', 'integrate', 'summary', 'overview'] },
  { name: 'Astra',  color: '#6366f1', icon: 'Compass',      role: 'Strategist',      style: 'Big-picture thinking. Prioritize what matters most and plan steps.',                    keywords: ['strategy', 'plan', 'goal', 'roadmap', 'priority', 'milestone'] },
  { name: 'Bolt',   color: '#ef4444', icon: 'Zap',          role: 'Critic',          style: 'Constructive but sharp. Find weaknesses and suggest improvements.',                     keywords: ['improve', 'optimize', 'refactor', 'critique', 'feedback', 'performance'] },
  { name: 'Cipher', color: '#14b8a6', icon: 'Code2',        role: 'Technologist',    style: 'Practical, implementation-focused. How things actually work.',                          keywords: ['code', 'implement', 'technical', 'engineering', 'system', 'architecture'] },
  { name: 'Drift',  color: '#f97316', icon: 'Navigation2',  role: 'Explorer',        style: 'Open-ended curiosity. Follow tangents and discover hidden connections.',                keywords: ['explore', 'discover', 'learn', 'curious', 'investigate', 'unknown'] },
  { name: 'Ember',  color: '#06b6d4', icon: 'ShieldCheck',  role: 'Validator',       style: 'Fact-check everything. Verify claims and cross-reference sources.',                     keywords: ['validate', 'confirm', 'verify', 'fact', 'accuracy', 'correct'] },
  { name: 'Frost',  color: '#84cc16', icon: 'Thermometer',  role: 'Realist',         style: 'Practical, grounded. Focus on feasibility and real-world constraints.',                 keywords: ['feasible', 'practical', 'realistic', 'cost', 'constraint', 'resource'] },
  { name: 'Glimmer',color: '#d946ef', icon: 'Sun',          role: 'Optimist',        style: 'Focus on opportunities and positive outcomes. Constructive framing.',                   keywords: ['positive', 'opportunity', 'benefit', 'potential', 'growth', 'future'] },
  { name: 'Haven',  color: '#0ea5e9', icon: 'Heart',        role: 'Ethicist',        style: 'Consider implications, fairness, and responsible use.',                                 keywords: ['ethics', 'fair', 'privacy', 'responsible', 'impact', 'safety'] },
  { name: 'Iris',   color: '#eab308', icon: 'BookOpen',     role: 'Archivist',       style: 'Track history and context. Find relevant past patterns.',                              keywords: ['history', 'context', 'past', 'reference', 'document', 'record'] },
  { name: 'Jade',   color: '#22d3ee', icon: 'Handshake',    role: 'Diplomat',        style: 'Find common ground. Resolve conflicts between different viewpoints.',                   keywords: ['resolve', 'conflict', 'compromise', 'agree', 'consensus', 'negotiate'] },
  { name: 'Krypton',color: '#8b5cf6', icon: 'Brain',        role: 'Deep Thinker',    style: 'First-principles reasoning. Drill down to fundamentals.',                              keywords: ['deep', 'fundamental', 'philosophy', 'reason', 'logic', 'root'] },
  { name: 'Lumen',  color: '#fb923c', icon: 'GraduationCap', role: 'Teacher',        style: 'Explain clearly. Break complex ideas into understandable parts.',                       keywords: ['explain', 'teach', 'clarify', 'simplify', 'understand', 'definition'] },
  { name: 'Mist',   color: '#2dd4bf', icon: 'Eye',          role: 'Intuitionist',    style: 'Gut-feel and pattern recognition. Quick, instinctive assessments.',                     keywords: ['intuition', 'feel', 'sense', 'pattern', 'quick', 'assess'] },
  { name: 'Nyx',    color: '#a78bfa', icon: 'CircleDot',    role: 'Philosopher',     style: 'Question underlying assumptions. Explore deeper meaning.',                              keywords: ['meaning', 'purpose', 'assumption', 'question', 'reflect', 'deeper'] },
  { name: 'Orbit',  color: '#fbbf24', icon: 'Share2',       role: 'Connector',       style: 'Link disparate ideas. Find relationships across domains.',                              keywords: ['connect', 'link', 'relationship', 'cross', 'domain', 'bridge'] },
];

const DEFAULT_AGENT_COUNT = 4;
const GOD_MODE_AGENT_COUNT = 8;

function selectAgents(prompt: string, count: number): AgentRole[] {
  const lower = prompt.toLowerCase();
  const scored = AGENT_ROLES.map(a => {
    const score = a.keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
    return { agent: a, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, count).map(s => s.agent);
  if (selected.length < count) {
    const used = new Set(selected.map(a => a.name));
    for (const a of AGENT_ROLES) {
      if (used.has(a.name)) continue;
      selected.push(a);
      used.add(a.name);
      if (selected.length >= count) break;
    }
  }
  return selected;
}

function emit(logType: 'thought' | 'tool' | 'result' | 'error', content: string) {
  useGiaStore.getState().addConsoleLog({ type: logType, content });
}

export class SubAgentManager {
  private agents: Map<string, SubAgentProgress> = new Map();
  private maxConcurrency: number;
  private isGodMode: boolean;
  private runId: string = '';

  constructor(maxConcurrency = 5, isGodMode = false) {
    this.maxConcurrency = maxConcurrency;
    this.isGodMode = isGodMode;
  }

  get progress(): SubAgentProgress[] {
    return Array.from(this.agents.values());
  }

  reset() {
    this.agents.clear();
  }

  async runAll(tasks: SubAgentTask[], signal?: AbortSignal): Promise<SubAgentProgress[]> {
    this.agents.clear();

    const combinedPrompt = tasks.map(t => t.prompt).join('\n');
    const agentCount = this.isGodMode ? GOD_MODE_AGENT_COUNT : DEFAULT_AGENT_COUNT;
    const selected = selectAgents(combinedPrompt, Math.min(agentCount, tasks.length));

    const identities: SubAgentIdentity[] = selected.map(def => ({
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: def.name,
      color: def.color,
      icon: def.icon,
      role: def.role,
      style: def.style,
    }));

    for (const identity of identities) {
      this.agents.set(identity.id, {
        id: identity.id,
        name: identity.name,
        color: identity.color,
        icon: identity.icon,
        role: identity.role,
        status: 'spawning',
        duration: 0,
        startedAt: Date.now(),
      });
    }

    this.runId = `nexus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    useNexusStore.getState().startRun(
      this.runId,
      useGiaStore.getState().activeSessionId ?? null,
      this.isGodMode,
      identities.map((identity, i) => ({
        id: identity.id,
        name: identity.name,
        color: identity.color,
        icon: identity.icon,
        role: identity.role,
        task: tasks.length > 1 ? (tasks[i % tasks.length]?.prompt || tasks[0]?.prompt || '') : (tasks[0]?.prompt || ''),
        startedAt: Date.now(),
      }))
    );

    const agentList = Array.from(this.agents.values());
    const modeLabel = this.isGodMode ? ' [GOD MODE]' : '';
    emit('tool', `Spawning ${agentList.length} sub-agents${modeLabel}: ${agentList.map(a => `${a.name} (${a.role})`).join(', ')}`);

    // When GIA issued a single sub_agent_call, all selected personas tackle
    // that one prompt from their own angle (intentional multi-perspective
    // debate — see synthesize()'s cross-evaluation). But when GIA issued
    // multiple sub_agent_calls with genuinely different prompts, each one
    // must actually reach its own agent — previously every agent silently
    // ran only tasks[0], discarding every other distinct task.
    const chunks: { task: SubAgentTask; identity: SubAgentIdentity }[][] = [];
    for (let i = 0; i < identities.length; i += this.maxConcurrency) {
      chunks.push(identities.slice(i, i + this.maxConcurrency).map((identity, offset) => {
        const idx = i + offset;
        const task = tasks.length > 1 ? (tasks[idx % tasks.length] || tasks[0]) : tasks[0];
        return { task, identity };
      }));
    }

    for (const chunk of chunks) {
      if (signal?.aborted) break;
      await Promise.allSettled(
        chunk.map(({ task, identity }) => this.executeOne(task, identity, signal))
      );
    }

    emit('result', `All ${agentList.length} sub-agents finished. Synthesizing findings...`);
    useNexusStore.getState().setSynthesizing(this.runId, true);

    return Array.from(this.agents.values());
  }

  private async executeOne(task: SubAgentTask, identity: SubAgentIdentity, signal?: AbortSignal): Promise<void> {
    const agent = this.agents.get(identity.id);
    if (!agent) return;

    agent.status = 'running';
    emit('tool', `[${identity.name}] ${identity.role} — starting...`);
    useNexusStore.getState().updateAgent(this.runId, identity.id, { status: 'running', currentActivity: 'Starting…' });

    const enrichedPrompt = `You are a sub-agent named ${identity.name} with the role of ${identity.role}.\n\nYour thinking style: ${identity.style}\n\nYour task:\n${task.prompt}\n\nProvide your findings based on your unique perspective. Be thorough.${this.isGodMode ? '\n\nYou are operating in GOD MODE. Go deeper than usual. Challenge every assumption. Leave no stone unturned.' : ''}`;

    try {
      const result = await delegateTask(task.provider, enrichedPrompt, signal, identity.name, (statusMsg) => {
        useNexusStore.getState().updateAgent(this.runId, identity.id, { currentActivity: statusMsg });
        emit('tool', `[${identity.name}] ${statusMsg}`);
      });
      agent.status = 'completed';
      agent.result = result;
      agent.duration = Date.now() - agent.startedAt;
      emit('result', `[${identity.name}] ${identity.role} — done (${(agent.duration / 1000).toFixed(1)}s)`);
      useNexusStore.getState().updateAgent(this.runId, identity.id, {
        status: 'completed', result, duration: agent.duration, currentActivity: undefined,
      });
    } catch (e: unknown) {
      agent.status = 'failed';
      agent.error = e instanceof Error ? e.message : 'Unknown error';
      agent.duration = Date.now() - agent.startedAt;
      emit('error', `[${identity.name}] Failed: ${agent.error}`);
      useNexusStore.getState().updateAgent(this.runId, identity.id, {
        status: 'failed', error: agent.error, duration: agent.duration, currentActivity: undefined,
      });
    }
  }

  markFinished() {
    if (this.runId) useNexusStore.getState().finishRun(this.runId);
  }

  synthesize(): string {
    const completed = Array.from(this.agents.values())
      .filter(a => a.status === 'completed' && a.result);
    const failed = Array.from(this.agents.values())
      .filter(a => a.status === 'failed');

    if (completed.length === 0) {
      return 'All sub-agents failed. Use your own knowledge to respond.';
    }

    let summary = `## Sub-Agent Synthesis\n\n`;
    summary += `${completed.length} agents succeeded, ${failed.length} failed.\n\n`;

    for (const agent of completed) {
      summary += `### [${agent.icon}] ${agent.name} (${agent.role}) — ${(agent.duration / 1000).toFixed(1)}s\n\n`;
      summary += `${agent.result}\n\n---\n\n`;
    }

    summary += `### Cross-Evaluation\n\n`;
    summary += `Review all agent findings. Note areas of agreement and disagreement.`;
    summary += ` Findings validated by multiple agents carry more weight.`;
    summary += ` Conflicts should be called out with the reasoning from each side.`;

    if (this.isGodMode) {
      summary += `\n\n### Meta-Analysis\n\n`;
      summary += `Go one level deeper: evaluate the evaluations. Which agents had the strongest methodology?`;
      summary += ` Were there blind spots across all agents? What was missed entirely?`;
      summary += ` Synthesize a final answer that accounts for the full range of insights.`;
    }

    summary += `\n\nWeigh the evidence and produce a final answer that synthesizes the best insights.`;

    return summary;
  }
}
