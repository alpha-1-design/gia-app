import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';

export const BrowserSection: React.FC = () => {
  const [proxyUrl, setProxyUrl] = useState(() => {
    const saved = localStorage.getItem('gia-browser-proxy');
    return saved || '';
  });
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  const handleSave = () => {
    if (proxyUrl.trim()) {
      localStorage.setItem('gia-browser-proxy', proxyUrl.trim());
      import('../../services/BrowserRunner').then(m => m.default.setProxy(proxyUrl.trim()));
    } else {
      localStorage.removeItem('gia-browser-proxy');
      import('../../services/BrowserRunner').then(m => m.default.setProxy(''));
    }
    setStatus('saved');
    useGiaStore.getState().addNotification('Browser proxy saved');
    setTimeout(() => setStatus('idle'), 2000);
  };

  useEffect(() => {
    import('../../services/BrowserRunner').then(m => {
      const saved = localStorage.getItem('gia-browser-proxy');
      if (saved) m.default.setProxy(saved);
    });
  }, []);

  return (
    <div className="gia-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Globe size={14} style={{ color: '#60a5fa' }} />
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--gia-muted)' }}>
          Browser Automation
        </span>
      </div>
      <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
        GIA can browse and render web pages in the background. For CORS-blocked sites, set a CORS proxy endpoint.
      </p>
      <div className="flex gap-2">
        <input
          className="gia-input"
          style={{ fontSize: '11px', flex: 1 }}
          value={proxyUrl}
          onChange={e => { setProxyUrl(e.target.value); setStatus('idle'); }}
          placeholder="https://your-cors-proxy.com/"
        />
        <button
          onClick={handleSave}
          className="gia-btn text-xs px-3 py-2"
          style={{ background: status === 'saved' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.1)', border: `1px solid ${status === 'saved' ? 'rgba(16,185,129,0.25)' : 'rgba(59,130,246,0.2)'}`, color: status === 'saved' ? '#34d399' : '#3b82f6' }}
        >
          {status === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>
      {proxyUrl ? (
        <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
          Proxy: {proxyUrl}
        </p>
      ) : (
        <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
          No proxy set — only CORS-enabled pages will work
        </p>
      )}
    </div>
  );
};
