import { useProviderStore } from '../store/useProviderStore';
import { providerRegistry } from './ProviderRegistry';

export interface ImageGenResult {
  url: string;
  revisedPrompt?: string;
  error?: string;
}

class ImageService {
  private static instance: ImageService;
  private lastBlobUrl: string | null = null;
  static getInstance() { if (!this.instance) this.instance = new ImageService(); return this.instance; }

  private revokeLastBlob() {
    if (this.lastBlobUrl) {
      URL.revokeObjectURL(this.lastBlobUrl);
      this.lastBlobUrl = null;
    }
  }

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
    const baseUrl = providerRegistry.getBaseUrl(targetProvider);
    if (!baseUrl) return { url: '', error: `${targetProvider} is not fully configured.` };
    const imageModel = providerRegistry.getImageModel(targetProvider);

    if (!imageModel) {
      return { url: '', error: `${providerRegistry.getLabel(targetProvider)} does not support image generation. Please switch to OpenAI or OpenRouter.` };
    }

    // HuggingFace: model-specific Inference API endpoint
    if (targetProvider === 'huggingface') {
      try {
        const hfUrl = `https://api-inference.huggingface.co/models/${imageModel}`;
        const res = await fetch(hfUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: prompt }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Image API error ${res.status}`);
        }
        const blob = await res.blob();
        this.revokeLastBlob();
        const url = URL.createObjectURL(blob);
        this.lastBlobUrl = url;
        return { url };
      } catch (e: unknown) {
        return { url: '', error: e instanceof Error ? e.message : String(e) };
      }
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
      } catch (e: unknown) {
        if (url === endpoints[endpoints.length - 1]) {
          return { url: '', error: e instanceof Error ? e.message : String(e) };
        }
      }
    }

    return { url: '', error: 'Image generation failed. Check your provider API key and model access.' };
  }
}

export default ImageService.getInstance();
