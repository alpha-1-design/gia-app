import React, { useState, useEffect } from 'react';
import { Sparkles, X, Check } from 'lucide-react';
import { useGiaStore } from '../store/useGiaStore';

interface SuggestionToastProps {
  suggestion: {
    module: 'writer' | 'analyst' | 'planner';
    reason: string;
  };
  onAccept: () => void;
  onDismiss: () => void;
}

const SuggestionToast = ({ suggestion, onAccept, onDismiss }: SuggestionToastProps) => {
  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500 w-[90%] max-w-[360px]">
      <div className="gia-card p-4 flex items-center gap-4 bg-zinc-900/95 backdrop-blur-xl border-zinc-800 shadow-2xl">
        <div className="w-10 h-10 bg-gia-accent rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-gia-accent/20">
          <Sparkles size={18} className="text-white" />
        </div>

        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-100">
            {suggestion.reason}
          </p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mt-0.5">
            Switch to {suggestion.module} view?
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
            title="Dismiss"
          >
            <X size={16} />
          </button>
          <button
            onClick={onAccept}
            className="p-2 bg-gia-accent text-white rounded-full hover:bg-gia-accent/90 transition-colors shadow-md"
            title="Accept"
          >
            <Check size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuggestionToast;
