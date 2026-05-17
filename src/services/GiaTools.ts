import { CapacitorHttp } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import CodeRunner from './CodeRunner';
import { useGiaStore } from '../store/useGiaStore';

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
      description: 'Get details about GIA environment, available runtimes, and system state.',
      execute: async () => {
        try {
          const runtimes = await CodeRunner.getRuntimes();
          const { activeProvider, providers } = (await import('../store/useProviderStore')).useProviderStore.getState();
          const info = {
            version: '2.3.0.0',
            runtimes: runtimes.map(r => r.language).slice(0, 10),
            provider: activeProvider,
            model: providers[activeProvider].model,
            capabilities: ['web_search', 'terminal_run', 'filesystem', 'image_gen', 'biometrics']
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
            files.forEach((f: any) => zip.file(f.path, f.content));
          }

          if (paths && Array.isArray(paths)) {
            for (const p of paths) {
              try {
                const res = await Filesystem.readFile({ path: p, directory: Directory.Documents, encoding: Encoding.UTF8 });
                zip.file(p, res.data as string);
              } catch (e) {
                console.error(`Skipping ${p}:`, e);
              }
            }
          }

          const blob = await zip.generateAsync({ type: 'blob' });
          
          // Save to filesystem for GIA to be able to "provide" it later
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const base64data = reader.result as string;
              resolve(base64data.split(',')[1]);
            };
          });
          reader.readAsDataURL(blob);
          const base64 = await base64Promise;

          await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Documents,
          });

          // Also trigger download for UX
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);

          useGiaStore.getState().addNotification(`GIA bundled ${filename}`);
          return { success: true, content: `Successfully created ${filename} and saved to Documents.` };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
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
