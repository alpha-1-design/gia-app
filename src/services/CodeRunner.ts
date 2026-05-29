import { CapacitorHttp } from '@capacitor/core';
import { isNativePlatform } from '../utils/helpers';

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
const uuid = () => crypto.randomUUID?.() ?? Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('');
const isNative = isNativePlatform();

const LANGUAGE_MAP: Record<string, string> = {
  py: 'python', python: 'python', py3: 'python', js: 'javascript', javascript: 'javascript',
  ts: 'typescript', typescript: 'typescript', tsx: 'typescript', jsx: 'javascript',
  cpp: 'c++', 'c++': 'c++', c: 'c', cs: 'c#', 'c#': 'c#',
  java: 'java', rb: 'ruby', ruby: 'ruby', go: 'go', rs: 'rust', rust: 'rust',
  php: 'php', swift: 'swift', kt: 'kotlin', kotlin: 'kotlin',
  scala: 'scala', r: 'r', perl: 'perl', lua: 'lua', sh: 'bash', bash: 'bash',
  sql: 'sql', html: 'html', css: 'css',
};

class CodeRunner {
  private static instance: CodeRunner;
  static getInstance() { if (!this.instance) this.instance = new CodeRunner(); return this.instance; }

  private userEndpoint: string = '';
  private userApiKey: string = '';

  setEndpoint(url: string) { this.userEndpoint = url; }
  getEndpoint() { return this.userEndpoint || PISTON_URL; }
  setApiKey(key: string) { this.userApiKey = key; }
  getApiKey() { return this.userApiKey; }
  private getAuthHeaders(): Record<string, string> {
    return this.userApiKey ? { 'Authorization': `Bearer ${this.userApiKey}` } : {};
  }

  private runLocalJS(code: string): Promise<CodeRunResult> {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.sandbox.add('allow-scripts');
      document.body.appendChild(iframe);
      const timeout = setTimeout(() => {
        document.body.removeChild(iframe);
        resolve({ output: '', error: 'Execution timed out after 10s', exitCode: 1, language: 'javascript', version: 'local (browser)' });
      }, 10000);
      const win = iframe.contentWindow;
      if (!win) {
        clearTimeout(timeout);
        document.body.removeChild(iframe);
        resolve({ output: '', error: 'Failed to create sandbox', exitCode: 1, language: 'javascript', version: 'local (browser)' });
        return;
      }
      const logs: string[] = [];
      (win as any).console = {
        log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
        error: (...args: any[]) => logs.push('[ERROR] ' + args.map(a => String(a)).join(' ')),
        warn: (...args: any[]) => logs.push('[WARN] ' + args.map(a => String(a)).join(' ')),
      };
      try {
        const result = (win as any).Function(code)();
        clearTimeout(timeout);
        document.body.removeChild(iframe);
        const output = logs.join('\n');
        if (result !== undefined && !output.includes(String(result))) {
          resolve({ output: output + (output ? '\n' : '') + String(result), error: null, exitCode: 0, language: 'javascript', version: 'local (browser)' });
        } else {
          resolve({ output: output || 'undefined', error: null, exitCode: 0, language: 'javascript', version: 'local (browser)' });
        }
      } catch (e: any) {
        clearTimeout(timeout);
        document.body.removeChild(iframe);
        resolve({ output: logs.join('\n'), error: e.message || 'JavaScript execution failed', exitCode: 1, language: 'javascript', version: 'local (browser)' });
      }
    });
  }

  async run(req: CodeRunRequest, attempts = 0, signal?: AbortSignal): Promise<CodeRunResult> {
    const maxAttempts = 3;
    const lang = LANGUAGE_MAP[req.language.toLowerCase()] || req.language;

    if (signal?.aborted) return { output: '', error: 'Request aborted', exitCode: 1, language: lang, version: '' };

    // Run JavaScript locally in browser — instant, no network needed
    if (lang === 'javascript') {
      return this.runLocalJS(req.code);
    }

    const files = [{ name: `main.${lang}`, content: req.code }];

    try {
      let data: any;
      const body = {
        language: lang,
        version: '*',
        files: files,
        stdin: req.stdin || '',
        args: req.args || [],
        compile_timeout: 30000,
        run_timeout: 15000,
        max_process_count: 64,
      };

      const authHeaders = this.getAuthHeaders();
      if (isNative) {
        const res = await CapacitorHttp.post({
          url: this.getEndpoint(),
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          data: body,
        });
        if (res.status === 401) throw new Error('Piston API requires authentication. Set an API key in Settings → Code Execution.');
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`Piston error ${res.status}: ${JSON.stringify(res.data)}`);
        }
        data = res.data;
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        const onAbort = () => controller.abort();
        signal?.addEventListener('abort', onAbort);

        const res = await fetch(this.getEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
        if (!res.ok) {
          const errText = await res.text().catch(() => 'Unknown error');
          if (res.status === 401) throw new Error('Piston API requires authentication. Set an API key in Settings → Code Execution, or self-host Piston (github.com/engineer-man/piston).');
          throw new Error(`Piston error ${res.status}: ${errText}`);
        }
        data = await res.json();
      }
      const run = data.run || {};
      const result: CodeRunResult = {
        output: (run.stdout || '').trim(),
        error: (run.stderr || run.output || null),
        exitCode: run.code ?? 0,
        language: lang,
        version: data.version || '',
      };

      if (!result.output && !result.error && result.exitCode !== 0) {
        result.error = `Process exited with code ${result.exitCode}`;
      }

      this.saveRun({ id: uuid(), ts: Date.now(), language: lang, code: req.code, output: result.output, error: result.error, exitCode: result.exitCode });
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
      this.saveRun({ id: uuid(), ts: Date.now(), language: lang, code: req.code, output: result.output, error: result.error, exitCode: result.exitCode });
      return result;
    }
  }

  async autoFix(code: string, language: string, error: string): Promise<string | null> {
    try {
      const { default: brain } = await import('./GiaBrain');
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

  private getRequestHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return { 'Content-Type': 'application/json', ...this.getAuthHeaders(), ...extra };
  }

  private async fetchJSON(url: string, options?: RequestInit): Promise<any> {
    const headers = this.getRequestHeaders(options?.headers as Record<string, string> || {});
    const mergedOptions = { ...options, headers };
    if (isNative) {
      const method = (options?.method || 'GET').toLowerCase() as 'get' | 'post';
      const res = await (CapacitorHttp as any)[method]({ url, connectTimeout: 10000, readTimeout: 10000, ...(options?.body ? { data: JSON.parse(options.body as string) } : {}), ...headers });
      if (res.status === 401) throw new Error('Piston API requires authentication. Set an API key in Settings.');
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      return res.data;
    }
    const res = await fetch(url, mergedOptions);
    if (res.status === 401) throw new Error('Piston API requires authentication. Set an API key in Settings.');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async getRuntimes(): Promise<PistonRuntime[]> {
    try {
      return await this.fetchJSON(PISTON_RUNTIMES_URL);
    } catch {
      return Object.entries(LANGUAGE_MAP).map(([alias, name]) => ({
        language: name, version: '*', aliases: [alias],
      }));
    }
  }

  async testEndpoint(url: string): Promise<{ ok: boolean; message: string }> {
    try {
      const runtimeUrl = url.replace('/execute', '/runtimes');
      const data = await this.fetchJSON(runtimeUrl);
      const count = Array.isArray(data) ? data.length : 0;
      return { ok: true, message: `Connected — ${count} runtimes available` };
    } catch {
      try {
        await this.fetchJSON(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: 'python', version: '*', files: [{ name: 'main.py', content: 'print("ok")' }] }),
        });
        return { ok: true, message: 'Connected (execute endpoint)' };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
      }
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
