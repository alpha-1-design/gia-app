import { CapacitorHttp } from '@capacitor/core';

export interface CodeRunRequest {
  language: string;
  code: string;
  stdin?: string;
  args?: string[];
}

export interface CodeRunResult {
  output: string;
  error: string | null;
  exitCode: number;
  language: string;
  version: string;
}

export interface CodeRunRecord {
  id: string;
  ts: number;
  language: string;
  code: string;
  output: string;
  error: string | null;
  exitCode: number;
}

export interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';
const PISTON_RUNTIMES_URL = 'https://emkc.org/api/v2/piston/runtimes';
const HISTORY_KEY = 'gia-code-history';

const LANGUAGE_MAP: Record<string, string> = {
  'python': 'python',
  'py': 'python',
  'javascript': 'javascript',
  'js': 'javascript',
  'typescript': 'typescript',
  'ts': 'typescript',
  'java': 'java',
  'cpp': 'cpp',
  'c++': 'cpp',
  'c': 'c',
  'go': 'go',
  'rust': 'rust',
  'rs': 'rust',
  'swift': 'swift',
  'kotlin': 'kotlin',
  'ruby': 'ruby',
  'rb': 'ruby',
  'php': 'php',
  'r': 'r',
  'sql': 'sql',
  'bash': 'bash',
  'sh': 'bash',
  'html': 'html',
};

class CodeRunner {
  private static instance: CodeRunner;
  static getInstance() { if (!this.instance) this.instance = new CodeRunner(); return this.instance; }

  private userEndpoint: string = '';

  setEndpoint(url: string) { this.userEndpoint = url; }
  getEndpoint() { return this.userEndpoint || PISTON_URL; }

  async run(req: CodeRunRequest, attempts = 0): Promise<CodeRunResult> {
    const maxAttempts = 3;
    const lang = LANGUAGE_MAP[req.language.toLowerCase()] || req.language;

    try {
      const res = await CapacitorHttp.post({
        url: this.getEndpoint(),
        headers: { 'Content-Type': 'application/json' },
        data: {
          language: lang,
          version: '*',
          files: [{ name: `main.${lang}`, content: req.code }],
          stdin: req.stdin || '',
          args: req.args || [],
        },
      });

      if (res.status === 429 && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000 * (attempts + 1)));
        return this.run(req, attempts + 1);
      }

      if (res.status < 200 || res.status >= 300) throw new Error(`Piston error ${res.status}`);

      const data = res.data;
      const run = data.run || {};
      const result: CodeRunResult = {
        output: run.stdout || '',
        error: run.stderr || run.output || null,
        exitCode: run.code ?? 0,
        language: lang,
        version: data.language?.version || '',
      };
      this.saveRun({ id: crypto.randomUUID(), ts: Date.now(), language: lang, code: req.code, output: result.output, error: result.error, exitCode: result.exitCode });
      return result;
    } catch (e) {
      if (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000 * (attempts + 1)));
        return this.run(req, attempts + 1);
      }
      const result: CodeRunResult = {
        output: '',
        error: e instanceof Error ? e.message : 'Execution failed',
        exitCode: 1,
        language: lang,
        version: '',
      };
      this.saveRun({ id: crypto.randomUUID(), ts: Date.now(), language: lang, code: req.code, output: result.output, error: result.error, exitCode: result.exitCode });
      return result;
    }
  }

  async autoFix(code: string, language: string, error: string): Promise<string | null> {
    try {
      const brain = (await import('./GiaBrain')).default;
      const res = await brain.generate({
        prompt: `Fix this ${language} code error:\n\n${code}\n\nError:\n${error}\n\nReturn ONLY the fixed code, no explanations.`,
        temperature: 0.2,
        maxTokens: 2000,
      });
      const fixed = res.text.replace(/```\w*\n?/g, '').trim();
      return fixed || null;
    } catch {
      return null;
    }
  }

  async getRuntimes(): Promise<PistonRuntime[]> {
    try {
      const res = await CapacitorHttp.get({
        url: PISTON_RUNTIMES_URL,
        connectTimeout: 10000,
        readTimeout: 10000,
      });
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      return res.data;
    } catch {
      return Object.entries(LANGUAGE_MAP).map(([alias, name]) => ({
        language: name, version: '*', aliases: [alias],
      }));
    }
  }

  async testEndpoint(url: string): Promise<{ ok: boolean; message: string }> {
    try {
      const runtimeUrl = url.replace('/execute', '/runtimes');
      const res = await CapacitorHttp.get({ url: runtimeUrl, connectTimeout: 10000, readTimeout: 10000 });
      if (res.status < 200 || res.status >= 300) {
        const testRes = await CapacitorHttp.post({
          url,
          connectTimeout: 10000,
          readTimeout: 10000,
          headers: { 'Content-Type': 'application/json' },
          data: { language: 'python', version: '*', files: [{ name: 'main.py', content: 'print("ok")' }] },
        });
        if (testRes.status < 200 || testRes.status >= 300) return { ok: false, message: `Endpoint error ${testRes.status}` };
        return { ok: true, message: 'Connected (execute endpoint)' };
      }
      const data = res.data;
      const count = Array.isArray(data) ? data.length : 0;
      return { ok: true, message: `Connected — ${count} runtimes available` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
    }
  }

  saveRun(record: CodeRunRecord) {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const history: CodeRunRecord[] = raw ? JSON.parse(raw) : [];
      history.unshift(record);
      if (history.length > 100) history.length = 100;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {}
  }

  getHistory(): CodeRunRecord[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }

  getSupportedLanguages(): { name: string; alias: string }[] {
    return Object.entries(LANGUAGE_MAP).map(([alias, name]) => ({ name, alias }));
  }
}

export default CodeRunner.getInstance();
