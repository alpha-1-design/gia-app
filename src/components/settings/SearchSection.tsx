import React, { useState } from 'react';
import { Search, ExternalLink, Check, X, Globe } from 'lucide-react';
import { useSearchStore, type SearchProviderId } from '../../store/useSearchStore';

const PROVIDER_META: Record<SearchProviderId, { label: string; desc: string; url: string; color: string; docUrl: string }> = {
  exa: {
    label: 'Exa Search',
    desc: 'AI-native search engine with semantic + keyword search. Returns clean structured results with highlights.',
    url: 'https://exa.ai',
    color: '#a855f7',
    docUrl: 'https://docs.exa.ai/reference/search-api',
  },
  browserless: {
    label: 'Browserless.io',
    desc: 'Headless browser as a service. Fetches, renders JS, and screenshots any web page. Great for dynamic sites.',
    url: 'https://browserless.io',
    color: '#3b82f6',
    docUrl: 'https://docs.browserless.io',
  },
  none: {
    label: 'No API — fallback scraping',
    desc: 'Uses DuckDuckGo/Google/Bing HTML scraping through CORS proxies. No API key needed but less reliable.',
    url: '',
    color: '#71717a',
    docUrl: '',
  },
};

export const SearchSection: React.FC = () => {
  const {
    activeSearchProvider,
    providers,
    setActiveSearchProvider,
    setSearchProviderKey,
    setSearchProviderEnabled,
  } = useSearchStore();

  const [keys, setKeys] = useState<Record<string, string>>({
    exa: providers.exa.apiKey,
    browserless: providers.browserless.apiKey,
  });

  const handleKeyChange = (id: SearchProviderId, val: string) => {
    setKeys(k => ({ ...k, [id]: val }));
  };

  const handleSaveKey = (id: SearchProviderId) => {
    const val = keys[id] || '';
    setSearchProviderKey(id, val);
    if (val.trim()) {
      setSearchProviderEnabled(id, true);
      setActiveSearchProvider(id);
    }
    useSearchStore.getState(); // trigger persist
  };

  const handleRemove = (id: SearchProviderId) => {
    setKeys(k => ({ ...k, [id]: '' }));
    setSearchProviderKey(id, '');
    setSearchProviderEnabled(id, false);
    setActiveSearchProvider('none');
  };

  const isActive = (id: SearchProviderId) => activeSearchProvider === id && providers[id]?.enabled && !!providers[id]?.apiKey;

  const providersToShow: SearchProviderId[] = ['exa', 'browserless', 'none'];

  return (
    <div className="gia-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Search size={14} style={{ color: '#a855f7' }} />
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--gia-muted)' }}>
          Search Providers
        </span>
        {activeSearchProvider !== 'none' && providers[activeSearchProvider]?.apiKey && (
          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400">
            Active
          </span>
        )}
      </div>
      <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
        Connect your own search API keys for reliable, high-quality results instead of HTML scraping.
      </p>

      <div className="space-y-2">
        {providersToShow.map(id => {
          const meta = PROVIDER_META[id];
          const active = isActive(id);
          const hasKey = !!providers[id]?.apiKey;

          if (id === 'none') {
            return (
              <div
                key={id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                style={{
                  background: activeSearchProvider === 'none' ? 'rgba(113,113,122,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${activeSearchProvider === 'none' ? 'rgba(113,113,122,0.2)' : 'rgba(255,255,255,0.04)'}`,
                }}
                onClick={() => setActiveSearchProvider('none')}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(113,113,122,0.12)', color: meta.color }}>
                  <Globe size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                    {meta.label}
                    {activeSearchProvider === 'none' && <Check size={10} className="text-emerald-400" />}
                  </p>
                  <p className="text-[8px] text-zinc-500 mt-0.5">{meta.desc}</p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={id}
              className="rounded-xl px-3 py-2.5"
              style={{
                background: active ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${active ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)'}`,
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${meta.color}15`, color: meta.color }}>
                  <Search size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                    {meta.label}
                    {active && <Check size={10} className="text-emerald-400" />}
                  </p>
                  <p className="text-[8px] text-zinc-500 mt-0.5">{meta.desc}</p>
                </div>
                <a href={meta.docUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500">
                  <ExternalLink size={10} />
                </a>
              </div>

              <div className="flex gap-2">
                <input
                  className="gia-input flex-1 min-w-0"
                  style={{ fontSize: '10px', padding: '6px 8px' }}
                  value={keys[id] || ''}
                  onChange={e => handleKeyChange(id as SearchProviderId, e.target.value)}
                  placeholder={`${meta.label} API key`}
                  type="password"
                />
                {hasKey ? (
                  <button
                    onClick={() => handleRemove(id as SearchProviderId)}
                    className="text-[9px] font-semibold px-2.5 py-1.5 rounded-lg shrink-0"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
                  >
                    <X size={11} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSaveKey(id as SearchProviderId)}
                    className="text-[9px] font-semibold px-2.5 py-1.5 rounded-lg shrink-0"
                    style={{ background: `${meta.color}15`, color: meta.color }}
                    disabled={!keys[id]?.trim()}
                  >
                    Save
                  </button>
                )}
              </div>

              {hasKey && (
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    onClick={() => setActiveSearchProvider(id as SearchProviderId)}
                    className="text-[8px] font-medium px-2 py-1 rounded-lg transition-all"
                    style={{
                      background: active ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                      color: active ? '#34d399' : 'var(--gia-muted)',
                    }}
                  >
                    {active ? 'Active' : 'Use this provider'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
