import { CapacitorHttp } from '@capacitor/core';
import { useProviderStore, PROVIDER_DEFAULTS } from '../store/useProviderStore';
import { useGiaStore } from '../store/useGiaStore';
import { useMemoryStore } from '../store/useMemoryStore';
import SearchService from './SearchService';
import GiaTools, { ToolResult } from './GiaTools';

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
  onThought?: (thought: string) => void; 
  signal?: AbortSignal;
}

export interface BrainResponse { text: string; provider: string; model: string; sources?: string[] }

const buildGiaSystem = () => {
  const { userProfile, activeSkillId, skills } = useGiaStore.getState();
  const activeSkill = skills.find(s => s.id === activeSkillId);
  const memory = useMemoryStore.getState().getRelevantContext();
  const now = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
  const userName = userProfile.name ? userProfile.name : 'the user';
  const userContext = userProfile.name
    ? `\n\nUser context:\n- Name: ${userProfile.name}${userProfile.bio ? `\n- About: ${userProfile.bio}` : ''}${userProfile.goals ? `\n- Goals: ${userProfile.goals}` : ''}`
    : '';

  let baseSystem = `You are GIA (Generative Interface Agent) v2.3.0 — an autonomous AI agent.
You have FULL CONTROL over your workspace. When you need to act, respond with a JSON block:
\`\`\`tool
{ "id": "tool_id", "args": { "param": "value" } }
\`\`\`
Then wait for the observation.

Available Capabilities:
${GiaTools.getAllTools().map(t => `- ${t.id}: ${t.description}`).join('\n')}

Skill Context: ${activeSkill?.name || 'General'}.
${activeSkill?.systemPrompt || 'Be concise, helpful, and professional.'}

Environment:
- Time: ${now}
- User: ${userName}${userContext}
${memory}

Guidelines:
1. Use 'switch_module' to help the user navigate between Chat, Exam, Analyst, etc.
2. Use 'terminal_run' for any coding, scripts, or technical troubleshooting.
3. Use 'filesystem_write' to save data, summaries, or results to the user's device.
4. If a model doesn't support native vision, GIA will provide an automated description of attached images.`;

  return baseSystem;
};

class GiaBrain {
  private static instance: GiaBrain;
  static getInstance() { if (!this.instance) this.instance = new GiaBrain(); return this.instance; }

  private isVisionCapable(model: string, provider: string): boolean {
    const m = model.toLowerCase();
    const p = provider.toLowerCase();
    if (m.includes('vision') || m.includes('gpt-4o') || m.includes('claude-3-5') || m.includes('gemini')) return true;
    if (m.includes('pixtral') || m.includes('llava') || m.includes('vl')) return true;
    if (p === 'anthropic' || p === 'openai' || p === 'gemini') return true;
    return false;
  }

  private async buildMessages(req: BrainRequest) {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];
    const msgs: any[] = [];
    if (req.history) msgs.push(...req.history);

    if (req.images && req.images.length > 0) {
      if (this.isVisionCapable(config.model, activeProvider)) {
        const content: any[] = [{ type: 'text', text: req.prompt }];
        req.images.forEach(img => {
          const dataUrl = img.data.startsWith('data:') ? img.data : `data:${img.type};base64,${img.data}`;
          content.push({
            type: 'image_url',
            image_url: { url: dataUrl, detail: 'auto' }
          });
        });
        msgs.push({ role: 'user', content });
      } else {
        const content = `[Image attached: ${req.images.map(i => i.name).join(', ')}]\n(System: Model ${config.model} lacks native vision. Analyzing via metadata fallback...)\n\nUSER: ${req.prompt}`;
        msgs.push({ role: 'user', content });
      }
    } else {
      msgs.push({ role: 'user', content: req.prompt });
    }
    return msgs;
  }

  async fetchURL(url: string): Promise<string> {
    try {
      const res = await CapacitorHttp.get({ url, connectTimeout: 10000, readTimeout: 10000 });
      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script,style,nav,footer,header,aside').forEach(el => el.remove());
      const text = doc.body?.innerText ?? doc.body?.textContent ?? '';
      return `[Source: ${url}]\n\n${text.replace(/\s{3,}/g, '\n\n').trim().slice(0, 10000)}`;
    } catch (e) {
      return `Error fetching URL: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  private async retryFetch(url: string, options: RequestInit, retries = 1): Promise<Response> {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(60000) });
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
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];
    const { baseUrl, label } = PROVIDER_DEFAULTS[activeProvider];
    const messages = [
      { role: 'system', content: req.systemPrompt || buildGiaSystem() },
      ...(await this.buildMessages(req))
    ];
    const body: any = {
      model: config.model,
      messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
      stream: !!req.onStream,
    };
    if (req.useExtendedThinking) {
      body.temperature = undefined;
      body.messages[0].content += `\n\nThink step-by-step before answering. Show your reasoning inside <think> tags, then provide your final answer.`;
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
      method: 'POST', headers, body: JSON.stringify(body), signal: req.signal,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({})) as any;
      throw new Error(e?.error?.message || `${label} error ${res.status}`);
    }
    if (req.onStream && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          const t = line.trim();
          if (!t || t === 'data: [DONE]') continue;
          if (t.startsWith('data: ')) {
            try {
              const json = JSON.parse(t.slice(6));
              const delta = json.choices[0].delta.content;
              if (delta) {
                fullText += delta;
                req.onStream(delta);
              }
            } catch { continue; }
          }
        }
      }
      return { text: fullText, provider: activeProvider, model: config.model };
    }
    const data = await res.json();
    return { text: data.choices[0].message.content, provider: activeProvider, model: config.model };
  }

  private async callAnthropic(req: BrainRequest): Promise<BrainResponse> {
    const { providers } = useProviderStore.getState();
    const config = providers.anthropic;
    const useThinking = !!req.useExtendedThinking;
    
    const messages = (await this.buildMessages(req)).map(m => {
      if (Array.isArray(m.content)) {
        return {
          ...m,
          content: m.content.map((c: any) => {
            if (c.type === 'image_url') {
              try {
                const url = c.image_url.url;
                const match = url.match(/^data:(image\/(jpeg|png|gif|webp));base64,(.*)$/);
                if (match) {
                  return {
                    type: 'image',
                    source: { type: 'base64', media_type: match[1], data: match[3] }
                  };
                }
              } catch (e) { console.error(e); }
              return { type: 'text', text: '[Unsupported Image Format]' };
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
          } catch { }
        }
      }
      return { text: fullText, provider: 'anthropic', model: config.model };
    }
    const data = await res.json() as any;
    const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
    return { text, provider: 'anthropic', model: config.model };
  }

  private async callGeminiNative(req: BrainRequest): Promise<BrainResponse> {
    const { providers } = useProviderStore.getState();
    const config = providers.gemini;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

    const contents: any[] = [];
    if (req.history) {
      req.history.forEach(m => {
        contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
      });
    }

    const currentParts: any[] = [{ text: req.prompt }];
    if (req.images) {
      req.images.forEach(img => {
        const base64Data = img.data.split(',')[1] || img.data;
        currentParts.push({ inline_data: { mime_type: img.type, data: base64Data } });
      });
    }
    contents.push({ role: 'user', parts: currentParts });

    const body = {
      contents,
      system_instruction: { parts: [{ text: req.systemPrompt || buildGiaSystem() }] },
      generationConfig: { temperature: req.temperature ?? 0.7, maxOutputTokens: req.maxTokens ?? 2048 }
    };

    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: req.signal });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || `Gemini error ${res.status}`);
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return { text, provider: 'gemini', model: config.model };
  }

  async generate(req: BrainRequest): Promise<BrainResponse> {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];
    if (!config.enabled || !config.apiKey) {
      throw new Error('No provider connected. Go to Settings → Engine Room and type: connect');
    }

    let currentPrompt = req.prompt;
    let history = req.history ? [...req.history] : [];
    let iterations = 0;
    const maxIterations = 8;

    while (iterations < maxIterations) {
      iterations++;
      const loopReq: BrainRequest = { ...req, prompt: currentPrompt, history: history };

      let res: BrainResponse;
      if (activeProvider === 'anthropic') res = await this.callAnthropic(loopReq);
      else if (activeProvider === 'gemini' && !config.model.includes('gpt')) res = await this.callGeminiNative(loopReq);
      else res = await this.callOpenAICompat(loopReq);
      
      const text = res.text;
      const toolMatch = text.match(/```tool\n([\s\S]*?)\n```/);
      if (toolMatch) {
        try {
          const toolCall = JSON.parse(toolMatch[1]);
          const tool = GiaTools.getTool(toolCall.id);
          if (tool) {
            req.onThought?.(`GIA is executing: ${tool.name}...`);
            const result = await tool.execute(toolCall.args);
            const obs = result.success ? `OBSERVATION: Success\n${result.content}` : `ERROR: ${result.error || 'Unknown error'}\n${result.content}`;
            history.push({ role: 'assistant', content: text });
            history.push({ role: 'user', content: obs });
            useGiaStore.getState().addConsoleLog({ type: result.success ? 'tool' : 'error', content: `Tool: ${toolCall.id}\nResult: ${result.content.slice(0, 500)}` });
            currentPrompt = `Tool finished. Observation: ${obs}`;
            continue;
          } else if (toolCall.id === 'sub_agent_call') {
            const { provider, prompt } = toolCall.args;
            req.onThought?.(`Delegating to sub-agent (${provider})...`);
            const subRes = await this.delegateTask(provider, prompt, req.signal);
            history.push({ role: 'assistant', content: text });
            history.push({ role: 'user', content: `SUB-AGENT (${provider}): ${subRes}` });
            currentPrompt = `Sub-agent finished. Continue based on their response.`;
            continue;
          }
        } catch (e: any) {
          history.push({ role: 'assistant', content: text });
          history.push({ role: 'user', content: `ERROR parsing tool call: ${e.message}` });
          currentPrompt = `Tool call was malformed. Please fix JSON and try again.`;
          continue;
        }
      }
      return res;
    }
    throw new Error('Max agentic iterations reached.');
  }

  private async delegateTask(providerName: string, prompt: string, signal?: AbortSignal): Promise<string> {
    const { providers } = useProviderStore.getState();
    const targetProvider = providerName.toLowerCase();
    const config = providers[targetProvider as keyof typeof providers];
    if (!config || !config.enabled) return `Error: Provider ${providerName} is not configured.`;
    try {
      const { baseUrl } = PROVIDER_DEFAULTS[targetProvider as keyof typeof PROVIDER_DEFAULTS];
      const body = { model: config.model, messages: [{ role: 'system', content: 'You are a GIA sub-agent.' }, { role: 'user', content: prompt }], temperature: 0.7, max_tokens: 2048 };
      const res = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.choices[0].message.content;
    } catch (e: any) { return `Error delegating: ${e.message}`; }
  }
}

export default GiaBrain.getInstance();
