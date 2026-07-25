export interface BrainRequest {
  prompt: string;
  systemPrompt?: string;
  systemPromptMode?: 'append' | 'replace';
  temperature?: number;
  maxTokens?: number;
  history?: { role: 'user' | 'assistant'; content: string | { type: string; text?: string; source?: { type: string; data: string } }[] }[];
  images?: { name: string; type: string; data: string }[];
  useWebSearch?: boolean;
  useExtendedThinking?: boolean;
  handsOff?: boolean;
  localVision?: boolean;
  onStream?: (chunk: string) => void;
  onThought?: (thought: string) => void;
  signal?: AbortSignal;
  _skipNativeSchemas?: boolean;
  forceJson?: boolean;
  providerId?: string;
  /** Chat message id the assistant's reply (and any tool calls it makes)
   *  belongs to. Passed explicitly through to executeToolBlocks so tool
   *  proposal cards attach to the right message even when more than one
   *  generation is in flight at once (e.g. a new message sent while a
   *  previous turn's tool execution is still finishing). */
  messageId?: string;
  /** Force a specific model on the current provider for this call, bypassing
   *  the provider's stored default model. Used for same-provider failover
   *  (e.g. one OpenCode Zen key that offers several models) without
   *  permanently changing the person's configured model. */
  modelOverride?: string;
  /** Stable key identifying this generation (e.g. `${sessionId}:${messageId}`)
   *  used to persist a resumable checkpoint if a rate limit or outage hits
   *  mid-stream. Without it, resilience still works but can't survive a
   *  full app restart. */
  checkpointKey?: string;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface BrainResponse {
  text: string;
  provider: string;
  model: string;
  sources?: string[];
  modelSwitched?: boolean;
  previousModel?: string;
  switchReason?: string;
  finishReason?: string;
  wasTruncated?: boolean;
  tokenUsage?: TokenUsage;
}

export interface BrainContext {
  buildSystemPrompt(prompt: string, moduleSpecific?: string, mode?: 'append' | 'replace'): string;
  buildMessages(req: BrainRequest): Promise<{ role: string; content: string | { type: string; text?: string; source?: { type: string; data: string } }[] }[]>;
  retryFetch(url: string, options: RequestInit, retries?: number): Promise<Response>;
  friendlyError(label: string, e: unknown, statusCode?: number): string;
  buildOpenAITools(): { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }[];
  buildAnthropicTools(): { type: string; function: { name: string; description: string; input_schema: Record<string, unknown> } }[];
  buildGeminiTools(): { functionDeclarations: { name: string; description: string; parameters: Record<string, unknown> } }[];
}
