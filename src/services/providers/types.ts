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
  friendlyError(label: string, e: unknown): string;
  buildOpenAITools(): { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }[];
  buildAnthropicTools(): { type: string; function: { name: string; description: string; input_schema: Record<string, unknown> } }[];
  buildGeminiTools(): { functionDeclarations: { name: string; description: string; parameters: Record<string, unknown> } }[];
}
