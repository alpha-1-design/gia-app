import { describe, it, expect } from 'vitest';
import config from '../../capacitor.config';

describe('capacitor.config', () => {
  it('keeps CapacitorHttp disabled so streaming responses actually stream', () => {
    // CapacitorHttp routes fetch()/XHR through Android's native HTTP bridge,
    // which buffers the whole response and delivers it to JS in one shot —
    // no incremental progress events. If this ever flips back to true, GIA's
    // responses will stop streaming and just appear all at once when done.
    expect(config.plugins?.CapacitorHttp?.enabled).toBe(false);
  });
});
