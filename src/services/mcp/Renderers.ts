import type { MCPContentType, MCPStructuredResult } from './MCPContentTypes';
import type { MCPContentRenderer } from './RendererRegistry';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function dataToDataURL(data: Uint8Array | string, mimeType: string): string {
  if (typeof data === 'string') {
    return `data:${mimeType};base64,${btoa(data)}`;
  }
  return `data:${mimeType};base64,${uint8ArrayToBase64(data)}`;
}

function createContainer(title: string, mimeType: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    background: var(--gia-surface-2);
    border: 1px solid var(--gia-border);
    border-radius: 12px;
    overflow: hidden;
  `;
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--gia-surface);
    border-bottom: 1px solid var(--gia-border);
    font-size: 11px;
    font-weight: 600;
    color: var(--gia-text);
  `;
  header.innerHTML = `<span style="display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:#a855f7;"></span>${mimeType}</span>`;
  wrapper.appendChild(header);
  const content = document.createElement('div');
  content.style.cssText = 'padding: 12px; min-height: 200px;';
  wrapper.appendChild(content);
  return wrapper;
}

export const ImageRenderer: MCPContentRenderer = {
  contentType: 'image/png' as MCPContentType,
  canRender(ct: MCPContentType) { return ct.startsWith('image/'); },
  async render(result: MCPStructuredResult, container: HTMLElement) {
    const wrapper = createContainer(result.metadata?.title || 'Image', result.contentType);
    const content = wrapper.querySelector('div:last-child')!;
    const url = dataToDataURL(result.data, result.contentType);
    const img = document.createElement('img');
    img.src = url;
    img.alt = result.metadata?.title || 'Image';
    img.style.cssText = 'max-width: 100%; height: auto; border-radius: 8px; display: block;';
    content.appendChild(img);
    if (result.metadata?.title) {
      const caption = document.createElement('p');
      caption.style.cssText = 'margin-top: 8px; font-size: 11px; color: var(--gia-muted); text-align: center;';
      caption.textContent = result.metadata.title;
      content.appendChild(caption);
    }
    container.appendChild(wrapper);
  },
  getPreview(result: MCPStructuredResult) {
    return result.metadata?.title || result.metadata?.preview || 'Image';
  },
};

export const SVGRenderer: MCPContentRenderer = {
  contentType: 'image/svg+xml' as MCPContentType,
  canRender(ct: MCPContentType) { return ct === 'image/svg+xml'; },
  async render(result: MCPStructuredResult, container: HTMLElement) {
    const wrapper = createContainer(result.metadata?.title || 'SVG', 'SVG');
    const content = wrapper.querySelector('div:last-child')!;
    if (typeof result.data === 'string') {
      content.innerHTML = result.data;
      const svg = content.querySelector('svg');
      if (svg) {
        svg.style.cssText = 'max-width: 100%; height: auto; display: block;';
      }
    } else {
      const blob = new Blob([new Uint8Array(result.data)], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'max-width: 100%; height: auto; border-radius: 8px;';
      content.appendChild(img);
    }
    container.appendChild(wrapper);
  },
  getPreview(r: MCPStructuredResult) { return r.metadata?.title || 'SVG'; },
};

export const GIFRenderer: MCPContentRenderer = {
  contentType: 'motion-graphic/gif' as MCPContentType,
  canRender(ct: MCPContentType) { return ct === 'motion-graphic/gif'; },
  async render(result: MCPStructuredResult, container: HTMLElement) {
    const wrapper = createContainer(result.metadata?.title || 'Animation', 'GIF');
    const content = wrapper.querySelector('div:last-child')!;
    const url = dataToDataURL(result.data, 'image/gif');
    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'max-width: 100%; height: auto; border-radius: 8px; display: block;';
    content.appendChild(img);
    container.appendChild(wrapper);
  },
  getPreview(r: MCPStructuredResult) { return r.metadata?.title || 'GIF Animation'; },
};

export const VideoRenderer: MCPContentRenderer = {
  contentType: 'video/mp4' as MCPContentType,
  canRender(ct: MCPContentType) { return ct.startsWith('video/'); },
  async render(result: MCPStructuredResult, container: HTMLElement) {
    const wrapper = createContainer(result.metadata?.title || 'Video', result.contentType);
    const content = wrapper.querySelector('div:last-child')!;
    const url = dataToDataURL(result.data, result.contentType);
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    video.style.cssText = 'max-width: 100%; height: auto; border-radius: 8px; display: block;';
    content.appendChild(video);
    container.appendChild(wrapper);
  },
  getPreview(r: MCPStructuredResult) { return r.metadata?.title || 'Video'; },
};

export const AudioRenderer: MCPContentRenderer = {
  contentType: 'audio/mp3' as MCPContentType,
  canRender(ct: MCPContentType) { return ct.startsWith('audio/'); },
  async render(result: MCPStructuredResult, container: HTMLElement) {
    const wrapper = createContainer(result.metadata?.title || 'Audio', result.contentType);
    const content = wrapper.querySelector('div:last-child')!;
    const url = dataToDataURL(result.data, result.contentType);
    const audio = document.createElement('audio');
    audio.src = url;
    audio.controls = true;
    audio.style.cssText = 'width: 100%;';
    content.appendChild(audio);
    container.appendChild(wrapper);
  },
  getPreview(r: MCPStructuredResult) { return r.metadata?.title || 'Audio'; },
};

export const JSONRenderer: MCPContentRenderer = {
  contentType: 'application/json' as MCPContentType,
  canRender(ct: MCPContentType) { return ct === 'application/json'; },
  async render(result: MCPStructuredResult, container: HTMLElement) {
    const wrapper = createContainer(result.metadata?.title || 'JSON', 'JSON');
    const content = wrapper.querySelector('div:last-child')!;
    let jsonStr: string;
    if (typeof result.data === 'string') {
      jsonStr = result.data;
    } else {
      jsonStr = new TextDecoder().decode(result.data);
    }
    try {
      const parsed = JSON.parse(jsonStr);
      const pre = document.createElement('pre');
      pre.style.cssText = 'font-size: 10px; line-height: 1.5; overflow: auto; max-height: 400px;';
      pre.textContent = JSON.stringify(parsed, null, 2);
      content.appendChild(pre);
    } catch {
      const pre = document.createElement('pre');
      pre.style.cssText = 'font-size: 10px; color: #ef4444;';
      pre.textContent = 'Invalid JSON';
      content.appendChild(pre);
    }
    container.appendChild(wrapper);
  },
  getPreview() { return 'JSON Data'; },
};

export const TextRenderer: MCPContentRenderer = {
  contentType: 'text/plain' as MCPContentType,
  canRender(ct: MCPContentType) { return ct === 'text/plain'; },
  async render(result: MCPStructuredResult, container: HTMLElement) {
    const wrapper = createContainer(result.metadata?.title || 'Text', 'Text');
    const content = wrapper.querySelector('div:last-child')!;
    const text = typeof result.data === 'string' ? result.data : new TextDecoder().decode(result.data);
    const pre = document.createElement('pre');
    pre.style.cssText = 'font-size: 10px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word;';
    pre.textContent = text;
    content.appendChild(pre);
    container.appendChild(wrapper);
  },
  getPreview(r: MCPStructuredResult) { return typeof r.data === 'string' ? r.data.slice(0, 50) : 'Text'; },
};

export const MarkdownRenderer: MCPContentRenderer = {
  contentType: 'text/markdown' as MCPContentType,
  canRender(ct: MCPContentType) { return ct === 'text/markdown'; },
  async render(result: MCPStructuredResult, container: HTMLElement) {
    const wrapper = createContainer(result.metadata?.title || 'Markdown', 'Markdown');
    const content = wrapper.querySelector('div:last-child')!;
    const text = typeof result.data === 'string' ? result.data : new TextDecoder().decode(result.data);
    const div = document.createElement('div');
    div.style.cssText = 'font-size: 11px; line-height: 1.6;';
    div.innerHTML = text.replace(/\n/g, '<br>');
    content.appendChild(div);
    container.appendChild(wrapper);
  },
  getPreview(r: MCPStructuredResult) { return typeof r.data === 'string' ? r.data.slice(0, 50) : 'Markdown'; },
};

export const CodeRenderer: MCPContentRenderer = {
  contentType: 'code/html' as MCPContentType,
  canRender(ct: MCPContentType) { return ct.startsWith('code/'); },
  async render(result: MCPStructuredResult, container: HTMLElement) {
    const wrapper = createContainer(result.metadata?.title || 'Code', result.contentType);
    const content = wrapper.querySelector('div:last-child')!;
    const codeText = typeof result.data === 'string' ? result.data : new TextDecoder().decode(result.data);
    const pre = document.createElement('pre');
    pre.style.cssText = 'font-size: 10px; line-height: 1.5; overflow: auto; max-height: 400px; background: #0d1117; padding: 12px; border-radius: 6px;';
    const codeEl = document.createElement('code');
    codeEl.textContent = codeText;
    pre.appendChild(codeEl);
    content.appendChild(pre);
    container.appendChild(wrapper);
  },
  getPreview(r: MCPStructuredResult) { return typeof r.data === 'string' ? r.data.slice(0, 50) : 'Code'; },
};
