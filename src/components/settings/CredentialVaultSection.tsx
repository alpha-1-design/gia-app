import React from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { useCredentialStore } from '../../store/useCredentialStore';
import connectorManager from '../../services/connectors/ConnectorManager';
import { useProviderStore } from '../../store/useProviderStore';

export const CredentialVaultSection: React.FC = () => {
  const credentials = useCredentialStore(s => Object.values(s.credentials));
  const removeCredential = useCredentialStore(s => s.removeCredential);
  const remove = (serviceId: string) => {
    connectorManager.clearCredential(serviceId);
    if (useProviderStore.getState().providers[serviceId]) {
      useProviderStore.getState().setProviderKey(serviceId, '');
    }
    removeCredential(serviceId);
  };

  return (
    <section className="rounded-2xl p-4" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={15} style={{ color: '#a855f7' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Saved service credentials</h3>
      </div>
      <p className="text-[10px] leading-relaxed mb-3" style={{ color: 'var(--gia-muted)' }}>
        Keys and tokens entered through GIA’s prompt are stored in the app’s local database and are only used for the service you approved. They never go into chat history or the system prompt. On Android, use device encryption and a screen lock.
      </p>
      {credentials.length === 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--gia-muted-2)' }}>No service credentials saved yet.</p>
      ) : (
        <div className="space-y-2">
          {credentials.map(credential => (
            <div key={credential.serviceId} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--gia-surface-2)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>{credential.label}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--gia-muted-2)' }}>
                  {credential.kind.replace('_', ' ')} · •••••••• · updated {new Date(credential.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <button type="button" onClick={() => remove(credential.serviceId)} className="p-2 rounded-lg" aria-label={`Remove ${credential.label} credential`} style={{ color: '#f87171' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default CredentialVaultSection;
