import React from 'react';
import {
  SiAlibabacloud, SiAnthropic, SiCloudflare, SiDatabricks, SiDeepseek,
  SiGithub, SiGooglegemini, SiGooglecloud, SiHuggingface, SiLmstudio,
  SiMeta, SiMinimax, SiMoonshotai, SiNvidia, SiOllama, SiOpenrouter,
  SiPerplexity, SiQwen, SiReplicate, SiScaleway, SiX,
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
  'google-ai-studio': '#4285f4', 'vertex-ai': '#4285f4', 'google-cloud': '#4285f4',
  opencode: '#a855f7', openrouter: '#ff6b35', groq: '#f55036', deepseek: '#4d6bfe',
  cerebras: '#06b6d4', mistral: '#ff7000', xai: '#e5e7eb', togetherai: '#6b7280',
  huggingface: '#ffd21e', ollama: '#e5e7eb', 'ollama-cloud': '#e5e7eb', lmstudio: '#f59e0b',
  'lmstudio-remote': '#f59e0b', nvidia: '#76b900', local: '#34d399', 'local-llm': '#34d399',
  cohere: '#d64545', 'cohere-command': '#d64545', ai21: '#6b7280', perplexity: '#20808d',
  fireworks: '#ef4444', deepinfra: '#8b5cf6', replicate: '#22c55e', meta: '#0866ff',
  'moonshot': '#111111', 'zhipu': '#3859ff', 'qwen': '#615ced', 'minimax': '#ff4d4d',
  'github-models': '#e5e7eb', 'cloudflare-ai': '#f6821f', 'cloudflare-gateway': '#f6821f',
  'databricks': '#ff3621', 'watsonx': '#be95ff', 'bedrock': '#ff9900', 'sagemaker': '#ff9900',
  'azure-openai': '#0078d4', 'scaleway': '#4f0599', 'lambda': '#a855f7',
  'sambanova': '#00a56d', 'hyperbolic': '#000000', 'novita': '#20c997', 'nebius': '#0f6fff',
  'friendli': '#12a594', 'nscale': '#6366f1', 'modal': '#0f0f0f', 'baseten': '#213147',
  'volcengine': '#00c8d2', 'cometapi': '#8b5cf6', requesty: '#f97316', portkey: '#dc2626',
  litellm: '#8b5cf6', vllm: '#34d399', llamacpp: '#22c55e', jan: '#0ea5e9',
  koboldcpp: '#f59e0b', tabbyml: '#a855f7', 'text-generation-webui': '#94a3b8',
  'siliconflow': '#7c3aed', stepfun: '#0ea5e9', baichuan: '#f43f5e',
  yi: '#10b981', inflection: '#e11d48', 'aleph-alpha': '#1d4ed8', predibase: '#6366f1',
  lepton: '#0284c7', 'custom-openai': '#a1a1aa', 'custom-anthropic': '#a1a1aa', 'custom-gemini': '#a1a1aa',
};

// ── Official simple-icons marks (real brand logos) ──────────────────────────
// ── Official simple-icons marks (real brand logos) ──────────────────────────
// Module-level so resolveIcon can check availability before falling back.
const SIMPLE_ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  anthropic: SiAnthropic,
  deepseek: SiDeepseek,
  gemini: SiGooglegemini,
  google: SiGooglegemini,
  'google-ai-studio': SiGooglegemini,
  openrouter: SiOpenrouter,
  xai: SiX,
  huggingface: SiHuggingface,
  ollama: SiOllama,
  'ollama-cloud': SiOllama,
  lmstudio: SiLmstudio,
  'lmstudio-remote': SiLmstudio,
  nvidia: SiNvidia,
  perplexity: SiPerplexity,
  replicate: SiReplicate,
  meta: SiMeta,
  moonshot: SiMoonshotai,
  minimax: SiMinimax,
  qwen: SiQwen,
  'github-models': SiGithub,
  'cloudflare-ai': SiCloudflare,
  'cloudflare-gateway': SiCloudflare,
  databricks: SiDatabricks,
  'vertex-ai': SiGooglecloud,
  'google-cloud': SiGooglecloud,
  'alibaba-cloud': SiAlibabacloud,
  scaleway: SiScaleway,
};

const SimpleIcon: React.FC<{ id: string; size: number; color: string }> = ({ id, size, color }) => {
  const Icon = SIMPLE_ICON_MAP[id];
  if (!Icon) return <></>;
  return <Icon size={size} color={color} />;
};

// ── Hand-drawn marks for providers without a simple-icons entry ─────────────
const OpenAIMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M22.28 9.82a5.98 5.98 0 0 0-.51-4.91 6.05 6.05 0 0 0-6.51-2.9A6 6 0 0 0 4.81 4.32a5.98 5.98 0 0 0-3.99 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.51 2.9A6 6 0 0 0 19.19 19.7a5.98 5.98 0 0 0 3.99-2.9 6.05 6.05 0 0 0-.74-7.1Zm-7.62 5.32a3.69 3.69 0 0 1-3.72 3.63 3.67 3.67 0 0 1-2.84-1.32l3.24-3.24a.86.86 0 0 0-.61-1.47H5.74a3.66 3.66 0 0 1 3.64-3.2 3.68 3.68 0 0 1 3.35 2.2l-3.07 3.07a.86.86 0 0 0 .6 1.47h6.05a3.66 3.66 0 0 1-3.2 3.6 3.66 3.66 0 0 1-3.27-2.03l3.18-3.18a.86.86 0 0 0-.61-1.47H8.2a3.66 3.66 0 0 1 3.64-3.2 3.68 3.68 0 0 1 3.35 2.2l-3.07 3.07a.86.86 0 0 0 .6 1.47h6.05Z" />
  </svg>
);

const OpenCodeMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
  </svg>
);

const GroqMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M12 3.2c-3 0-4.8 2.1-4.8 5 0 2 .9 3.4 2.4 4.2.9.5 1.3 1.1 1.3 2v.9h2.2v-.9c0-.9.4-1.5 1.3-2 1.5-.8 2.4-2.2 2.4-4.2 0-2.9-1.8-5-4.8-5Zm-1.6 14.6h3.2V20h-3.2Z" />
  </svg>
);

const CerebrasMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M12 3 3 8v8l9 5 9-5V8z" opacity=".25" />
    <path d="M12 6.5 6.5 9.3v5.4L12 17.5l5.5-2.8V9.3z" />
  </svg>
);

const MistralMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M19 4h-4l-3 5-3-5H5v16h4V9l3 5 3-5v11h4V4z" />
  </svg>
);

const LocalLLMMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M9 9h6v6H9z" fill={color} fillOpacity="0.2" />
    <path d="M9 1H9v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
  </svg>
);

// Deterministic 2-letter monogram for providers without a real mark —
// distinct per provider (zhipu → Zh, sambanova → Sa, baseten → Ba …),
// tinted in the provider's brand colour.
const Monogram: React.FC<{ id: string; size: number; color: string }> = ({ id, size, color }) => {
  const letters = (id || '?').replace(/[^a-z0-9]/gi, '').slice(0, 2);
  const text = letters
    ? letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase()
    : '?';
  return (
    <span style={{ color, fontWeight: 800, fontSize: size * 0.42, lineHeight: 1, letterSpacing: '-0.02em' }} className="select-none">
      {text}
    </span>
  );
};

function resolveIcon(id: string): { node: React.ReactElement; color: string } {
  const color = BRAND[id] ?? '#a855f7';
  const map: Record<string, React.ReactElement> = {
    openai: <OpenAIMark size={0} color={color} />,
    opencode: <OpenCodeMark size={0} color={color} />,
    groq: <GroqMark size={0} color={color} />,
    cerebras: <CerebrasMark size={0} color={color} />,
    mistral: <MistralMark size={0} color={color} />,
    local: <LocalLLMMark size={0} color={color} />,
    'local-llm': <LocalLLMMark size={0} color={color} />,
    'local_llm': <LocalLLMMark size={0} color={color} />,
  };
  const node = map[id];
  if (node) return { node, color };
  if (SIMPLE_ICON_MAP[id]) return { node: <SimpleIcon id={id} size={0} color={color} />, color };
  // No real mark — a distinct 2-letter monogram beats an empty box.
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
