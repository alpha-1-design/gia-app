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

export async function runPython(code: string, timeoutMs = 10000): Promise<string> {
  if (!pyodideInstance) {
    await loadPyodide();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Python execution timed out')), timeoutMs);

    try {
      const result = pyodideInstance.runPython(code);
      clearTimeout(timer);
      resolve(String(result ?? '(no output)'));
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
