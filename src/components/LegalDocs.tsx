import React, { useState } from 'react';
import { Shield, ScrollText } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import privacyMd from '../legal/privacy.md?raw';
import termsMd from '../legal/terms.md?raw';

export type LegalTab = 'privacy' | 'terms';

/** Tabbed privacy policy / terms reader. Used by the first-run gate and by Settings. */
export const LegalDocs: React.FC<{ initialTab?: LegalTab; className?: string }> = ({ initialTab = 'privacy', className = '' }) => {
  const [tab, setTab] = useState<LegalTab>(initialTab);
  const tabs: { id: LegalTab; label: string; icon: React.ReactNode }[] = [
    { id: 'privacy', label: 'Privacy Policy', icon: <Shield size={13} /> },
    { id: 'terms', label: 'Terms of Service', icon: <ScrollText size={13} /> },
  ];
  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div role="tablist" className="flex gap-2 mb-3 shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            style={{
              background: tab === t.id ? 'var(--gia-accent-dim)' : 'var(--gia-surface-2)',
              color: tab === t.id ? 'var(--gia-accent)' : 'var(--gia-muted)',
              border: '1px solid var(--gia-border)',
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        tabIndex={0}
        className="flex-1 min-h-0 overflow-y-auto rounded-xl p-4 text-sm"
        style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', overscrollBehavior: 'contain' }}
      >
        <MarkdownRenderer content={tab === 'privacy' ? privacyMd : termsMd} />
      </div>
    </div>
  );
};
