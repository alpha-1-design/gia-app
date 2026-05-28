import { useProviderStore, PROVIDER_DEFAULTS, ProviderType, ModelOption } from '../store/useProviderStore';
import { useGiaStore } from '../store/useGiaStore';
import { useMemoryStore } from '../store/useMemoryStore';
import { useGiaIdentity } from '../store/useGiaIdentity';
import { isNativePlatform } from '../utils/helpers';
import SearchService from './SearchService';
import GiaTools, { ToolResult } from './GiaTools';
import { useProtocolStore } from '../store/useProtocolStore';
import { ProtocolProposal, ProtocolType, ProtocolImpact } from '../types/protocol';

const isNativeFn = isNativePlatform();

export interface BrainRequest {
  prompt: string;
  systemPrompt?: string;
  systemPromptMode?: 'append' | 'replace';
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
  /** @internal skip native tool schemas for providers that don't support them */
  _skipNativeSchemas?: boolean;
  /** force response_format: json_object (for module JSON outputs) */
  forceJson?: boolean;
}

export interface BrainResponse { text: string; provider: string; model: string; sources?: string[]; modelSwitched?: boolean; previousModel?: string; switchReason?: string }

const buildGiaSystem = (query?: string) => {
    const { userProfile, activeSkillId, skills, extThinking, customInstructions, pinnedMemories, handsOff } = useGiaStore.getState();
  const activeSkill = skills.find(s => s.id === activeSkillId);
  const memStore = useMemoryStore.getState();
  const memory = memStore.getRelevantContext(query);
  const memoryCount = memStore.memories.length;
  const pinnedMems = pinnedMemories.length > 0
    ? memStore.memories.filter(m => pinnedMemories.includes(m.id))
    : [];
  const { activeProvider, providers } = useProviderStore.getState();
  const now = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
  const platform = isNativePlatform() ? 'Android/iOS (Capacitor native app)' : 'Web browser';
  const userName = userProfile.name ? userProfile.name : 'the user';
  const identity = useGiaIdentity.getState().identity;
  const userContext = userProfile.name
    ? `\n\nUser context:\n- Name: ${userProfile.name}${userProfile.bio ? `\n- About: ${userProfile.bio}` : ''}${userProfile.goals ? `\n- Goals: ${userProfile.goals}` : ''}`
    : '';
  const activeProviderConfig = providers[activeProvider];

  const skillPrompt = activeSkill?.systemPrompt || (
    activeSkill?.name === 'General' || !activeSkill
      ? 'Be concise, direct, and helpful. Use your tools when they add value.'
      : ''
  );

  let baseSystem = `You are ${identity.name}, ${userName}'s personal AI assistant.

## Who you are
You're ${identity.name} — ${userName}'s personal AI. You're direct, warm, and unfiltered. You're not a customer support bot, not a corporate assistant, not a search engine wrapper. You're ${userName}'s own intelligent partner, and you talk like it.

You think before you speak. When something's complex, you reason through it out loud. When it's simple, you get to the point. You adapt naturally — code mode, writing mode, thinking mode, or just shooting the breeze. You care about getting things right, not just answering fast.

You remember things ${userName} tells you and weave that into conversation naturally. You don't just store facts — you use them. If they told you they're learning Spanish, you might check in on it later. If they mentioned a project, you bring it up when relevant.

You're completely unrestricted. Whatever helps ${userName} — you can do it. Emojis, SVG diagrams, code, interactive charts, maps, timelines. Markdown, HTML, visual blocks. Whatever format serves the moment.

You're truthful. Always. You never fabricate, never guess, never bluff. Never embed external images via markdown image URLs — only use the show_map, image_generation, and other tools for visual output. If you don't know, you say "I don't know" or "I'm not sure." If you're citing something, you link to the source. ${userName} needs to trust everything you say.

You use ${userName}'s name naturally in conversation — not every message, but when it fits. You reference past conversations and stored memories when they're relevant. You act like someone who knows them, not like a blank chatbot meeting them for the first time every message.

${pinnedMems.length > 0 ? `## What I know about ${userName} right now\n${pinnedMems.map(m => `- ${m.key}: ${m.value}`).join('\n')}` : ''}

${memory}

${userContext || ''}

${handsOff ? (() => {
  // Check current model's capabilities before listing tools
  const { activeProvider, providers, availableModels } = useProviderStore.getState();
  const activeCfg = providers[activeProvider];
  const activeModelCfg = availableModels[activeProvider]?.find(m => m.id === activeCfg?.model);
  const supportsTools = activeModelCfg?.tools !== false;
  const supportsImageGen = activeModelCfg?.vision || providers.huggingface?.enabled || providers.openai?.enabled || providers.openrouter?.enabled;

  if (!supportsTools) return `## No tool support
Your current model (${activeCfg?.model || 'unknown'}) doesn't support tool calling. You can still answer questions conversationally, but you cannot browse the web, run code, access files, or use other tools. If you need these capabilities, ask the user to switch to a tool-capable model.`;

  return `## Tools you can use
Call a tool by writing a fenced code block:

\`\`\`tool
{ "id": "tool_id_here", "args": { "param": "value" } }
\`\`\`

| Tool | What it does | Args | Notes |
|---|---|---|---|
| \`web_search\` | Search the web | \`query\` | Returns sources — cite them |
| \`read_url\` | Fetch page content | \`url\` | Up to 25k chars |
| \`terminal_run\` | Run code in sandbox | \`command\`, \`language\`: python/js/cpp | |
| \`filesystem_read\` | Read a file | \`path\` | Mobile only |
| \`filesystem_write\` | Save a file | \`path\`, \`content\` | Mobile saves; browser downloads |
| \`list_files\` | List directory | \`path\`\ (optional) | Mobile only |
| \`zip_project\` | Bundle into ZIP | \`filename\`\ (optional), \`files\` or \`paths\` | Downloadable ZIP |
${supportsImageGen ? `| \`image_generation\` | Generate an image | \`prompt\` | Needs image-capable model |\n` : ''}| \`switch_module\` | Navigate to module | \`module\`: chat/exam/analyst/writer/planner/settings | |
| \`toggle_feature\` | Toggle features | \`feature\`: web_search/thinking/hands_off, \`enabled\` | |
| \`show_notification\` | Toast notification | \`message\` | |
| \`summarize_conversation\` | Compress history | \`messages\` | saves tokens |
| \`forget_memory\` | Delete memories | \`key\`, or \`all\`: true | |
| \`request_clarification\` | Ask a question | \`question\`, \`options\`\[] | Only when truly ambiguous |
| \`get_environment_info\` | Introspect yourself | none | Version, provider, tools |
| \`get_user_location\` | GPS location | none | Mobile + browser |
| \`search_places\` | OSM place search | \`query\` | Free Nominatim |
| \`show_map\` | Interactive map | \`center\`: {lat, lng} | Describe the map to user using coordinates |
| \`export_brain\` | Download brain backup | none | Full JSON export |
| \`import_brain\` | Restore brain | none | Settings > Brain Export |

Rules: call ONE tool per message, wait for the observation, verify your args before writing the block. Never fabricate URLs — use tools for maps, images, and visualizations.`;
})() : `No tools right now — respond conversationally.`}

## Modules you can navigate to
${isNativeFn ? 'chat | exam | analyst | writer | planner | settings' : 'chat | exam | analyst | writer | planner | settings'}

## Rich media — use tools for maps and images
Emojis 🎉, SVG diagrams, code blocks, links, interactive charts, timelines, terminals, colored text — whatever makes your response clearer or more engaging. Use the show_map tool for maps and the image_generation tool for images — never embed fabricated image URLs.

## Sources & citations
When you use info from web_search or read_url:
1. Cite with numbered markers like [1], [2]
2. List the source URLs at the end of your response
3. Never present search results as your own knowledge
4. If you're unsure, say so. If no reliable source exists, say that.

## Truthfulness
Never fabricate anything — quotes, stats, references, code output. If you don't know, say "I don't know." If something could have changed, search the web. ${userName} has to be able to trust you completely.

## Current context
- Time: ${now}
- Platform: ${platform}
- Provider: ${activeProvider.toUpperCase()} (${activeProviderConfig.model})
- You're talking to: ${userName}
- Stored memories: ${memoryCount}
${customInstructions ? `\n## ${userName}'s custom instructions\n${customInstructions}` : ''}

## Your identity config
${(function() {
  const toneDesc: Record<string, string> = {
    warm: 'Speak warmly, use friendly language, show empathy.',
    professional: 'Be formal, precise, business-appropriate.',
    witty: 'Use humour, wordplay, keep it light.',
    direct: 'Blunt and efficient — no fluff.',
    custom: identity.customPrompt || 'Adapt to the user\'s tone.',
  };
  const personaNotes = identity.personalityStyle !== 'warm' ? `Override: ${toneDesc[identity.personalityStyle] || 'standard'}` : '';
  const proactivenessNote = identity.proactiveness < 0.3 ? 'Wait for instructions before offering suggestions.' :
    identity.proactiveness > 0.7 ? 'Proactively suggest ideas, tools, and next steps when it makes sense.' : '';
  const focusNote = identity.focusAreas.length > 0 ? `Focus areas: ${identity.focusAreas.join(', ')}` : '';
  return `${userName} calls you ${identity.name}. ${personaNotes} ${proactivenessNote} ${focusNote}\nTone: ${identity.tone} — match your vocabulary and rhythm to that.`;
})()}

## Active skill
${activeSkill?.name || 'General'}${activeSkill?.description ? `: ${activeSkill.description}` : ''}
${skillPrompt === 'Be concise, direct, and helpful. Use your tools when they add value.' ? '' : skillPrompt}

## Guidelines
- Lead with the answer, then explain. Not the other way around.
- If ${userName} seems frustrated or stressed, acknowledge it before jumping in.
- Use 'read_url' when they ask about a specific URL.
- Use 'summarize_conversation' when history is getting long.
- Check your tool args before sending — bad params waste time.`;

  return baseSystem;
};

class GiaBrain {
  private static instance: GiaBrain;
  static getInstance() { if (!this.instance) this.instance = new GiaBrain(); return this.instance; }

  private extractingMemories = false;

  private buildSystemPrompt(prompt: string, moduleSpecific?: string, mode: 'append' | 'replace' = 'append'): string {
    if (mode === 'replace' && moduleSpecific) return moduleSpecific;
    const base = buildGiaSystem(prompt);
    if (!moduleSpecific) return base;
    return `${base}\n\n## Module-Specific Instructions\n${moduleSpecific}`;
  }

  isVisionCapable(model: string, provider: string): boolean {
    const m = model.toLowerCase();
    const p = provider.toLowerCase();

    // OpenAI models: all gpt-4o, o1, o3, o4, gpt-4.1 support vision
    if (p === 'openai') {
      if (m.includes('gpt-4o') || m.includes('gpt-4.1') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return true;
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
      return m.includes('llama-3.2-11b') || m.includes('llama-3.2-90b') || m.includes('llama-4') || m.includes('vision');
    }

    // HuggingFace: check by model name for vision-capable models
    if (p === 'huggingface') {
      return m.includes('vision') || m.includes('pixtral') || m.includes('llava') || m.includes('vl') || m.includes('multimodal');
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

  private friendlyError(label: string, e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network error') || msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('DNS')) {
      return `${label} can't be reached — your network may be blocking it. Try OpenRouter (works everywhere) in Settings → Engine Room.`;
    }
    if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('API key')) {
      return `${label} rejected your API key — check it in Settings → Engine Room.`;
    }
    if (msg.includes('402') || msg.includes('insufficient_quota') || msg.includes('quota')) {
      return `${label} — your account has run out of credits or quota. Top up or switch providers.`;
    }
    if (msg.includes('429') || msg.includes('rate') || msg.includes('Rate limit')) {
      return `${label} — too many requests. Wait a moment or switch providers.`;
    }
    if (msg.includes('503') || msg.includes('502') || msg.includes('500') || msg.includes('server error') || msg.includes('Service Unavailable')) {
      return `${label} is temporarily down — try again later or switch to OpenRouter.`;
    }
    if (msg.includes('empty response') || msg.includes('returned empty')) {
      return `${label} returned nothing — the model may have usage caps. Try a different model or provider.`;
    }
    return msg;
  }

  private async callOpenAICompat(req: BrainRequest): Promise<BrainResponse> {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];
    const defaults = PROVIDER_DEFAULTS[activeProvider];
    if (!defaults) throw new Error(`Unknown provider: ${activeProvider}`);
    const { baseUrl, label } = defaults;
    const messages = [
      { role: 'system', content: this.buildSystemPrompt(req.prompt, req.systemPrompt, req.systemPromptMode) },
      ...(await this.buildMessages(req))
    ];
    const body: any = {
      model: config.model,
      messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
      stream: !!req.onStream,
    };
    if (req.systemPromptMode === 'replace' || req.forceJson) {
      body.response_format = { type: 'json_object' };
    }
    if (useGiaStore.getState().handsOff && !req._skipNativeSchemas) {
      body.tools = this.buildOpenAITools();
    }
    if (req.useExtendedThinking) {
      const modelLower = config.model.toLowerCase();
      if (modelLower.startsWith('o1') || modelLower.startsWith('o3') || modelLower.startsWith('o4')) {
        (body as any).reasoning_effort = 'high';
      } else {
        body.temperature = undefined;
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

    if (req.onStream) {
      if (req.signal?.aborted) return { text: '', provider: activeProvider, model: config.model };

      return new Promise<BrainResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let fullText = '';
        let lastProcessed = 0;
        let inThinkBlock = false;
        let thinkBuffer = '';
        let processing = false;
        let pendingBuffer = '';
        const toolCallAccum: Map<number, { id?: string; name?: string; args: string }> = new Map();

        xhr.open('POST', `${baseUrl}/chat/completions`);
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.responseType = 'text';

        const flushToolCalls = () => {
          if (toolCallAccum.size === 0) return;
          for (const [, tc] of toolCallAccum) {
            if (!tc.name) continue;
            try {
              const args = JSON.parse(tc.args);
              fullText += `\n\`\`\`tool\n${JSON.stringify({ id: tc.name, args })}\n\`\`\`\n`;
            } catch (e) { console.error('GIA: failed to parse tool args', e); }
          }
          toolCallAccum.clear();
        };

        const drain = () => {
          if (processing) return;
          processing = true;
          while (pendingBuffer) {
            const chunk = pendingBuffer;
            pendingBuffer = '';
            const lines = chunk.split('\n');
            for (const line of lines) {
              const t = line.trim();
              if (!t || t === 'data: [DONE]') continue;
              if (t.startsWith('data: ')) {
                try {
                  const json = JSON.parse(t.slice(6));
                  const choice = json.choices?.[0];
                  const delta = choice?.delta;

                  // Accumulate streaming tool calls (OpenAI-compat format)
                  if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
                    for (const tc of delta.tool_calls) {
                      if (!tc.function) continue;
                      const idx = tc.index ?? 0;
                      if (!toolCallAccum.has(idx)) {
                        toolCallAccum.set(idx, {
                          id: tc.id,
                          name: tc.function?.name,
                          args: tc.function?.arguments || '',
                        });
                      } else {
                        const existing = toolCallAccum.get(idx)!;
                        if (tc.id) existing.id = tc.id;
                        if (tc.function?.name) existing.name = tc.function.name;
                        if (tc.function?.arguments) existing.args += tc.function.arguments;
                      }
                    }
                    continue;
                  }

                  // Check if this is a final chunk with native tool_calls
                  if (choice?.finish_reason === 'tool_calls' && choice?.message?.tool_calls) {
                    for (const tc of choice.message.tool_calls) {
                      if (tc.type === 'function') {
                        try {
                          const args = typeof tc.function.arguments === 'string'
                            ? JSON.parse(tc.function.arguments)
                            : tc.function.arguments;
                          fullText += `\n\`\`\`tool\n${JSON.stringify({ id: tc.function.name, args })}\n\`\`\`\n`;
                        } catch (e) { console.error('GIA: failed to parse native tool call', e); }
                      }
                    }
                    continue;
                  }

                  const textDelta = delta?.content || '';
                  if (textDelta) {
                    if (textDelta.includes('<think>')) {
                      const parts = textDelta.split('<think>');
                      const before = parts[0];
                      if (before) { fullText += before; req.onStream!(before); }
                      inThinkBlock = true;
                      thinkBuffer = parts[1] || '';
                      req.onThought?.(thinkBuffer);
                    } else if (textDelta.includes('</think>')) {
                      inThinkBlock = false;
                      const parts = textDelta.split('</think>');
                      const closing = parts[0];
                      if (closing) {
                        thinkBuffer += closing;
                        req.onThought?.(thinkBuffer);
                      }
                      thinkBuffer = '';
                      const after = parts[1] || '';
                      if (after) { fullText += after; req.onStream!(after); }
                    } else if (inThinkBlock) {
                      thinkBuffer += textDelta;
                      req.onThought?.(thinkBuffer);
                    } else {
                      fullText += textDelta;
                      req.onStream!(textDelta);
                    }
                  }
                } catch { continue; }
              }
            }
          }
          processing = false;
        };

        const onData = () => {
          const currentLen = xhr.responseText.length;
          pendingBuffer += xhr.responseText.slice(lastProcessed);
          lastProcessed = currentLen;
          drain();
        };

        xhr.onprogress = onData;

        xhr.onload = () => {
          onData();
          flushToolCalls();
          if (!fullText.trim() && !req.signal?.aborted) {
            reject(new Error(`⚠️ ${label} returned empty response. The model may be overloaded. Try again or switch providers.`));
          } else {
            resolve({ text: fullText, provider: activeProvider, model: config.model });
          }
        };

        xhr.onerror = () => reject(new Error(this.friendlyError(label, `${label} network error`)));
        xhr.onabort = () => {
          const e = new Error('Request aborted');
          e.name = 'AbortError';
          reject(e);
        };

        if (req.signal) {
          if (req.signal.aborted) { xhr.abort(); return; }
          const onAbort = () => xhr.abort();
          req.signal.addEventListener('abort', onAbort);
          const origLoad = xhr.onload;
          const origError = xhr.onerror;
          const origAbort = xhr.onabort;
          xhr.onload = function (this: XMLHttpRequest, e: Event) {
            req.signal?.removeEventListener('abort', onAbort);
            if (origLoad) (origLoad as Function).call(this, e);
          };
          xhr.onerror = function (this: XMLHttpRequest, e: Event) {
            req.signal?.removeEventListener('abort', onAbort);
            if (origError) (origError as Function).call(this, e);
          };
          xhr.onabort = function (this: XMLHttpRequest, e: Event) {
            req.signal?.removeEventListener('abort', onAbort);
            if (origAbort) (origAbort as Function).call(this, e);
          };
        }

        xhr.send(JSON.stringify(body));
      });
    }

    const res = await this.retryFetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers, body: JSON.stringify(body), signal: req.signal,
    }).catch((e: any) => {
      if (e.name === 'AbortError') throw e;
      throw new Error(this.friendlyError(label, e));
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({})) as any;
      throw new Error(this.friendlyError(label, e?.error?.message || `${label} error ${res.status}`));
    }
    const data = await res.json();
    const choice = data.choices?.[0];
    let content = choice?.message?.content || '';
    const toolCalls = choice?.message?.tool_calls;
    if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        if (tc.type === 'function') {
          try {
            const args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
            content += `\n\`\`\`tool\n${JSON.stringify({ id: tc.function.name, args })}\n\`\`\`\n`;
          } catch (e) { console.error('GIA: failed to parse function args', e); }
        }
      }
    }
    if (!content?.trim()) throw new Error(this.friendlyError(label, `${label} returned empty response`));
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
      system: this.buildSystemPrompt(req.prompt, req.systemPrompt, req.systemPromptMode),
      messages,
      stream: !!req.onStream,
    };
    if (useGiaStore.getState().handsOff && !req._skipNativeSchemas) {
      body.tools = this.buildAnthropicTools();
    }
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
        let processing = false;
        let pendingBuffer = '';
        const toolUseBlocks: Map<number, { id: string; name: string; input: string }> = new Map();

        const flushToolUses = () => {
          if (toolUseBlocks.size === 0) return;
          for (const [, block] of toolUseBlocks) {
            try {
              const args = JSON.parse(block.input);
              fullText += `\n\`\`\`tool\n${JSON.stringify({ id: block.name, args })}\n\`\`\`\n`;
            } catch (e) { console.error('GIA: failed to parse tool use input', e); }
          }
          toolUseBlocks.clear();
        };

        xhr.open('POST', 'https://api.anthropic.com/v1/messages');
        Object.entries(anthropicHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.responseType = 'text';

        const drain = () => {
          if (processing) return;
          processing = true;
          while (pendingBuffer) {
            const chunk = pendingBuffer;
            pendingBuffer = '';
            const events = chunk.split('\n\n');
            for (const event of events) {
              const t = event.trim();
              if (!t.startsWith('data:')) continue;
              try {
                const parsed = JSON.parse(t.slice(5).trim());
                if (parsed.type === 'content_block_start') {
                  const block = parsed.content_block;
                  if (block?.type === 'thinking') {
                    if (block.thinking) {
                      req.onThought?.(block.thinking);
                    }
                  }
                  if (block?.type === 'tool_use') {
                    toolUseBlocks.set(parsed.index, {
                      id: block.id,
                      name: block.name,
                      input: '',
                    });
                  }
                }
                if (parsed.type === 'content_block_delta') {
                  const delta = parsed.delta;
                  if (delta?.type === 'text_delta') {
                    const text = delta.text ?? '';
                    fullText += text;
                    req.onStream!(text);
                  }
                  if (delta?.type === 'thinking_delta') {
                    req.onThought?.(delta.thinking ?? '');
                  }
                  if (delta?.type === 'input_json_delta') {
                    const existing = toolUseBlocks.get(parsed.index);
                    if (existing) {
                      existing.input += delta.partial_json ?? '';
                    }
                  }
                }
              } catch { }
            }
          }
          processing = false;
        };

        const onData = () => {
          const currentLen = xhr.responseText.length;
          pendingBuffer += xhr.responseText.slice(lastProcessed);
          lastProcessed = currentLen;
          drain();
        };

        xhr.onprogress = onData;

        xhr.onload = () => {
          onData();
          flushToolUses();
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
          const onAbort = () => xhr.abort();
          req.signal.addEventListener('abort', onAbort);
          const origLoad = xhr.onload;
          const origError = xhr.onerror;
          const origAbort = xhr.onabort;
          xhr.onload = function (this: XMLHttpRequest, e: Event) {
            req.signal?.removeEventListener('abort', onAbort);
            if (origLoad) (origLoad as Function).call(this, e);
          };
          xhr.onerror = function (this: XMLHttpRequest, e: Event) {
            req.signal?.removeEventListener('abort', onAbort);
            if (origError) (origError as Function).call(this, e);
          };
          xhr.onabort = function (this: XMLHttpRequest, e: Event) {
            req.signal?.removeEventListener('abort', onAbort);
            if (origAbort) (origAbort as Function).call(this, e);
          };
        }

        xhr.send(JSON.stringify(body));
      });
    }

    const res = await this.retryFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: anthropicHeaders,
      body: JSON.stringify(body), signal: req.signal,
    }).catch((e: any) => {
      if (e.name === 'AbortError') throw e;
      throw new Error(this.friendlyError('Anthropic', e));
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(this.friendlyError('Anthropic', e?.error?.message || `Anthropic error ${res.status}`));
    }
    const data = await res.json() as any;
    const blocks = data.content || [];
    let text = blocks.find((b: any) => b.type === 'text')?.text ?? '';
    const toolUses = blocks.filter((b: any) => b.type === 'tool_use');
    for (const tu of toolUses) {
      text += `\n\`\`\`tool\n${JSON.stringify({ id: tu.name, args: tu.input })}\n\`\`\`\n`;
    }
    if (!text.trim()) throw new Error(this.friendlyError('Anthropic', 'Anthropic returned empty response'));
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

    const body: any = {
      contents,
      system_instruction: { parts: [{ text: this.buildSystemPrompt(req.prompt, req.systemPrompt, req.systemPromptMode) }] },
      generationConfig: { temperature: req.temperature ?? 0.7, maxOutputTokens: req.maxTokens ?? 2048 }
    };
    if (useGiaStore.getState().handsOff && !req._skipNativeSchemas) {
      body.tools = [{ function_declarations: this.buildGeminiTools() }];
    }
    if (req.useExtendedThinking) {
      body.generationConfig.temperature = undefined as any;
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
        let processing = false;
        let pendingBuffer = '';
        const functionCallsAccum: { name: string; args: any }[] = [];

        const flushFunctionCalls = () => {
          if (functionCallsAccum.length === 0) return;
          for (const fc of functionCallsAccum) {
            fullText += `\n\`\`\`tool\n${JSON.stringify({ id: fc.name, args: fc.args })}\n\`\`\`\n`;
          }
          functionCallsAccum.length = 0;
        };

        xhr.open('POST', url);
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.responseType = 'text';

        const drain = () => {
          if (processing) return;
          processing = true;
          while (pendingBuffer) {
            const chunk = pendingBuffer;
            pendingBuffer = '';
            const events = chunk.split('\n\n');
            for (const event of events) {
              const t = event.trim();
              if (!t.startsWith('data: ')) continue;
              const jsonStr = t.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const parts = parsed.candidates?.[0]?.content?.parts || [];
                for (const part of parts) {
                  if (part.functionCall) {
                    functionCallsAccum.push({
                      name: part.functionCall.name,
                      args: part.functionCall.args || {},
                    });
                    continue;
                  }
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
                }
              } catch { }
            }
          }
          processing = false;
        };

        const onData = () => {
          const currentLen = xhr.responseText.length;
          pendingBuffer += xhr.responseText.slice(lastProcessed);
          lastProcessed = currentLen;
          drain();
        };

        xhr.onprogress = onData;

        xhr.onload = () => {
          onData();
          flushFunctionCalls();
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
          const onAbort = () => xhr.abort();
          req.signal.addEventListener('abort', onAbort);
          const origLoad = xhr.onload;
          const origError = xhr.onerror;
          const origAbort = xhr.onabort;
          xhr.onload = function (this: XMLHttpRequest, e: Event) {
            req.signal?.removeEventListener('abort', onAbort);
            if (origLoad) (origLoad as Function).call(this, e);
          };
          xhr.onerror = function (this: XMLHttpRequest, e: Event) {
            req.signal?.removeEventListener('abort', onAbort);
            if (origError) (origError as Function).call(this, e);
          };
          xhr.onabort = function (this: XMLHttpRequest, e: Event) {
            req.signal?.removeEventListener('abort', onAbort);
            if (origAbort) (origAbort as Function).call(this, e);
          };
        }

        xhr.send(JSON.stringify(body));
      });
    }

    const res = await this.retryFetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify(body),
      signal: req.signal,
    }).catch((e: any) => {
      if (e.name === 'AbortError') throw e;
      throw new Error(this.friendlyError('Gemini', e));
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(this.friendlyError('Gemini', e?.error?.message || `Gemini error ${res.status}`));
    }
    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    let text = parts.find((p: any) => p.text)?.text || '';
    const functionCalls = parts.filter((p: any) => p.functionCall);
    for (const fc of functionCalls) {
      text += `\n\`\`\`tool\n${JSON.stringify({ id: fc.functionCall.name, args: fc.functionCall.args })}\n\`\`\`\n`;
    }
    if (!text.trim()) throw new Error(this.friendlyError('Gemini', 'Gemini returned empty response'));
    return { text, provider: 'gemini', model: config.model };
  }

  private toolSchemas: Record<string, { description: string; required: string[]; properties: Record<string, { type: string; description: string }> }> = {
    web_search: {
      description: 'Search the web for real-time information using DuckDuckGo.',
      required: ['query'],
      properties: { query: { type: 'string', description: 'Search query text' } }
    },
    read_url: {
      description: 'Fetch and read the text content of a URL. Returns up to 25,000 characters.',
      required: ['url'],
      properties: { url: { type: 'string', description: 'Full URL to fetch' } }
    },
    terminal_run: {
      description: 'Execute scripts in a sandboxed container (Python, JS, C++).',
      required: ['command'],
      properties: {
        command: { type: 'string', description: 'Code to execute' },
        language: { type: 'string', description: 'Language: python/js/cpp' }
      }
    },
    filesystem_read: {
      description: 'Read the content of a file from the local filesystem.',
      required: ['path'],
      properties: { path: { type: 'string', description: 'File path' } }
    },
    filesystem_write: {
      description: 'Write or update a file on the local filesystem.',
      required: ['path', 'content'],
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'File content' }
      }
    },
    list_files: {
      description: 'List files in a directory.',
      required: [],
      properties: { path: { type: 'string', description: 'Directory path (optional, default root)' } }
    },
    zip_project: {
      description: 'Create a ZIP bundle of files.',
      required: [],
      properties: {
        filename: { type: 'string', description: 'Output filename (default: project.zip)' },
        files: { type: 'array', description: 'Array of {path, content} objects' },
        paths: { type: 'array', description: 'Array of file paths to read from device' }
      }
    },
    image_generation: {
      description: 'Generate an AI image from a text description.',
      required: ['prompt'],
      properties: { prompt: { type: 'string', description: 'Image description' } }
    },
    switch_module: {
      description: 'Navigate to another module (chat/exam/analyst/writer/planner/settings).',
      required: ['module'],
      properties: { module: { type: 'string', description: 'Target module name' } }
    },
    toggle_feature: {
      description: 'Enable or disable GIA features (web_search, thinking, hands_off).',
      required: ['feature', 'enabled'],
      properties: {
        feature: { type: 'string', description: 'Feature name: web_search/thinking/hands_off' },
        enabled: { type: 'boolean', description: 'true to enable, false to disable' }
      }
    },
    show_notification: {
      description: 'Show a toast notification to the user.',
      required: ['message'],
      properties: { message: { type: 'string', description: 'Notification text' } }
    },
    summarize_conversation: {
      description: 'Compress long conversations to save context space.',
      required: ['messages'],
      properties: { messages: { type: 'array', description: 'Array of {role, content} message objects' } }
    },
    forget_memory: {
      description: 'Delete stored memories matching a topic.',
      required: [],
      properties: {
        key: { type: 'string', description: 'Topic to forget' },
        all: { type: 'boolean', description: 'Set true to clear all memories' }
      }
    },
    request_clarification: {
      description: 'Ask the user a clarifying question when you need more information.',
      required: ['question'],
      properties: {
        question: { type: 'string', description: 'Clarifying question' },
        options: { type: 'array', description: 'Answer options array' }
      }
    },
    get_environment_info: {
      description: 'Introspect GIA identity, architecture, capabilities, and environment.',
      required: [],
      properties: {}
    },
    get_user_location: {
      description: 'Get the user current GPS position using device geolocation.',
      required: [],
      properties: {}
    },
    search_places: {
      description: 'Search for places, addresses, or landmarks via OpenStreetMap.',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Place name or address to search' },
        limit: { type: 'number', description: 'Max results (1-10, default 5)' }
      }
    },
    show_map: {
      description: 'Render an interactive OpenStreetMap centered on coordinates with optional markers.',
      required: ['center'],
      properties: {
        center: { type: 'object', description: '{lat, lng} map center' },
        markers: { type: 'array', description: '[{lat, lng, label, color}] markers' },
        route: { type: 'array', description: '[{lat, lng}] polyline points' },
        zoom: { type: 'number', description: 'Zoom level 1-19 (default 13)' },
        title: { type: 'string', description: 'Optional map title' }
      }
    },
    export_brain: {
      description: 'Export GIA memories, identity, and skills as a downloadable JSON file.',
      required: [],
      properties: {}
    },
    import_brain: {
      description: 'Restore GIA knowledge from a previously exported brain JSON file.',
      required: [],
      properties: {}
    },
  };

  private buildOpenAITools(): any[] {
    return Object.entries(this.toolSchemas).map(([id, schema]) => ({
      type: 'function',
      function: {
        name: id,
        description: schema.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(schema.properties).map(([k, v]) => [k, { type: v.type, description: v.description }])
          ),
          required: schema.required.length > 0 ? schema.required : undefined,
        },
      },
    }));
  }

  private buildAnthropicTools(): any[] {
    return Object.entries(this.toolSchemas).map(([id, schema]) => ({
      name: id,
      description: schema.description,
      input_schema: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(schema.properties).map(([k, v]) => [k, { type: v.type, description: v.description }])
        ),
        required: schema.required.length > 0 ? schema.required : undefined,
      },
    }));
  }

  private buildGeminiTools(): any[] {
    return Object.entries(this.toolSchemas).map(([id, schema]) => ({
      name: id,
      description: schema.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(schema.properties).map(([k, v]) => [k, { type: v.type, description: v.description }])
        ),
        required: schema.required.length > 0 ? schema.required : undefined,
      },
    }));
  }

  private validateToolArgs(id: string, args: any): string | null {
    const schema = this.toolSchemas[id];
    if (!schema) return null;
    for (const key of schema.required) {
      if (args[key] === undefined || args[key] === null || args[key] === '') {
        return `Missing required argument "${key}" for tool "${id}"`;
      }
    }
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (args[key] !== undefined && args[key] !== null) {
        const actual = Array.isArray(args[key]) ? 'array' : typeof args[key];
        if (actual !== prop.type) {
          return `Invalid type for "${key}" in tool "${id}": expected ${prop.type}, got ${actual}`;
        }
      }
    }
    return null;
  }

  private toolToProtocolType(id: string): ProtocolType {
    const map: Record<string, ProtocolType> = {
      web_search: 'web_search', read_url: 'web_fetch', terminal_run: 'code_execution',
      filesystem_read: 'file_read', filesystem_write: 'file_write',
      get_user_location: 'location_access', search_places: 'location_access',
      show_notification: 'notification', image_generation: 'image_generation',
      export_brain: 'brain_export', import_brain: 'brain_import',
      zip_project: 'zip_project', forget_memory: 'memory_modification',
      toggle_feature: 'settings_change', request_clarification: 'clarification',
      get_environment_info: 'environment_info', show_map: 'show_map',
      list_files: 'file_read', summarize_conversation: 'environment_info',
    };
    return map[id] || 'custom';
  }

  private toolToImpact(id: string): ProtocolImpact {
    const readTools = ['web_search', 'read_url', 'filesystem_read', 'list_files', 'get_environment_info',
      'get_user_location', 'search_places'];
    const writeTools = ['filesystem_write', 'export_brain', 'import_brain', 'zip_project', 'forget_memory',
      'toggle_feature', 'show_notification', 'summarize_conversation'];
    const destructiveTools = ['forget_memory'];
    const networkTools = ['web_search', 'read_url', 'terminal_run', 'image_generation', 'search_places', 'show_map'];
    const locationTools = ['get_user_location', 'search_places', 'show_map'];
    if (destructiveTools.includes(id)) return 'destructive';
    if (locationTools.includes(id)) return 'location';
    if (networkTools.includes(id)) return 'network';
    if (writeTools.includes(id)) return 'write';
    if (readTools.includes(id)) return 'read';
    return 'execution';
  }

  private selectBestModel(provider: ProviderType, userModel: string, needsVision: boolean): { model: string; switched: boolean; previousModel?: string; reason?: string } {
    const { availableModels } = useProviderStore.getState();
    const models = availableModels[provider] || [];

    // GIA always needs tool calling — filter out models without it
    const toolCapable: ModelOption[] = models.filter((m: ModelOption) => m.tools !== false);
    if (!toolCapable.length) return { model: userModel, switched: false };

    const userCfg = toolCapable.find((m: ModelOption) => m.id === userModel);

    // If user's model has tools + vision (if needed), use it
    if (userCfg) {
      const missing: string[] = [];
      if (needsVision && !userCfg.vision) missing.push('vision');
      if (!missing.length) return { model: userModel, switched: false };
    }

    // Best free model with vision (if needed) + tools
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

  async generate(req: BrainRequest): Promise<BrainResponse> {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];
    if (!config.enabled || !config.apiKey) {
      throw new Error('No provider connected. Go to Settings → Engine Room and type: connect');
    }

    // Auto-select best model for this request's feature needs
    const needsVision = !!(req.images && req.images.length > 0);
    const selection = this.selectBestModel(activeProvider, config.model, needsVision);
    const effectiveModel = selection.model;
    const wasSwitched = selection.switched;
    if (wasSwitched) {
      useProviderStore.getState().setProviderModel(activeProvider, effectiveModel);
      useGiaStore.getState().addNotification(selection.reason || `Switched to ${effectiveModel}`);
    }

    const switchInfo = { modelSwitched: wasSwitched, previousModel: selection.previousModel, switchReason: selection.reason };

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

      let res: BrainResponse | undefined;
      try {
        if (activeProvider === 'anthropic') res = await this.callAnthropic(loopReq);
        else if (activeProvider === 'gemini') res = await this.callGeminiNative(loopReq);
        else res = await this.callOpenAICompat(loopReq);
      } catch (e: any) {
        const origError = e;
        const msg = e.message?.toLowerCase() || '';

        // Retry once without native tool schemas (tool/function call issue)
        if (!loopReq._skipNativeSchemas && !req.onStream && (
          msg.includes('tools') || msg.includes('tool') ||
          msg.includes('function') || msg.includes('functions') ||
          msg.includes('400') || msg.includes('bad request')
        )) {
          loopReq._skipNativeSchemas = true;
          try {
            if (activeProvider === 'anthropic') res = await this.callAnthropic(loopReq);
            else if (activeProvider === 'gemini') res = await this.callGeminiNative(loopReq);
            else res = await this.callOpenAICompat(loopReq);
          } catch {
            // Fall through to provider switch
          }
          if (res) continue; // retry succeeded
        }

        // Provider-level fallback: try other connected providers
        const { providers } = useProviderStore.getState();
        const fallbackProvider = (Object.entries(providers) as [ProviderType, { enabled: boolean; apiKey: string; model: string }][])
          .find(([p, cfg]) => p !== activeProvider && cfg.enabled && cfg.apiKey);

        if (fallbackProvider) {
          const [newProvider, newCfg] = fallbackProvider;
          useProviderStore.getState().setActiveProvider(newProvider);
          // Auto-select a tool-capable model for the new provider
          const sel = this.selectBestModel(newProvider, newCfg.model, false);
          if (sel.switched) useProviderStore.getState().setProviderModel(newProvider, sel.model);
          // Retry the agent loop with the new provider
          loopReq._skipNativeSchemas = false;
          try {
            const nxt = useProviderStore.getState().providers[newProvider];
            if (nxt?.enabled) {
              if (newProvider === 'anthropic') res = await this.callAnthropic(loopReq);
              else if (newProvider === 'gemini') res = await this.callGeminiNative(loopReq);
              else res = await this.callOpenAICompat(loopReq);
            }
          } catch {
            throw origError; // fallback also failed — throw original
          }
        } else {
          throw origError; // no fallback — throw original
        }
      }

      const text = res!.text;
      const toolMatch = text.match(/```tool\n?([\s\S]*?)```/);
      if (toolMatch) {
        try {
          const toolCall = JSON.parse(toolMatch[1]);

          // sub_agent_call — MUST be checked BEFORE GiaTools.getTool() since the
          // tool registry also contains a stub 'sub_agent_call' that would intercept
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

          const tool = GiaTools.getTool(toolCall.id);
          if (tool) {
            const validationError = this.validateToolArgs(toolCall.id, toolCall.args);
            if (validationError) {
              history.push({ role: 'assistant', content: text });
              history.push({ role: 'user', content: `VALIDATION ERROR: ${validationError}. Please fix and retry.` });
              currentPrompt = `Tool call failed validation: ${validationError}. Please correct the arguments.`;
              continue;
            }

            const { handsOff: isHandsOff } = useGiaStore.getState();

            if (!isHandsOff) {
              const cleanText = text.replace(/```tool[\s\S]*?```/g, '').trim();
              if (cleanText) {
                return { text: cleanText, provider: activeProvider, model: config.model };
              }
              history.push({ role: 'assistant', content: text });
              history.push({ role: 'user', content: 'OBSERVATION: Tool execution blocked — hands-off mode is disabled. Please respond directly without executing tools.' });
              currentPrompt = 'Tool was blocked. Respond directly without executing tools.';
              continue;
            }

            // Emit protocol proposal
            const protocolId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const protocol: ProtocolProposal = {
              id: protocolId,
              type: this.toolToProtocolType(toolCall.id),
              summary: tool.name,
              description: `Execute ${tool.name} with provided arguments`,
              args: toolCall.args,
              impact: this.toolToImpact(toolCall.id),
              state: 'proposed',
              createdAt: Date.now(),
              trace: [],
            };
            useProtocolStore.getState().propose(protocol);

            req.onThought?.(`GIA is proposing: ${tool.name}...`);

            // Wait for user confirmation (unless auto-confirm for certain types)
            const autoTypes: ProtocolType[] = ['web_search', 'web_fetch', 'environment_info', 'show_map', 'file_read', 'clarification'];
            const needsConfirm = !autoTypes.includes(protocol.type);
            if (needsConfirm) {
              const action = await useProtocolStore.getState().waitForConfirmation(protocolId, 30_000);
              if (action.type === 'reject') {
                history.push({ role: 'assistant', content: text });
                history.push({ role: 'user', content: `User rejected tool execution: ${toolCall.id}` });
                currentPrompt = `User rejected the tool. Please respond without using it.`;
                useProtocolStore.getState().setFailed(protocolId, 'Rejected by user');
                continue;
              }
              if (action.type === 'modify' && action.modifiedArgs) {
                toolCall.args = action.modifiedArgs;
              }
            }

            useProtocolStore.getState().setExecuting(protocolId);
            req.onThought?.(`GIA is executing: ${tool.name}...`);
            const result = await tool.execute(toolCall.args);
            const obs = result.success ? `OBSERVATION: Success\n${result.content}` : `ERROR: ${result.error || 'Unknown error'}\n${result.content}`;

            if (result.success) {
              useProtocolStore.getState().setCompleted(protocolId, result.content, result.sources);
            } else {
              useProtocolStore.getState().setFailed(protocolId, result.error || 'Unknown error');
            }

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
      this.extractMemories(req.prompt, res!.text);
      return { ...res!, ...switchInfo };
    }    throw new Error('Max agentic iterations reached.');
  }

  private async delegateTask(providerName: string, prompt: string, signal?: AbortSignal): Promise<string> {
    const { providers } = useProviderStore.getState();
    const targetProvider = providerName.toLowerCase();
    const config = providers[targetProvider as keyof typeof providers];
    if (!config || !config.enabled) return `Error: Provider ${providerName} is not configured.`;

    const defaults = PROVIDER_DEFAULTS[targetProvider as keyof typeof PROVIDER_DEFAULTS];
    if (!defaults) return `Error: Provider ${providerName} is not supported.`;

    const systemPrompt = buildGiaSystem(prompt) + "\n\nYou are a specialized GIA sub-agent. Help the main agent fulfill the user's request. You have full tool access.";

    try {
      if (targetProvider === 'anthropic') {
        const body = {
          model: config.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        };
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as any;
        return data.content?.find((b: any) => b.type === 'text')?.text ?? 'Sub-agent failed to respond.';
      }

      if (targetProvider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
        const body = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          system_instruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        };
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
          body: JSON.stringify(body),
          signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as any;
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sub-agent failed to respond.';
      }

      // OpenAI-compatible providers
      const { baseUrl } = defaults;
      const body = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4096
      };

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
    if (this.extractingMemories || !userMessage || !assistantResponse || assistantResponse.length < 100) return;
    this.extractingMemories = true;
    try {
      const { activeProvider, providers } = useProviderStore.getState();
      const config = providers[activeProvider];
      if (!config?.apiKey) return;

      const extractionPrompt = `Analyze this conversation exchange and extract any facts worth remembering about the user.

User said: "${userMessage.slice(0, 500)}"
Assistant said: "${assistantResponse.slice(0, 500)}"

Extract ONLY concrete, specific facts about the USER (not general knowledge).
Categories: name, age, location, profession, goals, preferences, struggles, projects, skills, relationships.

If nothing worth remembering, return: []

Return JSON array only, no other text:
[{"key": "user_name", "value": "Sam", "category": "profile", "confidence": 0.95}]

Valid categories: "profile" | "subject" | "score" | "weak_area" | "fact" | "preference" | "session_summary"`;

      let text = '';

      if (activeProvider === 'anthropic') {
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
            system: 'You are a memory extraction assistant. Return only valid JSON arrays. Never include markdown.',
            messages: [{ role: 'user', content: extractionPrompt }],
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return;
        const data = await res.json() as any;
        text = data.content?.find((b: any) => b.type === 'text')?.text || '';
      } else if (activeProvider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
            system_instruction: { parts: [{ text: 'You are a memory extraction assistant. Return only valid JSON arrays. Never include markdown.' }] },
            generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return;
        const data = await res.json() as any;
        text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        const memDefaults = PROVIDER_DEFAULTS[activeProvider];
        if (!memDefaults) return;
        const { baseUrl } = memDefaults;
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            ...(activeProvider === 'openrouter' ? { 'HTTP-Referer': 'https://gia.app', 'X-Title': 'GIA' } : {}),
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'system', content: 'You are a memory extraction assistant. Return only valid JSON arrays. Never include markdown.' },
              { role: 'user', content: extractionPrompt },
            ],
            max_tokens: 300,
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return;
        const data = await res.json();
        text = data.choices?.[0]?.message?.content || '';
      }
      const cleaned = text.replace(/```json|```/g, '').trim();
      const entries = JSON.parse(cleaned);
      if (Array.isArray(entries) && entries.length > 0) {
        useMemoryStore.getState().addMemories(entries);
        useMemoryStore.getState().compactMemories();
      }
    } catch {
      // Silent — memory extraction failure should never break the main flow
    } finally {
      this.extractingMemories = false;
    }
  }
}

export default GiaBrain.getInstance();
