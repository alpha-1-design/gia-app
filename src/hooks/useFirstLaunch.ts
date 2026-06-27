import { useRef, useEffect, useState } from 'react';
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

  const runDiagnostics = async () => {
    const report = await SystemDiagnostics.runDiagnostics();
    diagnosticsRef.current = report;
    return report;
  };

  return { shouldRunDiagnostics, runDiagnostics, diagnosticsRef };
}
