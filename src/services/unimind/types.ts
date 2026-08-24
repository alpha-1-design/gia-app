/**
 * Unimind protocol — the shared wire format between GIA devices.
 * This file is a mirror of gia-cowork/src/unimind/types.ts (the desktop
 * repo). Keep the two in sync: the relay (gia-cowork/relay) routes these
 * envelopes between any devices sharing a unimindId.
 */

export type ModelRef = string;

export type Actor = 'user' | 'agent';

export type Device = 'desktop' | 'mobile';

export type Channel =
  | 'whatsapp'
  | 'telegram'
  | 'desktop-app'
  | 'mobile-app'
  | 'voice'
  | 'face'
  | 'system'
  | (string & {});

export type PresenceStatus = 'online' | 'away' | 'offline';

export type VerificationMethod = 'face' | 'voice' | 'biometric' | 'presence';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface UnimindIdentity {
  unimindId: string;
  device: Device;
  deviceId: string;
}

export interface UnimindEnvelope {
  id: string;
  unimindId: string;
  ts: string;
  actor: Actor;
  channel: Channel;
  device: Device;
  deviceId: string;
  seq: number;
}

export interface ChatMessage {
  type: 'chat';
  role: MessageRole;
  content: string;
  attachments?: Array<{ kind: string; ref: string }>;
}

export interface AgentTriggerMessage {
  type: 'agent-trigger';
  agentId: string;
  task: string;
  modelRef?: ModelRef;
  loop?: Partial<LoopConfig>;
  requestId?: string;
}

export interface ActionDelegationMessage {
  type: 'action';
  target: Device;
  capability: string;
  params: Record<string, unknown>;
  requestId: string;
  result?: unknown;
  error?: string;
}

export interface VerifyRequestMessage {
  type: 'verify-request';
  method: VerificationMethod;
  challenge?: string;
  requestId: string;
  fromDevice: Device;
}

export interface VerifyResponseMessage {
  type: 'verify-response';
  requestId: string;
  verified: boolean;
  viaDevice: Device;
  method: VerificationMethod;
  confidence?: number;
  attestation?: string;
}

export interface PresenceMessage {
  type: 'presence';
  device: Device;
  status: PresenceStatus;
  activeDevice?: Device;
}

export interface LoopConfig {
  enabled: boolean;
  modelRef?: ModelRef;
  maxIterations: number;
  intervalMs: number;
  haltOnStall: boolean;
  stallThresholdMs: number;
}

export type UnimindPayload =
  | ChatMessage
  | AgentTriggerMessage
  | ActionDelegationMessage
  | VerifyRequestMessage
  | VerifyResponseMessage
  | PresenceMessage;

export interface UnimindMessage {
  envelope: UnimindEnvelope;
  payload: UnimindPayload;
}

export type UnimindMessageType = UnimindPayload['type'];

export function makeEnvelope(
  identity: UnimindIdentity,
  payload: UnimindPayload,
  seq: number,
): UnimindMessage {
  return {
    envelope: {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${identity.deviceId}-${seq}-${Date.now()}`,
      unimindId: identity.unimindId,
      ts: new Date().toISOString(),
      actor: payload.type === 'chat' && payload.role === 'user' ? 'user' : 'agent',
      channel:
        payload.type === 'chat'
          ? identity.device === 'desktop'
            ? 'desktop-app'
            : 'mobile-app'
          : 'system',
      device: identity.device,
      deviceId: identity.deviceId,
      seq,
    },
    payload,
  };
}
