import { CapacitorHttp } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import CodeRunner from './CodeRunner';
import { useGiaStore } from '../store/useGiaStore';
import { PROVIDER_DEFAULTS } from '../store/useProviderStore';

const isNative = () => typeof (window as any).Capacitor?.getPlatform === 'function'
  ? (window as any).Capacitor.getPlatform() === 'android'
  : false;

const blobUrls = new Set<string>();

const revokeAllBlobUrls = () => {
  blobUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
  blobUrls.clear();
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('Failed to read blob data'));
    reader.readAsDataURL(blob);
  });

const triggerDownload = (blob: Blob, filename: string) => {
  revokeAllBlobUrls();
  const url = URL.createObjectURL(blob);
  blobUrls.add(url);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    if (blobUrls.has(url)) {
      URL.revokeObjectURL(url);
      blobUrls.delete(url);
    }
  }, 30000);
};

export interface ToolResult {
  success: boolean;
  content: string;
  error?: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  execute: (args: any) => Promise<ToolResult>;
}

class GiaTools {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerBuiltInTools();
  }

  private registerBuiltInTools() {
    this.tools.set('web_search', {
      id: 'web_search',
      name: 'web_search',
      description: 'Search the web for real-time information using DuckDuckGo.',
      execute: async ({ query }) => {
        try {
          const SearchService = (await import('./SearchService')).default;
          const content = await SearchService.searchAndFormat(query);
          return { success: true, content: content || 'No results found.' };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('filesystem_read', {
      id: 'filesystem_read',
      name: 'filesystem_read',
      description: 'Read the content of a file from the local filesystem.',
      execute: async ({ path }) => {
        if (!isNative()) return { success: false, content: '', error: 'Filesystem access requires the GIA mobile app (Android).' };
        try {
          const result = await Filesystem.readFile({ path, directory: Directory.Documents, encoding: Encoding.UTF8 });
          return { success: true, content: result.data as string };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('filesystem_write', {
      id: 'filesystem_write',
      name: 'filesystem_write',
      description: 'Write or update a file on the local filesystem.',
      execute: async ({ path, content }) => {
        if (isNative()) {
          try {
            await Filesystem.writeFile({ path, data: content, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
            await Filesystem.stat({ path, directory: Directory.Documents });
            return { success: true, content: `File written to ${path} (verified)` };
          } catch (e: any) {
            return { success: false, content: '', error: e.message };
          }
        }
        const ext = path.split('.').pop()?.toLowerCase() || 'txt';
        const mimeMap: Record<string, string> = { txt: 'text/plain', md: 'text/markdown', html: 'text/html', css: 'text/css', js: 'text/javascript', ts: 'text/typescript', py: 'text/x-python', json: 'application/json', csv: 'text/csv', xml: 'text/xml', yaml: 'text/yaml', yml: 'text/yaml', pdf: 'application/pdf' };
        const blob = new Blob([content], { type: mimeMap[ext] || 'text/plain' });
        triggerDownload(blob, path.split('/').pop() || 'file.txt');
        return { success: true, content: `File "${path}" ready for download.` };
      }
    });

    this.tools.set('terminal_run', {
      id: 'terminal_run',
      name: 'terminal_run',
      description: 'Execute scripts in a sandboxed container (Python, JS, C++).',
      execute: async ({ command, language = 'python' }) => {
        try {
          const result = await CodeRunner.run({ language, code: command });
          return result.error ? { success: false, content: result.output, error: result.error } : { success: true, content: result.output };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('get_environment_info', {
      id: 'get_environment_info',
      name: 'get_environment_info',
      description: 'Get full introspection of GIA identity, architecture, capabilities, and environment.',
      execute: async () => {
        try {
          const runtimes = await CodeRunner.getRuntimes();
          const { activeProvider, providers } = (await import('../store/useProviderStore')).useProviderStore.getState();
          const store = useGiaStore.getState();
          const native = isNative();
          const info = {
            identity: {
              name: 'GIA', fullName: 'Generative Interface Agent', version: '2.3.1.0',
              tagline: 'Private on-device AI workspace',
              platform: native ? 'Android (Capacitor)' : 'Browser (Web)',
              architecture: 'React 18 + TypeScript + Zustand + Vite + Capacitor',
            },
            currentProvider: {
              name: activeProvider,
              label: PROVIDER_DEFAULTS[activeProvider]?.label || activeProvider,
              model: providers[activeProvider]?.model,
              apiKeySet: !!providers[activeProvider]?.apiKey,
              baseUrl: PROVIDER_DEFAULTS[activeProvider]?.baseUrl || '',
            },
            availableProviders: Object.entries(providers).map(([k, v]) => ({
              name: k, label: PROVIDER_DEFAULTS[k as keyof typeof PROVIDER_DEFAULTS]?.label || k,
              model: v.model, enabled: v.enabled, apiKeySet: !!v.apiKey,
            })),
            tools: this.getAllTools().map(t => ({ id: t.id, name: t.name, description: t.description })),
            modules: ['chat', 'exam', 'analyst', 'writer', 'planner', 'settings'],
            codeRuntimes: runtimes.map(r => ({ language: r.language, version: r.version })).slice(0, 20),
            uiCapabilities: {
              rendersMarkdown: true, syntaxHighlighting: true, codeExecution: true,
              inlineImages: true, streamingResponses: true, zipBundling: true,
              fileDownloads: !native,
              filesystemAccess: native,
            },
            memory: (await import('../store/useMemoryStore')).useMemoryStore.getState().memories.length,
            skills: store.skills?.length || 0,
          };
          return { success: true, content: JSON.stringify(info, null, 2) };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('list_files', {
      id: 'list_files', name: 'list_files',
      description: 'List files in a directory.',
      execute: async ({ path = '' }) => {
        if (!isNative()) return { success: false, content: '', error: 'Filesystem access requires the GIA mobile app (Android).' };
        try {
          const result = await Filesystem.readdir({ path, directory: Directory.Documents });
          return { success: true, content: result.files.map(f => f.name).join('\n') };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('image_generation', {
      id: 'image_generation', name: 'image_generation',
      description: 'Generate an AI image from a text description.',
      execute: async ({ prompt }) => {
        try {
          const ImageService = (await import('./ImageService')).default;
          const result = await ImageService.generate(prompt);
          if (result.error) return { success: false, content: '', error: result.error };
          return { success: true, content: `Image generated. URL: ${result.url}${result.revisedPrompt ? `\nRevised Prompt: ${result.revisedPrompt}` : ''}` };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('switch_module', {
      id: 'switch_module', name: 'switch_module',
      description: 'Switch the active GIA module (chat, exam, analyst, writer, planner, settings).',
      execute: async ({ module }) => {
        const store = useGiaStore.getState();
        const valid = ['chat', 'exam', 'analyst', 'writer', 'planner', 'settings'];
        if (valid.includes(module)) {
          store.setModule(module as any);
          store.addNotification(`GIA switched to ${module} module`);
          return { success: true, content: `Switched to ${module}` };
        }
        return { success: false, content: '', error: `Invalid module: ${module}` };
      }
    });

    this.tools.set('toggle_feature', {
      id: 'toggle_feature', name: 'toggle_feature',
      description: 'Enable or disable GIA features (web_search, thinking, hands_off).',
      execute: async ({ feature, enabled }) => {
        const store = useGiaStore.getState();
        if (feature === 'web_search') store.setWebSearch(enabled);
        else if (feature === 'thinking') store.setExtThinking(enabled);
        else if (feature === 'hands_off') store.setHandsOff(enabled);
        else return { success: false, content: '', error: `Invalid feature: ${feature}` };
        store.addNotification(`GIA turned ${feature} ${enabled ? 'ON' : 'OFF'}`);
        return { success: true, content: `${feature} is now ${enabled ? 'enabled' : 'disabled'}` };
      }
    });

    this.tools.set('show_notification', {
      id: 'show_notification', name: 'show_notification',
      description: 'Show a global notification toast to the user.',
      execute: async ({ message }) => {
        useGiaStore.getState().addNotification(message);
        return { success: true, content: 'Notification sent' };
      }
    });

    this.tools.set('zip_project', {
      id: 'zip_project', name: 'zip_project',
      description: 'Create a ZIP bundle of files. Provide "files" as [{path, content}] OR "paths" as string[] to read from device.',
      execute: async ({ filename = 'project.zip', files, paths }) => {
        try {
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();

          if (files && Array.isArray(files)) {
            files.forEach((f: any) => {
              const name = f.path.replace(/\\/g, '/');
              zip.file(name, typeof f.content === 'string' ? f.content : JSON.stringify(f.content), { binary: false });
            });
          }

          if (paths && Array.isArray(paths)) {
            if (!isNative()) return { success: false, content: '', error: 'Reading files from device paths requires the GIA mobile app.' };
            for (const p of paths) {
              try {
                const res = await Filesystem.readFile({ path: p, directory: Directory.Documents, encoding: Encoding.UTF8 });
                zip.file(p, res.data as string);
              } catch { /* skip unreadable */ }
            }
          }

          useGiaStore.getState().addNotification(`📦 Packaging ${filename}...`);
          const blob = await zip.generateAsync({ type: 'blob' });
          useGiaStore.getState().addNotification(`✅ ${filename} ready`);

          if (isNative()) {
            try {
              const base64 = await blobToBase64(blob);
              await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Documents });
              useGiaStore.getState().addNotification(`✅ ${filename} saved to Documents`);
              return { success: true, content: `Created ${filename} and saved to your Documents folder.` };
            } catch (e: any) {
              return { success: false, content: '', error: `Native save failed: ${e.message}` };
            }
          }

          triggerDownload(blob, filename);
          return { success: true, content: `Created ${filename} — check your downloads.` };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('forget_memory', {
      id: 'forget_memory', name: 'forget_memory',
      description: 'Delete a specific memory or all memories matching a topic.',
      execute: async ({ key, all = false }) => {
        const store = (await import('../store/useMemoryStore')).useMemoryStore.getState();
        if (all) {
          store.clearMemories();
          return { success: true, content: 'All memories cleared.' };
        }
        const matches = store.queryMemories(key);
        matches.forEach(m => store.deleteMemory(m.id));
        return {
          success: true,
          content: matches.length > 0
            ? `Forgot ${matches.length} memor${matches.length === 1 ? 'y' : 'ies'} about "${key}".`
            : `No memories found matching "${key}".`
        };
      }
    });

    this.tools.set('read_url', {
      id: 'read_url', name: 'read_url',
      description: 'Fetch and read the text content of a URL. Returns up to 25,000 characters.',
      execute: async ({ url }) => {
        try {
          const brain = (await import('./GiaBrain')).default;
          const content = await brain.fetchURL(url);
          return { success: true, content };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('summarize_conversation', {
      id: 'summarize_conversation', name: 'summarize_conversation',
      description: 'Generate a concise summary of the current conversation to save context space.',
      execute: async ({ messages: msgs }) => {
        try {
          const { activeProvider, providers } = (await import('../store/useProviderStore')).useProviderStore.getState();
          const config = providers[activeProvider];
          if (!config?.apiKey) return { success: false, content: '', error: 'No provider configured.' };
          const textToSummarize = Array.isArray(msgs) ? msgs.map((m: any) => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 1000) : ''}`).join('\n').slice(0, 15000) : '';
          const res = await fetch(`${PROVIDER_DEFAULTS.openai.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: 'Summarize this conversation concisely. Capture key facts, decisions, and user preferences.' }, { role: 'user', content: textToSummarize }], temperature: 0.3, max_tokens: 512 }),
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const summary = data.choices?.[0]?.message?.content || data.content || 'Summary unavailable.';
          return { success: true, content: summary };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('request_clarification', {
      id: 'request_clarification', name: 'request_clarification',
      description: 'Ask the user a clarifying question when you need more information.',
      execute: async ({ question, options }) => {
        useGiaStore.getState().setClarification({
          question: question || 'Could you clarify?',
          options: Array.isArray(options) && options.length >= 2 ? options : ['Yes', 'No'],
          sessionId: useGiaStore.getState().activeSessionId || '',
          assistantMsgId: '',
        });
        return { success: true, content: '__CLARIFICATION__' };
      }
    });
  }

  getTool(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  getAllTools() {
    return Array.from(this.tools.values());
  }
}

export default new GiaTools();
