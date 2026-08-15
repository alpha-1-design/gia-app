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
  'vision', 'gpt-4o', 'gpt-4.1', 'claude-3', 'claude-4', 'claude-sonnet', 'opus', 'o1', 'o3',
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

// Text-to-image capable model families (OpenAI-compatible /images/generations
// endpoints, HF Inference API, etc.). Used to report Image Gen for a model
// even when no image model override is configured.
const IMAGE_MODEL_PATTERNS = [
  'gpt-image', 'dall', 'imagen', 'flux', 'sdxl', 'stable-diffusion',
  'sana', 'pixart', 'kolors', 'playground', 'deepfloyd', 'cogview',
  'nano-banana', 'aurora', 'lumina', 'seedream', 'hunyuan-image',
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
  imageModel?: string,
): ProviderCapabilities {
  const lt = listingType.toLowerCase();
  // A configured image-generation model (registry default or per-provider
  // override) means the provider can render images through GIA's tool.
  const hasImageModel = !!imageModel && imageModel.length > 0;
  const imageGeneration = hasImageModel || modelMatches(model, IMAGE_MODEL_PATTERNS);

  switch (lt) {
    case 'anthropic':
      return {
        tools: true,
        thinking: modelMatches(model, THINKING_MODEL_PATTERNS),
        streaming: true,
        vision: staticVision ?? modelMatches(model, VISION_MODEL_PATTERNS),
        jsonMode: false,
        imageGeneration,
      };

    case 'gemini':
      return {
        tools: true,
        thinking: false,
        streaming: true,
        vision: true,
        jsonMode: false,
        imageGeneration,
      };

    case 'ollama':
      return {
        tools: staticTools ?? modelMatches(model, ['llama', 'qwen', 'mistral', 'gemma', 'phi']),
        thinking: false,
        streaming: true,
        vision: staticVision ?? modelMatches(model, VISION_MODEL_PATTERNS),
        jsonMode: false,
        imageGeneration,
      };

    case 'huggingface':
      return {
        tools: false,
        thinking: false,
        streaming: true,
        vision: staticVision ?? modelMatches(model, VISION_MODEL_PATTERNS),
        jsonMode: false,
        imageGeneration,
      };

    case 'local':
      return {
        tools: true,
        thinking: false,
        streaming: true,
        vision: false,
        jsonMode: false,
        imageGeneration,
      };

    default:
      return {
        tools: staticTools ?? true,
        thinking: modelMatches(model, THINKING_MODEL_PATTERNS),
        streaming: true,
        vision: staticVision ?? modelMatches(model, VISION_MODEL_PATTERNS),
        jsonMode: !lt.includes('anthropic') && !lt.includes('gemini'),
        imageGeneration,
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
    local: 'Local On-Device',
    none: 'Custom',
  };
  return map[listingType.toLowerCase()] || listingType;
}
