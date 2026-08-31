import { isRateLimitOrQuotaError, isRetryableServerError, saveCheckpoint, clearCheckpoint } from './brain/ResilientRelay';
import { friendlyError } from './brain/network';
import { useGiaStore } from '../store/useGiaStore';
import { useProviderStore } from '../store/useProviderStore';
import { BrainRequest } from './providers/types';
import ProviderService from './ProviderService';
import ProviderMonitor from './ProviderMonitor';

class ErrorHandlingService {
  async handleErrors(e: unknown, req: BrainRequest, effectiveProvider: string, finalModel: string, callStart: number, carryOverText: string, iterations: number, history: { role: string; content: string | { type: string; text?: string; source?: { type: string; data: string } }[] }[]) {
    const origError = e as Error;
    const msg = e instanceof Error ? e.message.toLowerCase() : '';
    ProviderMonitor.recordFailure(effectiveProvider, finalModel, msg, Math.round(performance.now() - callStart));

    if (req.checkpointKey) {
      saveCheckpoint({
        key: req.checkpointKey,
        sessionId: req.checkpointKey.split(':')[0],
        messageId: req.checkpointKey.split(':')[1],
        originalPrompt: req.prompt,
        accumulatedText: carryOverText,
        history: history as { role: string; content: string }[],
        failedProvider: effectiveProvider,
        failedModel: finalModel,
        reason: msg,
        attempt: iterations,
        savedAt: Date.now(),
      });
    }

    const rateLimited = isRateLimitOrQuotaError(msg) || isRetryableServerError(msg);

    if (rateLimited && useGiaStore.getState().smartFallback !== false) {
      let recovered = false;

      // Step 1: Retry the same provider up to 2 times with backoff
      for (let attempt = 1; attempt <= 2 && !recovered; attempt++) {
        const delay = 1500 * attempt;
        useGiaStore.getState().addNotification(`⚡ ${effectiveProvider} rate-limited — retrying in ${Math.round(delay / 1000)}s`);
        req.onThought?.(`Rate limit on ${effectiveProvider} — retrying...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        try {
          const res = await ProviderService.callProvider(req, effectiveProvider);
          ProviderMonitor.recordSuccess(effectiveProvider, finalModel, Math.round(performance.now() - callStart));
          recovered = true;
          if (req.checkpointKey) clearCheckpoint(req.checkpointKey);
          return { res, carryOverText: '' };
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message.toLowerCase() : '';
          ProviderMonitor.recordFailure(effectiveProvider, finalModel, retryMsg, Math.round(performance.now() - callStart));
          if (!isRateLimitOrQuotaError(retryMsg) && !isRetryableServerError(retryMsg)) break;
        }
      }

      // Step 2: If still rate-limited, fall back to another connected provider
      if (!recovered) {
        const { providers, getActiveProviders } = useProviderStore.getState();
        const allActive = getActiveProviders();
        const fallbackProviders = allActive.filter(
          (p) => p.id !== effectiveProvider && providers[p.id]?.apiKey && providers[p.id]?.enabled,
        );

        for (const fb of fallbackProviders) {
          const fbLabel = fb.config.model || fb.id;
          useGiaStore.getState().addNotification(`🔄 Falling back to ${fb.id} (${fbLabel})`);
          req.onThought?.(`Trying fallback provider: ${fb.id}...`);
          try {
            const res = await ProviderService.callProvider(req, fb.id);
            ProviderMonitor.recordSuccess(fb.id, fbLabel, Math.round(performance.now() - callStart));
            recovered = true;
            if (req.checkpointKey) clearCheckpoint(req.checkpointKey);
            useGiaStore.getState().addNotification(`✅ Recovered via ${fb.id}`);
            return { res, carryOverText: '' };
          } catch (fbErr) {
            const fbMsg = fbErr instanceof Error ? fbErr.message.toLowerCase() : '';
            ProviderMonitor.recordFailure(fb.id, fbLabel, fbMsg, Math.round(performance.now() - callStart));
            // If this provider also rate-limited, try the next one
            if (isRateLimitOrQuotaError(fbMsg) || isRetryableServerError(fbMsg)) continue;
            // Non-retryable error — stop trying
            break;
          }
        }
      }

      if (!recovered) {
        throw new Error(`${friendlyError(effectiveProvider, origError)} — no other providers available`);
      }
    } else {
      throw origError;
    }
    return { res: undefined, carryOverText };
  }
}

export default new ErrorHandlingService();
