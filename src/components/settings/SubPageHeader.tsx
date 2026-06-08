import React from 'react';
import { ArrowLeft } from 'lucide-react';

export const SubPageHeader: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
  <div className="flex items-center gap-3 mb-4">
    <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5" style={{ color: 'var(--gia-muted)' }}>
      <ArrowLeft size={18} />
    </button>
    <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>{title}</span>
  </div>
);
