import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, Brain, CheckCircle2, Clock3, Cpu, GitBranch, Loader2, PlugZap, Save, Server, Trash2, UserRoundPlus, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { AGENT_ROLES } from '../../services/brain/SubAgentManager';
import { useNexusStore } from '../../store/useNexusStore';
import { useAgentStore } from '../../store/useAgentStore';
import { useMCPStore } from '../../store/useMCPStore';
import MCPManager from '../../services/MCPManager';
import { useGiaStore } from '../../store/useGiaStore';
import { resolveAgentIcon } from '../../utils/agentIcons';
import { SubPageHeader } from './SubPageHeader';
import { DelegationTree } from '../DelegationTree';

export const NexusPage: React.FC<{ onBack: () => void; onOpenMcp?: () => void }> = ({ onBack, onOpenMcp }) => {
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentPurpose, setAgentPurpose] = useState('');
  const [agentInstructions, setAgentInstructions] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [connectingServer, setConnectingServer] = useState<string | null>(null);
  const agents = useAgentStore(state => state.agents);
  const servers = useMCPStore(state => state.servers);
  const connections = useMCPStore(state => state.connections);
  const connectedTools = MCPManager.getConnectedTools();
  const { activeRun, clearRun } = useNexusStore(useShallow(state => ({
    activeRun: state.activeRun,
    clearRun: state.clearRun,
  })));
  useEffect(() => {
    MCPManager.init().catch(error => {
      console.error('[NexusPage] MCP initialization failed:', error);
    });
  }, []);
  const run = activeRun;
  const finishedCount = run?.agents.filter(agent => agent.status === 'completed').length ?? 0;
  const failedCount = run?.agents.filter(agent => agent.status === 'failed').length ?? 0;
  const activeCount = run?.agents.filter(agent => agent.status === 'spawning' || agent.status === 'running').length ?? 0;
  const hasLiveRun = !!run && (!run.finishedAt || activeCount > 0 || run.synthesizing);

  const connectServer = async (serverId: string) => {
    setConnectingServer(serverId);
    try {
      await MCPManager.connect(serverId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown connection error';
      useGiaStore.getState().addNotification(`MCP connection failed: ${message}`);
    } finally {
      setConnectingServer(null);
    }
  };

  const disconnectServer = async (serverId: string) => {
    try {
      await MCPManager.disconnect(serverId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown disconnection error';
      useGiaStore.getState().addNotification(`MCP disconnection failed: ${message}`);
    }
  };

  const saveLocalAgent = () => {
    if (!agentName.trim() || !agentInstructions.trim()) return;
    useAgentStore.getState().addAgent({
      name: agentName.trim(),
      description: agentPurpose.trim(),
      systemPrompt: agentInstructions.trim(),
      icon: 'Bot',
      tools: selectedTools,
    });
    setAgentName('');
    setAgentPurpose('');
    setAgentInstructions('');
    setSelectedTools([]);
    setCreatingAgent(false);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto" style={{ background: 'var(--gia-bg)' }}>
      <div className="shrink-0 px-4 pt-4">
        <SubPageHeader title="Nexus" onBack={onBack} />
      </div>

      <main className="space-y-4 px-4 pb-6 pt-2">
        <section
          className="overflow-hidden rounded-2xl border p-4"
          style={{
            background: 'linear-gradient(145deg, rgba(16,185,129,0.11), rgba(99,102,241,0.07) 58%, rgba(15,23,42,0.2))',
            borderColor: 'rgba(16,185,129,0.2)',
          }}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border" style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' }}>
              <GitBranch size={20} style={{ color: '#34d399' }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#34d399' }}>Sub-agent coordination</p>
              <h2 className="mt-1 text-base font-bold" style={{ color: 'var(--gia-text)' }}>Nexus</h2>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
                GIA can split complex work across specialist agents, then combine their findings into one response.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <RunFact icon={<Brain size={13} />} label="Specialists" value={`${AGENT_ROLES.length}`} />
            <RunFact icon={<Activity size={13} />} label="Standard run" value="Up to 4 tasks" />
            <RunFact icon={<Cpu size={13} />} label="Extended run" value="Up to 8 tasks" />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border" style={{ background: 'var(--gia-surface)', borderColor: 'var(--gia-border)' }}>
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--gia-border)' }}>
            <div className="flex items-center gap-2">
              <Activity size={15} style={{ color: hasLiveRun ? '#34d399' : 'var(--gia-muted)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Run monitor</h3>
            </div>
            {run && (
              <span className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: hasLiveRun ? '#34d399' : 'var(--gia-muted)' }}>
                {hasLiveRun ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                {hasLiveRun ? 'Live' : 'Last run'}
              </span>
            )}
          </div>

          {!run ? (
            <div className="flex flex-col items-center px-5 py-7 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgba(148,163,184,0.08)', color: 'var(--gia-muted)' }}>
                <GitBranch size={20} />
              </div>
              <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>No delegation running</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
                When GIA delegates a task from Chat, the agents, their live progress, and results will appear here.
              </p>
            </div>
          ) : (
            <div className="p-3">
              <div className="mb-3 flex items-start justify-between gap-3 px-1">
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>
                    {run.isGodMode ? 'Extended run' : 'Standard run'}
                    <span className="font-normal" style={{ color: 'var(--gia-muted)' }}> · {run.agents.length} specialists</span>
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[10px]" style={{ color: 'var(--gia-muted)' }}>
                    <Clock3 size={11} />
                    Started {new Date(run.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                {!hasLiveRun && (
                  <button type="button" onClick={clearRun} aria-label="Clear last sub-agent run" className="rounded-lg p-2" style={{ color: 'var(--gia-muted)' }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <RunCount label="Working" count={activeCount} color="#34d399" />
                <RunCount label="Done" count={finishedCount} color="#60a5fa" />
                <RunCount label="Failed" count={failedCount} color="#f87171" />
              </div>
              <DelegationTree
                agents={run.agents}
                isGodMode={run.isGodMode}
                synthesizing={run.synthesizing}
                finished={!!run.finishedAt}
              />
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border" style={{ background: 'var(--gia-surface)', borderColor: 'var(--gia-border)' }}>
          <div className="flex items-start gap-3 border-b px-4 py-3.5" style={{ borderColor: 'var(--gia-border)' }}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>
              <PlugZap size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>External tools & data</h3>
              <p className="mt-0.5 text-[10px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
                Connect MCP servers here. Specialists can use connected tools when an agent profile includes them; GIA still applies its normal approvals.
              </p>
            </div>
            {onOpenMcp && (
              <button type="button" onClick={onOpenMcp} className="shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium" style={{ borderColor: 'var(--gia-border)', color: 'var(--gia-text)' }}>
                Manage
              </button>
            )}
          </div>
          <div className="space-y-2 p-3">
            {servers.length === 0 ? (
              <div className="rounded-xl border border-dashed px-3 py-4 text-center" style={{ borderColor: 'var(--gia-border)' }}>
                <Server size={16} className="mx-auto" style={{ color: 'var(--gia-muted)' }} />
                <p className="mt-2 text-[11px]" style={{ color: 'var(--gia-muted)' }}>No MCP servers configured yet.</p>
              </div>
            ) : servers.map(server => {
              const status = connections[server.id]?.status ?? 'disconnected';
              const toolCount = connections[server.id]?.toolCount ?? 0;
              return (
                <div key={server.id} className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.015)', borderColor: status === 'connected' ? 'rgba(52,211,153,0.18)' : 'var(--gia-border)' }}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: status === 'connected' ? '#34d399' : status === 'error' ? '#f87171' : 'rgba(148,163,184,0.45)' }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium" style={{ color: 'var(--gia-text)' }}>{server.name}</p>
                    <p className="text-[9px]" style={{ color: status === 'error' ? '#f87171' : 'var(--gia-muted-2)' }}>
                      {status === 'connected' ? `${toolCount} tools available` : status === 'error' ? connections[server.id]?.error || 'Connection failed' : status}
                    </p>
                  </div>
                  {status === 'connected' ? (
                    <button type="button" onClick={() => void disconnectServer(server.id)} className="rounded-lg px-2 py-1 text-[9px]" style={{ color: 'var(--gia-muted)' }}>Disconnect</button>
                  ) : (
                    <button type="button" disabled={connectingServer === server.id} onClick={() => void connectServer(server.id)} className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-medium disabled:opacity-50" style={{ borderColor: 'rgba(96,165,250,0.2)', color: '#93c5fd' }}>
                      {connectingServer === server.id ? <Loader2 size={10} className="animate-spin" /> : <PlugZap size={10} />}
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
            {connectedTools.length > 0 && (
              <p className="px-1 pt-1 text-[9px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>
                {connectedTools.length} connected MCP tool{connectedTools.length === 1 ? '' : 's'} can be assigned to a local agent.
              </p>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border" style={{ background: 'var(--gia-surface)', borderColor: 'var(--gia-border)' }}>
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3.5" style={{ borderColor: 'var(--gia-border)' }}>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Your local agents</h3>
              <p className="mt-0.5 text-[10px]" style={{ color: 'var(--gia-muted)' }}>Saved on this device and available for future Nexus tasks.</p>
            </div>
            <button type="button" onClick={() => setCreatingAgent(value => !value)} className="flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-semibold" style={{ background: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.24)', color: '#d8b4fe' }}>
              {creatingAgent ? <X size={12} /> : <UserRoundPlus size={13} />}
              {creatingAgent ? 'Cancel' : 'Create agent'}
            </button>
          </div>
          {creatingAgent && (
            <div className="space-y-3 border-b p-3.5" style={{ borderColor: 'var(--gia-border)', background: 'rgba(168,85,247,0.025)' }}>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-[9px] font-medium" style={{ color: 'var(--gia-muted)' }}>
                  Agent name
                  <input value={agentName} onChange={event => setAgentName(event.target.value)} placeholder="e.g. Release Scout" className="w-full rounded-xl border px-3 py-2 text-[11px] outline-none" style={{ background: 'rgba(0,0,0,0.16)', borderColor: 'var(--gia-border)', color: 'var(--gia-text)' }} />
                </label>
                <label className="space-y-1 text-[9px] font-medium" style={{ color: 'var(--gia-muted)' }}>
                  Specialty
                  <input value={agentPurpose} onChange={event => setAgentPurpose(event.target.value)} placeholder="What should this agent focus on?" className="w-full rounded-xl border px-3 py-2 text-[11px] outline-none" style={{ background: 'rgba(0,0,0,0.16)', borderColor: 'var(--gia-border)', color: 'var(--gia-text)' }} />
                </label>
              </div>
              <label className="block space-y-1 text-[9px] font-medium" style={{ color: 'var(--gia-muted)' }}>
                Instructions
                <textarea value={agentInstructions} onChange={event => setAgentInstructions(event.target.value)} rows={4} placeholder="Describe how this agent should approach its work. Keep it specific, not restrictive." className="w-full resize-y rounded-xl border px-3 py-2 text-[11px] leading-relaxed outline-none" style={{ background: 'rgba(0,0,0,0.16)', borderColor: 'var(--gia-border)', color: 'var(--gia-text)' }} />
              </label>
              {connectedTools.length > 0 && (
                <fieldset>
                  <legend className="mb-1.5 text-[9px] font-medium" style={{ color: 'var(--gia-muted)' }}>Assign connected MCP tools</legend>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {connectedTools.map(tool => (
                      <label key={tool.id} className="flex min-w-0 items-start gap-2 rounded-lg border p-2 text-[9px]" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--gia-border)', color: 'var(--gia-muted)' }}>
                        <input type="checkbox" checked={selectedTools.includes(tool.id)} onChange={() => setSelectedTools(current => current.includes(tool.id) ? current.filter(id => id !== tool.id) : [...current, tool.id])} className="mt-0.5 accent-violet-500" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium" style={{ color: 'var(--gia-text)' }}>{tool.name}</span>
                          <span className="line-clamp-2">{tool.description || tool.serverId}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="flex items-center justify-between gap-3">
                <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>Tool calls remain subject to GIA’s permissions and approvals.</p>
                <button type="button" disabled={!agentName.trim() || !agentInstructions.trim()} onClick={saveLocalAgent} className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-40" style={{ background: 'linear-gradient(110deg, #7c3aed, #4f46e5)' }}>
                  <Save size={12} /> Save locally
                </button>
              </div>
            </div>
          )}
          {agents.length > 0 ? (
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {agents.map(agent => {
                const AgentIcon = resolveAgentIcon(agent.icon);
                return (
                  <article key={agent.id} className="flex min-w-0 items-start gap-2.5 rounded-xl border p-3" style={{ borderColor: 'rgba(168,85,247,0.17)', background: 'linear-gradient(130deg, rgba(168,85,247,0.06), rgba(255,255,255,0.01))' }}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(168,85,247,0.12)', color: '#c4b5fd' }}><AgentIcon size={15} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold" style={{ color: 'var(--gia-text)' }}>{agent.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-[9px]" style={{ color: 'var(--gia-muted)' }}>{agent.description || 'Custom local specialist'}</p>
                      <p className="mt-1 text-[8px]" style={{ color: 'var(--gia-muted-2)' }}>{agent.tools.length} assigned tool{agent.tools.length === 1 ? '' : 's'} · saved on this device</p>
                    </div>
                    <span className="rounded-full border px-1.5 py-0.5 text-[8px]" style={{ borderColor: 'rgba(52,211,153,0.16)', color: '#6ee7b7' }}>Local</span>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>No custom agents yet. Create one to give GIA a reusable specialty.</p>
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Specialist roster</h3>
              <p className="mt-0.5 text-[10px]" style={{ color: 'var(--gia-muted)' }}>Personas GIA assigns automatically based on the task</p>
            </div>
            <span className="rounded-lg px-2 py-1 text-[10px]" style={{ background: 'rgba(16,185,129,0.08)', color: '#34d399' }}>{AGENT_ROLES.length} available</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {AGENT_ROLES.map((agent, index) => {
              const SpecialistIcon = resolveAgentIcon(agent.icon);
              return (
              <motion.article
                key={agent.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.28, delay: Math.min(index % 4, 3) * 0.035 }}
                className="group relative flex items-start gap-3 overflow-hidden rounded-2xl border p-3.5 transition-colors"
                style={{
                  background: `linear-gradient(125deg, ${agent.color}0b, var(--gia-surface) 48%)`,
                  borderColor: `${agent.color}25`,
                }}
              >
                <div className="absolute -right-7 -top-8 h-20 w-20 rounded-full blur-2xl transition-opacity group-hover:opacity-90" style={{ background: `${agent.color}18`, opacity: 0.45 }} />
                <div className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border" style={{ background: `${agent.color}14`, borderColor: `${agent.color}30`, color: agent.color, boxShadow: `inset 0 0 18px ${agent.color}0d` }}>
                  <SpecialistIcon size={17} strokeWidth={1.8} />
                </div>
                <div className="relative min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>{agent.name}</span>
                    <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: `${agent.color}12`, color: agent.color }}>{agent.role}</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>{agent.style}</p>
                </div>
                <span className="relative mt-1 rounded-full border px-2 py-1 text-[8px] uppercase tracking-wider" style={{ borderColor: `${agent.color}20`, color: 'var(--gia-muted-2)' }}>Nexus</span>
              </motion.article>
              );
            })}
          </div>
        </section>

        <p className="px-1 text-[10px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>
          Each delegated task is assigned to one specialist. GIA may launch up to 4 distinct tasks in a standard run or 8 in extended mode. Local agents and their tool selections are stored on this device; external MCP servers must be connected and their tool calls follow GIA’s approval flow.
        </p>
      </main>
    </div>
  );
};

const RunFact: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="rounded-xl border px-2 py-2" style={{ background: 'rgba(15,23,42,0.25)', borderColor: 'rgba(255,255,255,0.06)' }}>
    <div className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--gia-muted)' }}>{icon}{label}</div>
    <p className="mt-1 text-[11px] font-semibold" style={{ color: 'var(--gia-text)' }}>{value}</p>
  </div>
);

const RunCount: React.FC<{ label: string; count: number; color: string }> = ({ label, count, color }) => (
  <span className="rounded-md px-2 py-1 text-[9px] font-medium" style={{ color, background: `${color}12` }}>
    {count} {label}
  </span>
);
