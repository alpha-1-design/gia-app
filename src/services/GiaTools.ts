import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import CodeRunner from './CodeRunner';
import { useGiaStore } from '../store/useGiaStore';
import { useTaskStore } from '../store/useTaskStore';
import { useNotesStore, randomNoteColor } from '../store/useNotesStore';
import { PROVIDER_DEFAULTS } from '../store/useProviderStore';
import { isNativePlatform } from '../utils/helpers';

const isNative = isNativePlatform;

const blobUrls = new Set<string>();

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_DIRECTORIES = ['Documents', 'Download'];

const isPathSafe = (path: string): string | null => {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.includes('..')) return 'Path traversal is not allowed';
  if (normalized.startsWith('/')) return 'Absolute paths are not allowed';
  return null;
};

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
  sources?: { title: string; url: string }[];
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
          const result = await SearchService.searchWithSources(query);
          if (!result.content) return { success: true, content: 'No results found.', sources: [] };
          return { success: true, content: result.content, sources: result.sources };
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
        const pathErr = isPathSafe(path);
        if (pathErr) return { success: false, content: '', error: pathErr };
        try {
          const result = await Filesystem.readFile({ path, directory: Directory.Documents, encoding: Encoding.UTF8 });
          const content = result.data as string;
          if (content.length > MAX_FILE_SIZE) return { success: false, content: '', error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
          return { success: true, content };
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
        const pathErr = isPathSafe(path);
        if (pathErr) return { success: false, content: '', error: pathErr };
        if (content && content.length > MAX_FILE_SIZE) return { success: false, content: '', error: `Content exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
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
              desktopFilesystemAccess: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
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
        if (path) {
          const pathErr = isPathSafe(path);
          if (pathErr) return { success: false, content: '', error: pathErr };
        }
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
      description: 'Generate an AI image from a text description. Returns a markdown image for inline display.',
      execute: async ({ prompt }) => {
        try {
          const ImageService = (await import('./ImageService')).default;
          const result = await ImageService.generate(prompt);
          if (result.error) return { success: false, content: '', error: result.error };
          const caption = result.revisedPrompt ? `*${result.revisedPrompt}*` : prompt;
          return { success: true, content: `![${caption}](${result.url})\n${caption}` };
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
              const pathErr = isPathSafe(p);
              if (pathErr) continue;
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

          if (activeProvider === 'anthropic') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: config.model, max_tokens: 512, temperature: 0.3, system: 'Summarize this conversation concisely. Capture key facts, decisions, and user preferences.', messages: [{ role: 'user', content: textToSummarize }] }),
              signal: AbortSignal.timeout(15000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json() as any;
            return { success: true, content: data.content?.find((b: any) => b.type === 'text')?.text || 'Summary unavailable.' };
          }

          if (activeProvider === 'gemini') {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: textToSummarize }] }], system_instruction: { parts: [{ text: 'Summarize this conversation concisely. Capture key facts, decisions, and user preferences.' }] }, generationConfig: { temperature: 0.3, maxOutputTokens: 512 } }),
              signal: AbortSignal.timeout(15000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json() as any;
            return { success: true, content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Summary unavailable.' };
          }

          const sumDefaults = PROVIDER_DEFAULTS[activeProvider];
          if (!sumDefaults) return { success: false, content: '', error: `Unknown provider: ${activeProvider}` };
          const { baseUrl } = sumDefaults;
          const headers: Record<string, string> = { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' };
          if (activeProvider === 'openrouter') { headers['HTTP-Referer'] = 'https://gia.app'; headers['X-Title'] = 'GIA'; }
          const res = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: 'Summarize this conversation concisely. Capture key facts, decisions, and user preferences.' }, { role: 'user', content: textToSummarize }], temperature: 0.3, max_tokens: 512 }), signal: AbortSignal.timeout(15000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          return { success: true, content: data.choices?.[0]?.message?.content || 'Summary unavailable.' };
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

    this.tools.set('get_user_location', {
      id: 'get_user_location', name: 'get_user_location',
      description: 'Get the user\'s current GPS location (latitude, longitude, accuracy).',
      execute: async () => {
        try {
          const MapService = (await import('./MapService')).default;
          const pos = await MapService.getCurrentPosition();
          let address = '';
          try {
            const rev = await MapService.reverseGeocode(pos.lat, pos.lng);
            address = ` (${rev.road ? rev.road + ', ' : ''}${rev.city ? rev.city + ', ' : ''}${rev.country || ''})`;
          } catch {}
          return {
            success: true,
            content: `Location: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}${address}\nAccuracy: ${pos.accuracy ? `${Math.round(pos.accuracy)}m` : 'unknown'}`
          };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('search_places', {
      id: 'search_places', name: 'search_places',
      description: 'Search for places, addresses, or landmarks using OpenStreetMap.',
      execute: async ({ query, limit = 5 }) => {
        try {
          const MapService = (await import('./MapService')).default;
          const places = await MapService.searchPlaces(query, limit);
          if (places.length === 0) return { success: true, content: 'No places found for that query.' };
          const lines = places.map((p, i) =>
            `${i + 1}. **${p.displayName.slice(0, 100)}** — ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
          );
          return { success: true, content: `Found ${places.length} place(s):\n${lines.join('\n')}` };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('show_map', {
      id: 'show_map', name: 'show_map',
      description: 'Render an interactive OpenStreetMap. Provide center coords, markers, and optional route.',
      execute: async ({ center, markers, route, zoom = 13, title }) => {
        const mapData = { center, markers: markers || [], route: route || null, zoom, title: title || '' };
        const visualBlock = JSON.stringify({ type: 'map', data: mapData });
        const names = [title, center.label, center.name].filter(Boolean);
        const placeDesc = names.length > 0 ? names.join(' — ') : `${center.lat?.toFixed(4)}, ${center.lng?.toFixed(4)}`;
        const markerCount = (markers?.length || 0);
        const desc = `A map titled "${title || 'Map'}" was rendered centered on ${placeDesc} at zoom ${zoom}${markerCount > 0 ? ` with ${markerCount} marker(s)` : ''}.`;
        return { success: true, content: `${desc}\n\`\`\`visual\n${visualBlock}\n\`\`\`` };
      }
    });

    this.tools.set('export_brain', {
      id: 'export_brain', name: 'export_brain',
      description: 'Export all GIA memories, identity, and skills as a downloadable JSON file.',
      execute: async () => {
        try {
          const { exportBrainToFile } = await import('./BrainExport');
          exportBrainToFile();
          useGiaStore.getState().addNotification('Brain export downloaded');
          return { success: true, content: 'Brain data exported — check your downloads for gia-brain-*.json' };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('import_brain', {
      id: 'import_brain', name: 'import_brain',
      description: 'Upload and restore GIA knowledge from a previously exported .gia-brain.json file.',
      execute: async () => {
        return { success: false, content: '', error: 'File upload must be done manually in Settings > Brain Export. Tell the user to go there.' };
      }
    });

    this.tools.set('filesystem_desktop_read', {
      id: 'filesystem_desktop_read', name: 'filesystem_desktop_read',
      description: 'Read a file from the user\'s selected project folder on desktop. Requires folder to be pre-selected via the UI button.',
      execute: async ({ path }) => {
        const DesktopFS = (await import('./DesktopFS')).default;
        if (!DesktopFS.isAvailable) {
          return { success: false, content: '', error: 'Desktop filesystem access requires a Chromium-based browser.' };
        }
        if (!DesktopFS.hasHandle) {
          return { success: false, content: '', error: 'No project folder selected. Click "Pick Project Folder" in settings or the tools panel.' };
        }
        const pathErr = isPathSafe(path);
        if (pathErr) return { success: false, content: '', error: pathErr };
        try {
          const content = await DesktopFS.readFile(path);
          if (content.length > MAX_FILE_SIZE) return { success: false, content: '', error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
          return { success: true, content };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

    this.tools.set('filesystem_desktop_write', {
      id: 'filesystem_desktop_write', name: 'filesystem_desktop_write',
      description: 'Write or update a file in the user\'s selected project folder on desktop.',
      execute: async ({ path, content }) => {
        const DesktopFS = (await import('./DesktopFS')).default;
        if (!DesktopFS.isAvailable) {
          return { success: false, content: '', error: 'Desktop filesystem access requires a Chromium-based browser.' };
        }
        if (!DesktopFS.hasHandle) {
          return { success: false, content: '', error: 'No project folder selected. Click "Pick Project Folder" in settings or the tools panel.' };
        }
        const pathErr = isPathSafe(path);
        if (pathErr) return { success: false, content: '', error: pathErr };
        if (content && content.length > MAX_FILE_SIZE) return { success: false, content: '', error: `Content exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
        try {
          await DesktopFS.writeFile(path, content);
          return { success: true, content: `File written to ${DesktopFS.rootName || 'project'}/${path}` };
        } catch (e: any) {
          return { success: false, content: '', error: e.message };
        }
      }
    });

     this.tools.set('filesystem_desktop_list', {
       id: 'filesystem_desktop_list', name: 'filesystem_desktop_list',
       description: 'List files and directories in the user\'s selected project folder on desktop.',
       execute: async ({ path = '' }) => {
         const DesktopFS = (await import('./DesktopFS')).default;
         if (!DesktopFS.isAvailable) {
           return { success: false, content: '', error: 'Desktop filesystem access requires a Chromium-based browser.' };
         }
         if (!DesktopFS.hasHandle) {
           return { success: false, content: '', error: 'No project folder selected. Click "Pick Project Folder" in settings or the tools panel.' };
         }
         try {
           const entries = await DesktopFS.listFiles(path);
           const lines = entries.map(e =>
             `${e.kind === 'directory' ? '📁' : '📄'} ${e.name}`
           );
           const desc = path ? `Contents of "${path}":` : `Contents of "${DesktopFS.rootName || 'project'}":`;
           return { success: true, content: `${desc}\n${lines.join('\n')}` };
         } catch (e: any) {
           return { success: false, content: '', error: e.message };
         }
       }
     });

     // Task management tools
     this.tools.set('task_create', {
       id: 'task_create', name: 'task_create',
       description: 'Create a new task with title, description, priority, tags, and due date.',
       execute: async ({ title, description = '', priority = 'medium', tags = [], dueDate = null }) => {
         const store = useTaskStore.getState();
         if (!title || !title.trim()) {
           return { success: false, content: '', error: 'Task title is required' };
         }
         const id = store.addTask({
           title: title.trim(),
           description,
           status: 'todo',
           priority: priority as 'low' | 'medium' | 'high' | 'critical',
           tags: Array.isArray(tags) ? tags : [],
           dueDate: dueDate || null,
         });
         return { success: true, content: `Created task "${title}" with ID: ${id}` };
       }
     });

     this.tools.set('task_read', {
       id: 'task_read', name: 'task_read',
       description: 'Read a task by ID, or list tasks by status (todo, in_progress, done).',
       execute: async ({ id = null, status = null }) => {
         const store = useTaskStore.getState();
         if (id) {
           const task = store.tasks.find(t => t.id === id);
           if (!task) {
             return { success: false, content: '', error: `Task with ID ${id} not found` };
           }
           return {
             success: true,
             content: JSON.stringify({
               id: task.id,
               title: task.title,
               description: task.description,
               status: task.status,
               priority: task.priority,
               tags: task.tags,
               dueDate: task.dueDate,
               createdAt: task.createdAt,
               updatedAt: task.updatedAt
             }, null, 2)
           };
         } else {
           const tasks = status
             ? store.getTasksByStatus(status as 'todo' | 'in_progress' | 'done')
             : store.tasks;
           return {
             success: true,
             content: JSON.stringify(tasks.map(t => ({
               id: t.id,
               title: t.title,
               status: t.status,
               priority: t.priority,
               tags: t.tags
             })), null, 2)
           };
         }
       }
     });

     this.tools.set('task_update', {
       id: 'task_update', name: 'task_update',
       description: 'Update a task by ID with new properties.',
       execute: async ({ id, title, description, status, priority, tags, dueDate }) => {
         const store = useTaskStore.getState();
         const task = store.tasks.find(t => t.id === id);
         if (!task) {
           return { success: false, content: '', error: `Task with ID ${id} not found` };
         }
         const updates: any = {};
         if (title !== undefined) updates.title = title;
         if (description !== undefined) updates.description = description;
         if (status !== undefined) updates.status = status;
         if (priority !== undefined) updates.priority = priority;
         if (tags !== undefined) updates.tags = tags;
         if (dueDate !== undefined) updates.dueDate = dueDate;
         if (Object.keys(updates).length === 0) {
           return { success: false, content: '', error: 'No updates provided' };
         }
         store.updateTask(id, updates);
         return { success: true, content: `Updated task ${id}` };
       }
     });

     this.tools.set('task_delete', {
       id: 'task_delete', name: 'task_delete',
       description: 'Delete a task by ID.',
       execute: async ({ id }) => {
         const store = useTaskStore.getState();
         const task = store.tasks.find(t => t.id === id);
         if (!task) {
           return { success: false, content: '', error: `Task with ID ${id} not found` };
         }
         store.deleteTask(id);
         return { success: true, content: `Deleted task "${task.title}"` };
       }
     });

     this.tools.set('task_move', {
       id: 'task_move', name: 'task_move',
       description: 'Move a task to a different status (todo, in_progress, done).',
       execute: async ({ id, status }) => {
         const store = useTaskStore.getState();
         const task = store.tasks.find(t => t.id === id);
         if (!task) {
           return { success: false, content: '', error: `Task with ID ${id} not found` };
         }
         if (!['todo', 'in_progress', 'done'].includes(status)) {
           return { success: false, content: '', error: `Invalid status: ${status}` };
         }
         store.moveTask(id, status as 'todo' | 'in_progress' | 'done');
         return { success: true, content: `Moved task "${task.title}" to ${status}` };
       }
     });

     // Notes management tools
     this.tools.set('note_create', {
       id: 'note_create', name: 'note_create',
       description: 'Create a new note with title, content, color, and tags.',
       execute: async ({ title, content = '', color = '', tags = [] }) => {
         const store = useNotesStore.getState();
         if (!title || !title.trim()) {
           return { success: false, content: '', error: 'Note title is required' };
         }
         const id = store.addNote({
           title: title.trim(),
           content,
           color: color || randomNoteColor(),
           pinned: false,
           tags: Array.isArray(tags) ? tags : [],
         });
         return { success: true, content: `Created note "${title}" with ID: ${id}` };
       }
     });

     this.tools.set('note_read', {
       id: 'note_read', name: 'note_read',
       description: 'Read a note by ID, or list/search notes.',
       execute: async ({ id = null, search = null }) => {
         const store = useNotesStore.getState();
         if (id) {
           const note = store.getNote(id);
           if (!note) {
             return { success: false, content: '', error: `Note with ID ${id} not found` };
           }
           return {
             success: true,
             content: JSON.stringify({
               id: note.id,
               title: note.title,
               content: note.content,
               color: note.color,
               pinned: note.pinned,
               tags: note.tags,
               createdAt: note.createdAt,
               updatedAt: note.updatedAt
             }, null, 2)
           };
         } else {
           let notes = store.notes;
           if (search && typeof search === 'string') {
             notes = store.searchNotes(search);
           }
           return {
             success: true,
             content: JSON.stringify(notes.map(n => ({
               id: n.id,
               title: n.title,
               content: n.content.substring(0, 200) + (n.content.length > 200 ? '...' : ''),
               color: n.color,
               pinned: n.pinned,
               tags: n.tags
           })), null, 2)
           };
         }
       }
     });

     this.tools.set('note_update', {
       id: 'note_update', name: 'note_update',
       description: 'Update a note by ID with new properties.',
       execute: async ({ id, title, content, color, tags }) => {
         const store = useNotesStore.getState();
         const note = store.getNote(id);
         if (!note) {
           return { success: false, content: '', error: `Note with ID ${id} not found` };
         }
         const updates: any = {};
         if (title !== undefined) updates.title = title;
         if (content !== undefined) updates.content = content;
         if (color !== undefined) updates.color = color;
         if (tags !== undefined) updates.tags = tags;
         if (Object.keys(updates).length === 0) {
           return { success: false, content: '', error: 'No updates provided' };
         }
         store.updateNote(id, updates);
         return { success: true, content: `Updated note ${id}` };
       }
     });

     this.tools.set('note_delete', {
       id: 'note_delete', name: 'note_delete',
       description: 'Delete a note by ID.',
       execute: async ({ id }) => {
         const store = useNotesStore.getState();
         const note = store.getNote(id);
         if (!note) {
           return { success: false, content: '', error: `Note with ID ${id} not found` };
         }
         store.deleteNote(id);
         return { success: true, content: `Deleted note "${note.title}"` };
       }
     });

     this.tools.set('note_toggle_pin', {
       id: 'note_toggle_pin', name: 'note_toggle_pin',
       description: 'Toggle the pinned state of a note.',
       execute: async ({ id }) => {
         const store = useNotesStore.getState();
         const note = store.getNote(id);
         if (!note) {
           return { success: false, content: '', error: `Note with ID ${id} not found` };
         }
         store.togglePin(id);
         return { success: true, content: `Toggled pin for note "${note.title}"` };
       }
     });
  }

  getTool(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  getAllTools() {
    return Array.from(this.tools.values());
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.id, tool);
  }

  unregisterTool(id: string): void {
    this.tools.delete(id);
  }

  getToolSchema(id: string): Tool['schema'] {
    return this.tools.get(id)?.schema;
  }

  getAllToolSchemas(): Record<string, { description: string; properties: Record<string, unknown>; required?: string[] }> {
    const result: Record<string, any> = {};
    for (const [id, tool] of this.tools) {
      if (tool.schema) {
        result[id] = {
          description: tool.description,
          properties: tool.schema.properties,
          required: tool.schema.required,
        };
      }
    }
    return result;
  }
}

export default new GiaTools();
