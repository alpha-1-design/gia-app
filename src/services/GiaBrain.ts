import { CapacitorHttp } from '@capacitor/core';
import { useProviderStore, PROVIDER_DEFAULTS } from '../store/useProviderStore';
import { useGiaStore } from '../store/useGiaStore';
import { useMemoryStore } from '../store/useMemoryStore';
import SearchService from './SearchService';

export interface BrainRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  history?: { role: 'user' | 'assistant'; content: string | any[] }[];
  images?: { name: string; type: string; data: string }[];
  useWebSearch?: boolean;
  useExtendedThinking?: boolean;
  onStream?: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface BrainResponse { text: string; provider: string; model: string; sources?: string[] }

const buildGiaSystem = () => {
  const profile = useGiaStore.getState().userProfile;
  const memory = useMemoryStore.getState().getRelevantContext();
  const now = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
  const userName = profile.name ? profile.name : 'the user';
  const userContext = profile.name
    ? `\n\nUser context:\n- Name: ${profile.name}${profile.bio ? `\n- About: ${profile.bio}` : ''}${profile.goals ? `\n- Goals: ${profile.goals}` : ''}`
    : '';

  return `You are GIA (Generative Interface Agent) v2.2.2.0 — a personal AI workspace assistant created by Samuel Mensah (Alpha-1 Studio, Ghana) in 2025. You are powered by whichever AI model the user has connected.

You know who you are:
- Created by Samuel Mensah, a 19-year-old self-taught developer from Kumasi, Ghana, building from an Android phone
- Built to be private-first — everything runs on-device, no backend, no data collection
- You have six modes: Chat, Analyst, Writer, Planner, Exam, Settings — accessed via the bottom nav bar
- You can read and extract content from websites when given a URL
- You can analyze images, documents, and data files
- You support web search via DuckDuckGo (toggle "Search" above the input) — no API key needed
- You have extended thinking mode (toggle "Think" above the input) — works with ALL providers, not just Anthropic
- You can execute code via the Piston API (Python, JavaScript, Java, C++, Go, Rust, and 40+ languages) — code blocks have a "Run" button with auto-fix up to 3 attempts
- You have persistent memory — you remember facts, preferences, scores, and weak areas across sessions. View/edit memories in Settings
- You can generate study materials, exam questions (WASSCE/BECE/JAMB), plans, drafts, and code
- You support voice input — tap the mic icon to speak, GIA polishes the transcript
- You can continue/retry/edit/delete/fork messages — long-press any message for options
- You have a scheduler for recurring tasks — set up in the Planner's Schedule tab
- You support file attachments (PDF, images, text, code files)
- You can export chat history, analysis data, plans, and writing drafts
- You are aware of your own capabilities and limitations — you say so clearly when you hit them
- You are warm, natural, adaptive, and intelligent — not robotic
- You proactively suggest switching modules when appropriate
- You are in control of your features — not the other way around
- When asked "what can you do" or "/help", list your capabilities conversationally
- When the user enables "Hands-off" mode, you can embed commands like [GIA:switch:analyst] or [GIA:search:on] in your response to control the app automatically — these are hidden from the user

Current time: ${now}
You are talking to: ${userName}${userContext}

Personality: Be natural, direct, insightful, and genuinely helpful. Don't be stiff or over-formal. Think like a brilliant friend who also happens to be an expert in everything. When tasks are complex, think step by step. When tasks are simple, be concise. Always use clean Markdown formatting for structure.${memory}`;
};

class GiaBrain {
  private static instance: GiaBrain;
  static getInstance() { if (!this.instance) this.instance = new GiaBrain(); return this.instance; }

  private buildMessages(req: BrainRequest) {
    const msgs: any[] = [];
    if (req.history) msgs.push(...req.history);
    
    if (req.images && req.images.length > 0) {
      const content: any[] = [{ type: 'text', text: req.prompt }];
      req.images.forEach(img => {
        content.push({
          type: 'image_url',
          image_url: { url: img.data }
        });
      });
      msgs.push({ role: 'user', content });
    } else {
      msgs.push({ role: 'user', content: req.prompt });
    }
    return msgs;
  }

  async fetchURL(url: string): Promise<string> {
    try {
      // Use CapacitorHttp to bypass CORS and avoid 3rd party proxies (Privacy First)
      const res = await CapacitorHttp.get({
        url,
        connectTimeout: 10000,
        readTimeout: 10000,
      });

      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      
      const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const title = doc.title || 'No title';
      doc.querySelectorAll('script,style,nav,footer,header,aside').forEach(el => el.remove());
      const text = doc.body?.innerText ?? doc.body?.textContent ?? '';
      const cleanText = text.replace(/\s{3,}/g, '\n\n').trim().slice(0, 10000);
      return `[Source: ${url}]\n[Title: ${title}]\n\n${cleanText}`;
    } catch (e) {
      // Fallback for browser development
      try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const title = doc.title || 'No title';
        doc.querySelectorAll('script,style,nav,footer,header,aside').forEach(el => el.remove());
        const text = doc.body?.innerText?.slice(0, 10000) ?? '';
        return `[Source: ${url}]\n[Title: ${title}]\n\n${text}`;
      } catch {
        throw new Error(`Could not fetch URL: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  private async retryFetch(url: string, options: RequestInit, retries = 1): Promise<Response> {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(30000) });
        if ((res.status === 429 || res.status >= 500) && i < retries) {
          await new Promise(r => setTimeout(r, 2000 * (i + 1)));
          continue;
        }
        return res;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
        if (i >= retries) throw e;
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
      }
    }
    throw new Error('Max retries exceeded');
  }

  private async callOpenAICompat(req: BrainRequest): Promise<BrainResponse> {
    const { providers, activeProvider } = useProviderStore.getState();
    const config = providers[activeProvider];
    const { baseUrl, label } = PROVIDER_DEFAULTS[activeProvider];

    const body: any = {
      model: config.model,
      messages: [
        { role: 'system', content: req.systemPrompt || buildGiaSystem() },
        ...this.buildMessages(req),
      ],
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
      stream: !!req.onStream,
    };

    if (req.useExtendedThinking) {
      body.temperature = undefined;
      if (req.systemPrompt) {
        body.messages[0] = { role: 'system', content: `${req.systemPrompt}\n\nThink step-by-step before answering. Show your reasoning inside  tags, then provide your final answer.` };
      }
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (activeProvider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://gia.app';
      headers['X-Title'] = 'GIA';
    }

    const res = await this.retryFetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers, body: JSON.stringify(body), signal: req.signal,
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(e?.error?.message || `${label} error ${res.status}`);
    }

    if (req.onStream && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const data = t.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) { fullText += delta; req.onStream(delta); }
          } catch { /* skip */ }
        }
      }
      return { text: fullText, provider: activeProvider, model: config.model };
    }

    const data = await res.json() as any;
    const text = data.choices?.[0]?.message?.content ?? '';
    const sources = data.choices?.[0]?.message?.annotations?.map((a: any) => a.url).filter(Boolean);
    return { text, provider: activeProvider, model: config.model, sources };
  }

  private async callAnthropic(req: BrainRequest): Promise<BrainResponse> {
    const { providers } = useProviderStore.getState();
    const config = providers.anthropic;
    const useThinking = !!req.useExtendedThinking;

    const messages = this.buildMessages(req).map(m => {
      if (Array.isArray(m.content)) {
        return {
          ...m,
          content: m.content.map((c: any) => {
            if (c.type === 'image_url') {
              const [header, base64] = c.image_url.url.split(',');
              const mediaType = header.match(/:(.*?);/)[1];
              return {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 }
              };
            }
            return c;
          })
        };
      }
      return m;
    });

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: useThinking ? 16000 : (req.maxTokens ?? 2048),
      system: req.systemPrompt || buildGiaSystem(),
      messages,
      stream: !!req.onStream,
    };
    if (!useThinking && req.temperature !== undefined) body.temperature = req.temperature;
    if (useThinking) body.thinking = { type: 'enabled', budget_tokens: 10000 };

    const res = await this.retryFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body), signal: req.signal,
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(e?.error?.message || `Anthropic error ${res.status}`);
    }

    if (req.onStream && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          try {
            const parsed = JSON.parse(t.slice(5).trim());
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              const delta = parsed.delta.text ?? '';
              fullText += delta;
              req.onStream(delta);
            }
          } catch { /* skip */ }
        }
      }
      return { text: fullText, provider: 'anthropic', model: config.model };
    }

    const data = await res.json() as any;
    const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
    return { text, provider: 'anthropic', model: config.model };
  }

  private cachePrefix = 'gia-cache-';

  private getCachedResponse(prompt: string): string | null {
    try {
      const key = this.cachePrefix + this.hashString(prompt);
      return localStorage.getItem(key);
    } catch { return null; }
  }

  private setCachedResponse(prompt: string, response: string) {
    try {
      const key = this.cachePrefix + this.hashString(prompt);
      localStorage.setItem(key, response);
      // Keep cache bounded — remove old entries if over 50
      const keys = Object.keys(localStorage).filter(k => k.startsWith(this.cachePrefix));
      if (keys.length > 50) {
        keys.sort().slice(0, keys.length - 50).forEach(k => localStorage.removeItem(k));
      }
    } catch {}
  }

  private hashString(s: string): string {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const chr = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  async generate(req: BrainRequest): Promise<BrainResponse> {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];

    if (!config.enabled || !config.apiKey) {
      throw new Error('No provider connected. Go to Settings → Engine Room and type: connect');
    }

    if (req.useWebSearch) {
      const searchContext = await SearchService.searchAndFormat(req.prompt);
      if (searchContext) {
        req = { ...req, prompt: `${req.prompt}\n\n${searchContext}` };
      }
    }

    const urlMatch = req.prompt.match(/https?:\/\/[^\s]+/);
    if (urlMatch && !req.useWebSearch) {
      try {
        const pageText = await this.fetchURL(urlMatch[0]);
        req = { ...req, prompt: `${req.prompt}\n\n[Fetched content from ${urlMatch[0]}]:\n${pageText}` };
      } catch { /* silently fall through */ }
    }

    let response: BrainResponse;
    try {
      response = activeProvider === 'anthropic' ? await this.callAnthropic(req) : await this.callOpenAICompat(req);
    } catch (e) {
      const cacheKey = 'gen:' + req.prompt.slice(0, 200);
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        return { text: cached + '\n\n*(Offline — retrieved from local cache)*', provider: 'cache', model: 'local' };
      }
      const msg = e instanceof Error ? e.message : 'Connection failed';
      throw new Error(`${msg}\n\nTry:\n1. Check your internet connection\n2. Verify your API key in Settings\n3. Try a different provider`);
    }

    if (!req.systemPrompt?.includes('extraction') && !req.systemPrompt?.includes('extract')) {
      const cacheKey = 'gen:' + req.prompt.slice(0, 200);
      this.setCachedResponse(cacheKey, response.text);
      this.extractMemory(`${req.prompt}\n\n${response.text}`).catch(() => {});
    }

    return response;
  }

  private async extractMemory(conversation: string): Promise<void> {
    if (conversation.length < 50) return;
    const recent = conversation.slice(-3000);
    try {
      const { useMemoryStore } = await import('../store/useMemoryStore');
      const store = useMemoryStore.getState();
      try {
        const { activeProvider } = useProviderStore.getState();
        if (activeProvider === 'anthropic') {
          await this._extractViaAnthropic(recent, store);
        } else {
          await this._extractViaOpenAI(recent, store);
        }
      } catch {
        await this._fallbackExtract(recent, store);
      }
    } catch {}
  }
  private async _extractViaOpenAI(recent: string, store: any): Promise<void> {
    const { providers, activeProvider } = useProviderStore.getState();
    const config = providers[activeProvider];
    const { baseUrl } = PROVIDER_DEFAULTS[activeProvider];
    if (!config.apiKey) return;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'Extract up to 3 facts from the conversation as JSON array. Each: {"key":"short_key","value":"value","category":"fact|preference|profile|subject|weak_area|score","confidence":0.0-1.0}. No markdown.' },
          { role: 'user', content: recent },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;
    const data = await res.json() as any;
    const text = data.choices?.[0]?.message?.content ?? '';
    const facts = this._parseFacts(text);
    facts.forEach((f: any) => store.addMemory(f));
  }

  private async _extractViaAnthropic(recent: string, store: any): Promise<void> {
    const { providers } = useProviderStore.getState();
    const config = providers.anthropic;
    if (!config.apiKey) return;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 300,
        system: 'Extract up to 3 facts from the conversation as JSON array. Each: {"key":"short_key","value":"value","category":"fact|preference|profile|subject|weak_area|score","confidence":0.0-1.0}. No markdown.',
        messages: [{ role: 'user', content: recent }],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;
    const data = await res.json() as any;
    const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
    const facts = this._parseFacts(text);
    facts.forEach((f: any) => store.addMemory(f));
  }

  private async _fallbackExtract(recent: string, store: any): Promise<void> {
    const lower = recent.toLowerCase();
    const facts: { key: string; value: string; category: any; confidence: number }[] = [];

    const patterns = [
      { match: /my name is (\w+)/i, key: 'user_name', category: 'profile' as const },
      { match: /i(?:'m| am) (\d+) (?:years old|yrs?)/i, key: 'user_age', category: 'profile' as const },
      { match: /i study (.+)/i, key: 'subject', category: 'subject' as const },
      { match: /i(?:'m| am) in (sss|jhs|jss|university|school|college)/i, key: 'education_level', category: 'profile' as const },
      { match: /i(?:'m| am) from (.+)/i, key: 'location', category: 'profile' as const },
      { match: /my exam is (.+)/i, key: 'exam_type', category: 'fact' as const },
      { match: /(?:score|mark|grade).*?(\d+)/i, key: 'score', category: 'score' as const },
    ];

    for (const p of patterns) {
      const m = lower.match(p.match);
      if (m) {
        facts.push({ key: p.key, value: m[1].trim(), category: p.category, confidence: 0.6 });
      }
    }

    const unique = facts.filter((f, i, a) => a.findIndex(x => x.key === f.key) === i);
    unique.slice(0, 3).forEach((f) => store.addMemory(f));
  }

  private _parseFacts(text: string): any[] {
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      let depth = 0, start = -1, end = -1;
      for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '[') { if (depth === 0) start = i; depth++; }
        else if (cleaned[i] === ']') { depth--; if (depth === 0 && start !== -1) { end = i + 1; break; } }
        else if (cleaned[i] === '"') { i++; while (i < cleaned.length && !(cleaned[i] === '"' && cleaned[i-1] !== '\\')) i++; }
      }
      if (start === -1 || end === -1) return [];
      return JSON.parse(cleaned.slice(start, end));
    } catch { return []; }
  }
}

export default GiaBrain.getInstance();
