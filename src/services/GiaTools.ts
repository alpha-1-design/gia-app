import { CapacitorHttp } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import CodeRunner from './CodeRunner';
import { useGiaStore } from '../store/useGiaStore';

const isNativePlatform = () => typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform();

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
        if (!isNativePlatform()) {
          return { success: false, content: '', error: 'Filesystem access is only available on the GIA mobile app (Android/iOS). You are running in a browser where this is not supported. Please download the app or copy the file content manually.' };
        }
        try {
          const result = await Filesystem.readFile({
            path,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
          });
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
        if (!isNativePlatform()) {
          const ext = path.split('.').pop()?.toLowerCase() || 'txt';
          const mimeMap: Record<string, string> = { txt: 'text/plain', md: 'text/markdown', html: 'text/html', css: 'text/css', js: 'text/javascript', ts: 'text/typescript', py: 'text/x-python', json: 'application/json', csv: 'text/csv', xml: 'text/xml', yaml: 'text/yaml', yml: 'text/yaml', pdf: 'application/pdf' };
          const mime = mimeMap[ext] || 'text/plain';
          const blob = new Blob([content], { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = path.split('/').pop() || 'file.txt';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          return { success: true, content: `File "${path}" is ready for download. Your browser should have prompted you to save it.` };
        }
        try {
          await Filesystem.writeFile({
            path,
            data: content,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
            recursive: true
          });
          return { success: true, content: `File written to ${path}` };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('terminal_run', {
      id: 'terminal_run',
      name: 'terminal_run',
      description: 'Execute scripts or complex logic in a sandboxed container. Supports Python, JS, C++, etc. Use this for computations, data processing, or verifying code before saving.',
      execute: async ({ command, language = 'python' }) => {
        try {
          const result = await CodeRunner.run({
            language,
            code: command
          });
          if (result.error) {
            return { success: false, content: result.output, error: result.error };
          }
          return { success: true, content: result.output };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('get_environment_info', {
      id: 'get_environment_info',
      name: 'get_environment_info',
      description: 'Get full introspection of GIA identity, architecture, capabilities, and environment. Use this to understand what you are and what you can do.',
      execute: async () => {
        try {
          const runtimes = await CodeRunner.getRuntimes();
          const { activeProvider, providers } = (await import('../store/useProviderStore')).useProviderStore.getState();
          const store = useGiaStore.getState();
          const config = providers[activeProvider];
          const info = {
            identity: {
              name: 'GIA',
              fullName: 'Generative Interface Agent',
              version: '2.3.0.0',
              tagline: 'Private on-device AI workspace',
              platform: isNativePlatform() ? 'Android/iOS (Capacitor)' : 'Browser (Web)',
              architecture: 'React 18 + TypeScript + Zustand + Vite + Capacitor',
            },
            currentProvider: {
              name: activeProvider,
              label: config.label || activeProvider,
              model: config.model,
              apiKeySet: !!config.apiKey,
              baseUrl: config.baseUrl,
            },
            availableProviders: Object.entries(providers).map(([k, v]) => ({
              name: k,
              label: v.label || k,
              model: v.model,
              enabled: v.enabled,
              apiKeySet: !!v.apiKey,
            })),
            tools: GiaTools.getAllTools().map(t => ({
              id: t.id,
              name: t.name,
              description: t.description,
            })),
            modules: ['chat', 'exam', 'analyst', 'writer', 'planner', 'settings'],
            codeRuntimes: runtimes.map(r => ({ language: r.language, version: r.version })).slice(0, 20),
            uiCapabilities: {
              rendersMarkdown: true,
              syntaxHighlighting: true,
              codeExecution: true,
              inlineImages: true,
              streamingResponses: true,
              fileDownloads: true,
              zipBundling: true,
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
      id: 'list_files',
      name: 'list_files',
      description: 'List files in a directory.',
      execute: async ({ path = '' }) => {
        if (!isNativePlatform()) {
          return { success: false, content: '', error: 'Filesystem access is only available on the GIA mobile app (Android/iOS). You are running in a browser.' };
        }
        try {
          const result = await Filesystem.readdir({
            path,
            directory: Directory.Documents
          });
          return { success: true, content: result.files.map(f => f.name).join('\n') };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('image_generation', {
      id: 'image_generation',
      name: 'image_generation',
      description: 'Generate an AI image from a text description.',
      execute: async ({ prompt }) => {
        try {
          const ImageService = (await import('./ImageService')).default;
          const result = await ImageService.generate(prompt);
          if (result.error) return { success: false, content: '', error: result.error };
          return { success: true, content: `Image generated successfully. URL: ${result.url}${result.revisedPrompt ? `\nRevised Prompt: ${result.revisedPrompt}` : ''}` };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('switch_module', {
      id: 'switch_module',
      name: 'switch_module',
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
      id: 'toggle_feature',
      name: 'toggle_feature',
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
      id: 'show_notification',
      name: 'show_notification',
      description: 'Show a global notification toast to the user.',
      execute: async ({ message }) => {
        useGiaStore.getState().addNotification(message);
        return { success: true, content: 'Notification sent' };
      }
    });

    this.tools.set('zip_project', {
      id: 'zip_project',
      name: 'zip_project',
      description: 'Create a ZIP bundle of files. Provide "files" as [{path, content}] OR "paths" as string[] to zip from device.',
      execute: async ({ filename = 'project.zip', files, paths }) => {
        try {
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();

          if (files && Array.isArray(files)) {
            files.forEach((f: any) => {
              const name = f.path.replace(/\\/g, '/');
              if (f.content && typeof f.content === 'string') {
                zip.file(name, f.content, { binary: false });
              } else {
                zip.file(name, JSON.stringify(f.content), { binary: false });
              }
            });
          }

          if (paths && Array.isArray(paths)) {
            if (!isNativePlatform()) {
              return { success: false, content: '', error: 'Reading files from device paths is only supported on the GIA mobile app. Use the "files" parameter to provide content directly instead.' };
            }
            for (const p of paths) {
              try {
                const res = await Filesystem.readFile({ path: p, directory: Directory.Documents, encoding: Encoding.UTF8 });
                zip.file(p, res.data as string);
              } catch (e) {
                console.error(`Skipping ${p}:`, e);
              }
            }
          }

          useGiaStore.getState().addNotification(`Packaging ${filename}...`);
          const blob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
            if (metadata.percent % 25 === 0) {
              useGiaStore.getState().addNotification(`Zipping: ${Math.round(metadata.percent)}%`);
            }
          });

          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          if (isNativePlatform()) {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64data = reader.result as string;
                resolve(base64data.split(',')[1]);
              };
              reader.onerror = () => reject(new Error('Failed to read zip blob'));
              reader.readAsDataURL(blob);
            });

            await Filesystem.writeFile({
              path: filename,
              data: base64,
              directory: Directory.Documents,
            });
            useGiaStore.getState().addNotification(`✅ ${filename} saved to Documents`);
            return { success: true, content: `Successfully created ${filename} and saved to your Documents folder.` };
          }

          setTimeout(() => URL.revokeObjectURL(url), 10000);
          useGiaStore.getState().addNotification(`✅ ${filename} ready — check downloads`);
          return { success: true, content: `Successfully created ${filename}. Your browser should have prompted you to download it.` };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('request_clarification', {
      id: 'request_clarification',
      name: 'request_clarification',
      description: 'Ask the user a clarifying multiple-choice question when you need more information before proceeding. Provide 2-4 concise options.',
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

    this.tools.set('sub_agent_call', {
      id: 'sub_agent_call',
      name: 'sub_agent_call',
      description: 'Delegate a complex sub-task to a specific AI provider (openai, anthropic, gemini, etc.).',
      execute: async ({ provider, prompt }) => {
        // This is handled internally in GiaBrain.generate loop, but registered here for the prompt.
        return { success: true, content: 'Delegation request sent to brain loop' };
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
