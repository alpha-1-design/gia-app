import React from 'react';
import {
  SiAnthropic, SiGooglegemini, SiHuggingface, SiOllama, SiNvidia,
  SiOpenrouter, SiDeepseek, SiMistralai, SiPerplexity, SiReplicate, SiLmstudio,
  SiOpencode, SiMeta, SiClaude,
} from 'react-icons/si';

interface ProviderIconProps {
  provider: string;
  size?: number;
  className?: string;
  bare?: boolean;
}

// Brand colors.
const BRAND: Record<string, string> = {
  openai: '#10a37f', anthropic: '#d4a27f', gemini: '#4285f4', google: '#4285f4',
  opencode: '#a855f7', openrouter: '#ff6b35', groq: '#f55036', deepseek: '#4d6bfe',
  cerebras: '#06b6d4', mistral: '#ff7000', xai: '#e5e7eb', togetherai: '#6b7280',
  huggingface: '#ffd21e', ollama: '#e5e7eb', lmstudio: '#f59e0b', nvidia: '#76b900',
  local: '#34d399', cohere: '#d64545', ai21: '#6b7280', perplexity: '#20808d',
  fireworks: '#ef4444', deepinfra: '#8b5cf6', replicate: '#22c55e', meta: '#0866ff',
};

// Official brand marks for providers Simple Icons removed over trademark.
const OpenAIMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M22.28 9.82a5.98 5.98 0 0 0-.51-4.91 6.05 6.05 0 0 0-6.51-2.9A6 6 0 0 0 4.81 4.32a5.98 5.98 0 0 0-3.99 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.51 2.9A6 6 0 0 0 19.19 19.7a5.98 5.98 0 0 0 3.99-2.9 6.05 6.05 0 0 0-.74-7.1Zm-7.62 5.32a3.69 3.69 0 0 1-3.72 3.63 3.67 3.67 0 0 1-2.84-1.32l3.24-3.24a.86.86 0 0 0-.61-1.47H5.74a3.66 3.66 0 0 1 3.64-3.2 3.68 3.68 0 0 1 3.35 2.2l-3.07 3.07a.86.86 0 0 0 .6 1.47h6.05a3.66 3.66 0 0 1-3.2 3.6 3.66 3.66 0 0 1-3.27-2.03l3.18-3.18a.86.86 0 0 0-.61-1.47H8.2a3.66 3.66 0 0 1 3.64-3.2 3.68 3.68 0 0 1 3.35 2.2l-3.07 3.07a.86.86 0 0 0 .6 1.47h6.05Z" />
  </svg>
);

const XAIMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
    <path d="M4 4l16 16M20 4L4 20" />
  </svg>
);

const GroqMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M12 3.2c-3 0-4.8 2.1-4.8 5 0 2 .9 3.4 2.4 4.2.9.5 1.3 1.1 1.3 2v.9h2.2v-.9c0-.9.4-1.5 1.3-2 1.5-.8 2.4-2.2 2.4-4.2 0-2.9-1.8-5-4.8-5Zm-1.6 14.6h3.2V20h-3.2Z" />
  </svg>
);

const CohereMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M6 7.5A2.5 2.5 0 1 0 6 12 2.5 2.5 0 0 0 6 7.5Zm12 0A2.5 2.5 0 1 0 18 12 2.5 2.5 0 0 0 18 7.5Zm-12 5A2.5 2.5 0 1 0 6 17 2.5 2.5 0 0 0 6 12.5Zm12 0A2.5 2.5 0 1 0 18 17 2.5 2.5 0 0 0 18 12.5Z" />
  </svg>
);

const TogetherMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M5 6h3v12H5zM9 12l6-6h4v12h-4l-6-6z" />
  </svg>
);

const CerebrasMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M12 3 3 8v8l9 5 9-5V8z" opacity=".25" />
    <path d="M12 6.5 6.5 9.3v5.4L12 17.5l5.5-2.8V9.3z" />
  </svg>
);

const Monogram: React.FC<{ id: string; size: number; color: string }> = ({ id, size, color }) => (
  <span style={{ color, fontWeight: 800, fontSize: size * 0.5, lineHeight: 1 }} className="select-none">
    {(id || '?').replace(/[^a-z0-9]/gi, '').charAt(0).toUpperCase() || '?'}
  </span>
);

function resolveIcon(id: string): { node: React.ReactElement; color: string } {
  const color = BRAND[id] ?? '#a855f7';
  const map: Record<string, React.ReactElement> = {
    openai: <OpenAIMark size={0} color={color} />,
    anthropic: <SiAnthropic size={0} color={color} />,
    gemini: <SiGooglegemini size={0} color={color} />,
    google: <SiGooglegemini size={0} color={color} />,
    opencode: <SiOpencode size={0} color={color} />,
    openrouter: <SiOpenrouter size={0} color={color} />,
    groq: <GroqMark size={0} color={color} />,
    deepseek: <SiDeepseek size={0} color={color} />,
    cerebras: <CerebrasMark size={0} color={color} />,
    mistral: <SiMistralai size={0} color={color} />,
    xai: <XAIMark size={0} color={color} />,
    togetherai: <TogetherMark size={0} color={color} />,
    huggingface: <SiHuggingface size={0} color={color} />,
    ollama: <SiOllama size={0} color={color} />,
    lmstudio: <SiLmstudio size={0} color={color} />,
    nvidia: <SiNvidia size={0} color={color} />,
    local: <Monogram id="local" size={0} color={color} />,
    cohere: <CohereMark size={0} color={color} />,
    perplexity: <SiPerplexity size={0} color={color} />,
    fireworks: <SiReplicate size={0} color={color} />,
    deepinfra: <SiReplicate size={0} color={color} />,
    replicate: <SiReplicate size={0} color={color} />,
    meta: <SiMeta size={0} color={color} />,
    claude: <SiClaude size={0} color={color} />,
    ai21: <Monogram id="ai21" size={0} color={color} />,
  };
  return { node: map[id] ?? <Monogram id={id} size={0} color={color} />, color };
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
