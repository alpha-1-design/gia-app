export interface ProviderCapabilities {
  tools: boolean;
  thinking: boolean;
  streaming: boolean;
  vision: boolean;
  jsonMode: boolean;
  imageGeneration: boolean;
}

export const CAPABILITY_LABELS: Record<keyof ProviderCapabilities, { label: string; icon: string }> = {
  tools: { label: 'Tools', icon: '🛠' },
  thinking: { label: 'Extended Thinking', icon: '🧠' },
  streaming: { label: 'Streaming', icon: '⚡' },
  vision: { label: 'Vision', icon: '👁' },
  jsonMode: { label: 'JSON Mode', icon: '📋' },
  imageGeneration: { label: 'Image Gen', icon: '🎨' },
};

const VISION_MODEL_PATTERNS = [
  'vision', 'gpt-4o', 'gpt-4.1', 'claude-3', 'claude-4', 'opus',
  'gemini', 'gemma-3', 'pixtral', 'llava', '/vl', '-vl', 'vl-',
  'florence', 'cogvlm', 'qwen-vl', 'qwen2-vl',
  'llama-3.2', 'llama-4',
  'idefics', 'fuyu', 'palmyra-vision', 'minicpm',
  'glm-4v', 'internvl', 'deepseek-vl', 'phi-3-vision',
  'molmo', 'dpo-vision', 'reka', 'aria',
];

const THINKING_MODEL_PATTERNS = [
  'o1', 'o3', 'o4', 'claude-3-7', 'claude-3-5', 'claude-4',
  'deepseek-r1', 'deepseek-v4',
];

function modelMatches(model: string, patterns: string[]): boolean {
  const m = model.toLowerCase();
  return patterns.some(p => m.includes(p));
}

export function getProviderCapabilities(
  listingType: string,
  model: string,
  staticVision?: boolean,
  staticTools?: boolean,
): ProviderCapabilities {
  const lt = listingType.toLowerCase();

  switch (lt) {
    case 'anthropic':
      return {
        tools: true,
        thinking: modelMatches(model, THINKING_MODEL_PATTERNS),
        streaming: true,
        vision: staticVision ?? modelMatches(model, VISION_MODEL_PATTERNS),
        jsonMode: false,
        imageGeneration: false,
      };

    case 'gemini':
      return {
        tools: true,
        thinking: false,
        streaming: true,
        vision: true,
        jsonMode: false,
        imageGeneration: false,
      };

    case 'ollama':
      return {
        tools: staticTools ?? modelMatches(model, ['llama', 'qwen', 'mistral', 'gemma', 'phi']),
        thinking: false,
        streaming: true,
        vision: staticVision ?? modelMatches(model, VISION_MODEL_PATTERNS),
        jsonMode: false,
        imageGeneration: false,
      };

    case 'huggingface':
      return {
        tools: false,
        thinking: false,
        streaming: true,
        vision: staticVision ?? modelMatches(model, VISION_MODEL_PATTERNS),
        jsonMode: false,
        imageGeneration: false,
      };

    default:
      return {
        tools: staticTools ?? true,
        thinking: modelMatches(model, THINKING_MODEL_PATTERNS),
        streaming: true,
        vision: staticVision ?? modelMatches(model, VISION_MODEL_PATTERNS),
        jsonMode: !lt.includes('anthropic') && !lt.includes('gemini'),
        imageGeneration: false,
      };
  }
}

export function getProviderDisplayName(listingType: string): string {
  const map: Record<string, string> = {
    openai: 'OpenAI-compatible',
    anthropic: 'Anthropic',
    gemini: 'Google Gemini',
    ollama: 'Ollama (Local)',
    huggingface: 'HuggingFace',
    none: 'Custom',
  };
  return map[listingType.toLowerCase()] || listingType;
}
