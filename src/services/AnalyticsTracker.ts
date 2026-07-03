const STORAGE_KEY = 'gia-analytics-tracker';

interface ToolClaimEvent {
  type: 'tool_claimed';
  toolId: string;
  timestamp: number;
  sessionId: string;
}

interface ToolExecEvent {
  type: 'tool_executed';
  toolId: string;
  success: boolean;
  duration: number;
  error?: string;
  timestamp: number;
  sessionId: string;
}

interface FreezeEvent {
  type: 'freeze';
  duration: number;
  timestamp: number;
  sessionId: string;
}

interface RawOutputEvent {
  type: 'raw_output';
  kind: 'json' | 'markdown' | 'json_fence';
  snippet: string;
  timestamp: number;
  sessionId: string;
}

interface GenerationEvent {
  type: 'generation_complete';
  model: string;
  tokens: number;
  duration: number;
  hadTools: boolean;
  success: boolean;
  timestamp: number;
  sessionId: string;
}

type TrackedEvent = ToolClaimEvent | ToolExecEvent | FreezeEvent | RawOutputEvent | GenerationEvent;

interface TrackerData {
  events: TrackedEvent[];
  version: number;
}

const MAX_EVENTS = 2000;

function load(): TrackerData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { events: [], version: 1 };
}

function save(d: TrackerData) {
  try {
    if (d.events.length > MAX_EVENTS) d.events = d.events.slice(-MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch { /* storage full */ }
}

function getSessionId(): string {
  try {
    const s = useGiaStore.getState().activeSessionId;
    return s || 'unknown';
  } catch { return 'unknown'; }
}

import { useGiaStore } from '../store/useGiaStore';

class AnalyticsTracker {
  private _data: TrackerData;

  constructor() {
    this._data = load();
  }

  trackToolClaimed(toolId: string) {
    this._data.events.push({
      type: 'tool_claimed',
      toolId,
      timestamp: Date.now(),
      sessionId: getSessionId(),
    });
    save(this._data);
  }

  trackToolExecuted(toolId: string, success: boolean, duration: number, error?: string) {
    this._data.events.push({
      type: 'tool_executed',
      toolId,
      success,
      duration,
      error,
      timestamp: Date.now(),
      sessionId: getSessionId(),
    });
    save(this._data);
  }

  trackFreeze(duration: number) {
    this._data.events.push({
      type: 'freeze',
      duration,
      timestamp: Date.now(),
      sessionId: getSessionId(),
    });
    save(this._data);
  }

  trackRawOutput(kind: 'json' | 'markdown' | 'json_fence', snippet: string) {
    this._data.events.push({
      type: 'raw_output',
      kind,
      snippet: snippet.slice(0, 200),
      timestamp: Date.now(),
      sessionId: getSessionId(),
    });
    save(this._data);
  }

  trackGenerationComplete(model: string, tokens: number, duration: number, hadTools: boolean, success: boolean) {
    this._data.events.push({
      type: 'generation_complete',
      model,
      tokens,
      duration,
      hadTools,
      success,
      timestamp: Date.now(),
      sessionId: getSessionId(),
    });
    save(this._data);
  }

  getSummary() {
    const claimed: Record<string, number> = {};
    const executed: Record<string, { total: number; success: number; fails: number }> = {};
    let freezeCount = 0;
    let rawOutputCount = 0;
    let totalGens = 0;
    let failedGens = 0;

    for (const e of this._data.events) {
      if (e.type === 'tool_claimed') {
        claimed[e.toolId] = (claimed[e.toolId] || 0) + 1;
      } else if (e.type === 'tool_executed') {
        if (!executed[e.toolId]) executed[e.toolId] = { total: 0, success: 0, fails: 0 };
        executed[e.toolId].total++;
        if (e.success) executed[e.toolId].success++;
        else executed[e.toolId].fails++;
      } else if (e.type === 'freeze') {
        freezeCount++;
      } else if (e.type === 'raw_output') {
        rawOutputCount++;
      } else if (e.type === 'generation_complete') {
        totalGens++;
        if (!e.success) failedGens++;
      }
    }

    const allToolIds = new Set([...Object.keys(claimed), ...Object.keys(executed)]);
    const toolCompare: { id: string; claimed: number; executed: number; hallucinated: number }[] = [];
    for (const id of allToolIds) {
      const c = claimed[id] || 0;
      const e = executed[id]?.total || 0;
      toolCompare.push({ id, claimed: c, executed: e, hallucinated: Math.max(0, c - e) });
    }

    return {
      toolCompare: toolCompare.sort((a, b) => b.claimed - a.claimed),
      freezeCount,
      rawOutputCount,
      totalGens,
      failedGens,
      hallucinationRate: totalGens > 0
        ? Math.round((toolCompare.reduce((s, t) => s + t.hallucinated, 0) / totalGens) * 100)
        : 0,
    };
  }

  getRecentRawOutputs(limit = 10): RawOutputEvent[] {
    return this._data.events
      .filter((e): e is RawOutputEvent => e.type === 'raw_output')
      .slice(-limit)
      .reverse();
  }

  getRecentFails(limit = 10): ToolExecEvent[] {
    return this._data.events
      .filter((e): e is ToolExecEvent => e.type === 'tool_executed' && !e.success)
      .slice(-limit)
      .reverse();
  }

  clear() {
    this._data = { events: [], version: 1 };
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
}

export default new AnalyticsTracker();
