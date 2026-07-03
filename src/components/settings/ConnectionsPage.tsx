import React from 'react';
import { PlugZap, Share2 } from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import { ConnectorsSection } from './ConnectorsSection';
import { SocialSection } from './SocialSection';
import { GatewaySection } from './GatewaySection';
import { BrowserSection } from './BrowserSection';
import { SearchSection } from './SearchSection';

export const ConnectionsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
    <SubPageHeader title="Connections" onBack={onBack} />

    <div className="px-3 py-3 rounded-xl text-xs leading-relaxed" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', color: 'var(--gia-muted)' }}>
      <p className="font-semibold mb-2" style={{ color: '#f59e0b' }}>About this panel</p>
      <p className="mb-2">Link GIA to external services so she can fetch real-time data, send messages, browse the web, and search the internet. Each connection is optional — set up only what you need.</p>
      <ul className="space-y-1.5 pl-3" style={{ listStyle: 'disc' }}>
        <li><strong style={{ color: '#f59e0b' }}>Connectors</strong> — API integrations for third-party services like OpenWeather, GitHub, or custom APIs. Click <em>Configure</em>, enter your API key/fields, then test the connection. Each connector can be toggled on/off independently.</li>
        <li><strong style={{ color: '#f59e0b' }}>Social Media</strong> — Connect Telegram, WhatsApp, Instagram, or Twitter. For Telegram: talk to <em>@BotFather</em> on Telegram to create a bot, get your token, then paste it here. GIA can then respond to messages sent to that bot.</li>
        <li><strong style={{ color: '#f59e0b' }}>Gateway Routes</strong> — Define rules that map incoming messages (from social/Bridge) to specific actions or responses. Each route has a source, trigger pattern, and action.</li>
        <li><strong style={{ color: '#f59e0b' }}>Browser</strong> — Enable in-app browser automation. GIA can navigate pages, fill forms, and extract data. Uses a sandboxed headless browser.</li>
        <li><strong style={{ color: '#f59e0b' }}>Search</strong> — Pick your default web search provider (Google, DuckDuckGo, etc.) and configure API keys if needed. GIA uses this for web_search tool calls.</li>
      </ul>
      <p className="mt-2 text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
        Tip: Start with Connectors (add a free OpenWeather API key). Then try Social — Telegram is the easiest to set up. Test each connection after configuring to make sure it works.
      </p>
    </div>

    <div className="flex items-center gap-2 px-1">
      <PlugZap size={14} style={{ color: '#f59e0b' }} />
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Integrations</span>
    </div>
    <ConnectorsSection />
    <SocialSection />
    <GatewaySection />

    <div className="flex items-center gap-2 px-1 mt-2">
      <Share2 size={14} style={{ color: '#3b82f6' }} />
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Tools</span>
    </div>
    <BrowserSection />
    <SearchSection />
  </div>
);
