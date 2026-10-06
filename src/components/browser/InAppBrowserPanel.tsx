import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, LockKeyhole, RotateCw, Search, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useGiaStore } from '../../store/useGiaStore';
import GIAInAppBrowser from '../../services/GIAInAppBrowser';

const InAppBrowserPanel: React.FC = () => {
  const browser = useGiaStore((state) => state.inAppBrowser);
  const setBrowserState = useGiaStore((state) => state.setInAppBrowserState);
  const [address, setAddress] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const native = Capacitor.isNativePlatform();

  useEffect(() => {
    setAddress(browser.url);
  }, [browser.url]);

  useEffect(() => {
    if (!browser.open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void GIAInAppBrowser.close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [browser.open]);

  const navigate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (browser.mode === 'preview') await GIAInAppBrowser.openPreview(address);
      else await GIAInAppBrowser.navigate(address);
    } catch (error) {
      setBrowserState({ error: error instanceof Error ? error.message : 'Could not open that page.' });
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (browser.mode === 'preview' && !native) {
      setRefreshKey((key) => key + 1);
      return;
    }
    setBusy(true);
    try {
      await GIAInAppBrowser.reload();
    } catch (error) {
      setBrowserState({ error: error instanceof Error ? error.message : 'Could not reload the page.' });
    } finally {
      setBusy(false);
    }
  };

  if (!browser.open || native) return null;

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/75 p-0 sm:p-5" role="dialog" aria-modal="true" aria-label="In-app browser">
      <section className="flex h-full w-full flex-col overflow-hidden sm:max-h-[92vh] sm:max-w-6xl sm:rounded-2xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
        <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--gia-border)' }}>
          <div className="hidden items-center gap-1 sm:flex">
            <button type="button" onClick={() => void GIAInAppBrowser.back()} disabled className="rounded-lg p-2 opacity-40" aria-label="Back">
              <ArrowLeft size={16} />
            </button>
            <button type="button" onClick={() => void GIAInAppBrowser.forward()} disabled className="rounded-lg p-2 opacity-40" aria-label="Forward">
              <ArrowRight size={16} />
            </button>
          </div>
          <form onSubmit={navigate} className="flex min-w-0 flex-1 items-center gap-2">
            <div className="hidden shrink-0 sm:block" style={{ color: 'var(--gia-muted-2)' }}>
              {browser.mode === 'preview' ? <ExternalLink size={15} /> : <LockKeyhole size={15} />}
            </div>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              aria-label="Browser address"
              placeholder="https://example.com"
              className="min-w-0 flex-1 rounded-lg px-3 py-2 text-xs outline-none sm:text-sm"
              style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}
            />
            <button type="submit" disabled={busy || !address.trim()} className="rounded-lg p-2 disabled:opacity-40" style={{ color: 'var(--gia-text)' }} aria-label="Go to address">
              {busy ? <RotateCw size={15} className="animate-spin" /> : <Search size={15} />}
            </button>
          </form>
          <button type="button" onClick={() => void refresh()} className="rounded-lg p-2" style={{ color: 'var(--gia-muted)' }} aria-label="Reload page">
            <RotateCw size={15} />
          </button>
          <button type="button" onClick={() => void GIAInAppBrowser.close()} className="rounded-lg p-2" style={{ color: 'var(--gia-muted)' }} aria-label="Close browser">
            <X size={17} />
          </button>
        </header>

        {browser.mode === 'preview' ? (
          <>
            {browser.error && <p className="shrink-0 border-b border-red-400/20 px-4 py-2 text-xs text-red-300" style={{ background: 'var(--gia-surface-2)' }}>{browser.error}</p>}
            <iframe
              key={refreshKey}
              src={browser.url}
              title={browser.title || 'GIA-built app preview'}
              className="min-h-0 flex-1 border-0 bg-white"
              sandbox="allow-forms allow-scripts allow-popups"
              referrerPolicy="no-referrer"
            />
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8">
            <div className="mx-auto max-w-3xl">
              <div className="mb-4 flex items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--gia-muted-2)' }}>Read-only browser · web</p>
                <span className="rounded-full border px-1.5 py-0.5 text-[8px] font-bold tracking-wider" style={{ color: '#c4b5fd', borderColor: 'rgba(168,85,247,0.35)', background: 'rgba(168,85,247,0.1)' }}>GIA BETA</span>
              </div>
              <p className="mb-5 text-xs leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>
                If direct access is blocked, GIA may use configured web readers or third-party text proxies to retrieve the page.
              </p>
              {browser.loading ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--gia-muted)' }}>
                  <RotateCw size={15} className="animate-spin" />
                  Loading page content…
                </div>
              ) : browser.error ? (
                <div className="rounded-xl border border-red-400/25 bg-red-400/5 p-4 text-sm text-red-300">{browser.error}</div>
              ) : (
                <>
                  <h1 className="mb-2 text-xl font-semibold sm:text-2xl" style={{ color: 'var(--gia-text)' }}>{browser.title || 'Page content'}</h1>
                  <p className="mb-5 break-all text-xs" style={{ color: 'var(--gia-muted-2)' }}>{browser.url}</p>
                  {browser.content ? (
                    <article className="whitespace-pre-wrap break-words text-sm leading-7" style={{ color: 'var(--gia-text)' }}>{browser.content}</article>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--gia-muted)' }}>Enter a URL to read its available page content.</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default InAppBrowserPanel;
