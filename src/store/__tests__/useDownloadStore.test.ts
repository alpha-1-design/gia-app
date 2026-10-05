import { describe, it, expect, beforeEach } from 'vitest';
import { useDownloadStore } from '../useDownloadStore';
import { aggregateProgress, formatBytesShort, parseSizeLabel } from '../../utils/downloadProgress';

const s = () => useDownloadStore.getState();

describe('aggregateProgress', () => {
  it('sums files into one percentage', () => {
    expect(aggregateProgress({ a: { loaded: 50, total: 100 }, b: { loaded: 0, total: 100 } }).percent).toBe(25);
  });
  it('ignores files with no known size and never claims 100% by itself', () => {
    expect(aggregateProgress({ a: { loaded: 5, total: 0 }, b: { loaded: 200, total: 100 } }).percent).toBe(99);
    expect(aggregateProgress({}).percent).toBe(0);
  });
  it('a finished small file does not read as a finished download', () => {
    // config.json done, 1 GB of weights not started yet
    const p = aggregateProgress({ 'config.json': { loaded: 10, total: 10 } }, 1024 ** 3);
    expect(p.percent).toBe(0);
  });
  it('parses advertised sizes', () => {
    expect(parseSizeLabel('~1 GB')).toBe(1024 ** 3);
    expect(parseSizeLabel('~500 MB')).toBe(500 * 1024 ** 2);
    expect(parseSizeLabel('2.5GB')).toBe(Math.round(2.5 * 1024 ** 3));
    expect(parseSizeLabel('unknown')).toBe(0);
    expect(parseSizeLabel(undefined)).toBe(0);
  });
  it('formats sizes', () => {
    expect(formatBytesShort(0)).toBe('0 MB');
    expect(formatBytesShort(5 * 1024 ** 2)).toBe('5 MB');
    expect(formatBytesShort(1.5 * 1024 ** 3)).toBe('1.5 GB');
  });
});

describe('useDownloadStore', () => {
  beforeEach(() => useDownloadStore.setState({ tasks: {} }));

  it('combines per-file progress and never goes backwards when a bigger file starts', () => {
    s().report('m', 'Model', 'config.json', { loaded: 10, total: 10 }, 1000);
    expect(s().tasks.m.percent).toBe(1);
    s().report('m', 'Model', 'model.onnx', { loaded: 500, total: 900 }, 1000);
    const first = s().tasks.m.percent;
    expect(first).toBe(51);
    // a surprise extra file raises the total; the ring must not slide back
    s().report('m', 'Model', 'extra.bin', { loaded: 0, total: 5000 }, 1000);
    expect(s().tasks.m.percent).toBeGreaterThanOrEqual(first);
  });
  it('a new download after a finished one starts from scratch', () => {
    s().report('m', 'Model', 'f', { loaded: 100, total: 100 });
    s().finish('m');
    expect(s().tasks.m.status).toBe('done');
    expect(s().tasks.m.percent).toBe(100);
    s().report('m', 'Model', 'f', { loaded: 1, total: 100 });
    expect(s().tasks.m.status).toBe('running');
    expect(s().tasks.m.percent).toBe(1);
  });
  it('records failures and dismisses', () => {
    s().report('m', 'Model', 'f', { loaded: 1, total: 100 });
    s().fail('m', 'network');
    expect(s().tasks.m).toMatchObject({ status: 'error', error: 'network' });
    s().dismiss('m');
    expect(s().tasks.m).toBeUndefined();
  });
  it('ignores finish for unknown tasks', () => {
    s().finish('nope');
    expect(s().tasks).toEqual({});
  });
});
