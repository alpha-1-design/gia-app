import { logger } from '../utils/logger';
import type { ToolContext } from './tools/types';

let pyodideInstance: unknown = null;
let loadingPromise: Promise<unknown> | null = null;

function getPyodideCDN(): string {
  return 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
}

async function loadPyodideInstance(): Promise<unknown> {
  if (pyodideInstance) return pyodideInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const script = document.createElement('script');
      script.src = getPyodideCDN();
      const loadDone = new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Pyodide script'));
      });
      document.head.appendChild(script);
      await loadDone;

      const pyodide = await (window as unknown as Record<string, (config?: Record<string, unknown>) => Promise<unknown>>).loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
      });
      pyodideInstance = pyodide;
      logger.info('[PyodideRunner] Pyodide loaded successfully');
      return pyodide;
    } catch (e) {
      loadingPromise = null;
      throw e;
    }
  })();

  return loadingPromise;
}

export async function isPyodideAvailable(): Promise<boolean> {
  try {
    await loadPyodideInstance();
    return true;
  } catch {
    return false;
  }
}

export async function runPython(
  code: string,
  ctx?: ToolContext,
): Promise<{ output: string; error: string | null }> {
  const pyodide = await loadPyodideInstance();
  const py = pyodide as { runPythonAsync: (code: string) => Promise<unknown>; globals: { get: (key: string) => string } };

  ctx?.onProgress?.(0.3, 'Running Python...');

  const wrappedCode = `
import sys
from io import StringIO

__stdout = StringIO()
__stderr = StringIO()
sys.stdout = __stdout
sys.stderr = __stderr

try:
${code.split('\n').map(l => '  ' + l).join('\n')}
except Exception as e:
  __stderr.write(str(e))

sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
__result = __stdout.getvalue()
__error = __stderr.getvalue()
`;

  try {
    await py.runPythonAsync(wrappedCode);
    const output = (py.globals.get('__result') || '') as string;
    const error = (py.globals.get('__error') || '') as string;
    ctx?.onProgress?.(1, 'Done');
    return { output: output.trim(), error: error.trim() || null };
  } catch (e) {
    ctx?.onProgress?.(1, 'Failed');
    return { output: '', error: e instanceof Error ? e.message : 'Python execution failed' };
  }
}

export function unloadPyodide(): void {
  pyodideInstance = null;
  loadingPromise = null;
}
