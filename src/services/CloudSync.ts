import { logger } from '../utils/logger';
  import { useSyncStore, type SyncScope } from '../store/useSyncStore';
import { useMemoryStore } from '../store/useMemoryStore';
import { useKnowledgeGraphStore } from '../store/useKnowledgeGraphStore';
import { useTwinStore } from '../store/useTwinStore';

interface SyncPayload {
  type: 'full' | 'delta';
  timestamp: number;
  deviceId: string;
  data: Record<string, unknown>;
}

export class CloudSync {
  private deviceId: string;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private lastSyncHash = '';

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
  }

  private getOrCreateDeviceId(): string {
    const key = 'gia:deviceId';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, id);
    }
    return id;
  }

  start(): void {
    const config = useSyncStore.getState().config;
    if (!config.enabled) return;

    this.stop();
    this.syncTimer = setInterval(() => this.sync(), config.intervalMs);
    logger.info(`[CloudSync] Started (every ${config.intervalMs}ms)`);

    this.sync().catch(() => {});
  }

  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private async sync(): Promise<void> {
    const config = useSyncStore.getState().config;
    if (!config.enabled || !config.endpoint) return;

    useSyncStore.getState().setStatus('syncing');

    try {
      const payload = this.buildPayload(config.scope);
      const payloadStr = JSON.stringify(payload);

      if (payloadStr === this.lastSyncHash) {
        useSyncStore.getState().setStatus('idle');
        return;
      }

      if (config.encrypted) {
        const encrypted = await this.encrypt(payloadStr, config.encryptionKey);
          await this.sendToEndpoint(encrypted, config.endpoint);
        } else {
          await this.sendToEndpoint(payloadStr, config.endpoint);
      }

      this.lastSyncHash = payloadStr;
      useSyncStore.getState().recordSync();
      logger.debug('[CloudSync] Sync completed');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown sync error';
      useSyncStore.getState().setError(msg);
      useSyncStore.getState().setStatus('error');
      logger.warn('[CloudSync] Sync failed:', msg);
    }
  }

  private buildPayload(scopes: SyncScope[]): SyncPayload {
    const data: Record<string, unknown> = {};

    if (scopes.includes('all') || scopes.includes('memories')) {
      data.memories = useMemoryStore.getState().memories;
    }
    if (scopes.includes('all') || scopes.includes('knowledge_graph')) {
      const kg = useKnowledgeGraphStore.getState();
      data.knowledgeGraph = { entities: kg.entities, relationships: kg.relationships };
    }
    if (scopes.includes('all') || scopes.includes('twin')) {
      data.twin = useTwinStore.getState().twin;
    }
    if (scopes.includes('all') || scopes.includes('settings')) {
      data.settings = this.collectSettings();
    }

    return {
      type: 'delta',
      timestamp: Date.now(),
      deviceId: this.deviceId,
      data,
    };
  }

  private collectSettings(): Record<string, unknown> {
    try {
      const stores = ['gia-automation-v1', 'gia-sync-v1', 'gia-mood-v1', 'gia-notifications-v1'];
      const settings: Record<string, unknown> = {};
      for (const storeName of stores) {
        const raw = localStorage.getItem(storeName);
        if (raw) {
          try { settings[storeName] = JSON.parse(raw); } catch { settings[storeName] = raw; }
        }
      }
      return settings;
    } catch {
      return {};
    }
  }

  private async encrypt(text: string, key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key.padEnd(32, 'x').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      keyMaterial,
      data
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encrypted: string, key: string): Promise<string> {
    const combined = new Uint8Array(
      atob(encrypted).split('').map((c) => c.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(key.padEnd(32, 'x').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      keyMaterial,
      data
    );

    return new TextDecoder().decode(decrypted);
  }

  private async sendToEndpoint(
    payload: string,
    endpoint: string,
  ): Promise<void> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GIA-Device': this.deviceId,
        'X-GIA-Version': '1.0',
      },
      body: JSON.stringify({ payload }),
    });

    if (!response.ok) {
      throw new Error(`Sync server returned ${response.status}`);
    }
  }

  getStatus(): string {
    const config = useSyncStore.getState().config;
    if (!config.enabled) return 'Sync disabled';
    return `Sync: ${config.status}, last: ${config.lastSync ? new Date(config.lastSync).toISOString() : 'never'}`;
  }
}

export const cloudSync = new CloudSync();
