import React from 'react';
import ChatModule from './ChatModule';
import { useGiaStore } from '../store/useGiaStore';

/**
 * Build — a dedicated workspace for building apps, websites and tools.
 *
 * It reuses the full chat pipeline (session, streaming, tool loop, sandbox,
 * live preview) with Build Mode forced on, so the system prompt is the BUILD
 * instructions and the preview button is always available. Kept as a thin
 * wrapper around ChatModule rather than a fork — one chat implementation,
 * two entry points.
 */
const BuildModule: React.FC = () => {
  // Entering the Build module switches the shared data mode so the system
  // prompt uses the BUILD instructions; leaving returns to normal code mode.
  React.useEffect(() => {
    useGiaStore.getState().setBuildMode(true);
    useGiaStore.getState().updateSharedData({ currentMode: 'build' });
    return () => {
      useGiaStore.getState().setBuildMode(false);
      useGiaStore.getState().updateSharedData({ currentMode: 'code' });
    };
  }, []);

  return <ChatModule build />;
};

export default BuildModule;
