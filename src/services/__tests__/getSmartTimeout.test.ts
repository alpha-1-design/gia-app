import { describe, it, expect } from 'vitest';
import { getSmartTimeout } from '../TerminalService';

describe('getSmartTimeout — dev server fast-fail', () => {
  it('gives foreground dev-server commands a short 10s timeout instead of the 60s default', () => {
    expect(getSmartTimeout('npm run dev')).toBe(10000);
    expect(getSmartTimeout('npm start')).toBe(10000);
    expect(getSmartTimeout('yarn dev')).toBe(10000);
    expect(getSmartTimeout('vite')).toBe(10000);
    expect(getSmartTimeout('next dev')).toBe(10000);
    expect(getSmartTimeout('flask run')).toBe(10000);
    expect(getSmartTimeout('python3 -m http.server 8000')).toBe(10000);
    expect(getSmartTimeout('uvicorn main:app --reload')).toBe(10000);
  });

  it('is not fooled by the broader python3?|node test-runner category (ordering regression check)', () => {
    // Before the fix, "python3 -m http.server" would have matched the much
    // looser `python3?` pattern in the tests/scripts category first and
    // gotten a 2-minute timeout instead of the intended 10-second fail.
    expect(getSmartTimeout('python3 -m http.server 8000')).toBe(10000);
    expect(getSmartTimeout('python3 -m http.server 8000')).not.toBe(120000);
  });

  it('cannot be overridden by an explicit large requestedTimeout (foreground dev servers never exit, so no timeout value is ever correct for one)', () => {
    expect(getSmartTimeout('npm run dev', 300000)).toBe(10000);
  });

  it('does not affect an actual build command (npm run build), only the dev-server start command', () => {
    expect(getSmartTimeout('npm run build')).toBe(240000);
  });

  it('does not affect ordinary python/node script runs', () => {
    expect(getSmartTimeout('python3 script.py')).toBe(120000);
    expect(getSmartTimeout('node index.js')).toBe(120000);
  });

  it('leaves unrelated commands on the normal 60s default', () => {
    expect(getSmartTimeout('ls -la')).toBe(60000);
  });
});
