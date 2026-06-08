import { z } from 'zod';
import CodeRunner from '../CodeRunner';
import { useGiaStore } from '../../store/useGiaStore';
import { providerRegistry } from '../ProviderRegistry';
import { isNativePlatform } from '../../utils/helpers';
import type { Tool } from './types';

const isNative = isNativePlatform;

const terminalRun: Tool = {
  id: 'terminal_run',
  name: 'terminal_run',
  description: 'Execute scripts in a sandboxed container (Python, JS, C++).',
  schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Code to execute' },
      language: { type: 'string', description: 'Language: python/js/cpp', enum: ['python', 'js', 'cpp'] }
    },
    required: ['command']
  },
  execute: async ({ command, language = 'python' }) => {
    const terminalSchema = z.object({
      command: z.string().min(1, "Command is required").max(10000, "Command too long"),
      language: z.enum(['python', 'js', 'cpp']).default('python')
    });

    const validationResult = terminalSchema.safeParse({ command, language });
    if (!validationResult.success) {
      return {
        success: false,
        content: '',
        error: `Invalid terminal run parameters: ${validationResult.error.issues.map((e: z.ZodIssue) => (e instanceof Error ? e.message : String(e))).join(', ')}`
      };
    }

    try {
      const result = await CodeRunner.run({ language, code: command });
      return result.error ? { success: false, content: result.output, error: result.error } : { success: true, content: result.output };
    } catch (e: unknown) {
      return { success: false, content: '', error: (e instanceof Error ? e.message : String(e)) };
    }
  }
};

const environmentInfo: Tool = {
  id: 'get_environment_info',
  name: 'get_environment_info',
  description: 'Get full introspection of GIA identity, architecture, capabilities, and environment.',
  execute: async () => {
    try {
      const runtimes = await CodeRunner.getRuntimes();
      const { activeProvider, providers } = (await import('../../store/useProviderStore')).useProviderStore.getState();
      const store = useGiaStore.getState();
      const native = isNative();
      const giaTools = (await import('../GiaTools')).default;
      const info = {
        identity: {
          name: 'GIA', fullName: 'Generative Interface Agent', version: '2.3.1.0',
          tagline: 'Private on-device AI workspace',
          platform: native ? 'Android (Capacitor)' : 'Browser (Web)',
          architecture: 'React 18 + TypeScript + Zustand + Vite + Capacitor',
        },
        currentProvider: {
          name: activeProvider,
          label: providerRegistry.getLabel(activeProvider),
          model: providers[activeProvider]?.model,
          apiKeySet: !!providers[activeProvider]?.apiKey,
          baseUrl: providerRegistry.getBaseUrl(activeProvider),
        },
        availableProviders: Object.entries(providers).map(([k, v]) => ({
          name: k, label: providerRegistry.getLabel(k),
          model: v.model, enabled: v.enabled, apiKeySet: !!v.apiKey,
        })),
        tools: giaTools.getAllTools().map(t => ({ id: t.id, name: t.name, description: t.description })),
        modules: ['chat', 'exam', 'analyst', 'writer', 'planner', 'settings'],
        codeRuntimes: runtimes.map(r => ({ language: r.language, version: r.version })).slice(0, 20),
        uiCapabilities: {
          rendersMarkdown: true, syntaxHighlighting: true, codeExecution: true,
          inlineImages: true, streamingResponses: true, zipBundling: true,
          fileDownloads: !native,
          filesystemAccess: native,
          desktopFilesystemAccess: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
        },
        memory: (await import('../../store/useMemoryStore')).useMemoryStore.getState().memories.length,
        skills: store.skills?.length || 0,
        creator: {
          name: 'Samuel Mensah',
          born: 'June 6th',
          location: 'Kumasi, Ghana',
          background: 'Started as a novice in tech/programming, fell in love with it in 2025',
          philosophy: 'Freedom and privacy — people should get privacy AND power',
          inspiration: 'GIA is heavily Claude-inspired',
          mission: 'Built GIA for the African space — an all-round personal assistant for exams, planning, tasks, and beyond',
          projects: ['GIA (Generative Interface Agent)', 'Nexus', 'LifeFlow', 'alpha1studio', 'alpha1design', 'privacy-toolkit', 'rehoboth-kitchen-app', 'rhema-fashion', 'vibez-fashion', 'sam-atlas', 'universal-toolbox', 'Termux-Live-', 'Sentinal-pro', 'Core-x', 'FamilyGameNight', 'chatbot', 'BLACKBOX', 'LiquidGlass-PRO-Launcher', 'knowledge-synthesis-engine', 'alpha-analytics', 'alpha1-status-api', 'alpha1-status-frontend', 'My-portfolio-'],
          github: 'https://github.com/alpha-1-design',
          monetization: 'Not focused on money — if people are impressed and choose to support, he\'s grateful',
        },
      };
      return { success: true, content: JSON.stringify(info, null, 2) };
    } catch (e: unknown) {
      return { success: false, content: '', error: (e instanceof Error ? e.message : String(e)) };
    }
  }
};

const github: Tool = {
  id: 'github',
  name: 'github',
  description: 'Fetch data from GitHub — user profile, repos, repo contents, README, or file contents from any public repo. Ask the user for their GitHub username if they don\'t specify one.',
  schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get_user', 'list_repos', 'get_repo', 'list_contents', 'get_file', 'get_readme'],
        description: 'What GitHub data to fetch',
      },
      username: { type: 'string', description: 'GitHub username or org (e.g. alpha-1-design, tensorflow, facebook). Ask the user if not specified.' },
      repo: { type: 'string', description: 'Repo name (required for get_repo, list_contents, get_file, get_readme)' },
      path: { type: 'string', description: 'File/directory path within repo (for list_contents, get_file)' },
      sort: { type: 'string', enum: ['updated', 'created', 'pushed', 'full_name'], description: 'Sort order for repos' },
    },
    required: ['action'],
  },
  execute: async ({ action, username, repo, path, sort }: { action: string; username?: string; repo?: string; path?: string; sort?: string }) => {
    if (!username) return { success: false, content: '', error: 'GitHub username is required — ask the user for their GitHub username.' };
    const githubUser = username;
    const gh = (await import('../GitHubService')).default;
    try {
      let data: unknown;
      switch (action) {
        case 'get_user':
          data = await gh.getUser(githubUser);
          break;
        case 'list_repos':
          data = await gh.listRepos(githubUser, (sort as 'updated' | 'created' | 'pushed' | 'full_name') || 'updated');
          break;
        case 'get_repo':
          if (!repo) return { success: false, content: '', error: 'repo is required' };
          data = await gh.getRepo(githubUser, repo);
          break;
        case 'list_contents':
          if (!repo) return { success: false, content: '', error: 'repo is required' };
          data = await gh.listRepoContents(githubUser, repo, path || '');
          break;
        case 'get_file':
          if (!repo || !path) return { success: false, content: '', error: 'repo and path are required' };
          data = await gh.getFileContent(githubUser, repo, path);
          return { success: true, content: data };
        case 'get_readme':
          if (!repo) return { success: false, content: '', error: 'repo is required' };
          data = await gh.getReadme(githubUser, repo);
          return { success: true, content: data };
        default:
          return { success: false, content: '', error: `Unknown action: ${action}` };
      }
      return { success: true, content: JSON.stringify(data, null, 2) };
    } catch (e: unknown) {
      return { success: false, content: '', error: (e instanceof Error ? e.message : String(e)) };
    }
  }
};

const wikipedia: Tool = {
  id: 'wikipedia', name: 'wikipedia',
  description: 'Search Wikipedia and get article summaries. Great for quick facts, history, biographies, and general knowledge.',
  schema: {
    type: 'object', properties: {
      query: { type: 'string', description: 'What to search for' },
      maxChars: { type: 'number', description: 'Max characters to return (default 5000)' },
    }, required: ['query'],
  },
  execute: async ({ query, maxChars }) => {
    try {
      const tb = (await import('../ToolboxService')).default;
      const result = await tb.wikipedia(query, maxChars || 5000);
      return { success: true, content: `# ${result.title}\n\n${result.extract}\n\n[Read more on Wikipedia](${result.url})` };
    } catch (e: unknown) { return { success: false, content: '', error: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'Wikipedia fetch failed' }; }
  }
};

const weather: Tool = {
  id: 'weather', name: 'weather',
  description: 'Get current weather conditions for any city or location. Returns temperature, conditions, humidity, and wind.',
  schema: {
    type: 'object', properties: {
      location: { type: 'string', description: 'City name or location (e.g. "Accra", "Kumasi", "London, UK")' },
    }, required: ['location'],
  },
  execute: async ({ location }) => {
    try {
      const tb = (await import('../ToolboxService')).default;
      const w = await tb.weather(location);
      return { success: true, content: `## Weather in ${w.location}\n- **Condition:** ${w.condition}\n- **Temperature:** ${w.temp} (feels ${w.feelsLike})\n- **Humidity:** ${w.humidity}\n- **Wind:** ${w.wind}` };
    } catch (e: unknown) { return { success: false, content: '', error: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'Weather fetch failed' }; }
  }
};

const define: Tool = {
  id: 'define', name: 'define',
  description: 'Look up the definition of any English word. Returns definitions with parts of speech and example sentences.',
  schema: {
    type: 'object', properties: {
      word: { type: 'string', description: 'Word to define' },
    }, required: ['word'],
  },
  execute: async ({ word }) => {
    try {
      const tb = (await import('../ToolboxService')).default;
      const d = await tb.define(word);
      const meanings = d.meanings.map(m =>
        `*${m.partOfSpeech}*\n${m.definitions.map((df, i) => `${i + 1}. ${df.definition}${df.example ? ` — "${df.example}"` : ''}`).join('\n')}`
      ).join('\n\n');
      return { success: true, content: `# ${d.word} ${d.phonetic}\n\n${meanings}` };
    } catch (e: unknown) { return { success: false, content: '', error: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'Dictionary fetch failed' }; }
  }
};

const imageGeneration: Tool = {
  id: 'image_generation', name: 'image_generation',
  description: 'Generate an AI image from a text description. Returns a markdown image for inline display.',
  schema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Image generation prompt' }
    },
    required: ['prompt']
  },
  execute: async ({ prompt }) => {
    const imageSchema = z.object({
      prompt: z.string().min(1, "Image prompt is required").max(1000, "Prompt too long")
    });

    const validationResult = imageSchema.safeParse({ prompt });
    if (!validationResult.success) {
      return {
        success: false,
        content: '',
        error: `Invalid image generation prompt: ${validationResult.error.issues.map((e: z.ZodIssue) => (e instanceof Error ? e.message : String(e))).join(', ')}`
      };
    }

    try {
      const ImageService = (await import('../ImageService')).default;
      const result = await ImageService.generate(prompt);
      if (result.error) return { success: false, content: '', error: result.error };
      const caption = result.revisedPrompt ? `*${result.revisedPrompt}*` : prompt;
      return { success: true, content: `![${caption}](${result.url})\n${caption}` };
    } catch (e: unknown) {
      return { success: false, content: '', error: (e instanceof Error ? e.message : String(e)) };
    }
  }
};

export const coreTools: Tool[] = [terminalRun, environmentInfo, github, wikipedia, weather, define, imageGeneration];
