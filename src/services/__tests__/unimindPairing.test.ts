import { describe, it, expect } from 'vitest';
import { buildUnimindPairingUrl, parseUnimindPairingUrl } from '../unimindPairing';

describe('unimindPairing', () => {
  const payload = { relay: 'ws://192.168.1.50:8787/unimind', id: 'uni-abc-123' };

  it('round-trips a payload through URL building and parse', () => {
    const url = buildUnimindPairingUrl(payload);
    expect(url).toMatch(/^unimind:\/\/pair\?relay=/);
    expect(parseUnimindPairingUrl(url)).toEqual(payload);
  });

  it('tolerates whitespace and the single-slash scheme form', () => {
    const url = buildUnimindPairingUrl(payload);
    expect(parseUnimindPairingUrl(`  ${url.replace('unimind://', 'unimind:')}  `)).toEqual(payload);
  });

  it('rejects non-unimind content', () => {
    expect(parseUnimindPairingUrl('https://example.com/pair?relay=x&id=y')).toBeNull();
    expect(parseUnimindPairingUrl('random text')).toBeNull();
  });

  it('rejects payloads missing id or relay', () => {
    expect(parseUnimindPairingUrl('unimind://pair?relay=ws://x')).toBeNull();
    expect(parseUnimindPairingUrl('unimind://pair?id=uni-x')).toBeNull();
  });

  it('rejects non-websocket relays', () => {
    expect(parseUnimindPairingUrl('unimind://pair?relay=https://x&id=uni-x')).toBeNull();
  });

  it('accepts wss relays', () => {
    expect(parseUnimindPairingUrl('unimind://pair?relay=wss%3A%2F%2Frelay.example.com%2Funimind&id=uni-x')).toEqual({
      relay: 'wss://relay.example.com/unimind',
      id: 'uni-x',
    });
  });
});