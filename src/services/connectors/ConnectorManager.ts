export interface ConnectorConfig {
  id: string;
  name: string;
  description: string;
  type: 'api' | 'database' | 'cloud' | 'storage' | 'messaging' | 'analytics';
  icon: string;
  baseUrl?: string;
  apiKey?: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error';
  lastChecked?: number;
  errorMessage?: string;
}

export interface ConnectorRequest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
}

export interface ConnectorResponse {
  status: number;
  data: unknown;
  headers: Record<string, string>;
  duration: number;
}

class ConnectorManager {
  private connectors: Map<string, ConnectorConfig> = new Map();
  private storeKey = 'gia-connectors';

  constructor() {
    this.registerDefaults();
    this.load();
  }

  private registerDefaults() {
    const defaults: ConnectorConfig[] = [
      { id: 'openweather', name: 'OpenWeatherMap', description: 'Weather data API', type: 'api', icon: 'cloud-sun', baseUrl: 'https://api.openweathermap.org/data/2.5', enabled: false, status: 'disconnected' },
      { id: 'newsapi', name: 'NewsAPI', description: 'News articles and headlines', type: 'api', icon: 'newspaper', baseUrl: 'https://newsapi.org/v2', enabled: false, status: 'disconnected' },
      { id: 'github', name: 'GitHub API', description: 'GitHub repositories and user data', type: 'api', icon: 'github', baseUrl: 'https://api.github.com', enabled: false, status: 'disconnected' },
      { id: 'serpapi', name: 'SERP API', description: 'Search engine results', type: 'api', icon: 'search', baseUrl: 'https://serpapi.com', enabled: false, status: 'disconnected' },
      { id: 'sendgrid', name: 'SendGrid', description: 'Email delivery service', type: 'messaging', icon: 'mail', baseUrl: 'https://api.sendgrid.com/v3', enabled: false, status: 'disconnected' },
      { id: 'supabase', name: 'Supabase', description: 'PostgreSQL database with realtime', type: 'database', icon: 'database', enabled: false, status: 'disconnected' },
      { id: 'firebase', name: 'Firebase', description: 'Google Firebase backend', type: 'cloud', icon: 'flame', enabled: false, status: 'disconnected' },
      { id: 'aws', name: 'AWS S3', description: 'Amazon S3 cloud storage', type: 'storage', icon: 'cloud', enabled: false, status: 'disconnected' },
      { id: 'twilio', name: 'Twilio', description: 'SMS and communication APIs', type: 'messaging', icon: 'message-circle', baseUrl: 'https://api.twilio.com', enabled: false, status: 'disconnected' },
      { id: 'notion', name: 'Notion API', description: 'Notion workspaces and databases', type: 'api', icon: 'file-text', baseUrl: 'https://api.notion.com/v1', enabled: false, status: 'disconnected' },
      { id: 'telegram', name: 'Telegram Bot', description: 'Telegram bot messaging', type: 'messaging', icon: 'send', baseUrl: 'https://api.telegram.org/bot', enabled: false, status: 'disconnected' },
    ];
    for (const c of defaults) {
      this.connectors.set(c.id, c);
    }
  }

  private load() {
    try {
      const raw = localStorage.getItem(this.storeKey);
      if (raw) {
        const saved: ConnectorConfig[] = JSON.parse(raw);
        for (const c of saved) {
          if (this.connectors.has(c.id)) {
            this.connectors.set(c.id, { ...this.connectors.get(c.id)!, ...c });
          } else {
            this.connectors.set(c.id, c);
          }
        }
      }
    } catch { /* ignore */ }
  }

  private save() {
    try {
      localStorage.setItem(this.storeKey, JSON.stringify(Array.from(this.connectors.values())));
    } catch { /* ignore */ }
  }

  getAll(): ConnectorConfig[] {
    return Array.from(this.connectors.values());
  }

  get(id: string): ConnectorConfig | undefined {
    return this.connectors.get(id);
  }

  configure(id: string, config: Partial<ConnectorConfig>): boolean {
    const connector = this.connectors.get(id);
    if (!connector) return false;
    Object.assign(connector, config);
    connector.lastChecked = Date.now();
    if (config.apiKey) connector.status = 'connected';
    this.save();
    return true;
  }

  remove(id: string): boolean {
    return this.connectors.delete(id);
  }

  testConnection(id: string): Promise<boolean> {
    const connector = this.connectors.get(id);
    if (!connector) return Promise.resolve(false);
    connector.lastChecked = Date.now();
    if (connector.apiKey) {
      connector.status = 'connected';
      connector.errorMessage = undefined;
    } else {
      connector.status = 'disconnected';
      connector.errorMessage = 'No API key configured';
    }
    this.save();
    return Promise.resolve(connector.status === 'connected');
  }

  async call(id: string, request: ConnectorRequest): Promise<ConnectorResponse> {
    const connector = this.connectors.get(id);
    if (!connector) throw new Error(`Connector "${id}" not found`);
    if (!connector.enabled) throw new Error(`Connector "${id}" is disabled`);
    if (!connector.baseUrl) throw new Error(`Connector "${id}" has no base URL configured`);

    const start = performance.now();
    const url = new URL(request.endpoint, connector.baseUrl);
    if (request.params) {
      for (const [k, v] of Object.entries(request.params)) url.searchParams.set(k, v);
    }

    const headers: Record<string, string> = {
      'User-Agent': 'GIA/2.3.1',
      ...request.headers,
    };
    if (connector.apiKey) {
      if (id === 'openweather') headers['Authorization'] = `Bearer ${connector.apiKey}`;
      else headers['x-api-key'] = connector.apiKey;
    }

    const res = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
      signal: AbortSignal.timeout(15000),
    });

    const duration = Math.round(performance.now() - start);
    const data = res.headers.get('content-type')?.includes('json')
      ? await res.json()
      : await res.text();

    return {
      status: res.status,
      data,
      headers: Object.fromEntries(res.headers.entries()),
      duration,
    };
  }

  async callRaw(url: string, method: string, headers?: Record<string, string>, body?: unknown): Promise<ConnectorResponse> {
    const start = performance.now();
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': 'GIA/2.3.1', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const duration = Math.round(performance.now() - start);
    const data = res.headers.get('content-type')?.includes('json')
      ? await res.json()
      : await res.text();
    return { status: res.status, data, headers: Object.fromEntries(res.headers.entries()), duration };
  }
}

export default new ConnectorManager();
