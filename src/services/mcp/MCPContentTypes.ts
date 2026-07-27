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
  | 'text/markdown'
  | 'application/octet-stream';

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

export interface MCPToolCallResult {
  success: boolean;
  content?: MCPStructuredResult | MCPStructuredResult[];
  text?: string;
  error?: string;
  sources?: { title: string; url: string }[];
}

export function isStructuredResult(result: unknown): result is MCPStructuredResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'contentType' in result &&
    typeof (result as Record<string, unknown>).contentType === 'string' &&
    'data' in result
  );
}

export function isStructuredResultArray(result: unknown): result is MCPStructuredResult[] {
  return Array.isArray(result) && result.every(isStructuredResult);
}

export function detectContentType(data: string | Uint8Array, filename?: string): MCPContentType {
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const extMap: Record<string, MCPContentType> = {
      epub: 'ebook/epub',
      pdf: 'ebook/pdf',
      lottie: 'motion-graphic/lottie',
      json: 'application/json',
      gif: 'motion-graphic/gif',
      gltf: '3d/gltf',
      glb: '3d/glb',
      usdz: '3d/usdz',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mp3',
      wav: 'audio/wav',
      html: 'code/html',
      css: 'code/css',
      js: 'code/javascript',
      ts: 'code/typescript',
      py: 'code/python',
      md: 'text/markdown',
      txt: 'text/plain',
    };
    if (ext && extMap[ext]) return extMap[ext];
  }

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        return 'application/json';
      } catch { /* not valid JSON, continue */ }
    }
    if (trimmed.startsWith('<?xml') || trimmed.includes('<svg')) return 'image/svg+xml';
    if (trimmed.startsWith('<!DOCTYPE html') || trimmed.includes('<html')) return 'code/html';
    if (trimmed.startsWith('<?xml version="1.0" encoding="UTF-8"?>') && trimmed.includes('package')) return 'ebook/epub';
    return 'text/plain';
  }

  return 'application/octet-stream';
}

export function getRendererForContentType(contentType: MCPContentType): string {
  const renderers: Record<MCPContentType, string> = {
    'ebook/epub': 'EPUBRenderer',
    'ebook/pdf': 'PDFRenderer',
    'motion-graphic/lottie': 'LottieRenderer',
    'motion-graphic/gif': 'GIFRenderer',
    '3d/gltf': 'GLTFRenderer',
    '3d/glb': 'GLBRenderer',
    '3d/usdz': 'USDZRenderer',
    'image/png': 'ImageRenderer',
    'image/jpeg': 'ImageRenderer',
    'image/webp': 'ImageRenderer',
    'image/svg+xml': 'SVGRenderer',
    'video/mp4': 'VideoRenderer',
    'video/webm': 'VideoRenderer',
    'audio/mp3': 'AudioRenderer',
    'audio/wav': 'AudioRenderer',
    'code/html': 'HTMLRenderer',
    'code/css': 'CodeRenderer',
    'code/javascript': 'CodeRenderer',
    'code/typescript': 'CodeRenderer',
    'code/python': 'CodeRenderer',
    'application/json': 'JSONRenderer',
    'text/plain': 'TextRenderer',
    'text/markdown': 'MarkdownRenderer',
    'application/octet-stream': 'DefaultRenderer',
  };
  return renderers[contentType] || 'DefaultRenderer';
}