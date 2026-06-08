import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, ExternalLink, Mail, Globe } from 'lucide-react';
import QRCode from 'qrcode';

export const InstallSection: React.FC = () => {
  const [repo, setRepo] = useState(() => localStorage.getItem('gia-github-repo') || 'alpha-1-design/gia-app');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrError, setQrError] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }; }, []);

  const releaseUrl = repo ? `https://github.com/${repo}/releases/latest` : '';

  useEffect(() => {
    if (!repo || !canvasRef.current) return;
    setQrError(false);
    QRCode.toCanvas(canvasRef.current, releaseUrl, {
      width: 160, margin: 2, color: { dark: '#ffffff', light: '#0a0a0f' },
    }).catch(() => setQrError(true));
  }, [repo, releaseUrl]);

  const handleSave = () => {
    localStorage.setItem('gia-github-repo', repo);
    setSaved(true);
    saveTimerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="flex items-center gap-2">
        <Smartphone size={14} style={{ color: '#3b82f6' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Install GIA
        </span>
      </div>

      <div className="flex justify-center py-2">
        {qrError || !repo ? (
          <div className="w-40 h-40 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] text-center px-4" style={{ color: 'var(--gia-muted-2)' }}>
              {!repo ? 'Set your GitHub repo below' : 'Could not generate QR'}
            </p>
          </div>
        ) : (
          <canvas ref={canvasRef} className="rounded-xl" style={{ border: '2px solid rgba(255,255,255,0.08)' }} />
        )}
      </div>

      <p className="text-[10px] text-center" style={{ color: 'var(--gia-muted-2)' }}>
        Scan with your phone to download the latest APK
      </p>

      <div className="flex gap-2">
        <input
          className="gia-input"
          value={repo}
          onChange={e => setRepo(e.target.value)}
          placeholder="owner/gia-app"
          style={{ fontSize: '11px', flex: 1 }}
        />
        <button
          onClick={handleSave}
          className="gia-btn text-xs px-3 py-2"
          style={{ background: saved ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.1)', border: `1px solid ${saved ? 'rgba(16,185,129,0.25)' : 'rgba(59,130,246,0.2)'}`, color: saved ? '#34d399' : '#3b82f6' }}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {releaseUrl && (
        <a
          href={releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="gia-btn flex items-center justify-center gap-1.5 text-[11px] px-3 py-2 w-full"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}
        >
          <ExternalLink size={11} /> Open Latest Release
        </a>
      )}

      <div className="flex flex-col gap-1 text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
        <div className="flex items-center gap-1.5">
          <Mail size={10} /> alphariansamuel@gmail.com
        </div>
        <div className="flex items-center gap-1.5">
          <Globe size={10} /> alpha1-studio.vercel.app
        </div>
      </div>
    </div>
  );
};
