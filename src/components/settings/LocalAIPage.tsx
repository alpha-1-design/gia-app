import React from 'react';
import { Cpu, Eye } from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import { LocalModelsSection } from './LocalModelsSection';
import { VisionSection } from './VisionSection';

export const LocalAIPage: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
    <SubPageHeader title="Local AI" onBack={onBack} />

    <div className="px-3 py-3 rounded-xl text-xs leading-relaxed" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', color: 'var(--gia-muted)' }}>
      <p className="font-semibold mb-2" style={{ color: '#22c55e' }}>About this panel</p>
      <p className="mb-2">Run AI entirely on your device — no internet, no cloud costs, total privacy. Everything processes locally using ONNX runtime via Transformers.js.</p>
      <ul className="space-y-1.5 pl-3" style={{ listStyle: 'disc' }}>
        <li><strong style={{ color: '#22c55e' }}>On-Device LLM</strong> — Download a local language model (Qwen2.5 0.5B–3B) that runs on your phone's CPU/GPU. Once downloaded and loaded, switch the active provider to <em>local-llm</em> in Engine Room to start chatting locally.
          <ul className="pl-3 mt-1 space-y-0.5" style={{ listStyle: 'circle' }}>
            <li>0.5B Lightning (~1GB) — Fast, good for basic chat and Q&A</li>
            <li>1.5B Balanced (~3GB) — Best quality-size trade-off, handles reasoning</li>
            <li>3B Ultra (~6GB) — Most capable, complex instructions</li>
          </ul>
        </li>
        <li><strong style={{ color: '#22c55e' }}>Vision Recognition</strong> — Enable on-device image analysis. GIA can describe images, read text from photos, and recognise objects. Useful for Circle-to-Search and screenshots. Uses a quantised vision model (~200MB).</li>
      </ul>
      <p className="mt-2 text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
        Tip: Start with Qwen2.5 0.5B if you're trying local AI for the first time — it downloads fastest (~1GB) and gives you a feel for the experience. Once downloaded, remember to switch your provider in Engine Room. Vision is separate from the LLM and can be used alongside any provider.
      </p>
    </div>

    <div className="flex items-center gap-2 px-1">
      <Cpu size={14} style={{ color: '#22c55e' }} />
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>On-Device LLM</span>
    </div>
    <LocalModelsSection />

    <div className="flex items-center gap-2 px-1 mt-2">
      <Eye size={14} style={{ color: '#3b82f6' }} />
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Vision</span>
    </div>
    <VisionSection />
  </div>
);
