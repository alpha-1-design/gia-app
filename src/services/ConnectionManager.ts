import oauthManager, { type OAuthConfig, type OAuthTokens } from './social/OAuthManager';

export type ServiceType = 'gmail' | 'calendar';

interface ServiceConnection {
  type: ServiceType;
  tokens: OAuthTokens;
  accountName?: string;
  connectedAt: number;
}

const STORE_KEY = 'gia-service-connections';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

function getOAuthConfig(service: ServiceType, clientId: string): OAuthConfig {
  const scopes: Record<ServiceType, string> = {
    gmail: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
    calendar: 'https://www.googleapis.com/auth/calendar.events',
  };
  return {
    platformId: service,
    authUrl: GOOGLE_AUTH_URL,
    tokenUrl: GOOGLE_TOKEN_URL,
    revokeUrl: GOOGLE_REVOKE_URL,
    scopes: scopes[service],
    redirectUri: oauthManager.getRedirectUri(),
    clientId,
  };
}

class ConnectionManager {
  private connections: Map<string, ServiceConnection> = new Map();

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data: Record<string, ServiceConnection> = JSON.parse(raw);
        for (const [id, conn] of Object.entries(data)) {
          if (conn.tokens.expiresAt && conn.tokens.expiresAt > Date.now()) {
            this.connections.set(id, conn);
          }
        }
      }
    } catch { /* noop */ }
  }

  private save() {
    const data: Record<string, ServiceConnection> = {};
    for (const [id, conn] of this.connections) {
      data[id] = conn;
    }
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch { /* noop */ }
  }

  isConnected(service: ServiceType): boolean {
    const conn = this.connections.get(service);
    if (!conn) return false;
    if (conn.tokens.expiresAt && conn.tokens.expiresAt < Date.now()) return false;
    return true;
  }

  getTokens(service: ServiceType): OAuthTokens | null {
    const conn = this.connections.get(service);
    if (!conn) return null;
    if (conn.tokens.expiresAt && conn.tokens.expiresAt < Date.now()) return null;
    return conn.tokens;
  }

  getAccountName(service: ServiceType): string | undefined {
    return this.connections.get(service)?.accountName;
  }

  async connect(service: ServiceType, clientId: string): Promise<{ success: boolean; error?: string }> {
    const config = getOAuthConfig(service, clientId);
    try {
      const tokens = await oauthManager.startFlow(config);
      this.connections.set(service, {
        type: service,
        tokens,
        accountName: 'google-user',
        connectedAt: Date.now(),
      });
      this.save();
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Connection failed' };
    }
  }

  async disconnect(service: ServiceType): Promise<void> {
    const conn = this.connections.get(service);
    if (conn?.tokens?.accessToken) {
      try {
        const config = getOAuthConfig(service, '');
        await oauthManager.revokeToken(config, conn.tokens.accessToken);
      } catch { /* noop */ }
    }
    this.connections.delete(service);
    this.save();
  }

  getConnectedServices(): ServiceType[] {
    return Array.from(this.connections.keys()).filter((s): s is ServiceType => this.isConnected(s as ServiceType));
  }

  listAll(): { service: ServiceType; accountName?: string }[] {
    const result: { service: ServiceType; accountName?: string }[] = [];
    for (const [service, conn] of this.connections) {
      if (this.isConnected(service as ServiceType)) {
        result.push({ service: service as ServiceType, accountName: conn.accountName });
      }
    }
    return result;
  }
}

export default new ConnectionManager();
