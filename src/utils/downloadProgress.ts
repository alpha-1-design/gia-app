export interface FileProgress { loaded: number; total: number }

/**
 * Model downloads arrive as several files (config, tokenizer, weights), each
 * reporting its own loaded/total. Sum them into one honest percentage.
 */
export function aggregateProgress(
  files: Record<string, FileProgress>,
  expectedTotal = 0,
): { loaded: number; total: number; percent: number } {
  let loaded = 0;
  let total = 0;
  for (const f of Object.values(files)) {
    if (!Number.isFinite(f.total) || f.total <= 0) continue;
    total += f.total;
    loaded += Math.min(Math.max(0, f.loaded || 0), f.total);
  }
  // Small files (config, tokenizer) finish first. Without a floor the ring would
  // read 100% while the big weights file has not even started, so use the
  // model's advertised size as the minimum total.
  total = Math.max(total, expectedTotal);
  // Only finish() may show 100%: more files can still appear.
  return { loaded, total, percent: total > 0 ? Math.min(99, Math.floor((loaded / total) * 100)) : 0 };
}

/** "~1 GB", "~500 MB", "2.5GB" -> bytes. Returns 0 when it cannot tell. */
export function parseSizeLabel(label: string | undefined): number {
  const m = /([\d.]+)\s*(GB|MB)/i.exec(label ?? '');
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * (m[2].toUpperCase() === 'GB' ? 1024 ** 3 : 1024 ** 2));
}

/** Files that start later add to the total; never show the ring going backwards. */
export function monotonicPercent(previous: number, next: number): number {
  return Math.max(previous, next);
}

export function formatBytesShort(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}
