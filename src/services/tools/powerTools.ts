import { z } from 'zod';
import { useMemoryStore } from '../../store/useMemoryStore';
import { useNotesStore } from '../../store/useNotesStore';
import type { Tool, ToolContext } from './types';

const httpRequest: Tool = {
  id: 'http_request',
  name: 'http_request',
  description: 'Make arbitrary HTTP requests (GET, POST, PUT, PATCH, DELETE) to any API endpoint. Returns JSON or text response.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Full URL to request' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], description: 'HTTP method (default: GET)' },
      headers: { type: 'object', description: 'Optional headers as key-value pairs' },
      body: { type: 'string', description: 'Request body (stringified JSON for POST/PUT/PATCH)' },
      timeout: { type: 'number', description: 'Timeout in ms (default: 15000)' },
    },
    required: ['url'],
  },
  execute: async (args, ctx?: ToolContext) => {
    const schema = z.object({
      url: z.string().url('Must be a valid URL').max(5000),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.string().optional(),
      timeout: z.number().min(1000).max(60000).default(15000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    const { url, method, headers, body, timeout } = parsed.data;
    try {
      ctx?.onProgress?.(0.1, `Connecting to ${new URL(url).hostname}...`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, {
        method,
        headers: { 'User-Agent': 'GIA/2.3.1.2', ...headers },
        body: method === 'GET' || method === 'DELETE' ? undefined : body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      ctx?.onProgress?.(0.6, 'Reading response...');
      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();
      ctx?.onProgress?.(0.9, 'Processing response...');
      let content = text;
      if (contentType.includes('application/json') || contentType.includes('json')) {
        try { content = JSON.stringify(JSON.parse(text), null, 2); } catch { content = text; }
      }
      ctx?.onProgress?.(1, 'Done');
      return {
        success: res.ok,
        content: `${res.status} ${res.statusText}\n\n${content.slice(0, 50000)}`,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const webScrape: Tool = {
  id: 'web_scrape',
  name: 'web_scrape',
  description: 'Fetch and extract readable content from any URL. Returns clean text with title.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      maxChars: { type: 'number', description: 'Max characters to return (default: 25000)' },
    },
    required: ['url'],
  },
  execute: async (args, ctx?: ToolContext) => {
    const schema = z.object({
      url: z.string().url('Must be a valid URL').max(5000),
      maxChars: z.number().min(1000).max(100000).default(25000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    const { url, maxChars } = parsed.data;
    try {
      ctx?.onProgress?.(0.1, 'Connecting...');
      const { default: fallback } = await import('../FallbackWebSearch');
      ctx?.onProgress?.(0.3, 'Fetching page...');
      const page = await fallback.scrape(url, maxChars);
      ctx?.onProgress?.(0.8, 'Extracting content...');
      return { success: true, content: `# ${page.title}\n\n${page.content}\n\n---\n_Fetched via ${page.source}_` };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const dataAnalysis: Tool = {
  id: 'data_analysis',
  name: 'data_analysis',
  description: 'Analyze structured data (CSV, JSON, or TSV). Returns summary statistics, column info, row counts, and sample rows.',
  schema: {
    type: 'object',
    properties: {
      data: { type: 'string', description: 'The raw data as CSV, JSON array, or TSV string' },
      format: { type: 'string', enum: ['csv', 'json', 'tsv'], description: 'Data format (default: auto-detect)' },
      maxRows: { type: 'number', description: 'Max rows to analyze (default: 1000)' },
    },
    required: ['data'],
  },
  execute: async (args) => {
    const schema = z.object({
      data: z.string().min(1).max(200000),
      format: z.enum(['csv', 'json', 'tsv']).optional(),
      maxRows: z.number().min(1).max(10000).default(1000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    const { data, format, maxRows } = parsed.data;
    try {
      let rows: Record<string, unknown>[] = [];
      if (format === 'json' || (!format && data.trim().startsWith('['))) {
        rows = JSON.parse(data);
      } else {
        const sep = format === 'tsv' ? '\t' : ',';
        const lines = data.trim().split('\n');
        const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
        for (let i = 1; i < Math.min(lines.length, maxRows + 1); i++) {
          const vals = lines[i].split(sep).map(v => {
            v = v.trim();
            if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
            const num = Number(v);
            return isNaN(num) ? v : num;
          });
          const row: Record<string, unknown> = {};
          headers.forEach((h, j) => { row[h] = vals[j]; });
          rows.push(row);
        }
      }
      const totalRows = rows.length;
      const cols = Object.keys(rows[0] || {});
      const numericCols = cols.filter(c => rows.some(r => typeof r[c] === 'number'));
      const stats: Record<string, { min?: number; max?: number; avg?: number; unique: number; nulls: number }> = {};
      for (const c of cols) {
        const vals = rows.map(r => r[c]);
        const unique = new Set(vals).size;
        const nulls = vals.filter(v => v === null || v === undefined || v === '').length;
        if (numericCols.includes(c)) {
          const nums = vals.filter(v => typeof v === 'number') as number[];
          stats[c] = {
            min: Math.min(...nums),
            max: Math.max(...nums),
            avg: Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100,
            unique, nulls,
          };
        } else {
          stats[c] = { unique, nulls };
        }
      }
      const summary = {
        totalRows,
        totalColumns: cols.length,
        columns: cols,
        numericColumns: numericCols,
        columnStats: stats,
        sampleRows: rows.slice(0, 10),
      };
      return { success: true, content: JSON.stringify(summary, null, 2).slice(0, 30000) };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const mathCompute: Tool = {
  id: 'math',
  name: 'math',
  description: 'Evaluate mathematical expressions safely. Supports +, -, *, /, **, %, sqrt, sin, cos, tan, log, ln, abs, round, floor, ceil, pi, e.',
  schema: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Math expression to evaluate (e.g. "sqrt(144) * pi")' },
    },
    required: ['expression'],
  },
  execute: async (args) => {
    const schema = z.object({ expression: z.string().min(1).max(500) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    const expr = parsed.data.expression;
    const safe = /^[\d\s+\-*/%.(),e^a-z_A-Z]+$/.test(expr);
    if (!safe) return { success: false, content: '', error: 'Expression contains disallowed characters' };
    try {
      const fn = new Function(
        'Math', 'parseInt', 'parseFloat',
        `return (${expr.replace(/\^/g, '**')});`
      );
      const result = fn(Math, parseInt, parseFloat);
      return { success: true, content: String(result) };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const localSearch: Tool = {
  id: 'local_search',
  name: 'local_search',
  description: 'Search GIA\'s internal knowledge — notes and memories. Full-text search across titles and content.',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      maxResults: { type: 'number', description: 'Max results per source (default: 5)' },
    },
    required: ['query'],
  },
  execute: async (args) => {
    const schema = z.object({
      query: z.string().min(1).max(500),
      maxResults: z.number().min(1).max(50).default(5),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    const { query, maxResults } = parsed.data;
    const q = query.toLowerCase();
    try {
      const results: string[] = [];
      const memories = useMemoryStore.getState().memories;
      const matchedMemories = memories
        .filter(m => m.value.toLowerCase().includes(q) || m.key.toLowerCase().includes(q))
        .slice(0, maxResults);
      if (matchedMemories.length > 0) {
        results.push(`## Memories (${matchedMemories.length})`);
        matchedMemories.forEach(m => results.push(`- ${m.key}: ${m.value.slice(0, 200)}`));
      }
      try {
        const notes = useNotesStore.getState().notes;
        if (notes) {
          const matchedNotes = (Array.isArray(notes) ? notes : [])
            .filter((n: { title?: string; content?: string }) =>
              (n.title || '').toLowerCase().includes(q) ||
              (n.content || '').toLowerCase().includes(q)
            )
            .slice(0, maxResults);
          if (matchedNotes.length > 0) {
            results.push(`\n## Notes (${matchedNotes.length})`);
            matchedNotes.forEach((n: { title?: string; content?: string }) =>
              results.push(`- **${n.title || 'Untitled'}**: ${(n.content || '').slice(0, 200)}`)
            );
          }
        }
      } catch { /* notes store may not exist */ }
      if (results.length === 0) return { success: true, content: `No results found for "${query}" in local knowledge.` };
      return { success: true, content: results.join('\n') };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const encodeDecode: Tool = {
  id: 'encode_decode',
  name: 'encode_decode',
  description: 'Encode or decode text using Base64, URL encoding, or JSON stringify/parse.',
  schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['base64_encode', 'base64_decode', 'url_encode', 'url_decode', 'json_stringify', 'json_parse'], description: 'Operation to perform' },
      input: { type: 'string', description: 'Text to encode/decode' },
    },
    required: ['action', 'input'],
  },
  execute: async (args) => {
    const schema = z.object({
      action: z.enum(['base64_encode', 'base64_decode', 'url_encode', 'url_decode', 'json_stringify', 'json_parse']),
      input: z.string().max(50000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    const { action, input } = parsed.data;
    try {
      let result: string;
      switch (action) {
        case 'base64_encode':
          result = btoa(input);
          break;
        case 'base64_decode':
          result = atob(input);
          break;
        case 'url_encode':
          result = encodeURIComponent(input);
          break;
        case 'url_decode':
          result = decodeURIComponent(input);
          break;
        case 'json_stringify':
          result = JSON.stringify(JSON.parse(input), null, 2);
          break;
        case 'json_parse':
          result = JSON.stringify(input);
          break;
        default:
          return { success: false, content: '', error: `Unknown action: ${action}` };
      }
      return { success: true, content: result };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const generateQR: Tool = {
  id: 'generate_qr',
  name: 'generate_qr',
  description: 'Generate a QR code image from text or a URL. Returns a markdown image for inline display.',
  schema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text or URL to encode in the QR code' },
      size: { type: 'number', description: 'Size in pixels (default: 200, max: 500)' },
    },
    required: ['text'],
  },
  execute: async (args) => {
    const schema = z.object({
      text: z.string().min(1).max(2000),
      size: z.number().min(100).max(500).default(200),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    const { text, size } = parsed.data;
    try {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
      return { success: true, content: `![QR Code](${url})\n\nQR code for: ${text}` };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const localClassify: Tool = {
  id: 'classify_text',
  name: 'classify_text',
  description: 'Classify text into categories using local on-device AI. Returns confidence scores for each label. Works offline.',
  schema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to classify' },
      labels: { type: 'array', items: { type: 'string' }, description: 'Array of label strings to classify against (e.g. ["urgent", "normal", "spam"])' },
    },
    required: ['text', 'labels'],
  },
  execute: async (args) => {
    const schema = z.object({
      text: z.string().min(1).max(10000),
      labels: z.array(z.string().min(1)).min(2).max(50),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    const { text, labels } = parsed.data;
    try {
      const { default: localAI } = await import('../LocalAI');
      const results = await localAI.classify(text, labels);
      const ranked = results.sort((a, b) => b.score - a.score);
      const content = ranked.map(r => `- **${r.label}**: ${(r.score * 100).toFixed(1)}%`).join('\n');
      return { success: true, content: `## Classification Results\n\n${content}\n\n_Best match: **${ranked[0]?.label}** (${(ranked[0]?.score * 100).toFixed(1)}%)_` };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const listApis: Tool = {
  id: 'list_available_apis',
  name: 'list_available_apis',
  description: 'List all publicly documented APIs available through common free API directories. Returns categorized API collections with descriptions.',
  execute: async () => {
    const apis = [
      { name: 'Open Library', url: 'https://openlibrary.org/developers/api', desc: 'Books, authors, covers' },
      { name: 'OpenWeatherMap', url: 'https://openweathermap.org/api', desc: 'Weather data (free tier: 60 calls/min)' },
      { name: 'REST Countries', url: 'https://restcountries.com', desc: 'Country information' },
      { name: 'JokeAPI', url: 'https://sv443.net/jokeapi/v2/', desc: 'Programming, general, dark jokes' },
      { name: 'Numbers API', url: 'http://numbersapi.com', desc: 'Interesting facts about numbers' },
      { name: 'Dog API', url: 'https://dog.ceo/dog-api/', desc: 'Random dog images' },
      { name: 'Cat Facts', url: 'https://catfact.ninja', desc: 'Random cat facts' },
      { name: 'CoinDesk', url: 'https://www.coindesk.com/api', desc: 'Bitcoin price index' },
      { name: 'ExchangeRate-API', url: 'https://exchangerate-api.com', desc: 'Currency exchange rates' },
      { name: 'IPify', url: 'https://geo.ipify.org', desc: 'IP address geolocation' },
      { name: 'The Star Wars API', url: 'https://swapi.dev', desc: 'Star Wars data (people, planets, films)' },
      { name: 'PokéAPI', url: 'https://pokeapi.co', desc: 'Pokémon data' },
      { name: 'NASA APIs', url: 'https://api.nasa.gov', desc: 'Astronomy, Mars rover photos' },
      { name: 'Open Trivia DB', url: 'https://opentdb.com/api_config.php', desc: 'Trivia questions' },
      { name: 'Rick and Morty API', url: 'https://rickandmortyapi.com', desc: 'Rick and Morty character data' },
      { name: 'Wikipedia', url: 'https://en.wikipedia.org/w/api.php', desc: 'Encyclopedia (use wikipedia tool)' },
    ];
    const categorized: Record<string, typeof apis> = {
      '📚 Reference': apis.filter(a => ['Open Library', 'REST Countries', 'Wikipedia', 'Numbers API'].includes(a.name)),
      '🌤️ Weather & Geo': apis.filter(a => ['OpenWeatherMap', 'IPify'].includes(a.name)),
      '🎮 Fun & Games': apis.filter(a => ['JokeAPI', 'Dog API', 'Cat Facts', 'PokéAPI', 'The Star Wars API', 'Rick and Morty API', 'Open Trivia DB'].includes(a.name)),
      '💰 Finance': apis.filter(a => ['CoinDesk', 'ExchangeRate-API'].includes(a.name)),
      '🚀 Science': apis.filter(a => ['NASA APIs'].includes(a.name)),
    };
    let content = '# Available Free APIs\n\n';
    for (const [cat, items] of Object.entries(categorized)) {
      content += `## ${cat}\n`;
      items.forEach(a => { content += `- **${a.name}**: ${a.desc} — ${a.url}\n`; });
      content += '\n';
    }
    content += 'Use `http_request` tool to call any of these APIs with the appropriate endpoint.';
    return { success: true, content };
  },
};

const screenshotPage: Tool = {
  id: 'screenshot',
  name: 'screenshot',
  description: 'Capture a screenshot of any public webpage as an image. Returns a markdown image for inline display.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Full URL to screenshot' },
      width: { type: 'number', description: 'Viewport width (default: 1280)' },
      height: { type: 'number', description: 'Viewport height (default: 720)' },
    },
    required: ['url'],
  },
  execute: async (args) => {
    const schema = z.object({
      url: z.string().url().max(5000),
      width: z.number().min(320).max(3840).default(1280),
      height: z.number().min(240).max(2160).default(720),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    const { url, width, height } = parsed.data;
    try {
      const screenshotUrl = `https://api.screenshotmachine.com/?key=free&url=${encodeURIComponent(url)}&dimension=${width}x${height}&format=png`;
      return { success: true, content: `![Screenshot of ${url}](${screenshotUrl})` };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const powerTools: Tool[] = [
  httpRequest,
  webScrape,
  dataAnalysis,
  mathCompute,
  localSearch,
  encodeDecode,
  generateQR,
  localClassify,
  listApis,
  screenshotPage,
];
