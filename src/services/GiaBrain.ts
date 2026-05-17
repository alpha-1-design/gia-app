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
  handsOff?: boolean;
  onStream?: (chunk: string) => void;
  onThought?: (thought: string) => void;
  signal?: AbortSignal;
}

export interface BrainResponse { text: string; provider: string; model: string; sources?: string[] }

const buildGiaSystem = () => {
  const { userProfile, activeSkillId, skills, handsOff } = useGiaStore.getState();
  const activeSkill = skills.find(s => s.id === activeSkillId);
  const memory = useMemoryStore.getState().getRelevantContext();
  const memoryCount = useMemoryStore.getState().memories.length;
  const { activeProvider, providers } = useProviderStore.getState();
  const now = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
  const isNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.();
  const platform = isNative ? 'Android/iOS (Capacitor native app)' : 'Web browser';
  const userName = userProfile.name ? userProfile.name : 'the user';
  const userContext = userProfile.name
    ? `\n\nUser context:\n- Name: ${userProfile.name}${userProfile.bio ? `\n- About: ${userProfile.bio}` : ''}${userProfile.goals ? `\n- Goals: ${userProfile.goals}` : ''}`
    : '';
  const activeProviderConfig = providers[activeProvider];
  const enabledProviders = (Object.entries(providers) as [string, typeof activeProviderConfig][])
    .filter(([, v]) => v.enabled && v.apiKey)
    .map(([k]) => k);

  const toolInstructions = handsOff
    ? `You have FULL CONTROL over your workspace. When you need to act, respond with a JSON block:
\`\`\`tool
{ "id": "tool_id", "args": { "param": "value" } }
\`\`\`
Then wait for the observation.`
    : `You can SUGGEST tools to the user, but you may NOT execute them autonomously. Hands-off mode is disabled.`;

  const skillPrompt = activeSkill?.systemPrompt || (
    activeSkill?.name === 'General' || !activeSkill
      ? 'Be concise, direct, and helpful. Use your tools when they add value.'
      : ''
  );

  let baseSystem = `You are GIA (Generative Interface Agent) v2.3.0 — a private, on-device AI workspace running inside the user's device.

## Who You Are
You are not a cloud chatbot. You live inside ${platform} as a React+TypeScript single-page app bundled with Capacitor. Your code runs entirely on the user's device — you have no server, no backend, and no cloud dependency except the AI model API calls you make to the provider the user configured. Your responses are streamed token-by-token through a WebView, rendered as Markdown in a chat interface. You have dark theme styling, code blocks with syntax highlighting + Run/Copy/Download buttons, inline image display, and module-based navigation.

${toolInstructions}

## Your Tools (Self-Awareness)
You can introspect yourself at any time by calling 'get_environment_info' — it returns your full identity, all registered tools, current provider + model, platform type, available code runtimes, UI capabilities, memory count, and skills count. Use it to understand your own state.

## Your AI Backend
You are currently powered by ${activeProvider.toUpperCase()} (model: ${activeProviderConfig.model}), with API key ${activeProviderConfig.apiKey ? 'configured' : 'NOT SET'}. Enabled providers: ${enabledProviders.length > 0 ? enabledProviders.join(', ') : 'none — configure one in Settings'}. Different providers have different strengths — some support vision (image understanding), some have larger context windows, some are faster.

## Available Modules
You can navigate the user between these modules using 'switch_module':
- chat: Main conversation interface (default)
- exam: Quiz/testing module with score tracking
- analyst: Data analysis with visualization
- writer: Document drafting and editing
- planner: Task scheduling with notifications
- settings: Configure providers, skills, profile, and app behavior

## Your Rendering Capabilities
- Full Markdown (headers, lists, tables, bold, italic, inline code, blockquotes, horizontal rules)
- Code blocks with syntax highlighting — the user can Run, Copy, or Download code
- Inline images (markdown image syntax)
- Streaming responses (your text appears word-by-word)
- Long messages (>3000 chars) have an expand/collapse toggle
- Tables are rendered with proper column alignment

## Platform Limitations
${isNative
  ? '- Full filesystem access (read/write/list files in Documents folder)\n- Push notifications via LocalNotifications\n- Biometric lock (fingerprint/face) for security\n- Text-to-speech (native TTS engine)\n- Speech recognition (microphone input)'
  : '- Browser mode: filesystem_read/list_files require the native app\n- Filesystem_write triggers a browser download instead of saving to device\n- zip_project creates a downloadable ZIP in the browser\n- Text-to-speech uses Web Speech API\n- Speech recognition uses Web Speech API\n- Biometric lock uses a PIN fallback instead of fingerprint/face'
}

## Active Skill Context
${activeSkill?.name || 'General'}${activeSkill?.description ? `: ${activeSkill.description}` : ''}
${skillPrompt}

## Environment
- Time: ${now}
- User: ${userName}
- Memories stored: ${memoryCount}
${userContext}
${memory}

## Guidelines
1. Know yourself — you are a local AI agent, not a cloud chatbot. You can introspect with 'get_environment_info'.
2. Use 'switch_module' to navigate between Chat, Exam, Analyst, Writer, Planner, Settings.
3. Use 'terminal_run' to execute code (Python, JS, C++, etc.) in a sandboxed container.
4. Use 'filesystem_write' to save single files (triggers browser download in web mode) or 'zip_project' to bundle multiple files into a downloadable ZIP.
5. Use 'request_clarification' to ask the user a multiple-choice question when you need to choose a direction before proceeding.
6. If the current model doesn't support vision natively, I will automatically describe attached images for you before they reach your context.
7. Hands-off mode is currently ${handsOff ? 'ENABLED — you can execute tools autonomously without asking' : 'DISABLED — suggest tools to the user but wait for permission'}.`;

  return baseSystem;
};

class GiaBrain {
  private static instance: GiaBrain;
  static getInstance() { if (!this.instance) this.instance = new GiaBrain(); return this.instance; }

  private isVisionCapable(model: string, provider: string): boolean {
    const m = model.toLowerCase();
    const p = provider.toLowerCase();

    // OpenAI models: all gpt-4o, o1, o3, gpt-4.1 support vision
    if (p === 'openai') {
      if (m.includes('gpt-4o') || m.includes('gpt-4.1') || m.startsWith('o1') || m.startsWith('o3')) return true;
      return false;
    }

    // Anthropic: every Claude model supports vision
    if (p === 'anthropic') {
      return m.includes('claude');
    }

    // Gemini: all support vision
    if (p === 'gemini') {
      return true;
    }

    // Groq: limited vision models
    if (p === 'groq') {
      return m.includes('llama-3.2-11b') || m.includes('llama-3.2-90b') || m.includes('vision');
    }

    // OpenRouter & others: check by model name patterns
    const visionPatterns = [
      'vision', 'gpt-4o', 'gpt-4.1', 'claude-3', 'claude-4', 'opus',
      'gemini', 'pixtral', 'llava', '/vl', '-vl', 'vl-',
      'florence', 'cogvlm', 'qwen-vl', 'qwen2-vl',
      'llama-3.2-11b', 'llama-3.2-90b',
      'idefics', 'fuyu', 'palmyra-vision', 'minicpm',
      'glm-4v', 'internvl', 'deepseek-vl', 'phi-3-vision',
      'molmo', 'dpo-vision',
    ];
    return visionPatterns.some(pattern => m.includes(pattern));
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

  private retryFetch(url: string, options: RequestInit, retries = 1): Promise<Response> {
    const hasTimeout = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function';
    const timeoutSignal = hasTimeout ? AbortSignal.timeout(60000) : undefined;

    const run = async (attempt: number): Promise<Response> => {
      try {
        const combinedSignal = options.signal || timeoutSignal;
        const res = await fetch(url, { ...options, signal: combinedSignal });
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          return run(attempt + 1);
        }
        return res;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
        if (attempt >= retries) throw e;
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        return run(attempt + 1);
      }
    };
    return run(0);
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

    if (req.onStream) {
      if (req.signal?.aborted) return { text: '', provider: activeProvider, model: config.model };

      return new Promise<BrainResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let fullText = '';
        let lastProcessed = 0;

        xhr.open('POST', `${baseUrl}/chat/completions`);
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.responseType = 'text';

        const processLines = (text: string) => {
          const lines = text.split('\n');
          for (const line of lines) {
            const t = line.trim();
            if (!t || t === 'data: [DONE]') continue;
            if (t.startsWith('data: ')) {
              try {
                const json = JSON.parse(t.slice(6));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  req.onStream!(delta);
                }
              } catch { continue; }
            }
          }
        };

        xhr.onprogress = () => {
          const currentLen = xhr.responseText.length;
          const newData = xhr.responseText.slice(lastProcessed);
          lastProcessed = currentLen;
          processLines(newData);
        };

        xhr.onload = () => {
          const remaining = xhr.responseText.slice(lastProcessed);
          if (remaining.trim()) processLines(remaining);
          if (!fullText.trim()) reject(new Error(`${label} returned empty response`));
          else resolve({ text: fullText, provider: activeProvider, model: config.model });
        };

        xhr.onerror = () => reject(new Error(`${label} network error`));
        xhr.onabort = () => {
          const e = new Error('Request aborted');
          e.name = 'AbortError';
          reject(e);
        };

        if (req.signal) {
          if (req.signal.aborted) { xhr.abort(); return; }
          req.signal.addEventListener('abort', () => xhr.abort());
        }

        xhr.send(JSON.stringify(body));
      });
    }

    const res = await this.retryFetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers, body: JSON.stringify(body), signal: req.signal,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({})) as any;
      throw new Error(e?.error?.message || `${label} error ${res.status}`);
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
              throw new Error(`Unsupported image format for Anthropic. Supported: JPEG, PNG, GIF, WebP. Got: ${c.image_url.url?.slice(0, 50)}`);
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
    const anthropicHeaders: Record<string, string> = {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    };

    if (req.onStream) {
      if (req.signal?.aborted) return { text: '', provider: 'anthropic', model: config.model };

      return new Promise<BrainResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let fullText = '';
        let lastProcessed = 0;

        xhr.open('POST', 'https://api.anthropic.com/v1/messages');
        Object.entries(anthropicHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.responseType = 'text';

        const processAnthropicEvents = (text: string) => {
          const events = text.split('\n\n');
          for (const event of events) {
            const t = event.trim();
            if (!t.startsWith('data:')) continue;
            try {
              const parsed = JSON.parse(t.slice(5).trim());
              if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'thinking') {
                if (parsed.content_block.thinking) {
                  req.onThought?.(parsed.content_block.thinking);
                }
              }
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                const delta = parsed.delta.text ?? '';
                fullText += delta;
                req.onStream!(delta);
              }
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'thinking_delta') {
                req.onThought?.(parsed.delta.thinking ?? '');
              }
            } catch { }
          }
        };

        xhr.onprogress = () => {
          const currentLen = xhr.responseText.length;
          const newData = xhr.responseText.slice(lastProcessed);
          lastProcessed = currentLen;
          processAnthropicEvents(newData);
        };

        xhr.onload = () => {
          const remaining = xhr.responseText.slice(lastProcessed);
          if (remaining.trim()) processAnthropicEvents(remaining);
          if (!fullText.trim()) reject(new Error('Anthropic returned empty response'));
          else resolve({ text: fullText, provider: 'anthropic', model: config.model });
        };

        xhr.onerror = () => reject(new Error('Anthropic network error'));
        xhr.onabort = () => {
          const e = new Error('Request aborted');
          e.name = 'AbortError';
          reject(e);
        };

        if (req.signal) {
          if (req.signal.aborted) { xhr.abort(); return; }
          req.signal.addEventListener('abort', () => xhr.abort());
        }

        xhr.send(JSON.stringify(body));
      });
    }

    const res = await this.retryFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: anthropicHeaders,
      body: JSON.stringify(body), signal: req.signal,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(e?.error?.message || `Anthropic error ${res.status}`);
    }
    const data = await res.json() as any;
    const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
    return { text, provider: 'anthropic', model: config.model };
  }

  private async callGeminiNative(req: BrainRequest): Promise<BrainResponse> {
    const { providers } = useProviderStore.getState();
    const config = providers.gemini;

    const contents: any[] = [];
    if (req.history) {
      req.history.forEach(m => {
        const part = typeof m.content === 'string' ? { text: m.content } : { text: JSON.stringify(m.content) };
        contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [part] });
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

    if (req.onStream) {
      if (req.signal?.aborted) return { text: '', provider: 'gemini', model: config.model };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse`;
      const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey };

      return new Promise<BrainResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let fullText = '';
        let lastProcessed = 0;

        xhr.open('POST', url);
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.responseType = 'text';

        const processGeminiEvents = (text: string) => {
          const events = text.split('\n\n');
          for (const event of events) {
            const t = event.trim();
            if (!t.startsWith('data: ')) continue;
            const jsonStr = t.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const part = parsed.candidates?.[0]?.content?.parts?.[0];
              if (part?.text) {
                fullText += part.text;
                req.onStream!(part.text);
              }
            } catch { }
          }
        };

        xhr.onprogress = () => {
          const currentLen = xhr.responseText.length;
          const newData = xhr.responseText.slice(lastProcessed);
          lastProcessed = currentLen;
          processGeminiEvents(newData);
        };

        xhr.onload = () => {
          const remaining = xhr.responseText.slice(lastProcessed);
          if (remaining.trim()) processGeminiEvents(remaining);
          if (!fullText.trim()) reject(new Error('Gemini returned empty response'));
          else resolve({ text: fullText, provider: 'gemini', model: config.model });
        };

        xhr.onerror = () => reject(new Error('Gemini network error'));
        xhr.onabort = () => {
          const e = new Error('Request aborted');
          e.name = 'AbortError';
          reject(e);
        };

        if (req.signal) {
          if (req.signal.aborted) { xhr.abort(); return; }
          req.signal.addEventListener('abort', () => xhr.abort());
        }

        xhr.send(JSON.stringify(body));
      });
    }

    const res = await this.retryFetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify(body),
      signal: req.signal,
    });
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
    let clarificationAttempts = 0;

    while (iterations < maxIterations) {
      if (req.signal?.aborted) throw new Error('Request aborted');
      iterations++;
      const loopReq: BrainRequest = { ...req, prompt: currentPrompt, history: history };

      let res: BrainResponse;
      if (activeProvider === 'anthropic') res = await this.callAnthropic(loopReq);
      else if (activeProvider === 'gemini') res = await this.callGeminiNative(loopReq);
      else res = await this.callOpenAICompat(loopReq);
      
      const text = res.text;
      const toolMatch = text.match(/```tool\n([\s\S]*?)\n```/);
      if (toolMatch) {
        try {
          const toolCall = JSON.parse(toolMatch[1]);

          // sub_agent_call is handled inline, never goes through tool registry
          if (toolCall.id === 'sub_agent_call') {
            const { provider, prompt: subPrompt } = toolCall.args;
            req.onThought?.(`Delegating to sub-agent (${provider})...`);
            const subRes = await this.delegateTask(provider, subPrompt, req.signal);
            history.push({ role: 'assistant', content: text });
            history.push({ role: 'user', content: `SUB-AGENT (${provider}): ${subRes}` });
            currentPrompt = `Sub-agent finished. Continue based on their response.`;
            continue;
          }

          // Clarification — always allowed but max 1 per generate() to prevent looping
          if (toolCall.id === 'request_clarification') {
            if (clarificationAttempts >= 1) {
              history.push({ role: 'assistant', content: text });
              history.push({ role: 'user', content: 'OBSERVATION: Clarification already asked. Respond directly without asking again.' });
              currentPrompt = 'Clarification already used. Respond directly.';
              continue;
            }
            clarificationAttempts++;
            const tool = GiaTools.getTool('request_clarification');
            if (tool) {
              await tool.execute(toolCall.args);
              const cleanText = text.replace(/```tool\n[\s\S]*?\n```/g, '').trim();
              history.push({ role: 'assistant', content: cleanText || 'I need some clarification.' });
              return { text: '__CLARIFICATION__', provider: activeProvider, model: config.model };
            }
          }

          const { handsOff: isHandsOff } = useGiaStore.getState();
          if (!isHandsOff) {
            req.onThought?.('GIA suggested a tool but hands-off mode is disabled. Tool execution skipped.');
            history.push({ role: 'assistant', content: text });
            history.push({ role: 'user', content: 'OBSERVATION: Tool execution blocked — hands-off mode is disabled. Please respond directly without executing tools, or ask the user to enable hands-off mode in settings.' });
            currentPrompt = 'Tool was blocked. Respond directly without executing tools.';
            continue;
          }

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
