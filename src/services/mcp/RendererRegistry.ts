import type { MCPContentType, MCPStructuredResult } from './MCPContentTypes';

export interface MCPContentRenderer {
  contentType: MCPContentType;
  canRender(contentType: MCPContentType): boolean;
  render(result: MCPStructuredResult, container: HTMLElement): Promise<void>;
  getPreview?(result: MCPStructuredResult): string;
}

export interface RendererRegistry {
  register(renderer: MCPContentRenderer): void;
  unregister(contentType: MCPContentType): void;
  getRenderer(contentType: MCPContentType): MCPContentRenderer | undefined;
  getAllRenderers(): MCPContentRenderer[];
  render(result: MCPStructuredResult, container: HTMLElement): Promise<void>;
  getPreview(result: MCPStructuredResult): string;
}

function createRendererRegistry(): RendererRegistry {
  const renderers = new Map<MCPContentType, MCPContentRenderer>();

  return {
    register(renderer: MCPContentRenderer) {
      renderers.set(renderer.contentType, renderer);
    },
    unregister(contentType: MCPContentType) {
      renderers.delete(contentType);
    },
    getRenderer(contentType: MCPContentType) {
      return renderers.get(contentType);
    },
    getAllRenderers() {
      return Array.from(renderers.values());
    },
    async render(result: MCPStructuredResult, container: HTMLElement) {
      const renderer = renderers.get(result.contentType);
      if (!renderer) {
        container.innerHTML = `
          <div style="padding: 16px; color: var(--gia-muted); font-size: 12px;">
            No renderer for ${result.contentType}
          </div>
        `;
        return;
      }
      try {
        await renderer.render(result, container);
      } catch (e) {
        console.error(`[Renderer] Failed to render ${result.contentType}:`, e);
        container.innerHTML = `
          <div style="padding: 16px; color: #ef4444; font-size: 12px;">
            Render error: ${e instanceof Error ? e.message : String(e)}
          </div>
        `;
      }
    },
    getPreview(result: MCPStructuredResult) {
      const renderer = renderers.get(result.contentType);
      if (renderer?.getPreview) return renderer.getPreview(result);
      const meta = result.metadata;
      return meta?.preview || meta?.title || result.contentType;
    },
  };
}

export const rendererRegistry = createRendererRegistry();

export function registerDefaultRenderers() {
  // Import and register renderers dynamically to avoid circular deps
  // This will be called during app initialization
}