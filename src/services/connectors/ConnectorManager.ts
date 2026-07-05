export interface ConnectorField {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'password' | 'url';
  required: boolean;
}

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
  config?: Record<string, string>;
  fields?: ConnectorField[];
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
      { id: 'openweather', name: 'OpenWeatherMap', description: 'Weather data API', type: 'api', icon: 'cloud-sun', baseUrl: 'https://api.openweathermap.org/data/2.5', enabled: false, status: 'disconnected', fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'Paste API key...', type: 'password', required: true }] },
      { id: 'newsapi', name: 'NewsAPI', description: 'News articles and headlines', type: 'api', icon: 'newspaper', baseUrl: 'https://newsapi.org/v2', enabled: false, status: 'disconnected', fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'Paste API key...', type: 'password', required: true }] },
      { id: 'github', name: 'GitHub API', description: 'GitHub repositories and user data', type: 'api', icon: 'github', baseUrl: 'https://api.github.com', enabled: false, status: 'disconnected', fields: [{ key: 'apiKey', label: 'Personal Access Token', placeholder: 'ghp_...', type: 'password', required: true }] },
      { id: 'serpapi', name: 'SERP API', description: 'Search engine results', type: 'api', icon: 'search', baseUrl: 'https://serpapi.com', enabled: false, status: 'disconnected', fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'Paste API key...', type: 'password', required: true }] },
      { id: 'sendgrid', name: 'SendGrid', description: 'Email delivery service', type: 'messaging', icon: 'mail', baseUrl: 'https://api.sendgrid.com/v3', enabled: false, status: 'disconnected', fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'SG....', type: 'password', required: true }] },
      { id: 'supabase', name: 'Supabase', description: 'PostgreSQL database with realtime', type: 'database', icon: 'database', enabled: false, status: 'disconnected', fields: [{ key: 'projectUrl', label: 'Project URL', placeholder: 'https://xxx.supabase.co', type: 'url', required: true }, { key: 'anonKey', label: 'Anon Key', placeholder: 'eyJ...', type: 'password', required: true }] },
      { id: 'firebase', name: 'Firebase', description: 'Google Firebase backend — needs project config (apiKey, authDomain, projectId, etc.)', type: 'cloud', icon: 'flame', enabled: false, status: 'disconnected', fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'AIza...', type: 'password', required: true }, { key: 'authDomain', label: 'Auth Domain', placeholder: 'xxx.firebaseapp.com', type: 'text', required: true }, { key: 'projectId', label: 'Project ID', placeholder: 'my-project-id', type: 'text', required: true }, { key: 'storageBucket', label: 'Storage Bucket', placeholder: 'xxx.appspot.com', type: 'text', required: false }] },
      { id: 'aws', name: 'AWS S3', description: 'Amazon S3 cloud storage', type: 'storage', icon: 'cloud', enabled: false, status: 'disconnected', fields: [{ key: 'accessKeyId', label: 'Access Key ID', placeholder: 'AKIA...', type: 'text', required: true }, { key: 'secretAccessKey', label: 'Secret Access Key', placeholder: 'Paste secret key...', type: 'password', required: true }, { key: 'region', label: 'Region', placeholder: 'us-east-1', type: 'text', required: true }, { key: 'bucket', label: 'Bucket Name', placeholder: 'my-bucket', type: 'text', required: false }] },
      { id: 'twilio', name: 'Twilio', description: 'SMS and communication APIs', type: 'messaging', icon: 'message-circle', baseUrl: 'https://api.twilio.com', enabled: false, status: 'disconnected', fields: [{ key: 'accountSid', label: 'Account SID', placeholder: 'AC...', type: 'password', required: true }, { key: 'authToken', label: 'Auth Token', placeholder: 'Paste auth token...', type: 'password', required: true }, { key: 'fromNumber', label: 'From Number', placeholder: '+1234567890', type: 'text', required: false }] },
      { id: 'notion', name: 'Notion API', description: 'Notion workspaces and databases', type: 'api', icon: 'file-text', baseUrl: 'https://api.notion.com/v1', enabled: false, status: 'disconnected', fields: [{ key: 'apiKey', label: 'Integration Token', placeholder: 'ntn_...', type: 'password', required: true }] },
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
    if (config.apiKey) {
      connector.apiKey = config.apiKey;
      connector.config = { ...connector.config, apiKey: config.apiKey };
    }
    if (config.config) {
      connector.config = { ...connector.config, ...config.config };
      if (config.config.apiKey) connector.apiKey = config.config.apiKey;
    }
    if (config.enabled !== undefined) connector.enabled = config.enabled;
    connector.lastChecked = Date.now();
    const hasRequired = connector.fields?.every(f => !f.required || (connector.config?.[f.key] || connector.apiKey));
    if (hasRequired && (connector.apiKey || Object.keys(connector.config || {}).length > 0)) connector.status = 'connected';
    this.save();
    return true;
  }

  remove(id: string): boolean {
    return this.connectors.delete(id);
  }

  async testConnection(id: string): Promise<boolean> {
    const connector = this.connectors.get(id);
    if (!connector) return false;
    connector.lastChecked = Date.now();
    const cfg = connector.config || {};
    const hasRequired = connector.fields?.every(f => !f.required || cfg[f.key] || (f.key === 'apiKey' && connector.apiKey));
    if (!hasRequired) {
      connector.status = 'disconnected';
      connector.errorMessage = 'Fill in all required fields first';
      this.save();
      return false;
    }
    if (id === 'supabase' || id === 'firebase' || id === 'aws') {
      connector.status = 'connected';
      connector.errorMessage = undefined;
      this.save();
      return true;
    }
    if (!connector.baseUrl) {
      connector.status = 'error';
      connector.errorMessage = 'No base URL configured';
      this.save();
      return false;
    }
    try {
      const apiKey = cfg.apiKey || connector.apiKey || '';
      const testUrl = `${connector.baseUrl.replace(/\/+$/, '')}/`;
      const headers: Record<string, string> = { 'User-Agent': 'GIA/2.3.2.0' };
      if (id === 'github') headers['Authorization'] = `Bearer ${apiKey}`;
      else if (id === 'twilio') headers['Authorization'] = 'Basic ' + btoa(`${cfg.accountSid || apiKey}:${cfg.authToken || ''}`);
      else headers['x-api-key'] = apiKey;
      const res = await fetch(testUrl, { method: 'GET', headers, signal: AbortSignal.timeout(10000) });
      connector.status = res.ok ? 'connected' : 'error';
      connector.errorMessage = res.ok ? undefined : `HTTP ${res.status}`;
    } catch (e) {
      connector.status = 'error';
      connector.errorMessage = e instanceof Error ? e.message : 'Connection failed';
    }
    this.save();
    return connector.status === 'connected';
  }

  async call(id: string, request: ConnectorRequest): Promise<ConnectorResponse> {
    const connector = this.connectors.get(id);
    if (!connector) throw new Error(`Connector "${id}" not found`);
    if (!connector.enabled) throw new Error(`Connector "${id}" is disabled`);

    const cfg = connector.config || {};
    const apiKey = cfg.apiKey || connector.apiKey || '';

    if (!connector.baseUrl && id !== 'supabase' && id !== 'aws' && id !== 'firebase') {
      throw new Error(`Connector "${id}" has no base URL configured`);
    }

    const start = performance.now();

    let urlStr: string;
    const headers: Record<string, string> = { 'User-Agent': 'GIA/2.3.2.0', ...request.headers };

    if (id === 'supabase') {
      const base = cfg.projectUrl || connector.baseUrl || '';
      if (!base) throw new Error('Supabase project URL is required');
      urlStr = `${base.replace(/\/+$/, '')}${request.endpoint}`;
      headers['apikey'] = cfg.anonKey || apiKey;
      headers['Authorization'] = `Bearer ${cfg.anonKey || apiKey}`;
    } else if (id === 'twilio') {
      const sid = cfg.accountSid || apiKey;
      const token = cfg.authToken || '';
      if (!connector.baseUrl) throw new Error('Twilio base URL missing');
      urlStr = `${connector.baseUrl.replace(/\/+$/, '')}${request.endpoint}`;
      headers['Authorization'] = 'Basic ' + btoa(`${sid}:${token}`);
    } else if (id === 'aws') {
      throw new Error('AWS S3 calls require native SDK — use connector_config to set credentials');
    } else if (id === 'firebase') {
      throw new Error('Firebase calls use Firebase SDK — configure via connector_config');
    } else {
      if (!connector.baseUrl) throw new Error(`Connector "${id}" has no base URL configured`);
      urlStr = `${connector.baseUrl.replace(/\/+$/, '')}${request.endpoint}`;
      if (apiKey) {
        if (id === 'openweather') headers['Authorization'] = `Bearer ${apiKey}`;
        else headers['x-api-key'] = apiKey;
      }
    }

    const url = new URL(urlStr);
    if (request.params) {
      for (const [k, v] of Object.entries(request.params)) url.searchParams.set(k, v);
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
      headers: { 'User-Agent': 'GIA/2.3.2.0', ...headers },
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
