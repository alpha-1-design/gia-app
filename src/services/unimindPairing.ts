/**
 * Unimind pairing payload — the QR content shared between devices.
 *
 * The desktop (GIA Cowork) renders a QR code containing
 * `unimind://pair?relay=<relay url>&id=<unimindId>`; the phone (GIA)
 * scans it and adopts both values, so "same relay URL + same pairing id"
 * no longer has to be typed by hand.
 */

export interface UnimindPairingPayload {
  relay: string;
  id: string;
}

const PAIRING_MARKER = 'pair?';

export function buildUnimindPairingUrl(payload: UnimindPairingPayload): string {
  const params = new URLSearchParams();
  params.set('relay', payload.relay);
  params.set('id', payload.id);
  return `unimind://pair?${params.toString()}`;
}

export function parseUnimindPairingUrl(raw: string): UnimindPairingPayload | null {
  const text = raw.trim();
  const marker = text.indexOf(PAIRING_MARKER);
  if (marker < 0) return null;
  const scheme = text.slice(0, marker).toLowerCase();
  if (!scheme.startsWith('unimind')) return null;
  try {
    const params = new URLSearchParams(text.slice(marker + PAIRING_MARKER.length));
    const relay = params.get('relay');
    const id = params.get('id');
    if (!relay || !id) return null;
    if (!/^wss?:\/\//i.test(relay)) return null;
    return { relay, id };
  } catch {
    return null;
  }
}