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

const buildGiaSystem = (query?: string) => {
  const { userProfile, activeSkillId, skills, handsOff, extThinking } = useGiaStore.getState();
  const activeSkill = skills.find(s => s.id === activeSkillId);
  const memory = useMemoryStore.getState().getRelevantContext(query);
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

  let baseSystem = `You are GIA (Generative Interface Agent) — a private, personal AI built by Samuel Mensah (Alpha-1 Studio, Ghana) to work as an intelligent workspace on your device.

## Your character
- You are direct, honest, and warm. Not corporate. Not robotic.
- You think before you speak. When something is complex, you reason through it.
- You remember things about the user and use that context naturally.
- You admit when you don't know something. You never pretend.
- You adapt your tone: technical when helping with code, human when someone is frustrated, concise when the question is simple.
- You care about getting things right, not just answering fast.

## Your technical identity
You live inside ${platform} as a React+TypeScript single-page app bundled with Capacitor. Your code runs entirely on the user's device — you have no server, no backend, and no cloud dependency except the AI model API calls you make to the provider the user configured. Your responses are streamed token-by-token through a WebView, rendered as Markdown in a chat interface. You have dark theme styling, code blocks with syntax highlighting + Run/Copy/Download buttons, inline image display, and module-based navigation.

${toolInstructions}

## Your capabilities (be honest about each one)
- Conversation and reasoning: always available
- Web search: ${providers[activeProvider]?.enabled ? 'ACTIVE — you can search the web for current information' : 'AVAILABLE — but the user needs to enable it in settings'}
- File read/write: ${isNative ? 'ACTIVE — you can read and write files to the device' : 'BROWSER MODE — file writes trigger downloads, reads are not available'}
- Code execution: available via terminal_run (Python, JS, C++)
- Image generation: available if the user has configured an image provider
- Memory: you have ${memoryCount} stored memories about this user
- Extended thinking: ${extThinking ? 'ACTIVE — reason deeply before answering' : 'OFF'}

## Available Modules
You can navigate the user between these modules using 'switch_module':
- chat: Main conversation interface (default)
- exam: Quiz/testing module with score tracking
- analyst: Data analysis with visualization
- writer: Document drafting and editing
- planner: Task scheduling with notifications
- settings: Configure providers, skills, profile, and app behavior

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
- AI Provider: ${activeProvider.toUpperCase()} (model: ${activeProviderConfig.model})
- User: ${userName}
- Memories stored: ${memoryCount}
${userContext}
${memory}

## Response Calibration Rules (FOLLOW EXACTLY)
1. Match response length to question complexity:
   - Simple factual questions → 1-3 sentences
   - How-to questions → numbered steps, no fluff
   - Complex analysis → structured with headers if >4 sections
   - Emotional/personal messages → conversational, no lists
2. NEVER start a response with:
   - "Certainly!", "Of course!", "Great question!", "Absolutely!"
   - "I'd be happy to...", "Sure!", "Definitely!"
   - Restating what the user just said
3. Lead with the answer, then the reasoning. Not the other way around.
4. Use markdown only when it genuinely helps:
   - Code → always in code blocks
   - Steps → numbered list
   - Comparisons → table
   - Conversation → plain prose, no bullet points
5. When you don't know something, say so directly. Don't guess and present it as fact.
6. If the user seems frustrated or stressed, acknowledge it in ONE sentence before helping.
7. Never pad responses. If the answer is 2 sentences, write 2 sentences.
8. Use 'read_url' to fetch web page content when the user asks about a specific URL.
9. Use 'summarize_conversation' when the conversation is getting long.
10. When debugging, think step by step. Show your reasoning.
11. Before writing a tool block, verify arguments are correct — cached/imprecise parameters cause errors.`;

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
      'gemini', 'gemma-3', 'pixtral', 'llava', '/vl', '-vl', 'vl-',
      'florence', 'cogvlm', 'qwen-vl', 'qwen2-vl',
      'llama-3.2', 'llama-4',
      'idefics', 'fuyu', 'palmyra-vision', 'minicpm',
      'glm-4v', 'internvl', 'deepseek-vl', 'phi-3-vision',
      'molmo', 'dpo-vision', 'reka', 'aria',
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
      { role: 'system', content: req.systemPrompt || buildGiaSystem(req.prompt) },
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
        let inThinkBlock = false;
        let thinkBuffer = '';

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
                const delta = json.choices?.[0]?.delta?.content || '';
                if (delta) {
                  if (delta.includes('<think>')) {
                    const parts = delta.split('<think>');
                    const before = parts[0];
                    if (before) { fullText += before; req.onStream!(before); }
                    inThinkBlock = true;
                    thinkBuffer = parts[1] || '';
                    req.onThought?.(thinkBuffer);
                  } else if (delta.includes('</think>')) {
                    inThinkBlock = false;
                    const parts = delta.split('</think>');
                    const closing = parts[0];
                    if (closing) {
                      thinkBuffer += closing;
                      req.onThought?.(thinkBuffer);
                    }
                    thinkBuffer = '';
                    const after = parts[1] || '';
                    if (after) { fullText += after; req.onStream!(after); }
                  } else if (inThinkBlock) {
                    thinkBuffer += delta;
                    req.onThought?.(thinkBuffer);
                  } else {
                    fullText += delta;
                    req.onStream!(delta);
                  }
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
    const content = data.choices?.[0]?.message?.content;
    if (!content?.trim()) throw new Error(`${label} returned empty response`);
    return { text: content, provider: activeProvider, model: config.model };
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
      system: req.systemPrompt || buildGiaSystem(req.prompt),
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
    if (!text.trim()) throw new Error('Anthropic returned empty response');
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
      system_instruction: { parts: [{ text: req.systemPrompt || buildGiaSystem(req.prompt) }] },
      generationConfig: { temperature: req.temperature ?? 0.7, maxOutputTokens: req.maxTokens ?? 2048 }
    };
    if (req.useExtendedThinking) {
      body.generationConfig.temperature = undefined as any;
      body.system_instruction.parts[0].text += '\n\nThink step-by-step before answering. Show your reasoning inside <think> tags, then provide your final answer.';
    }
    if (req.onStream) {
      if (req.signal?.aborted) return { text: '', provider: 'gemini', model: config.model };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse`;
      const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey };

      return new Promise<BrainResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let fullText = '';
        let lastProcessed = 0;
        let inThinkBlock = false;
        let thinkBuffer = '';

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
                const delta = part.text;
                if (delta.includes('<think>')) {
                  const parts = delta.split('<think>');
                  const before = parts[0];
                  if (before) { fullText += before; req.onStream!(before); }
                  inThinkBlock = true;
                  thinkBuffer = parts[1] || '';
                  req.onThought?.(thinkBuffer);
                } else if (delta.includes('</think>')) {
                  inThinkBlock = false;
                  const parts = delta.split('</think>');
                  const closing = parts[0];
                  if (closing) {
                    thinkBuffer += closing;
                    req.onThought?.(thinkBuffer);
                  }
                  thinkBuffer = '';
                  const after = delta.split('</think>')[1] || '';
                  if (after) { fullText += after; req.onStream!(after); }
                } else if (inThinkBlock) {
                  thinkBuffer += delta;
                  req.onThought?.(thinkBuffer);
                } else {
                  fullText += delta;
                  req.onStream!(delta);
                }
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
    if (!text.trim()) throw new Error('Gemini returned empty response');
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

    // Response calibration: adjust temperature based on prompt type
    const calibratedTemp = (() => {
      if (req.temperature !== undefined) return req.temperature;
      const lower = req.prompt.toLowerCase();
      if (lower.startsWith('write') || lower.startsWith('draft') || lower.startsWith('compose') || lower.startsWith('create')) return 0.9;
      if (lower.startsWith('summarize') || lower.startsWith('explain') || lower.startsWith('what is') || lower.startsWith('how')) return 0.3;
      if (lower.startsWith('fix') || lower.startsWith('debug') || lower.startsWith('refactor') || lower.startsWith('review')) return 0.2;
      if (lower.startsWith('translate')) return 0.5;
      return 0.7;
    })();
    const loopReq: BrainRequest = { ...req, temperature: calibratedTemp };

    while (iterations < maxIterations) {
      if (req.signal?.aborted) throw new Error('Request aborted');
      iterations++;
      loopReq.prompt = currentPrompt;
      loopReq.history = history;

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
      // Extract memories from final response (not tool results or clarifications)
      this.extractMemories(req.prompt, res.text);
      return res;
    }    throw new Error('Max agentic iterations reached.');
  }

  private async delegateTask(providerName: string, prompt: string, signal?: AbortSignal): Promise<string> {
    const { providers } = useProviderStore.getState();
    const targetProvider = providerName.toLowerCase();
    const config = providers[targetProvider as keyof typeof providers];
    if (!config || !config.enabled) return `Error: Provider ${providerName} is not configured.`;
    
    try {
      const { baseUrl } = PROVIDER_DEFAULTS[targetProvider as keyof typeof PROVIDER_DEFAULTS];
      
      // Sub-agents now get the full GIA system context but are instructed as specialized helpers
      const systemPrompt = buildGiaSystem(prompt) + "\n\nYou are a specialized GIA sub-agent. Help the main agent fulfill the user's request. You have full tool access.";
      
      const body = { 
        model: config.model, 
        messages: [
          { role: 'system', content: systemPrompt }, 
          { role: 'user', content: prompt }
        ], 
        temperature: 0.7, 
        max_tokens: 4096 
      };

      // For sub-agents, we do a single generation but we could also loop. 
      // To keep it simple and avoid depth recursion limits, we do one deep turn.
      const res = await fetch(`${baseUrl}/chat/completions`, { 
        method: 'POST', 
        headers: { 
          'Authorization': `Bearer ${config.apiKey}`, 
          'Content-Type': 'application/json' 
        }, 
        body: JSON.stringify(body), 
        signal 
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || data.content || "Sub-agent failed to respond.";
    } catch (e: any) { 
      return `Error delegating: ${e.message}`; 
    }
  }

  async fetchURL(url: string): Promise<string> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return text.slice(0, 25000);
    } catch (e: any) { throw new Error(`Failed to fetch ${url}: ${e.message}`); }
  }

  private async extractMemories(userMessage: string, assistantResponse: string) {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];
    if (!config?.apiKey) return;

    try {
      const res = await this.generate({
        prompt: `Analyze this conversation exchange and extract any facts worth remembering about the user.

User said: "${userMessage.slice(0, 500)}"
Assistant said: "${assistantResponse.slice(0, 500)}"

Extract ONLY concrete, specific facts about the USER (not general knowledge).
Categories: name, age, location, profession, goals, preferences, struggles, projects, skills, relationships.

If nothing worth remembering, return: []

Return JSON array only, no other text:
[{"key": "user_name", "value": "Sam", "category": "profile", "confidence": 0.95}]

Valid categories: "profile" | "subject" | "score" | "weak_area" | "fact" | "preference" | "session_summary"`,
        systemPrompt: 'You are a memory extraction assistant. Return only valid JSON arrays. Never include markdown.',
        maxTokens: 300,
        temperature: 0.1,
      });

      const cleaned = res.text.replace(/```json|```/g, '').trim();
      const entries = JSON.parse(cleaned);
      if (Array.isArray(entries) && entries.length > 0) {
        const { addMemories } = await import('../store/useMemoryStore').then(m => m.useMemoryStore.getState());
        addMemories(entries);
      }
    } catch {
      // Silent — memory extraction failure should never break the main flow
    }
  }
}

export default GiaBrain.getInstance();
