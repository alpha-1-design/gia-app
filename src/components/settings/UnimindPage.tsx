import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Smartphone, Laptop, Plug, PlugZap, RefreshCw, Link2, Lock, MessageSquare, ScanLine, X } from 'lucide-react';
import jsQR from 'jsqr';
import { unimindClient } from '../../services/unimindClient';
import type { UnimindStatus } from '../../services/unimindClient';
import { parseUnimindPairingUrl } from '../../services/unimindPairing';
import { SubPageHeader } from './SubPageHeader';

interface Props {
  onBack: () => void;
}

export const UnimindPage: React.FC<Props> = ({ onBack }) => {
  const [url, setUrl] = useState(() => unimindClient.getRelayUrl());
  const [status, setStatus] = useState<UnimindStatus>(() => unimindClient.getStatus());
  const [busy, setBusy] = useState(false);
  const [chatText, setChatText] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const refresh = useCallback(() => setStatus(unimindClient.getStatus()), []);

  useEffect(() => {
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!scanOpen) return;
    let cancelled = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScanStatus('Camera is not available in this environment.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        video.srcObject = stream;
        await video.play();
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        const tick = () => {
          if (cancelled) return;
          if (video.readyState >= 2 && video.videoWidth > 0) {
            canvas.width = Math.min(640, video.videoWidth);
            canvas.height = Math.min(480, video.videoHeight);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(image.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
            if (code?.data) {
              const payload = parseUnimindPairingUrl(code.data);
              if (payload) {
                unimindClient.setRelayUrl(payload.relay);
                unimindClient.setUnimindId(payload.id);
                setUrl(payload.relay);
                setScanOpen(false);
                setActionMsg(`✅ Paired — connecting to ${payload.relay}…`);
                void unimindClient.connect(payload.relay);
                refresh();
                return;
              }
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (err) {
        if (!cancelled) setScanStatus(`Camera error: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanOpen, refresh]);

  const connect = async () => {
    setBusy(true);
    try {
      await unimindClient.connect(url);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const disconnect = () => {
    unimindClient.disconnect();
    refresh();
  };

  const runDesktopAction = async (capability: string) => {
    const desktop = status.peers.find((p) => p.device === 'desktop');
    if (!desktop) {
      setActionMsg('Desktop not online — start GIA Cowork on your laptop with the same pairing id.');
      return;
    }
    setActionMsg(null);
    try {
      const res = await unimindClient.requestAction(desktop.deviceId, capability, {});
      setActionMsg(res.success ? `✅ ${capability}: ${res.content || 'done'}` : `❌ ${res.error}`);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const sendChat = async () => {
    const text = chatText.trim();
    if (!text) return;
    const desktop = status.peers.find((p) => p.device === 'desktop');
    if (!desktop) {
      setActionMsg('Desktop not online — start GIA Cowork on your laptop with the same pairing id.');
      return;
    }
    unimindClient.sendChat(text);
    setChatText('');
    setActionMsg('Message sent to desktop.');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: 13,
    background: 'var(--gia-bg-2)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)',
    fontFamily: 'monospace',
  };
  const cardStyle: React.CSSProperties = { background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', borderRadius: '12px', padding: '14px' };
  const btnBase: React.CSSProperties = { padding: '8px 14px', borderRadius: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--gia-border)' };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '14px' }}>
      <SubPageHeader title="Unimind" onBack={onBack} />

      <div style={cardStyle}>
        <div className="flex items-center gap-1.5 mb-2">
          <Link2 size={13} style={{ color: status.connected ? '#34d399' : 'var(--gia-muted-2)' }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Relay</span>
          <span className="ml-auto text-[10px]" style={{ color: status.connected ? '#34d399' : '#f87171' }}>
            {status.connected ? '● connected' : '○ disconnected'}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ws://192.168.1.50:8787/unimind"
            style={inputStyle}
          />
          {status.connected ? (
            <button onClick={disconnect} style={{ ...btnBase, background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
              <Plug size={13} className="inline mr-1" /> Disconnect
            </button>
          ) : (
            <button onClick={() => void connect()} disabled={busy || !url.trim()} style={{ ...btnBase, background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>
              <PlugZap size={13} className="inline mr-1" /> {busy ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>
        <button
          onClick={() => { setScanStatus(null); setScanOpen(true); }}
          style={{ ...btnBase, width: '100%', marginTop: 8, background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}
        >
          <ScanLine size={13} className="inline mr-1" /> Scan to pair
        </button>
        <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>
          Pairing id: <code style={{ color: '#a78bfa' }}>{status.unimindId}</code>
          <br />
          On your desktop: GIA Cowork → Settings → Unimind — show the pairing QR and <strong>scan it here</strong>, or set the
          <strong> same relay URL + same pairing id</strong> by hand.
        </p>
      </div>

      <div style={cardStyle}>
        <div className="flex items-center gap-1.5 mb-2">
          <Smartphone size={13} style={{ color: '#8b5cf6' }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Devices</span>
          <button onClick={refresh} className="ml-auto" style={{ background: 'none', border: 'none', color: 'var(--gia-muted-2)', cursor: 'pointer' }}>
            <RefreshCw size={13} />
          </button>
        </div>
        {status.peers.length === 0 ? (
          <p className="text-[11px]" style={{ color: 'var(--gia-muted-2)' }}>No devices online yet. Open GIA Cowork on your desktop with the same pairing id.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {status.peers.map((p) => (
              <div key={p.deviceId} className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--gia-text)' }}>
                {p.device === 'desktop' ? <Laptop size={13} style={{ color: '#8b5cf6' }} /> : <Smartphone size={13} style={{ color: '#8b5cf6' }} />}
                <span className="font-medium">{p.name || p.device}</span>
                <span className="ml-auto" style={{ color: p.presence === 'online' ? '#34d399' : p.presence === 'away' ? '#fbbf24' : 'var(--gia-muted-2)' }}>
                  {p.presence}
                </span>
              </div>
            ))}
          </div>
        )}

        {status.peers.some((p) => p.device === 'desktop') && (
          <>
            <div className="mt-3 pt-3 flex gap-2" style={{ borderTop: '1px solid var(--gia-border)' }}>
              <button onClick={() => void runDesktopAction('system_lock')} style={{ ...btnBase, flex: 1, background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                <Lock size={13} className="inline mr-1" /> Lock desktop
              </button>
              <button onClick={() => void runDesktopAction('system_unlock')} style={{ ...btnBase, flex: 1, background: 'rgba(52,211,153,0.08)', color: '#34d399' }}>
                Unlock desktop
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Message to desktop…"
                style={inputStyle}
              />
              <button onClick={() => void sendChat()} disabled={!chatText.trim()} style={{ ...btnBase, background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>
                <MessageSquare size={13} className="inline mr-1" /> Send
              </button>
            </div>
          </>
        )}

        {actionMsg && (
          <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>{actionMsg}</p>
        )}
      </div>

      <p className="text-[10px] leading-relaxed px-1" style={{ color: 'var(--gia-muted-2)' }}>
        GIA can run your phone's tools from the desktop and the desktop's tools from here — ask GIA to "text John from my phone", "lock my laptop",
        or "take a photo". Unlock requires <strong>remote unlock</strong> to be enabled in GIA Cowork settings first.
      </p>

      {scanOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-6" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>Scan the pairing QR on GIA Cowork</p>
          <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-sm rounded-xl border" style={{ borderColor: 'var(--gia-border)', maxHeight: '55vh', objectFit: 'contain' }} />
          <canvas ref={canvasRef} className="hidden" />
          {scanStatus && <p className="text-[11px] text-center" style={{ color: '#fbbf24' }}>{scanStatus}</p>}
          <button onClick={() => setScanOpen(false)} style={{ ...btnBase, background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
            <X size={13} className="inline mr-1" /> Cancel
          </button>
        </div>
      )}
    </div>
  );
};
