import { logger } from '../utils/logger';

interface MeshMessage {
  type: 'state_sync' | 'command' | 'notification' | 'ping' | 'pong' | 'capability_profile';
  sourceDevice: string;
  targetDevice?: string;
  payload: unknown;
  timestamp: number;
  id: string;
}

/**
 * Compact per-device capability inventory. Built by CapabilityService after
 * each scan and broadcast so every paired peer knows what the others can do
 * (OpenClaw-style fleet awareness, borrowed from gia-cowork).
 */
export interface CapabilityMeshPayload {
  platform: 'desktop' | 'mobile' | 'web';
  os: string;
  distroId: string;
  packageManagers: string[];
  binaryCount: number;
  tools: string[];
  missing: string[];
  gpu: boolean;
  webgpu: boolean;
  ramFreeGB: number | null;
  engines: {
    localLLMModels: number;
    localLLMReady: string[];
    kokoro: string;
    speech5: string;
    whisper: string;
  };
  hash: string;
  scannedAt: number;
}

interface MeshPeer {
  id: string;
  name: string;
  type: 'electron' | 'browser' | 'android' | 'extension';
  lastSeen: number;
  connected: boolean;
}

type MessageHandler = (msg: MeshMessage) => void;

export class CrossDeviceMesh {
  private peers: Map<string, MeshPeer> = new Map();
  private peerCapabilities: Map<string, CapabilityMeshPayload> = new Map();
  private messageHandlers: Set<MessageHandler> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private peerCheckTimer: ReturnType<typeof setInterval> | null = null;
  private deviceId: string;

  private readonly PING_INTERVAL = 30000;
  private readonly PEER_TIMEOUT = 120000;

  constructor() {
    this.deviceId = localStorage.getItem('gia:meshDeviceId')
      || `mesh-${crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('gia:meshDeviceId', this.deviceId);
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  startLocalBroadcast(): void {
    try {
      this.broadcastChannel = new BroadcastChannel('gia-mesh');
      this.broadcastChannel.onmessage = (event) => {
        this.handleMessage(event.data as MeshMessage);
      };
      logger.info('[CrossDeviceMesh] Local broadcast started');
    } catch (e) {
      logger.warn('[CrossDeviceMesh] BroadcastChannel not available:', e);
    }
  }

  async connectRelay(url: string): Promise<void> {
    if (this.ws) this.ws.close();

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        logger.info('[CrossDeviceMesh] Relay connected');
        this.send({ type: 'ping', payload: { deviceType: this.getDeviceType() } });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as MeshMessage;
          this.handleMessage(msg);
        } catch { /* ignore malformed messages */ }
      };

      this.ws.onclose = () => {
        logger.info('[CrossDeviceMesh] Relay disconnected');
        this.scheduleReconnect(url);
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (e) {
      logger.warn('[CrossDeviceMesh] Relay connection failed:', e);
      this.scheduleReconnect(url);
    }
  }

  private scheduleReconnect(url: string): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectRelay(url).catch(() => {});
    }, 10000);
  }

  startPeerDiscovery(): void {
    this.peerCheckTimer = setInterval(() => {
      this.prunePeers();
      this.send({ type: 'ping', payload: { deviceType: this.getDeviceType() } });
    }, this.PING_INTERVAL);
  }

  stop(): void {
    this.ws?.close();
    this.ws = null;
    this.broadcastChannel?.close();
    this.broadcastChannel = null;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.peerCheckTimer) { clearInterval(this.peerCheckTimer); this.peerCheckTimer = null; }
  }

  sendStateSync(data: unknown): void {
    this.send({ type: 'state_sync', payload: data });
  }

  sendCommand(command: string, targetDevice?: string): void {
    this.send({ type: 'command', payload: command, targetDevice });
  }

  sendNotification(title: string, body: string): void {
    this.send({ type: 'notification', payload: { title, body } });
  }

  /** Announce this device's capability inventory to every paired peer. */
  broadcastCapabilityProfile(profile: CapabilityMeshPayload): void {
    this.send({ type: 'capability_profile', payload: profile });
  }

  private send(partial: Partial<MeshMessage>): void {
    const msg: MeshMessage = {
      type: partial.type || 'ping',
      sourceDevice: this.deviceId,
      targetDevice: partial.targetDevice,
      payload: partial.payload,
      timestamp: Date.now(),
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };

    if (this.broadcastChannel) {
      try { this.broadcastChannel.postMessage(msg); } catch { /* ignore */ }
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(msg: MeshMessage): void {
    if (msg.sourceDevice === this.deviceId) return;

    if (msg.type === 'ping') {
      this.addOrUpdatePeer(msg.sourceDevice, (msg.payload as { deviceType?: MeshPeer['type'] })?.deviceType || 'browser');
      this.send({ type: 'pong', targetDevice: msg.sourceDevice, payload: { deviceType: this.getDeviceType() } });
      return;
    }

    if (msg.type === 'pong') {
      this.addOrUpdatePeer(msg.sourceDevice, (msg.payload as { deviceType?: MeshPeer['type'] })?.deviceType || 'browser');
      return;
    }

    if (msg.type === 'capability_profile') {
      this.addOrUpdatePeer(msg.sourceDevice, (msg.payload as { deviceType?: MeshPeer['type'] })?.deviceType
        || (msg.payload as CapabilityMeshPayload)?.platform === 'mobile' ? 'android'
        : (msg.payload as CapabilityMeshPayload)?.platform === 'desktop' ? 'electron' : 'browser');
      this.peerCapabilities.set(msg.sourceDevice, msg.payload as CapabilityMeshPayload);
      return;
    }

    this.messageHandlers.forEach((handler) => {
      try { handler(msg); } catch (e) { logger.warn('[CrossDeviceMesh] Handler error:', e); }
    });
  }

  private addOrUpdatePeer(id: string, type: MeshPeer['type']): void {
    const existing = this.peers.get(id);
    if (existing) {
      existing.lastSeen = Date.now();
      existing.connected = true;
    } else {
      this.peers.set(id, {
        id,
        name: `${type}-${id.slice(-6)}`,
        type,
        lastSeen: Date.now(),
        connected: true,
      });
      logger.info(`[CrossDeviceMesh] New peer: ${id} (${type})`);
    }
  }

  private prunePeers(): void {
    const now = Date.now();
    for (const [id, peer] of this.peers) {
      if (now - peer.lastSeen > this.PEER_TIMEOUT) {
        peer.connected = false;
        this.peers.delete(id);
        logger.info(`[CrossDeviceMesh] Peer timed out: ${id}`);
      }
    }
  }

  private getDeviceType(): MeshPeer['type'] {
    const ua = navigator.userAgent;
    if (ua.includes('Electron')) return 'electron';
    if (ua.includes('Android')) return 'android';
    if (ua.includes('Chrome') && !ua.includes('Electron')) return 'extension';
    return 'browser';
  }

  getPeers(): MeshPeer[] {
    return Array.from(this.peers.values());
  }

  /** Capability inventory last announced by a peer (or null if none yet). */
  getCapabilityProfile(peerId: string): CapabilityMeshPayload | null {
    return this.peerCapabilities.get(peerId) ?? null;
  }

  /** All peers that have announced a capability inventory. */
  getPeerCapabilities(): { peer: MeshPeer; profile: CapabilityMeshPayload }[] {
    return Array.from(this.peerCapabilities.entries())
      .filter(([id]) => this.peers.has(id))
      .map(([id, profile]) => ({ peer: this.peers.get(id)!, profile }));
  }

  /** Compact per-peer overview for the model prompt (fleet awareness). */
  getFleetContext(): string {
    const lines: string[] = [];
    for (const { peer, profile } of this.getPeerCapabilities()) {
      const bits: string[] = [profile.os || 'unknown OS'];
      if (profile.packageManagers.length > 0) bits.push(`pm: ${profile.packageManagers.join(',')}`);
      bits.push(`${profile.binaryCount} tools`);
      if (profile.gpu) bits.push('gpu');
      if (profile.webgpu) bits.push('webgpu');
      if (profile.engines.localLLMReady.length > 0) bits.push(`llm: ${profile.engines.localLLMReady.join(',')}`);
      if (profile.engines.kokoro === 'ready') bits.push('kokoro');
      if (profile.engines.speech5 === 'ready') bits.push('speech5');
      if (profile.engines.whisper === 'ready') bits.push('whisper');
      lines.push(`- ${peer.name} (${peer.type}): ${bits.join(' · ')}`);
    }
    return lines.join('\n');
  }

  getStatus(): string {
    return `Mesh: ${this.peers.size} peer(s), relay: ${this.ws?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected'}`;
  }
}

export const crossDeviceMesh = new CrossDeviceMesh();
