import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Key, X } from 'lucide-react';
import { useGiaStore } from '../store/useGiaStore';
import { useProviderStore } from '../store/useProviderStore';
import { logger } from '../utils/logger';

const ApiKeyInputPanel: React.FC = () => {
  const { pendingApiKeyRequest, setPendingApiKeyRequest } = useGiaStore(s => ({
    pendingApiKeyRequest: s.pendingApiKeyRequest,
    setPendingApiKeyRequest: s.setPendingApiKeyRequest,
  }));
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pendingApiKeyRequest) return null;

  const { providerId, description } = pendingApiKeyRequest;

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { providers } = useProviderStore.getState();
      const providerConfigs = providers;
      if (providerConfigs[providerId]) {
        useProviderStore.getState().setProviderKey(providerId, apiKey.trim());
        setPendingApiKeyRequest(null);
        setApiKey('');
        useGiaStore.getState().addNotification(`API key saved for ${providerId}`);
      } else {
        setError(`Provider ${providerId} not found. Add it in Settings first.`);
      }
    } catch (e) {
      setError((e as Error).message || 'Failed to save API key');
      logger.error('[ApiKeyInput] Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPendingApiKeyRequest(null);
    setApiKey('');
    setError(null);
  };

  return (
    <AnimatePresence>
      {pendingApiKeyRequest && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="fixed bottom-20 left-4 right-4 z-[200] mx-auto max-w-md"
        >
          <div
            className="rounded-2xl p-4 shadow-2xl"
            style={{
              background: 'rgba(12, 12, 20, 0.98)',
              border: '1px solid rgba(168,85,247,0.2)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.05))' }}>
                <Key size={16} style={{ color: '#a855f7' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-zinc-100">API Key Required</p>
                <p className="text-[10px] text-zinc-500 truncate">{description}</p>
              </div>
              <button onClick={handleCancel} className="text-zinc-600 hover:text-zinc-400 p-1" aria-label="Close">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setError(null); }}
                placeholder="Enter API key..."
                className="w-full px-3 py-2 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                style={{
                  background: 'var(--gia-surface-2)',
                  border: '1px solid var(--gia-border, rgba(255,255,255,0.1))',
                }}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && !saving) handleSave(); }}
              />

              {error && (
                <p className="text-[11px] text-red-400">{error}</p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !apiKey.trim()}
                  className="flex-1 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all active:scale-95 disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(168,85,247,0.15))',
                    color: '#c084fc',
                    border: '1px solid rgba(168,85,247,0.3)',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Key'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-[12px] font-medium transition-all active:scale-95 disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--gia-muted)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ApiKeyInputPanel;