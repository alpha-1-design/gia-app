import { GIAScreenAgent } from './GIAScreenAgent';

/**
 * Shared orb control actions — used BOTH by the floating orb mini-brain
 * (OrbAssistant) and by the in-chat `orb_act` tool, so a single code path
 * drives the phone from either surface.
 */
export type OrbControlAction =
  | { action: 'tap'; x: number; y: number }
  | { action: 'tap_text'; text: string }
  | { action: 'scroll'; direction?: 'up' | 'down' | 'left' | 'right' }
  | { action: 'open_app'; app: string }
  | { action: 'go_back' }
  | { action: 'send_photo'; caption?: string };

export type OrbActionSpec = Partial<OrbControlAction> & { action?: string };

export function isOrbActionPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { action?: unknown }).action === 'string';
}

/**
 * Execute one orb action against the phone. Returns a short human-readable
 * result string (e.g. `tapped "Send"`) or `null` when the action was unknown.
 */
export async function executeOrbAction(
  spec: Record<string, unknown>,
  screenshotPath?: string | null,
): Promise<string | null> {
  const action = typeof spec.action === 'string' ? spec.action : '';

  switch (action) {
    case 'tap': {
      const x = typeof spec.x === 'number' ? spec.x : NaN;
      const y = typeof spec.y === 'number' ? spec.y : NaN;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      await GIAScreenAgent.performTap({ x, y });
      return `tapped at (${Math.round(x)}, ${Math.round(y)})`;
    }

    case 'tap_text': {
      const text = typeof spec.text === 'string' ? spec.text : '';
      if (!text) return null;
      try {
        const r = await GIAScreenAgent.tapText({ text });
        return r.clicked ? `tapped "${text}"` : `couldn't find "${text}"`;
      } catch {
        return `couldn't find "${text}"`;
      }
    }

    case 'scroll': {
      const direction = spec.direction === 'left' || spec.direction === 'right' || spec.direction === 'up'
        ? spec.direction
        : 'down';
      const r = await GIAScreenAgent.performSwipe({ direction });
      return r.ok ? `scrolled ${direction}` : 'scroll failed';
    }

    case 'open_app': {
      const app = typeof spec.app === 'string' ? spec.app : '';
      if (!app) return null;
      const r = await GIAScreenAgent.openApp({ app });
      return r.ok ? `opened ${app}` : `couldn't open ${app}`;
    }

    case 'go_back': {
      const r = await GIAScreenAgent.goBack();
      return r.ok ? 'went back' : 'back failed';
    }

    case 'send_photo': {
      if (screenshotPath) {
        await GIAScreenAgent.orbShowImage({ path: screenshotPath });
      }
      return 'sent you a screen capture';
    }

    default:
      return null;
  }
}