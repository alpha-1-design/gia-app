import { useProviderStore, ProviderType, ModelOption } from '../../store/useProviderStore';
import { useGiaStore } from '../../store/useGiaStore';
import { getProviderCapabilities } from '../providers/capabilities';
import { providerRegistry } from '../ProviderRegistry';

import type { BrainRequest } from '../providers/types';

export function isVisionCapable(model: string, provider: string): boolean {
  const listingType = providerRegistry.getListingType(provider);
  return getProviderCapabilities(listingType, model).vision;
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

  // The user's chosen model isn't in the (dynamically fetched) list. Trust the
  // user's explicit selection instead of treating it as "unavailable" and
  // silently switching on every message — the fetched list can be incomplete,
  // stale, or formatted differently, and the model is usually perfectly valid.
  if (!userCfg) return { model: userModel, switched: false };

  // Only auto-switch when the model genuinely lacks a capability this request
  // needs (vision) and a capable alternative exists.
  if (needsVision && !userCfg.vision) {
    const best = toolCapable
      .filter((m: ModelOption) => m.vision)
      .sort((a: ModelOption, b: ModelOption) => (b.free ? 1 : 0) - (a.free ? 1 : 0))[0];
    if (best) {
      return {
        model: best.id,
        switched: true,
        previousModel: userCfg.id,
        reason: `${userCfg.label} can't see images — using ${best.label}`,
      };
    }
  }

  return { model: userModel, switched: false };
}

export async function buildMessages(req: BrainRequest): Promise<{ role: string; content: unknown }[]> {
  const { activeProvider, providers } = useProviderStore.getState();
  const config = providers[activeProvider];
  const msgs: { role: string; content: unknown }[] = [];
  if (req.history) msgs.push(...req.history);

  if (req.images && req.images.length > 0) {
    if (req.localVision) {
      useGiaStore.getState().addNotification(`🧠 Analyzing ${req.images.length} image(s) with local vision...`);
      const parts: string[] = [];
      for (const img of req.images) {
        try {
          const { default: visionService } = await import('../VisionService');
          const analysis = await visionService.analyze(img.data);
          const imgParts: string[] = [];
          if (analysis.caption?.description) imgParts.push(`Caption: ${analysis.caption.description}`);
          if (analysis.ocr?.text) imgParts.push(`OCR Text: "${analysis.ocr.text}"`);
          if (analysis.objects && analysis.objects.objects.length > 0) {
            const objList = analysis.objects.objects.map(o => `${o.label} (${Math.round(o.score * 100)}%)`).join(', ');
            imgParts.push(`Detected objects: ${objList}`);
          }
          if (analysis.classification?.label) imgParts.push(`Classification: ${analysis.classification.label} (${Math.round(analysis.classification.score * 100)}%)`);
          parts.push(`[${img.name}]: ${imgParts.join('; ')}`);
        } catch {
          parts.push(`[${img.name}]: (local vision failed)`);
        }
      }
      const descText = parts.length > 0
        ? `\n\n[Local Vision Analysis of attached image(s):\n${parts.join('\n')}]\n\n`
        : '';
      const content = `${descText}USER: ${req.prompt}`;
      msgs.push({ role: 'user', content });
    } else if (isVisionCapable(config.model, activeProvider)) {
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
      const content = `[Image attached: ${names}]\n(System: ${config.model} cannot process images directly. Enable local on-device vision analysis in tools.)\n\nUSER: ${req.prompt}`;
      msgs.push({ role: 'user', content });
      useGiaStore.getState().addNotification(`⚠️ ${config.model} cannot see images — enable local on-device vision in tools`);
    }
  } else {
    msgs.push({ role: 'user', content: req.prompt });
  }
  return msgs;
}
