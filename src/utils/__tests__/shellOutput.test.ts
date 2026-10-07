import { describe, it, expect } from 'vitest';
import { wrapCommand, parseShellOutput, stripAnsi, capScrollback, CWD_MARKER } from '../shellOutput';

describe('shellOutput', () => {
  it('wrapCommand keeps the command, its exit code, and reports cwd', () => {
    const w = wrapCommand('cd /tmp && ls');
    expect(w.startsWith('cd /tmp && ls\n')).toBe(true);
    expect(w).toContain('exit $__gia_rc');
    expect(w).toContain(CWD_MARKER);
  });

  it('parseShellOutput hides the marker and returns the directory', () => {
    const r = parseShellOutput(`hello\n\n${CWD_MARKER}/root/proj\n`);
    expect(r.cwd).toBe('/root/proj');
    expect(r.text).not.toContain(CWD_MARKER);
    expect(r.text).toContain('hello');
  });

  it('parseShellOutput tolerates a half-received marker and no marker', () => {
    expect(parseShellOutput('partial output').cwd).toBeNull();
    const r = parseShellOutput(`out\n${CWD_MARKER}/ro`);
    expect(r.text).not.toContain(CWD_MARKER);
  });

  it('stripAnsi removes colour codes', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red');
  });

  it('capScrollback trims long output', () => {
    expect(capScrollback('a'.repeat(50), 10).length).toBeLessThan(50);
    expect(capScrollback('short')).toBe('short');
  });
});
