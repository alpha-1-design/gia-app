import React from 'react';
import {
  SiAnthropic, SiDeepseek, SiGooglegemini, SiHuggingface, SiLmstudio,
  SiMistralai, SiNvidia, SiOllama, SiOpencode, SiOpenrouter, SiPerplexity,
  SiX,
} from 'react-icons/si';

interface ProviderIconProps {
  provider: string;
  size?: number;
  className?: string;
  bare?: boolean;
}

// Brand colors.
const BRAND: Record<string, string> = {
  openai: '#10a37f', anthropic: '#d97757', gemini: '#4285f4', google: '#4285f4',
  opencode: '#a855f7', openrouter: '#ff6b35', groq: '#f55036', deepseek: '#4d6bfe',
  cerebras: '#06b6d4', mistral: '#ff7000', xai: '#e5e7eb', togetherai: '#6b7280',
  huggingface: '#ffd21e', ollama: '#e5e7eb', lmstudio: '#f59e0b',
  nvidia: '#76b900', 'local-llm': '#34d399', cohere: '#d64545',
  ai21: '#6b7280', perplexity: '#20808d', fireworks: '#ef4444',
  deepinfra: '#8b5cf6', replicate: '#22c55e',
};

// ── Official simple-icons marks (real brand logos) ──────────────────────────
// Module-level so resolveIcon can check availability before falling back.
const SIMPLE_ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  anthropic: SiAnthropic,
  deepseek: SiDeepseek,
  gemini: SiGooglegemini,
  google: SiGooglegemini,
  opencode: SiOpencode,
  mistral: SiMistralai,
  openrouter: SiOpenrouter,
  xai: SiX,
  huggingface: SiHuggingface,
  ollama: SiOllama,
  lmstudio: SiLmstudio,
  nvidia: SiNvidia,
  perplexity: SiPerplexity,
};

const SimpleIcon: React.FC<{ id: string; size: number; color: string }> = ({ id, size, color }) => {
  const Icon = SIMPLE_ICON_MAP[id];
  if (!Icon) return <></>;
  return <Icon size={size} color={color} />;
};

// Unavailable brand artwork uses a labelled monogram, never an invented logo.
const Monogram: React.FC<{ id: string; size: number; color: string }> = ({ id, size, color }) => {
  const text = ({
    openai: 'OA', groq: 'GQ', cerebras: 'CE', togetherai: 'TA',
    cohere: 'CO', ai21: 'AI', fireworks: 'FW', deepinfra: 'DI',
    replicate: 'RE', 'local-llm': 'LL',
  } as Record<string, string>)[id] ?? (id || '?').replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();
  return (
    <span style={{ color, fontWeight: 800, fontSize: size * 0.42, lineHeight: 1, letterSpacing: '-0.02em' }} className="select-none">
      {text}
    </span>
  );
};

function resolveIcon(id: string): { node: React.ReactElement; color: string } {
  const color = BRAND[id] ?? '#a855f7';
  if (SIMPLE_ICON_MAP[id]) return { node: <SimpleIcon id={id} size={0} color={color} />, color };
  return { node: <Monogram id={id} size={0} color={color} />, color };
}

const ProviderIcon: React.FC<ProviderIconProps> = ({ provider, size = 18, className, bare = false }) => {
  const id = (provider || '').toLowerCase();
  const { node, color } = resolveIcon(id);
  const glyph = React.cloneElement(node as React.ReactElement<Record<string, unknown>>, { size, color });

  if (bare) {
    return (
      <span className={className} style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {glyph}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{
        width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: Math.max(4, size * 0.3), background: `${color}1f`, border: `1px solid ${color}3a`,
        flexShrink: 0, padding: size * 0.16, boxSizing: 'border-box',
      }}
      aria-label={provider} title={provider}
    >
      {glyph}
    </span>
  );
};

export default ProviderIcon;
