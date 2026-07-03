import React, { useState } from 'react';
import { Shield, Battery, Headphones } from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import { SecuritySection } from './SecuritySection';
import { CodeExecutionSection } from './CodeExecutionSection';
import { ProtocolsApprovalsSection } from './ProtocolsApprovalsSection';
import { VoiceSection } from './VoiceSection';
import { PowerSection } from './PowerSection';
import { ReliabilitySection } from './ReliabilitySection';

export const SystemPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [codeEndpoint, setCodeEndpoint] = useState(() => localStorage.getItem('gia-piston-endpoint') || '');

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
      <SubPageHeader title="System & Performance" onBack={onBack} />

      <div className="px-3 py-3 rounded-xl text-xs leading-relaxed" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: 'var(--gia-muted)' }}>
        <p className="font-semibold mb-2" style={{ color: '#34d399' }}>About this panel</p>
        <p className="mb-2">Tune how GIA runs under the hood — security, permissions, voice control, power usage, and reliability. These settings affect GIA's behaviour across all modules.</p>
        <ul className="space-y-1.5 pl-3" style={{ listStyle: 'disc' }}>
          <li><strong style={{ color: '#34d399' }}>Security</strong> — Lock GIA behind biometrics (fingerprint/face). Enable app lock so GIA requires authentication before opening. On Android, this uses the device's built-in biometric system.</li>
          <li><strong style={{ color: '#34d399' }}>Code Execution</strong> — Configure the sandbox endpoint (Piston API) GIA uses to run code. Default is a public instance, or you can point to your own. Code runs in isolated containers.</li>
          <li><strong style={{ color: '#34d399' }}>Protocols & Approvals</strong> — Control which tools require your explicit approval before running. Eg: require confirmation before GIA deletes files or executes terminal commands. Safer defaults for newer users.</li>
          <li><strong style={{ color: '#34d399' }}>Voice Control</strong> — Set a wake word ("Hey GIA"), choose recognition language, enable background wake word (Porcupine engine), and toggle TTS for spoken responses. Test wake word detection in the diagnostics section.</li>
          <li><strong style={{ color: '#34d399' }}>Power Saving</strong> — Reduce battery drain by limiting background activity, disabling animations, or throttling AI responses on low battery.</li>
          <li><strong style={{ color: '#34d399' }}>Reliability</strong> — Configure retry logic, auto-recovery on errors, and offline fallback behaviour. Helps GIA recover from network failures gracefully.</li>
        </ul>
        <p className="mt-2 text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
          Tip: If you're new, leave Protocols at their defaults. Come back here after you've used GIA for a while and want finer control. Voice setup is worthwhile — saying "Hey GIA" to start a conversation feels great.
        </p>
      </div>

      <div className="flex items-center gap-2 px-1">
        <Shield size={14} style={{ color: '#34d399' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Security & Permissions</span>
      </div>
      <SecuritySection />
      <CodeExecutionSection codeEndpoint={codeEndpoint} setCodeEndpoint={setCodeEndpoint} />
      <ProtocolsApprovalsSection />

      <div className="flex items-center gap-2 px-1 mt-2">
        <Headphones size={14} style={{ color: '#ec4899' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Voice</span>
      </div>
      <VoiceSection />

      <div className="flex items-center gap-2 px-1 mt-2">
        <Battery size={14} style={{ color: '#f59e0b' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Performance</span>
      </div>
      <PowerSection />
      <ReliabilitySection />
    </div>
  );
};
