/** Bump when the privacy policy or terms change in a way users must re-accept. */
export const LEGAL_VERSION = '2026-10';

export function needsLegalAcceptance(acceptedVersion: string): boolean {
  return acceptedVersion !== LEGAL_VERSION;
}
