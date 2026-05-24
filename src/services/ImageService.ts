import { useProviderStore, PROVIDER_DEFAULTS } from '../store/useProviderStore';
import { isNativePlatform } from '../utils/helpers';

export interface ImageGenResult {
  url: string;
  revisedPrompt?: string;
  error?: string;
}

// Known image generation models per provider
const IMAGE_MODELS: Record<string, string> = {
  openai: 'dall-e-3',
  openrouter: 'openai/dall-e-3',
  anthropic: '',
  gemini: '',
  groq: '',
  opencode: '',
  deepseek: '',
  cerebras: '',
  mistral: '',
};

const isNative = isNativePlatform();

class ImageService {
  private static instance: ImageService;
  static getInstance() { if (!this.instance) this.instance = new ImageService(); return this.instance; }

  async generate(prompt: string): Promise<ImageGenResult> {
    const { activeProvider, providers } = useProviderStore.getState();

    // Determine best image-capable provider
    let targetProvider = activeProvider;
    if (!IMAGE_MODELS[activeProvider] || !providers[activeProvider]?.enabled) {
      if (providers.openrouter?.enabled) targetProvider = 'openrouter';
      else if (providers.openai?.enabled) targetProvider = 'openai';
      else return { url: '', error: 'No image-capable provider connected. GIA needs OpenAI (DALL-E 3) or OpenRouter with a compatible image model configured in Engine Room.' };
    }

    const config = providers[targetProvider];
    const targetDefaults = PROVIDER_DEFAULTS[targetProvider];
    if (!targetDefaults) return { url: '', error: `${targetProvider} is not fully configured.` };
    const { baseUrl } = targetDefaults
    const imageModel = IMAGE_MODELS[targetProvider];

    if (!imageModel) {
      return { url: '', error: `${PROVIDER_DEFAULTS[targetProvider]?.label || targetProvider} does not support image generation. Please switch to OpenAI or OpenRouter.` };
    }

    // Try OpenAI-compatible /images/generations endpoint
    const endpoints = [
      `${baseUrl}/images/generations`,
      `${baseUrl.replace(/\/v1$/, '')}/v1/images/generations`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: imageModel,
            prompt: prompt,
            n: 1,
            size: '1024x1024',
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 404 && url !== endpoints[endpoints.length - 1]) continue;
          throw new Error(err.error?.message || `Image API error ${res.status}`);
        }

        const data = await res.json();
        return {
          url: data.data[0].url,
          revisedPrompt: data.data[0].revised_prompt
        };
      } catch (e: any) {
        if (url === endpoints[endpoints.length - 1]) {
          return { url: '', error: e.message };
        }
      }
    }

    return { url: '', error: 'Image generation failed. Check your provider API key and model access.' };
  }
}

export default ImageService.getInstance();
