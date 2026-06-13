import React, { useState, useEffect } from 'react';
import { Share2, Link2, Link2Off, CheckCircle2 } from 'lucide-react';
import socialManager from '../../services/social/SocialManager';

// ── Brand SVGs ──────────────────────────────────────────────────────
const platformSvgs: Record<string, React.ReactNode> = {
  twitter: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#0088CC">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.127.087.507.087.507l-1.562 7.326c-.067.315-.43.561-.791.46-.26-.072-1.082-.367-1.636-.578-.366-.14-.763-.293-.72-.556.035-.148.217-.302.415-.493.567-.552 1.648-1.62 1.649-1.62.046-.039.12-.106.084-.214a.247.247 0 0 0-.215-.133c-.035 0-.26.07-1.098.7-1.349.91-1.645 1.108-1.807 1.2-.184.104-.389.122-.563.026-.2-.11-.542-.32-.86-.523-.386-.245-.526-.384-.49-.588.019-.112.1-.215.276-.332.246-.163.888-.676 1.724-1.31.657-.498 1.17-.897 1.23-.952.16-.145.287-.306.184-.478-.063-.107-.24-.146-.413-.126-.171.018-1.142.764-2.312 1.523-.287.186-.55.359-.79.505-.27.17-.52.178-.764.026a42.55 42.55 0 0 1-.761-.395c-.415-.226-.73-.354-.724-.562.005-.092.052-.183.145-.276.285-.315 1.57-.94 3.192-1.5 1.66-.572 3.15-.98 3.29-1.026.09-.03.236-.058.33 0z"/>
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#25D366">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
};

const platformBrandColors: Record<string, string> = {
  twitter: '#000000',
  instagram: '#E4405F',
  facebook: '#1877F2',
  linkedin: '#0A66C2',
  tiktok: '#000000',
  telegram: '#0088CC',
  whatsapp: '#25D366',
};

type AuthField = { key: string; label: string; placeholder: string; type?: string; required?: boolean; url?: string };

const PLATFORM_AUTH_FIELDS: Record<string, AuthField[]> = {
  twitter: [
    { key: 'clientId', label: 'Client ID', placeholder: 'OAuth 2.0 Client ID from Twitter Developer Portal', required: true, url: 'https://developer.twitter.com/en/portal/dashboard' },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'OAuth 2.0 Client Secret', type: 'password', required: true },
    { key: 'bearerToken', label: 'Bearer Token', placeholder: 'API Bearer Token (optional)', type: 'password' },
    { key: 'accountName', label: 'Account Username', placeholder: '@yourhandle' },
  ],
  instagram: [
    { key: 'clientId', label: 'App ID', placeholder: 'Instagram App ID from Meta Developers', required: true, url: 'https://developers.facebook.com/docs/instagram-basic-display-api/getting-started' },
    { key: 'clientSecret', label: 'App Secret', placeholder: 'Instagram App Secret', type: 'password', required: true },
    { key: 'accessToken', label: 'Access Token', placeholder: 'Long-lived access token (optional)', type: 'password' },
    { key: 'accountName', label: 'Account Username', placeholder: '@yourhandle' },
  ],
  facebook: [
    { key: 'appId', label: 'App ID', placeholder: 'Facebook App ID', required: true, url: 'https://developers.facebook.com/apps' },
    { key: 'appSecret', label: 'App Secret', placeholder: 'Facebook App Secret', type: 'password', required: true },
    { key: 'pageId', label: 'Page ID', placeholder: 'Facebook Page ID (optional)' },
    { key: 'accessToken', label: 'Page Access Token', placeholder: 'Long-lived page token (optional)', type: 'password' },
    { key: 'accountName', label: 'Page Name', placeholder: 'Your Facebook page name' },
  ],
  linkedin: [
    { key: 'clientId', label: 'Client ID', placeholder: 'LinkedIn OAuth Client ID', required: true, url: 'https://www.linkedin.com/developers/apps' },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'LinkedIn OAuth Client Secret', type: 'password', required: true },
    { key: 'redirectUri', label: 'Redirect URI', placeholder: window.location.origin + '/oauth-callback.html' },
    { key: 'accessToken', label: 'Access Token', placeholder: 'OAuth access token (optional)', type: 'password' },
    { key: 'accountName', label: 'Account Name', placeholder: 'Your LinkedIn name' },
  ],
  tiktok: [
    { key: 'clientKey', label: 'Client Key', placeholder: 'TikTok Developer Client Key', required: true, url: 'https://developers.tiktok.com/apps' },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'TikTok Client Secret', type: 'password', required: true },
    { key: 'accountName', label: 'Account Name', placeholder: '@yourhandle' },
  ],
  telegram: [
    { key: 'botToken', label: 'Bot Token', placeholder: 'Token from @BotFather', type: 'password', required: true, url: 'https://t.me/BotFather' },
    { key: 'channelId', label: 'Channel ID', placeholder: 'e.g. @yourchannel or -1001234567890' },
    { key: 'accountName', label: 'Bot Name', placeholder: 'Your bot display name' },
  ],
  whatsapp: [
    { key: 'businessAccountId', label: 'Business Account ID', placeholder: 'WhatsApp Business Account ID (WABA)', required: true, url: 'https://developers.facebook.com/docs/whatsapp/cloud-api' },
    { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: 'WhatsApp Phone Number ID', required: true },
    { key: 'apiToken', label: 'API Token', placeholder: 'Permanent access token from Meta', type: 'password', required: true },
    { key: 'accountName', label: 'Business Name', placeholder: 'Your business display name' },
  ],
};

export const SocialSection: React.FC = () => {
  const [platforms, setPlatforms] = useState(socialManager.getPlatforms());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const refresh = () => setPlatforms(socialManager.getPlatforms());

  useEffect(() => { const iv = setInterval(refresh, 5000); return () => clearInterval(iv); }, []);

  const handleConnectWithToken = (id: string) => {
    const fields = PLATFORM_AUTH_FIELDS[id] || [];
    const config: Record<string, string> = {};
    for (const f of fields) {
      if (formData[f.key]) config[f.key] = formData[f.key];
    }
    socialManager.connectPlatform(id, config);
    setFormData({});
    setExpanded(null);
    refresh();
  };

  const handleConnectSimple = (id: string) => {
    socialManager.connectPlatform(id, { accountName: formData.accountName || id });
    setFormData({});
    setExpanded(null);
    refresh();
  };

  const handleDisconnect = (id: string) => {
    socialManager.disconnectPlatform(id);
    refresh();
  };

  const setField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Share2 size={16} style={{ color: '#3b82f6' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Social Media</span>
      </div>
      <div className="space-y-2">
        {platforms.map((p) => (
          <div key={p.id}
            className="p-3 rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--gia-border)' }}
          >
            <div className="flex items-center gap-3">
              <span style={{ color: platformBrandColors[p.id] || 'var(--gia-text)' }}>
                {platformSvgs[p.id] || '🌐'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>{p.name}</span>
                  {p.connected && (
                    <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                      <CheckCircle2 size={9} />
                      Connected
                    </span>
                  )}
                </div>
                {p.accountName && (
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>
                    @{p.accountName}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {p.connected ? (
                  <button onClick={() => handleDisconnect(p.id)}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg transition-all tap-feedback"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                    <Link2Off size={11} /> Disconnect
                  </button>
                ) : (
                  <button onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg transition-all tap-feedback"
                    style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
                    <Link2 size={11} /> Connect
                  </button>
                )}
              </div>
            </div>

            {expanded === p.id && !p.connected && (
              <div className="mt-3 space-y-2">
                {(PLATFORM_AUTH_FIELDS[p.id] || []).map(field => (
                  <div key={field.key}>
                    {field.url ? (
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-medium" style={{ color: 'var(--gia-muted)' }}>{field.label}</label>
                        <a href={field.url} target="_blank" rel="noopener noreferrer"
                          className="text-[9px] text-blue-400 hover:text-blue-300 transition-colors">
                          Get from developer portal →
                        </a>
                      </div>
                    ) : (
                      <label className="text-[9px] font-medium" style={{ color: 'var(--gia-muted)' }}>{field.label}</label>
                    )}
                    <input
                      value={formData[field.key] || ''}
                      onChange={e => setField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      type={field.type || 'text'}
                      className="w-full text-[10px] px-2.5 py-1.5 rounded-lg outline-none mt-0.5"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => handleConnectWithToken(p.id)}
                    className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                    <Link2 size={11} />
                    Connect
                  </button>
                  <button onClick={() => { setExpanded(null); setFormData({}); }}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg"
                    style={{ color: 'var(--gia-muted)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
