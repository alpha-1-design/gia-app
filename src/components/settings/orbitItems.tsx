import React from 'react';
import { PlugZap, Send, MessageCircle, Route, Globe, Search, KeyRound } from 'lucide-react';

export interface OrbitItem {
  id: string;
  label: string;
  /** Element id of the settings section this opens. */
  target: string;
  color: string;
  icon: React.ReactNode;
}

export const ORBIT_ITEMS: OrbitItem[] = [
  { id: 'connectors', label: 'Connectors', target: 'conn-connectors', color: '#f59e0b', icon: <PlugZap size={18} /> },
  { id: 'vault', label: 'Credential vault', target: 'conn-vault', color: '#a78bfa', icon: <KeyRound size={18} /> },
  { id: 'telegram', label: 'Telegram and social', target: 'conn-social', color: '#38bdf8', icon: <Send size={18} /> },
  { id: 'messaging', label: 'WhatsApp and messaging', target: 'conn-social', color: '#4ade80', icon: <MessageCircle size={18} /> },
  { id: 'gateway', label: 'Gateway routes', target: 'conn-gateway', color: '#f472b6', icon: <Route size={18} /> },
  { id: 'browser', label: 'Browser', target: 'conn-browser', color: '#60a5fa', icon: <Globe size={18} /> },
  { id: 'search', label: 'Search', target: 'conn-search', color: '#fbbf24', icon: <Search size={18} /> },
];
