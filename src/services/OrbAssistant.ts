import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

import { logger } from '../utils/logger';
import { GIAScreenAgent, type ScreenCaptureResult } from './GIAScreenAgent';
import ProviderService from './ProviderService';
import visionService from './VisionService';
import VisionRouter from './vision/VisionRouter';
import whisperService from './WhisperService';
import { cloudTranscribe, isCloudSTTConfigured } from './CloudSTT';
import { isVisionCapable, selectBestModel } from './brain/modelUtils';
import { useProviderStore } from '../store/useProviderStore';
import { executeOrbAction } from './OrbControlActions';

import type { BrainRequest } from './providers/types';
import type { PluginListenerHandle } from '@capacitor/core';

/**
 * OrbAssistant — the mini-brain behind the floating Android orb.
 *
 * Flow (fully in the background; the app never opens):
 *   1. Native orb captures a screenshot and emits `orbitAnalyze` with a
 *      cache-relative PNG path.
 *   2. We read it, run a local on-device caption IF the caption model is
 *      already downloaded (never force-download ~340 MB), and stream the
 *      screen image (for vision-capable providers) + screen text through
 *      `ProviderService.callProvider` directly (bypassing GiaBrain's tool
 *      loop and protocol-approval gate, which cannot render in the
 *      background).
 *   3. Live deltas stream back into the orb HUD via `orbResponse`. Native
 *      TTS speaks the final summary.
 *   4. If the model emits `[orb_act]{...}[/orb_act]` blocks, we execute them
 *      (tap / tap_text / scroll / open_app / go_back / send_photo), then
 *      re-capture to verify and loop — an observe → act → verify loop capped
 *      at a few steps.
 */
interface OrbAnalyzeEvent {
  path?: string;
  timestamp?: number;
}

interface OrbVoiceEvent {
  path?: string;
  timestamp?: number;
  durationMs?: number;
}

interface OrbSessionOptions {
  /** Cache-relative screenshot path (screen analyze sessions). */
  screenshotPath?: string | null;
  /** Spoken user prompt (voice sessions — transcribed on-device). */
  voicePrompt?: string | null;
}

const MAX_ORB_STEPS = 4;
const MAX_SCREEN_TEXT = 1500;

function stripActionBlocks(text: string): string {
  return text.replace(/\[orb_act\][\s\S]*?\[\/orb_act\]/g, '').trim();
}

function parseOrbActs(text: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const regex = /\[orb_act\]\s*(\{[\s\S]*?\})\s*\[\/orb_act\]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      if (typeof parsed === 'object' && parsed !== null) out.push(parsed);
    } catch {
      // skip malformed blocks
    }
  }
  return out;
}

function elementsToText(content: ScreenCaptureResult): string {
  const parts: string[] = [];
  if (content.elements && content.elements.length > 0) {
    for (const el of content.elements) {
      const bits = [el.text, el.contentDescription].filter((b): b is string => !!b);
      if (bits.length) parts.push(bits.join(' '));
    }
  }
  if (parts.length === 0 && content.text) parts.push(content.text);
  return parts.join(' · ').slice(0, MAX_SCREEN_TEXT);
}

function buildOrbSystemPrompt(
  caption: string,
  screenText: string,
  actionsDone: string[],
  includeImage: boolean,
): string {
  const done = actionsDone.length > 0
    ? `\nYou already did on this screen: ${actionsDone.join(', ')}.`
    : '';
  const visionLine = caption
    ? `\nCAPTION (on-device vision): ${caption}`
    : includeImage
      ? `\nCAPTION: (attached — the provider is looking at the screen screenshot)`
      : '\nCAPTION: (not captured this round)';
  return [
    'You are the floating GIA Orb — a screen-aware companion living on this phone\'s screen.',
    'You can SEE the user\'s screen AND control this phone. Respond in short, warm, human lines that stream live into a HUD beside the orb.',
    '',
    `SCREEN TEXT: ${screenText ? screenText : '(none detected)'}`,
    visionLine,
    done,
    '',
    'If the screen needs an action, emit EXACTLY ONE block structured as:',
    '[orb_act]{"action":"tap_text","text":"Search"}[/orb_act]',
    'or without acting — just describe the screen. Do NOT wrap JSON in code fences.',
    '',
    'Available actions (JSON inside [orb_act]...[/orb_act]):',
    '- {"action":"tap","x":123,"y":456}  tap at integer pixel coordinates',
    '- {"action":"tap_text","text":"<visible text>"}  tap the element containing that text (PREFER this over coordinates)',
    '- {"action":"scroll","direction":"up|down|left|right"}',
    '- {"action":"open_app","app":"YouTube"}  open an app by name or package id',
    '- {"action":"go_back"}   system back button',
    '- {"action":"send_photo","caption":"<why>"}  show the user the screen capture as a picture',
    '',
    'Rules: at most one orb_act per message. Prefer tap_text; only guess coordinates when nothing else works. After acting, say in one short line what you did. End your turn with a 1-2 line summary of what is on the screen now.',
  ].join('\n');
}

class OrbAssistant {
  private active = false;
  private handle: PluginListenerHandle | null = null;
  private voiceHandle: PluginListenerHandle | null = null;
  private sessionAbort: AbortController | null = null;

  async start(): Promise<void> {
    if (this.active) return;
    if (!Capacitor.isNativePlatform()) return;

    try {
      this.handle = await GIAScreenAgent.addListener('orbitAnalyze', (e) => {
        const event = e as unknown as OrbAnalyzeEvent;
        void this.runSession({ screenshotPath: event.path });
      });
      this.voiceHandle = await GIAScreenAgent.addListener('orbitVoice', (e) => {
        const event = e as unknown as OrbVoiceEvent;
        void this.handleVoice(event);
      });
      this.active = true;
      logger.log('[OrbAssistant] listening for orb captures + voice');
    } catch (err) {
      logger.warn('[OrbAssistant] native orb bridge unavailable:', err);
      this.active = false;
    }
  }

  async stop(): Promise<void> {
    this.active = false;
    this.sessionAbort?.abort();
    this.sessionAbort = null;
    for (const h of [this.handle, this.voiceHandle]) {
      if (h) {
        try { await h.remove(); } catch { /* noop */ }
      }
    }
    this.handle = null;
    this.voiceHandle = null;
  }

  private async runSession(opts: OrbSessionOptions): Promise<void> {
    this.sessionAbort?.abort();
    const abort = new AbortController();
    this.sessionAbort = abort;

    try {
      const screenshotPath = opts.screenshotPath ?? null;
      const voicePrompt = opts.voicePrompt ?? null;
      const imageOnFirst = !voicePrompt && screenshotPath !== null;

      let screenText = await this.readScreenText();
      let actionsDone: string[] = [];
      let summary = '';

      for (let step = 0; step < MAX_ORB_STEPS; step++) {
        if (abort.signal.aborted) break;
        const includeImage = imageOnFirst && step === 0;
        const turnPath = includeImage ? screenshotPath : null;

        const caption = includeImage && screenshotPath
          ? await this.localCaption(screenshotPath)
          : '';
        const collected = await this.streamTurn(
          abort.signal,
          turnPath,
          includeImage,
          caption,
          screenText,
          actionsDone,
          voicePrompt,
        );
        summary = stripActionBlocks(collected);

        const acts = parseOrbActs(collected);
        if (acts.length === 0) break;

        const beforeCount = actionsDone.length;
        for (const act of acts) {
          if (abort.signal.aborted) break;
          const msg = await executeOrbAction(act, screenshotPath ?? undefined);
          if (msg) {
            actionsDone = [...actionsDone, msg];
            void GIAScreenAgent.orbResponse({ delta: `\n✔ ${msg}`, done: false });
          }
        }
        if (actionsDone.length === beforeCount) break;

        // observe → verify: re-capture the screen after acting
        const next = await GIAScreenAgent.capture().catch(() => null);
        if (!next) break;
        screenText = elementsToText(next);
      }

      void GIAScreenAgent.orbResponse({
        delta: '',
        done: true,
        final: summary.trim() || 'Done.',
      });
    } catch (err) {
      if (abort.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[OrbAssistant] session error:', message);
      await this.fail(message);
    } finally {
      if (this.sessionAbort === abort) this.sessionAbort = null;
    }
  }

  /** Voice session: transcribe the native clip on-device, then run the orb brain. */
  private async handleVoice(event: OrbVoiceEvent): Promise<void> {
    try {
      if (!event?.path) {
        await this.fail('No voice clip received.');
        return;
      }
      const transcript = await this.transcribeOrbAudio(event.path);
      if (!transcript) {
        await this.fail("I didn't catch that — could you try again?");
        return;
      }
      void GIAScreenAgent.orbResponse({ delta: `You: ${transcript}\n`, done: false });
      await this.runSession({ screenshotPath: null, voicePrompt: transcript });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[OrbAssistant] voice session error:', message);
      await this.fail(message);
    }
  }

  /** Orb voice STT: on-device Whisper when loaded, else the configured cloud fallback. */
  private async transcribeOrbAudio(path: string): Promise<string> {
    const b64 = await this.readCapture(path);
    const bytes = this.base64ToBytes(b64);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/mp4' });

    if (whisperService.isReady) {
      try {
        const text = await whisperService.transcribe(blob);
        if (text) return text;
      } catch (err) {
        logger.warn('[OrbAssistant] on-device Whisper failed, falling back to cloud:', err);
        if (!isCloudSTTConfigured()) {
          throw new Error(`On-device Whisper failed to transcribe (${err instanceof Error ? err.message : String(err)}), and no Cloud STT fallback is configured.`);
        }
      }
    } else if (!isCloudSTTConfigured()) {
      throw new Error('No speech-to-text ready. Open GIA once → Settings → Voice and either download On-Device Whisper (~50MB, offline) or enable the Orb Cloud STT fallback — your voice clip is sent to the provider when the cloud option is used.');
    }

    const text = await cloudTranscribe(blob);
    if (!text) throw new Error("I heard something but couldn't make it out — try again.");
    return text;
  }

  private base64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  private async streamTurn(
    signal: AbortSignal,
    screenshotPath: string | null,
    includeImage: boolean,
    caption: string,
    screenText: string,
    actionsDone: string[],
    voicePrompt?: string | null,
  ): Promise<string> {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];
    if (!config || !config.apiKey || config.apiKey.trim().length === 0) {
      throw new Error('No AI provider configured. Open GIA → Settings → AI Provider, add a key, then tap the orb again.');
    }

    const selection = selectBestModel(activeProvider, config.model || '', includeImage);

    const req: BrainRequest = {
      systemPrompt: buildOrbSystemPrompt(caption, screenText, actionsDone, includeImage),
      systemPromptMode: 'replace',
      prompt: voicePrompt
        ? `The user just spoke to you: "${voicePrompt}"

Answer them in short, warm, human lines that stream into the HUD. You may do ONE orb_act block if acting on the screen is needed to answer, then say what you did.`
        : includeImage
          ? 'Here is the current screen. Look at it and tell me what is on it. You may act in one orb_act block if the screen needs an action.'
          : 'You just acted on the screen. Here is the new screen text. Continue with any further action, or give your final short summary.',
      maxTokens: 640,
      temperature: 0.6,
      modelOverride: selection.model,
      signal,
    };

    const canSendImages = activeProvider !== 'local-llm';
    if (includeImage && canSendImages && screenshotPath) {
      const b64 = await this.readCapture(screenshotPath);
      req.images = [{ name: 'screen', type: 'image/png', data: b64 }];

      // buildMessages() gates image content on the CURRENT config model, not
      // modelOverride. If we auto-switched to a vision model, also inject the
      // image directly via history (openai+anthropic adapters both map this
      // shape; gemini reads req.images natively).
      const switchedForVision = !isVisionCapable(config.model, activeProvider) && selection.switched;
      if (activeProvider !== 'gemini' && switchedForVision) {
        req.history = [{
          role: 'user',
          content: [
            { type: 'text', text: 'Screen capture from the orb.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}`, detail: 'auto' } },
          ],
        } as unknown as NonNullable<BrainRequest['history']>[number]];
      }
    }

    let full = '';
    let cleanForwarded = 0;
    let clean = '';
    req.onStream = (chunk: string) => {
      full += chunk;
      const c = stripActionBlocks(full);
      if (c.length > cleanForwarded) {
        void GIAScreenAgent.orbResponse({ delta: c.slice(cleanForwarded), done: false });
        cleanForwarded = c.length;
      }
      clean = c;
    };

    await GIAScreenAgent.orbResponse({ delta: 'Thinking…\n', done: false });
    await ProviderService.callProvider(req, activeProvider);
    return stripActionBlocks(full) || clean;
  }

  private async readScreenText(): Promise<string> {
    try {
      const content = await GIAScreenAgent.getScreenContent();
      return elementsToText(content);
    } catch {
      return '';
    }
  }

  /** Best-effort local caption. Never triggers a model download. */
  private async localCaption(screenshotPath: string): Promise<string> {
    try {
      if (!visionService.isCaptionReady()) return '';
      const b64 = await this.readCapture(screenshotPath);
      const dataUrl = `data:image/png;base64,${b64}`;
      const r = await VisionRouter.processImage(dataUrl, 'caption');
      return typeof r.result === 'string' ? r.result : JSON.stringify(r.result);
    } catch {
      return '';
    }
  }

  private async readCapture(path: string): Promise<string> {
    const r = await Filesystem.readFile({ path, directory: Directory.Cache })
      .catch(() => Filesystem.readFile({ path }));
    const data = r.data;
    if (typeof data === 'string') return data;
    // Capacitor may return a File/Blob on some platforms — convert to base64.
    const bytes = new Uint8Array(await data.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  private async fail(message: string): Promise<void> {
    try {
      await GIAScreenAgent.orbResponse({ delta: '', done: true, final: `⚠️ ${message}` });
    } catch { /* noop */ }
  }
}

export default new OrbAssistant();