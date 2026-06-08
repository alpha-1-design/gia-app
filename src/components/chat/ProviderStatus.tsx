import React from 'react';

interface ProviderStatusProps {
  providerConnected: boolean;
  providerLabel: string;
  activeModel: string;
  className?: string;
}

export const ProviderStatus: React.FC<ProviderStatusProps> = ({ providerConnected, providerLabel, activeModel, className }) => {
  return (
    <div className={`gia-pill flex items-center gap-1.5 flex-1 min-w-0 max-w-[180px] ${className || ''}`} style={{
      background: providerConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
      color: providerConnected ? '#34d399' : '#f87171',
      border: `1px solid ${providerConnected ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
    }}>
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: providerConnected ? '#34d399' : '#f87171' }} />
      <span className="truncate max-w-[80px]">{providerLabel}</span>
      {activeModel && providerConnected && (
        <span className="text-[7px] opacity-50 truncate max-w-[60px] hidden sm:inline">{activeModel.split('/').pop()}</span>
      )}
    </div>
  );
};
