export interface ToolResult {
  success: boolean;
  content: string;
  error?: string;
  sources?: { title: string; url: string }[];
}

export interface ToolContext {
  onProgress?: (progress: number, label: string) => void;
  onThought?: (thought: string) => void;
  signal?: AbortSignal;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  schema?: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>, context?: ToolContext) => Promise<ToolResult>;
}
