export interface RenderItem {
  contentType?: string;
  data?: string | Uint8Array | unknown;
  metadata?: {
    title?: string;
    description?: string;
  };
  encoding?: string;
  [key: string]: unknown;
}

export type Renderer = (item: RenderItem, container: HTMLElement) => void;

export class RendererRegistry {
  private renderers: Map<string, Renderer> = new Map();

  constructor() {
    this.registerDefaultRenderers();
  }

  public register(contentType: string, renderer: Renderer): void {
    this.renderers.set(contentType.toLowerCase(), renderer);
  }

  public render(item: RenderItem, container: HTMLElement): void {
    if (!item) return;
    const contentType = (item.contentType || 'text/plain').toLowerCase();

    for (const [type, renderer] of this.renderers.entries()) {
      if (contentType.includes(type)) {
        renderer(item, container);
        return;
      }
    }

    this.defaultRenderer(item, container);
  }

  private registerDefaultRenderers(): void {
    this.register('image/', (item, container) => {
      const img = document.createElement('img');
      img.style.maxWidth = '100%';
      img.style.borderRadius = '8px';
      img.style.marginTop = '4px';

      if (typeof item.data === 'string') {
        img.src = item.data.startsWith('data:')
          ? item.data
          : `data:${item.contentType || 'image/png'};base64,${item.data}`;
      } else if (item.data instanceof Uint8Array) {
        const blob = new Blob([item.data as unknown as BlobPart], { type: item.contentType || 'image/png' });
        img.src = URL.createObjectURL(blob);
      }
      if (item.metadata?.title) {
        img.alt = item.metadata.title;
        img.title = item.metadata.title;
      }
      container.appendChild(img);
    });

    this.register('text/html', (item, container) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'mcp-html-content p-2 rounded text-xs';
      if (typeof item.data === 'string') {
        wrapper.innerHTML = item.data;
      }
      container.appendChild(wrapper);
    });

    this.register('application/json', (item, container) => {
      const pre = document.createElement('pre');
      pre.className = 'text-[10px] leading-relaxed whitespace-pre-wrap font-mono p-2 rounded-lg mt-1 max-h-40 overflow-y-auto';
      try {
        pre.textContent = typeof item.data === 'string'
          ? JSON.stringify(JSON.parse(item.data), null, 2)
          : JSON.stringify(item.data, null, 2);
      } catch {
        pre.textContent = String(item.data);
      }
      container.appendChild(pre);
    });
  }

  private defaultRenderer(item: RenderItem, container: HTMLElement): void {
    const div = document.createElement('div');
    div.className = 'text-xs p-2 rounded';

    if (item.metadata?.title) {
      const header = document.createElement('div');
      header.className = 'font-semibold text-xs mb-1';
      header.textContent = item.metadata.title;
      div.appendChild(header);
    }

    const content = document.createElement('pre');
    content.className = 'text-[10px] leading-relaxed whitespace-pre-wrap font-mono';
    if (typeof item.data === 'string') {
      content.textContent = item.data;
    } else if (item.data instanceof Uint8Array) {
      content.textContent = new TextDecoder().decode(item.data);
    } else {
      content.textContent = JSON.stringify(item.data, null, 2);
    }
    div.appendChild(content);
    container.appendChild(div);
  }
}

export const rendererRegistry = new RendererRegistry();
export default rendererRegistry;
