import React from 'react';
import { SubPageHeader } from './SubPageHeader';
import SandboxSetupPanel from '../SandboxSetupPanel';

/**
 * TerminalPage — Thin wrapper that renders the on-device SandboxSetupPanel.
 *
 * The old implementation (783 lines of inline terminal/package/permission UI)
 * has been replaced by SandboxSetupPanel which provides:
 * - Kai 9000-style tabbed interface (System, Packages, Files, MCPs)
 * - On-device rootfs download from CDN with progress
 * - Full Install option for essential dev packages
 * - Workspace folder creation
 * - Collapsible package sections with individual install/remove
 */
export const TerminalPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="Root Terminal & Linux Shell" onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        <SandboxSetupPanel />
      </div>
    </div>
  );
};

export default TerminalPage;
