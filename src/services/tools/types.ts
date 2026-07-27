export type MCPContentType =
  | 'ebook/epub'
  | 'ebook/pdf'
  | 'motion-graphic/lottie'
  | 'motion-graphic/gif'
  | '3d/gltf'
  | '3d/glb'
  | '3d/usdz'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/svg+xml'
  | 'video/mp4'
  | 'video/webm'
  | 'audio/mp3'
  | 'audio/wav'
  | 'code/html'
  | 'code/css'
  | 'code/javascript'
  | 'code/typescript'
  | 'code/python'
  | 'application/json'
  | 'text/plain'
  | 'text/markdown';

export interface MCPContentMetadata {
  title?: string;
  description?: string;
  author?: string;
  tags?: string[];
  createdAt?: number;
  preview?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  duration?: number;
  [key: string]: unknown;
}

export interface MCPStructuredResult {
  contentType: MCPContentType;
  data: Uint8Array | string;
  metadata?: MCPContentMetadata;
  encoding?: 'base64' | 'utf-8' | 'binary';
}

export interface ToolResult {
  success: boolean;
  content: string;
  error?: string;
  sources?: { title: string; url: string }[];
  structuredResult?: MCPStructuredResult | MCPStructuredResult[];
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
    description?: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>, context?: ToolContext) => Promise<ToolResult>;
}
