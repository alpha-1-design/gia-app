import { useProviderStore, PROVIDER_DEFAULTS } from '../store/useProviderStore';

export interface ImageGenResult {
  url: string;
  revisedPrompt?: string;
  error?: string;
}

class ImageService {
  private static instance: ImageService;
  static getInstance() { if (!this.instance) this.instance = new ImageService(); return this.instance; }

  async generate(prompt: string): Promise<ImageGenResult> {
    const { activeProvider, providers } = useProviderStore.getState();
    
    // Default to OpenAI or OpenRouter for image generation if available
    let targetProvider = activeProvider;
    if (activeProvider !== 'openai' && activeProvider !== 'openrouter') {
      if (providers.openai.enabled) targetProvider = 'openai';
      else if (providers.openrouter.enabled) targetProvider = 'openrouter';
      else return { url: '', error: 'No image-capable provider (OpenAI/OpenRouter) connected.' };
    }

    const config = providers[targetProvider];
    const { baseUrl } = PROVIDER_DEFAULTS[targetProvider];

    try {
      const res = await fetch(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: targetProvider === 'openai' ? 'dall-e-3' : 'openai/dall-e-3',
          prompt: prompt,
          n: 1,
          size: '1024x1024',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Image API error ${res.status}`);
      }

      const data = await res.json();
      return {
        url: data.data[0].url,
        revisedPrompt: data.data[0].revised_prompt
      };
    } catch (e: any) {
      return { url: '', error: e.message };
    }
  }
}

export default ImageService.getInstance();
