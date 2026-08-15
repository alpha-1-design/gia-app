import { logger } from '../utils/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodideInstance: any = null;
let loadPromise: Promise<void> | null = null;

export async function loadPyodide(): Promise<void> {
  if (pyodideInstance) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js';
      script.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Pyodide script'));
        document.head.appendChild(script);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pyodide = await (window as any).loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/',
      });
      pyodideInstance = pyodide;
      logger.info('[Pyodide] Python runtime loaded');
    } catch (e) {
      loadPromise = null;
      logger.warn('[Pyodide] Failed to load:', e);
      throw e;
    }
  })();

  return loadPromise;
}

export function isReady(): boolean {
  return pyodideInstance !== null;
}

export async function runPython(code: string, timeoutMs = 30000): Promise<string> {
  if (!pyodideInstance) {
    await loadPyodide();
  }

  // Capture stdout/stderr via StringIO — runPython() returns the *value* of
  // the last expression (undefined for print()), so without this every
  // print() call reports "(no output)".
  const wrappedCode = [
    'import sys',
    'from io import StringIO',
    '__gia_out = StringIO()',
    '__gia_err = StringIO()',
    'sys.stdout = __gia_out',
    'sys.stderr = __gia_err',
    'try:',
    ...code.split('\n').map(l => '  ' + l),
    'except Exception as e:',
    '  __gia_err.write(str(e))',
    'sys.stdout = sys.__stdout__',
    'sys.stderr = sys.__stderr__',
    '__gia_result = __gia_out.getvalue()',
    '__gia_error = __gia_err.getvalue()',
  ].join('\n');

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Python execution timed out')), timeoutMs);

    try {
      pyodideInstance.runPython(wrappedCode);
      clearTimeout(timer);
      const out = String(pyodideInstance.globals.get('__gia_result') ?? '');
      const err = String(pyodideInstance.globals.get('__gia_error') ?? '');
      resolve(err ? `Error: ${err}` : (out || '(no output)'));
    } catch (e) {
      clearTimeout(timer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolve(`Error: ${(e as any).message || String(e)}`);
    }
  });
}

export function reset(): void {
  pyodideInstance = null;
  loadPromise = null;
}

export default { loadPyodide, isReady, runPython, reset };
