/**
 * CapabilityPolicyService — per-capability install approval policy
 * (OpenClaw-style allowlist, borrowed from gia-cowork).
 *
 * Every capability/package is in one of three modes:
 *   allow — install without asking again (auto-approved, cached in the policy)
 *   ask   — always present the user a real choice (default)
 *   deny  — never install; refuse outright
 *
 * Persisted in localStorage so choices survive restarts. `getContext()` is
 * injected into the model prompt so GIA already knows which installs are
 * approved/refused before it opens a suggestion.
 *
 * The policy is keyed by install target name (package / binary / capability
 * id), normalised to lowercase. Enforcement lives in `sandbox_install` and
 * any future install tool.
 */

export type CapabilityPolicy = 'allow' | 'ask' | 'deny';

const LS_KEY = 'gia:capability-policy';
const DEFAULT_POLICY: CapabilityPolicy = 'ask';

export function normalizePolicy(name: string): string {
  return String(name).trim().toLowerCase();
}

function load(): Record<string, CapabilityPolicy> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v === 'allow' || v === 'ask' || v === 'deny'),
    ) as Record<string, CapabilityPolicy>;
  } catch {
    return {};
  }
}

function save(policy: Record<string, CapabilityPolicy>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(policy));
  } catch {
    // storage unavailable — policy just won't persist
  }
}

class CapabilityPolicyService {
  private policy: Record<string, CapabilityPolicy>;

  constructor() {
    this.policy = load();
  }

  /** Current mode for a capability/package. Defaults to `ask` (user choice). */
  decision(name: string): CapabilityPolicy {
    return this.policy[normalizePolicy(name)] ?? DEFAULT_POLICY;
  }

  set(name: string, mode: CapabilityPolicy): void {
    const key = normalizePolicy(name);
    if (!key) return;
    if (mode === 'ask') delete this.policy[key];
    else this.policy[key] = mode;
    save(this.policy);
  }

  allow(name: string): void { this.set(name, 'allow'); }
  ask(name: string): void { this.set(name, 'ask'); }
  deny(name: string): void { this.set(name, 'deny'); }

  /** Snapshot of the whole policy (allow + deny entries). */
  getPolicy(): Readonly<Record<string, CapabilityPolicy>> {
    return { ...this.policy };
  }

  /** Compact prompt block describing what is auto-approved vs refused. */
  getContext(): string {
    const entries = Object.entries(this.policy);
    if (entries.length === 0) return '';
    const allowed = entries.filter(([, m]) => m === 'allow').map(([k]) => k);
    const denied = entries.filter(([, m]) => m === 'deny').map(([k]) => k);
    const lines: string[] = [];
    if (allowed.length > 0) lines.push(`- Auto-approved installs (policy allow — do not ask again): ${allowed.join(', ')}`);
    if (denied.length > 0) lines.push(`- Refused installs (policy deny — never install, tell the user why and offer alternatives): ${denied.join(', ')}`);
    return lines.join('\n');
  }
}

export default new CapabilityPolicyService();