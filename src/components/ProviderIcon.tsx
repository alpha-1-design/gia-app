import React from 'react';

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
  local: '#34d399', 'local-llm': '#34d399', cohere: '#d64545', ai21: '#6b7280', perplexity: '#20808d',
  fireworks: '#ef4444', deepinfra: '#8b5cf6', replicate: '#22c55e', meta: '#0866ff',
};

// Official brand marks for providers
const OpenAIMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M22.28 9.82a5.98 5.98 0 0 0-.51-4.91 6.05 6.05 0 0 0-6.51-2.9A6 6 0 0 0 4.81 4.32a5.98 5.98 0 0 0-3.99 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.51 2.9A6 6 0 0 0 19.19 19.7a5.98 5.98 0 0 0 3.99-2.9 6.05 6.05 0 0 0-.74-7.1Zm-7.62 5.32a3.69 3.69 0 0 1-3.72 3.63 3.67 3.67 0 0 1-2.84-1.32l3.24-3.24a.86.86 0 0 0-.61-1.47H5.74a3.66 3.66 0 0 1 3.64-3.2 3.68 3.68 0 0 1 3.35 2.2l-3.07 3.07a.86.86 0 0 0 .6 1.47h6.05a3.66 3.66 0 0 1-3.2 3.6 3.66 3.66 0 0 1-3.27-2.03l3.18-3.18a.86.86 0 0 0-.61-1.47H8.2a3.66 3.66 0 0 1 3.64-3.2 3.68 3.68 0 0 1 3.35 2.2l-3.07 3.07a.86.86 0 0 0 .6 1.47h6.05Z" />
  </svg>
);

const AnthropicMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M16.52 3.12a.6.6 0 0 0-.52-.32h-3.99a.6.6 0 0 0-.53.33L6.15 19.82a.6.6 0 0 0 .54.85h3.1a.6.6 0 0 0 .54-.34l1.39-3.23h5.57l1.38 3.23a.6.6 0 0 0 .55.34h3.1a.6.6 0 0 0 .54-.85zM12.92 14.1l1.63-3.8 1.63 3.8z" />
  </svg>
);

const GeminiMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M12 2c0 5.523 4.477 10 10 10-5.523 0-10 4.477-10 10-5.523 0-10-4.477-10-10 5.523 0 10-4.477 10-10z" />
  </svg>
);

const OpenCodeMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
  </svg>
);

const OpenRouterMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="3" fill={color} />
    <circle cx="5" cy="17" r="3" fill={color} />
    <circle cx="19" cy="17" r="3" fill={color} />
    <path d="M12 8l-5 6M12 8l5 6" />
  </svg>
);

const DeepSeekMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.5a3.5 3.5 0 1 1 3.5-3.5" />
    <path d="M12 6v12M8 12h8" opacity=".3" />
  </svg>
);

const MistralMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M19 4h-4l-3 5-3-5H5v16h4V9l3 5 3-5v11h4V4z" />
  </svg>
);

const HuggingFaceMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2}>
    <circle cx="9" cy="10" r="1" fill={color} />
    <circle cx="15" cy="10" r="1" fill={color} />
    <path d="M12 18c-2.5 0-4-1.5-4-3h8c0 1.5-1.5 3-4 3zm-9-6c0-4.5 4-8 9-8s9 3.5 9 8-4 8-9 8-9-3.5-9-8z" />
    <path d="M6 14s-1 1-1 2 1 2 1 2M18 14s1 1 1 2-1 2-1 2" strokeWidth={1.5} />
  </svg>
);

const OllamaMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3c-4.5 0-7 2.5-7 6 0 2 .5 3.5 1.5 4.5l-1 5.5h4.5l1.5-3h1l1.5 3H21l-1-5.5c1-1 1.5-2.5 1.5-4.5 0-3.5-2.5-6-7-6z" />
    <circle cx="9.5" cy="9" r="1" fill={color} />
    <circle cx="14.5" cy="9" r="1" fill={color} />
  </svg>
);

const LMStudioMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="11" rx="2" />
    <path d="M12 15v4M8 19h8M8 8h8" />
  </svg>
);

const NvidiaMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    <path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4" />
    <circle cx="12" cy="12" r="2" fill={color} />
  </svg>
);

const PerplexityMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v10M7 12h10M8.5 8.5l7 7M8.5 15.5l7-7" />
  </svg>
);

const ReplicateMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const MetaMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.4}>
    <path d="M7 16c-3 0-5-2-5-4s2-4 5-4c2.5 0 4.5 2.5 5 4 .5-1.5 2.5-4 5-4 3 0 5 2 5 4s-2 4-5 4c-2.5 0-4.5-2.5-5-4-.5 1.5-2.5 4-5 4z" />
  </svg>
);

const LocalLLMMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M9 9h6v6H9z" fill={color} fillOpacity="0.2" />
    <path d="M9 1H9v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
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
    anthropic: <AnthropicMark size={0} color={color} />,
    gemini: <GeminiMark size={0} color={color} />,
    google: <GeminiMark size={0} color={color} />,
    opencode: <OpenCodeMark size={0} color={color} />,
    openrouter: <OpenRouterMark size={0} color={color} />,
    groq: <GroqMark size={0} color={color} />,
    deepseek: <DeepSeekMark size={0} color={color} />,
    cerebras: <CerebrasMark size={0} color={color} />,
    mistral: <MistralMark size={0} color={color} />,
    xai: <XAIMark size={0} color={color} />,
    togetherai: <TogetherMark size={0} color={color} />,
    huggingface: <HuggingFaceMark size={0} color={color} />,
    ollama: <OllamaMark size={0} color={color} />,
    lmstudio: <LMStudioMark size={0} color={color} />,
    nvidia: <NvidiaMark size={0} color={color} />,
    cohere: <CohereMark size={0} color={color} />,
    perplexity: <PerplexityMark size={0} color={color} />,
    fireworks: <ReplicateMark size={0} color={color} />,
    deepinfra: <ReplicateMark size={0} color={color} />,
    replicate: <ReplicateMark size={0} color={color} />,
    meta: <MetaMark size={0} color={color} />,
    local: <LocalLLMMark size={0} color={color} />,
    'local-llm': <LocalLLMMark size={0} color={color} />,
    'local_llm': <LocalLLMMark size={0} color={color} />,
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
