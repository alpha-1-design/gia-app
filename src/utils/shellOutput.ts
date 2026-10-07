/** Helpers for the on-device Linux shell panel (pure, unit-tested). */

export const CWD_MARKER = '__GIA_CWD__';

/**
 * Wrap a user command so the shell reports its final working directory and
 * keeps the command's own exit code. Each command runs in a fresh `sh -c`, so
 * `cd` would otherwise be forgotten between commands.
 */
export function wrapCommand(cmd: string): string {
  return `${cmd}\n__gia_rc=$?\nprintf '\\n${CWD_MARKER}%s\\n' "$(pwd)"\nexit $__gia_rc`;
}

// eslint-disable-next-line no-control-regex -- matching ESC/BEL control characters is the point
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;

/** Remove terminal colour/cursor escape sequences — the panel renders plain text. */
export function stripAnsi(s: string): string {
  return s.replace(ANSI, '').replace(/\r(?!\n)/g, '\n');
}

/** Split raw output into what to show and the reported working directory (if seen yet). */
export function parseShellOutput(raw: string): { text: string; cwd: string | null } {
  const m = raw.match(new RegExp(`\\n?${CWD_MARKER}([^\\n]*)(?:\\n|$)`));
  const cwd = m ? m[1].trim() || null : null;
  const text = stripAnsi(raw.replace(new RegExp(`\\n?${CWD_MARKER}[^\\n]*(?:\\n|$)`, 'g'), ''));
  return { text, cwd };
}

/** Keep the scrollback bounded so a noisy command can't bloat memory. */
export function capScrollback(s: string, max = 200_000): string {
  return s.length > max ? '…(older output trimmed)\n' + s.slice(s.length - max) : s;
}
