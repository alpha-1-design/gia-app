import React, { useState } from 'react';
import { useGiaStore } from '../store/useGiaStore';
import { LEGAL_VERSION, needsLegalAcceptance } from '../utils/legal';
import { LegalDocs } from './LegalDocs';

/**
 * Full-screen first-run gate. GIA does nothing until the privacy policy and
 * terms have been read and accepted; it returns when they change (LEGAL_VERSION).
 */
const LegalGate: React.FC = () => {
  const accepted = useGiaStore(s => s.legalAcceptedVersion);
  const [agreed, setAgreed] = useState(false);
  const [declined, setDeclined] = useState(false);

  if (!needsLegalAcceptance(accepted)) return null;

  const decline = async () => {
    setDeclined(true);
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { App } = await import('@capacitor/app');
        await App.exitApp();
      }
    } catch { /* the message below is enough on the web */ }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-title"
      className="fixed inset-0 z-[100] flex flex-col p-4"
      style={{ background: 'var(--gia-bg)', paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <h1 id="legal-title" className="text-lg font-semibold mb-1" style={{ color: 'var(--gia-text)' }}>Before you start</h1>
      <p className="text-xs mb-3" style={{ color: 'var(--gia-muted)' }}>
        Please read how GIA handles your data and what you agree to when you use it.
      </p>

      <LegalDocs className="flex-1" />

      {declined ? (
        <p role="alert" className="text-xs mt-3 text-center" style={{ color: 'var(--gia-muted)' }}>
          GIA can&rsquo;t run without accepting. You can close the app, or go back and accept.
          <button className="ml-2 underline" style={{ color: 'var(--gia-accent)' }} onClick={() => setDeclined(false)}>Go back</button>
        </p>
      ) : (
        <div className="mt-3 shrink-0">
          <label className="flex items-start gap-2 text-xs cursor-pointer mb-3" style={{ color: 'var(--gia-text)' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5"
              style={{ accentColor: 'var(--gia-accent)' }}
            />
            I have read the Privacy Policy and Terms of Service and I agree to them.
          </label>
          <div className="flex gap-2">
            <button
              onClick={decline}
              className="flex-1 py-3 rounded-xl text-sm"
              style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-muted)', border: '1px solid var(--gia-border)' }}
            >
              Decline
            </button>
            <button
              disabled={!agreed}
              onClick={() => useGiaStore.getState().acceptLegal(LEGAL_VERSION)}
              className="flex-[2] py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--gia-accent)', color: '#000' }}
            >
              Agree and continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LegalGate;
