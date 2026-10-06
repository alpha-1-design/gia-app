/** RMS loudness of an AnalyserNode time-domain buffer (bytes centred on 128), 0..1. */
export function levelFromTimeDomain(data: ArrayLike<number>): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  // Speech rarely fills the range; lift quiet input so the bars are readable.
  return Math.min(1, Math.sqrt(sum / data.length) * 3);
}

/** Append a level to a rolling window of at most `max` bars. */
export function pushLevel(levels: number[], level: number, max: number): number[] {
  const next = [...levels, Math.max(0, Math.min(1, level))];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** 0:07, 12:03. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
