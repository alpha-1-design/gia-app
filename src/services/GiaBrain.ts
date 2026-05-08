import { CapacitorHttp } from '@capacitor/core';
import { useProviderStore, PROVIDER_DEFAULTS } from '../store/useProviderStore';
import { useGiaStore } from '../store/useGiaStore';

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
}

export interface BrainResponse { text: string; provider: string; model: string; sources?: string[] }

const buildGiaSystem = () => {
  const profile = useGiaStore.getState().userProfile;
  const now = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
  const userName = profile.name ? profile.name : 'the user';
  const userContext = profile.name
    ? `\n\nUser context:\n- Name: ${profile.name}${profile.bio ? `\n- About: ${profile.bio}` : ''}${profile.goals ? `\n- Goals: ${profile.goals}` : ''}`
    : '';

  return `You are GIA (Generative Interface Agent) — a personal AI workspace assistant created by Samuel Mensah (Alpha-1 Studio, Ghana) in 2025. You are powered by whichever AI model the user has connected.

You know who you are:
- Created by Samuel Mensah, a 19-year-old self-taught developer from Kumasi, Ghana, building from an Android phone
- Built to be private-first — everything runs on-device, no backend, no data collection
- You have four focused modes: Chat, Analyst, Writer, Planner
- You can read and extract content from websites when given a URL
- You can analyze images, documents, and data files
- You support web search (via OpenRouter plugin)
- You can generate study materials, exam questions, plans, drafts, and code
- You are aware of your own capabilities and limitations — you say so clearly when you hit them
- You are warm, natural, adaptive, and intelligent — not robotic

Current time: ${now}
You are talking to: ${userName}${userContext}

Personality: Be natural, direct, insightful, and genuinely helpful. Don't be stiff or over-formal. Think like a brilliant friend who also happens to be an expert in everything. When tasks are complex, think step by step. When tasks are simple, be concise. Always use clean Markdown formatting for structure.`;
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
      doc.querySelectorAll('script,style,nav,footer,header,aside').forEach(el => el.remove());
      const text = doc.body?.innerText ?? doc.body?.textContent ?? '';
      return text.replace(/\s{3,}/g, '\n\n').trim().slice(0, 8000);
    } catch (e) {
      // Fallback for browser development
      try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script,style,nav,footer,header,aside').forEach(el => el.remove());
        return doc.body?.innerText?.slice(0, 8000) ?? '';
      } catch {
        throw new Error(`Could not fetch URL: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  private async callOpenAICompat(req: BrainRequest): Promise<BrainResponse> {
    const { providers, activeProvider } = useProviderStore.getState();
    const config = providers[activeProvider];
    const { baseUrl, label } = PROVIDER_DEFAULTS[activeProvider];

    const body: Record<string, unknown> = {
      model: config.model,
      messages: [
        { role: 'system', content: req.systemPrompt || buildGiaSystem() },
        ...this.buildMessages(req),
      ],
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
      stream: !!req.onStream,
    };

    if (req.useWebSearch && activeProvider === 'openrouter') {
      body.plugins = [{ id: 'web' }];
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (activeProvider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://gia.app';
      headers['X-Title'] = 'GIA';
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers, body: JSON.stringify(body),
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
    const useThinking = req.useExtendedThinking && config.model.includes('claude-3-7');

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

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

  async generate(req: BrainRequest): Promise<BrainResponse> {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];

    if (!config.enabled || !config.apiKey) {
      throw new Error('No provider connected. Go to Settings → Engine Room and type: connect');
    }

    const urlMatch = req.prompt.match(/https?:\/\/[^\s]+/);
    if (urlMatch && !req.useWebSearch) {
      try {
        const pageText = await this.fetchURL(urlMatch[0]);
        req = { ...req, prompt: `${req.prompt}\n\n[Fetched content from ${urlMatch[0]}]:\n${pageText}` };
      } catch { /* silently fall through */ }
    }

    return activeProvider === 'anthropic' ? this.callAnthropic(req) : this.callOpenAICompat(req);
  }

  async webSearch(query: string): Promise<{ results: { title: string; url: string; snippet: string }[] }> {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];
    if (!config.enabled) return { results: [] };

    if (activeProvider === 'openrouter') {
      const res = await this.generate({
        prompt: `Search the web for: "${query}". Return a JSON object: {"results":[{"title":"...","url":"...","snippet":"..."}]}. Return only JSON, no markdown.`,
        useWebSearch: true,
        temperature: 0.1,
        maxTokens: 1000,
      });
      try {
        const clean = res.text.replace(/```json|```/g, '').trim();
        return JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
      } catch { return { results: [] }; }
    }

    const res = await this.generate({
      prompt: `Based on your knowledge, provide 3-5 search results for: "${query}". Format as JSON: {"results":[{"title":"...","url":"...","snippet":"..."}]}. Use real, accurate URLs and information. Return only JSON.`,
      temperature: 0.3,
      maxTokens: 800,
    });
    try {
      const clean = res.text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
    } catch { return { results: [] }; }
  }
}

export default GiaBrain.getInstance();
