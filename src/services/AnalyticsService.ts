const STORAGE_KEY = 'gia-analytics-data';
const OPT_IN_KEY = 'gia-analytics-optin';

interface AnalyticsEvent {
  event: string;
  timestamp: number;
  metadata?: Record<string, string | number | boolean>;
}

interface AnalyticsData {
  events: AnalyticsEvent[];
  firstRun: number;
  lastRun: number;
  runCount: number;
}

function loadData(): AnalyticsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { events: [], firstRun: Date.now(), lastRun: Date.now(), runCount: 0 };
}

function saveData(d: AnalyticsData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch { /* storage full */ }
}

class AnalyticsService {
  private optIn: boolean = localStorage.getItem(OPT_IN_KEY) === 'true';

  isOptedIn() { return this.optIn; }

  setOptIn(v: boolean) {
    this.optIn = v;
    localStorage.setItem(OPT_IN_KEY, String(v));
  }

  track(event: string, metadata?: Record<string, string | number | boolean>) {
    if (!this.optIn) return;
    const d = loadData();
    d.events.push({ event, timestamp: Date.now(), metadata });
    d.lastRun = Date.now();
    d.runCount++;
    if (d.events.length > 500) d.events = d.events.slice(-500);
    saveData(d);
  }

  trackMessage(role: 'user' | 'assistant') {
    this.track('message', { role });
  }

  trackSession() {
    this.track('session_start');
  }

  trackTool(toolId: string, success: boolean) {
    this.track('tool_use', { toolId, success });
  }

  trackFeature(feature: string, enabled: boolean) {
    this.track('feature_toggle', { feature, enabled });
  }

  getSummary(): { runCount: number; eventCount: number; firstRun: number; lastRun: number; topEvents: [string, number][] } {
    const d = loadData();
    const counts = new Map<string, number>();
    for (const e of d.events) {
      counts.set(e.event, (counts.get(e.event) || 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    return {
      runCount: d.runCount,
      eventCount: d.events.length,
      firstRun: d.firstRun,
      lastRun: d.lastRun,
      topEvents: sorted,
    };
  }

  clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
}

export default new AnalyticsService();
