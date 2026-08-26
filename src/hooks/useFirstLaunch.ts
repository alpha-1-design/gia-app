import { useRef, useEffect, useState, useCallback } from 'react';
import { useGiaStore } from '../store/useGiaStore';
import { SystemDiagnostics, type DiagnosticReport } from '../services/SystemDiagnostics';

export function useFirstLaunch() {
  const [shouldRunDiagnostics, setShouldRunDiagnostics] = useState(false);
  const diagnosticsRef = useRef<DiagnosticReport | null>(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    const sessions = useGiaStore.getState().sessions;
    if (sessions.length === 0) {
      setShouldRunDiagnostics(true);
    }
  }, []);

  // Stable across renders (useCallback, no deps) — this used to be a plain
  // function recreated on every render of the hook. Consumers put it in a
  // useEffect dependency array, so a fresh reference every render made that
  // effect re-fire on every unrelated App re-render for as long as
  // shouldRunDiagnostics stayed true (it was never reset), and the effect
  // itself called addNotification, whose store update triggered another App
  // re-render → new reference → effect fires again → infinite loop (this was
  // the "Maximum update depth exceeded" / minified React error #185 crash).
  const runDiagnostics = useCallback(async () => {
    const report = await SystemDiagnostics.runDiagnostics();
    diagnosticsRef.current = report;
    return report;
  }, []);

  return { shouldRunDiagnostics, setShouldRunDiagnostics, runDiagnostics, diagnosticsRef };
}
