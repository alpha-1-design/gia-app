import { isRateLimitOrQuotaError, isRetryableServerError, isAuthError, isModelNotFoundError, isRecoverableError, pickFallbackModel, backoffDelay, saveCheckpoint, clearCheckpoint } from './brain/ResilientRelay';
import { friendlyError } from './brain/network';
import { useGiaStore } from '../store/useGiaStore';
import { useProviderStore } from '../store/useProviderStore';
import { BrainRequest, BrainResponse } from './providers/types';
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

    // Broadened from "rate-limit/5xx only" to almost any provider-side or
    // transport failure -- an invalid key, a renamed/deprecated model, a
    // network blip, or a context-length overflow all used to just fail the
    // whole generation outright even with other providers sitting connected
    // and ready. Only our own input-guardrail rejections are excluded, since
    // those would fail identically everywhere.
    const recoverable = isRecoverableError(msg);
    // Same-provider retry only makes sense for transient failures. Retrying
    // the identical provider+model against an invalid key or a model that
    // doesn't exist can't ever succeed -- go straight to a fallback model/provider.
    const sameProviderRetryable = isRateLimitOrQuotaError(msg) || isRetryableServerError(msg);

    if (recoverable && useGiaStore.getState().smartFallback !== false) {
      let recovered = false;
      let res: BrainResponse | undefined;

      // Step 1: Retry the same provider+model a couple times with backoff,
      // but only for genuinely transient errors (rate limit / 5xx).
      if (sameProviderRetryable) {
        for (let attempt = 1; attempt <= 2 && !recovered; attempt++) {
          const delay = backoffDelay(attempt);
          useGiaStore.getState().addNotification(`⚡ ${effectiveProvider} rate-limited — retrying in ${Math.round(delay / 1000)}s`);
          req.onThought?.(`Rate limit on ${effectiveProvider} — retrying...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          try {
            res = await ProviderService.callProvider(req, effectiveProvider);
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
      }

      // Step 2: Try a different model on the SAME provider before jumping
      // providers entirely -- e.g. a key that unlocks several models. Skipped
      // for auth errors, which affect the whole key/account, not one model.
      const triedModels = [finalModel];
      if (!recovered && !isAuthError(msg)) {
        let fbModel = pickFallbackModel(effectiveProvider, finalModel, triedModels);
        while (fbModel && !recovered) {
          triedModels.push(fbModel);
          useGiaStore.getState().addNotification(`🔄 Trying ${effectiveProvider}/${fbModel}`);
          req.onThought?.(`Trying fallback model: ${effectiveProvider}/${fbModel}...`);
          try {
            res = await ProviderService.callProvider({ ...req, modelOverride: fbModel }, effectiveProvider);
            ProviderMonitor.recordSuccess(effectiveProvider, fbModel, Math.round(performance.now() - callStart));
            recovered = true;
            if (req.checkpointKey) clearCheckpoint(req.checkpointKey);
            useGiaStore.getState().addNotification(`✅ Recovered via ${effectiveProvider}/${fbModel}`);
            return { res, carryOverText: '' };
          } catch (fbErr) {
            const fbMsg = fbErr instanceof Error ? fbErr.message.toLowerCase() : '';
            ProviderMonitor.recordFailure(effectiveProvider, fbModel, fbMsg, Math.round(performance.now() - callStart));
            if (!isRecoverableError(fbMsg) || isAuthError(fbMsg) || isModelNotFoundError(fbMsg)) break;
            fbModel = pickFallbackModel(effectiveProvider, finalModel, triedModels);
          }
        }
      }

      // Step 3: Fall back to another connected provider entirely, trying the
      // healthiest one first instead of whatever order it happens to appear
      // in the config.
      if (!recovered) {
        const { providers, getActiveProviders } = useProviderStore.getState();
        const allActive = getActiveProviders();
        const statusRank = (s: string) => (s === 'healthy' ? 0 : s === 'degraded' ? 1 : 2);
        const fallbackProviders = allActive
          .filter((p) => p.id !== effectiveProvider && providers[p.id]?.apiKey && providers[p.id]?.enabled)
          .sort((a, b) => statusRank(ProviderMonitor.getHealth(a.id, a.config.model).status) - statusRank(ProviderMonitor.getHealth(b.id, b.config.model).status));

        for (const fb of fallbackProviders) {
          const fbLabel = fb.config.model || fb.id;
          useGiaStore.getState().addNotification(`🔄 Falling back to ${fb.id} (${fbLabel})`);
          req.onThought?.(`Trying fallback provider: ${fb.id}...`);
          try {
            res = await ProviderService.callProvider(req, fb.id);
            ProviderMonitor.recordSuccess(fb.id, fbLabel, Math.round(performance.now() - callStart));
            recovered = true;
            if (req.checkpointKey) clearCheckpoint(req.checkpointKey);
            useGiaStore.getState().addNotification(`✅ Recovered via ${fb.id}`);
            return { res, carryOverText: '' };
          } catch (fbErr) {
            const fbMsg = fbErr instanceof Error ? fbErr.message.toLowerCase() : '';
            ProviderMonitor.recordFailure(fb.id, fbLabel, fbMsg, Math.round(performance.now() - callStart));
            // If this provider also failed for a recoverable reason, try the next one
            if (isRecoverableError(fbMsg)) continue;
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
