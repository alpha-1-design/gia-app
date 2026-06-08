import { useProviderStore, ProviderType, ModelOption } from '../../store/useProviderStore';
import { useGiaStore } from '../../store/useGiaStore';

import type { BrainRequest } from '../providers/types';

export function isVisionCapable(model: string, provider: string): boolean {
  const m = model.toLowerCase();
  const p = provider.toLowerCase();

  if (p === 'openai') {
    if (m.includes('gpt-4o') || m.includes('gpt-4.1') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return true;
    return false;
  }

  if (p === 'anthropic') {
    return m.includes('claude');
  }

  if (p === 'gemini') {
    return true;
  }

  if (p === 'groq') {
    return m.includes('llama-3.2-11b') || m.includes('llama-3.2-90b') || m.includes('llama-4') || m.includes('vision');
  }

  if (p === 'huggingface') {
    return m.includes('vision') || m.includes('pixtral') || m.includes('llava') || m.includes('vl') || m.includes('multimodal');
  }

  const visionPatterns = [
    'vision', 'gpt-4o', 'gpt-4.1', 'claude-3', 'claude-4', 'opus',
    'gemini', 'gemma-3', 'pixtral', 'llava', '/vl', '-vl', 'vl-',
    'florence', 'cogvlm', 'qwen-vl', 'qwen2-vl',
    'llama-3.2', 'llama-4',
    'idefics', 'fuyu', 'palmyra-vision', 'minicpm',
    'glm-4v', 'internvl', 'deepseek-vl', 'phi-3-vision',
    'molmo', 'dpo-vision', 'reka', 'aria',
  ];
  return visionPatterns.some(pattern => m.includes(pattern));
}

export function selectBestModel(
  provider: ProviderType,
  userModel: string,
  needsVision: boolean,
): { model: string; switched: boolean; previousModel?: string; reason?: string } {
  const { availableModels } = useProviderStore.getState();
  const models = availableModels[provider] || [];

  const toolCapable: ModelOption[] = models.filter((m: ModelOption) => m.tools !== false);
  if (!toolCapable.length) return { model: userModel, switched: false };

  const userCfg = toolCapable.find((m: ModelOption) => m.id === userModel);

  if (userCfg) {
    const missing: string[] = [];
    if (needsVision && !userCfg.vision) missing.push('vision');
    if (!missing.length) return { model: userModel, switched: false };
  }

  const best: ModelOption | undefined = toolCapable
    .filter((m: ModelOption) => m.free && (!needsVision || m.vision))
    .sort((a: ModelOption, b: ModelOption) => ((b.context?.length || 0) - (a.context?.length || 0)))[0]
    || toolCapable
      .filter((m: ModelOption) => !needsVision || m.vision)
      .sort((a: ModelOption, b: ModelOption) => (b.free ? 1 : 0) - (a.free ? 1 : 0))[0];

  if (best && best.id !== userModel) {
    return {
      model: best.id,
      switched: true,
      previousModel: userCfg?.id || userModel,
      reason: userCfg ? `${userCfg.label} can't ${needsVision ? 'see images' : 'use tools'} — using ${best.label}` : `${userModel} unavailable`,
    };
  }

  return { model: userCfg?.id || userModel, switched: false };
}

export async function buildMessages(req: BrainRequest): Promise<{ role: string; content: unknown }[]> {
  const { activeProvider, providers } = useProviderStore.getState();
  const config = providers[activeProvider];
  const msgs: { role: string; content: unknown }[] = [];
  if (req.history) msgs.push(...req.history);

  if (req.images && req.images.length > 0) {
    if (isVisionCapable(config.model, activeProvider)) {
      const content: { type: string; text?: string; image_url?: { url: string; detail: string } }[] = [{ type: 'text', text: req.prompt }];
      req.images.forEach(img => {
        const dataUrl = img.data.startsWith('data:') ? img.data : `data:${img.type};base64,${img.data}`;
        content.push({
          type: 'image_url',
          image_url: { url: dataUrl, detail: 'auto' }
        });
      });
      msgs.push({ role: 'user', content });
    } else {
      const names = req.images.map(i => i.name).join(', ');
      const content = `[Image attached: ${names}]\n(System: Model ${config.model} lacks native vision. Analyzing via metadata fallback...)\n\nUSER: ${req.prompt}`;
      msgs.push({ role: 'user', content });
      useGiaStore.getState().addNotification(`⚠️ ${config.model} can't see images. Image "${names}" was passed as filename text only.`);
    }
  } else {
    msgs.push({ role: 'user', content: req.prompt });
  }
  return msgs;
}
