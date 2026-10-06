type JsonObject = Record<string, unknown>;

export interface AnalysisPoint {
  label: string;
  value: number;
  [key: string]: unknown;
}

export interface NormalizedAnalysis {
  data: AnalysisPoint[];
  summary?: string;
  narrative?: string;
  columns?: string[];
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function numeric(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/,/g, '')) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeAnalysisOutput(value: unknown): NormalizedAnalysis {
  const root = isObject(value) ? value : {};
  const rawData = Array.isArray(value) ? value
    : [root.data, root.rows, root.points, root.results, root.values, root.series].find(candidate => Array.isArray(candidate) || isObject(candidate));

  let data: AnalysisPoint[] = [];
  if (Array.isArray(rawData)) {
    data = rawData.flatMap((raw, index) => {
      if (typeof raw === 'number' || typeof raw === 'string') {
        const value = numeric(raw);
        return value === undefined ? [] : [{ label: `Point ${index + 1}`, value }];
      }
      if (!isObject(raw)) return [];
      const label = text(raw.label ?? raw.name ?? raw.category ?? raw.date ?? raw.x) || `Point ${index + 1}`;
      const value = numeric(raw.value ?? raw.amount ?? raw.count ?? raw.total ?? raw.y);
      return value === undefined ? [] : [{ ...raw, label, value }];
    });
  } else if (isObject(rawData)) {
    const labels = Array.isArray(rawData.labels) ? rawData.labels : [];
    const values = Array.isArray(rawData.values) ? rawData.values : [];
    if (values.length) {
      data = values.flatMap((raw, index) => {
        const value = numeric(raw);
        return value === undefined ? [] : [{ label: text(labels[index]) || `Point ${index + 1}`, value }];
      });
    } else {
      data = Object.entries(rawData).flatMap(([label, raw]) => {
        const value = numeric(raw);
        return value === undefined ? [] : [{ label, value }];
      });
    }
  }

  if (!data.length) throw new Error('No chartable numeric data points were found in the AI response.');

  const summary = text(root.summary ?? root.insight ?? root.headline);
  const narrative = text(root.narrative ?? root.analysis ?? root.interpretation ?? root.conclusion);
  const rawColumns = root.columns ?? root.headers;
  const columns = Array.isArray(rawColumns) ? rawColumns.map(text).filter(Boolean) : undefined;
  return { data, ...(summary ? { summary } : {}), ...(narrative ? { narrative } : {}), ...(columns?.length ? { columns } : {}) };
}
