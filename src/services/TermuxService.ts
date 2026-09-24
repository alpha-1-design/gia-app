import { Capacitor } from '@capacitor/core';
import { GIAIntent, type TermuxStatus } from './GIAIntent';

/**
 * Hard ceiling on a single Termux command.
 *
 * The native side has its own watchdog, but this is the backstop: if the bridge
 * never answers, this promise MUST settle so the tool loop cannot wedge GIA
 * mid-turn. Without it, `termux_run` hangs until the user force-quits the app.
 */
const RUN_TIMEOUT_MS = 30_000;

const TIMEOUT_MESSAGE =
  `Termux did not respond within ${RUN_TIMEOUT_MS / 1000}s, so GIA stopped waiting. ` +
  'This usually means Termux is not servicing commands from other apps. ' +
  'Open Termux and add `allow-external-apps = true` to ~/.termux/termux.properties, then restart Termux.';

class TermuxService {
  /** Cheap check: is the Termux package present. Says nothing about readiness. */
  async isInstalled(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    return (await GIAIntent.termuxStatus()).installed;
  }

  /**
   * Full bridge readiness. On native this performs a live round-trip probe
   * (~4s worst case) and reports whether allow-external-apps is in effect.
   * Returns a not-ready status rather than throwing, so callers always have a
   * truthful answer to show the user.
   */
  async status(): Promise<TermuxStatus> {
    if (!Capacitor.isNativePlatform()) {
      return {
        installed: false,
        ready: false,
        bridgeResponsive: false,
        allowExternalApps: false,
        declaredAllowExternalApps: null,
        reason: 'not_native',
        hint: 'Termux integration is only available in the Android app.',
      };
    }
    try {
      return await GIAIntent.termuxStatus();
    } catch (e) {
      return {
        installed: true,
        ready: false,
        bridgeResponsive: false,
        allowExternalApps: false,
        declaredAllowExternalApps: null,
        reason: 'status_failed',
        hint: `Could not determine Termux readiness: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  async open(): Promise<void> {
    await GIAIntent.openTermux();
  }

  /**
   * Runs a command in Termux. Always settles: either with the result, or with a
   * timeout error after RUN_TIMEOUT_MS. Never leaves the caller hanging.
   */
  async run(
    command: string,
    args: string[] = [],
    workdir?: string,
  ): Promise<{ jobId: string; stdout?: string; stderr?: string; exitCode?: number }> {
    if (!(await this.isInstalled())) throw new Error('Termux is not installed');

    const call = GIAIntent.runTermuxCommand({ command, args, workdir });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(TIMEOUT_MESSAGE)), RUN_TIMEOUT_MS);
    });

    try {
      // Promise.race guarantees settlement: whichever settles first wins, and
      // the loser is abandoned. No unhandled rejection because both branches
      // are raced and the call's rejection is consumed by the race.
      return await Promise.race([call, timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}

export default new TermuxService();
