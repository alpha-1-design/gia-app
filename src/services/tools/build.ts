import { z } from 'zod';
import { useGiaStore } from '../../store/useGiaStore';
import { isNativePlatform } from '../../utils/helpers';
import { triggerDownload, blobToBase64 } from './helpers';
import type { Tool, ToolContext } from './types';
import type { Skill } from '../../store/useGiaStore';

const isNative = isNativePlatform;

const buildProject: Tool = {
  id: 'build_project',
  name: 'build_project',
  description: 'Generate project files, optionally run a build command, and package the result into a downloadable ZIP. Use for scaffolding apps, building websites, compiling code, and delivering the output as a single file.',
  schema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative file path (e.g. "src/index.js", "package.json")' },
            content: { type: 'string', description: 'File content' },
          },
          required: ['path', 'content'],
        },
        description: 'Project files to include in the ZIP',
      },
      build_command: {
        type: 'string',
        description: 'Optional build/install command to run before packaging (e.g. "npm install && npm run build", "pip install -r requirements.txt", "gcc -o output main.c"). Uses available terminal/sandbox.',
      },
      language: {
        type: 'string',
        enum: ['sh', 'python', 'js', 'cpp'],
        description: 'Execution mode for the build command. "sh" (default) for shell commands, "python" for Python scripts, "js" for Node.js, "cpp" for C++ compile+run.',
      },
      output_filename: {
        type: 'string',
        description: 'Output ZIP filename (default: "project.zip")',
      },
      entry: {
        type: 'string',
        description: 'Main entry point or file to highlight in build output summary',
      },
    },
    required: ['files'],
  },
  execute: async (args, ctx?: ToolContext) => {
    const schema = z.object({
      files: z.array(z.object({
        path: z.string().min(1).max(500),
        content: z.string().max(10 * 1024 * 1024),
      })).min(1, 'At least one file is required'),
      build_command: z.string().max(10000).optional(),
      language: z.enum(['sh', 'python', 'js', 'cpp']).default('sh'),
      output_filename: z.string().max(200).default('project.zip'),
      entry: z.string().max(500).optional(),
    });

    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return {
        success: false,
        content: '',
        error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      };
    }

    const { files, build_command, language, output_filename, entry } = parsed.data;
    const outputName = output_filename.endsWith('.zip') ? output_filename : `${output_filename}.zip`;

    ctx?.onProgress?.(0.05, `Creating project with ${files.length} files...`);
    ctx?.onThought?.(`🔨 Building ${outputName} — ${files.length} files`);
    useGiaStore.getState().addNotification(`Building ${outputName}...`);

    let buildOutput = '';
    let buildSuccess = true;

    if (build_command) {
      ctx?.onProgress?.(0.15, `Running build: ${build_command.slice(0, 80)}...`);
      ctx?.onThought?.(`⚙️ Running build command...`);
      useGiaStore.getState().addNotification(`Running build: ${build_command.slice(0, 60)}...`);

      try {
        ctx?.onThought?.('Compiling via terminal...');
        const TerminalService = (await import('../TerminalService')).default;
        const result = await TerminalService.exec(build_command, undefined, undefined, 120000);
        buildOutput = result.output || '(no output)';
        buildSuccess = result.exitCode === 0;
        if (!buildSuccess) {
          useGiaStore.getState().addNotification('Build failed — check output');
          ctx?.onProgress?.(0.4, `Build exited with code ${result.exitCode}`);
          ctx?.onThought?.(`⚠️ Build exited with code ${result.exitCode}`);
        } else {
          useGiaStore.getState().addNotification('Build completed');
          ctx?.onProgress?.(0.4, 'Build succeeded');
          ctx?.onThought?.('✅ Build succeeded');
        }
      } catch {
        ctx?.onThought?.('Terminal unavailable, trying code runner...');
        try {
          const CodeRunner = (await import('../CodeRunner')).default;
          const result = await CodeRunner.run({ language, code: build_command });
          buildOutput = result.output || '(no output)';
          buildSuccess = !result.error;
          if (!buildSuccess) {
            buildOutput = (result.error || '') + '\n' + buildOutput;
          }
          ctx?.onProgress?.(0.4, buildSuccess ? 'Build succeeded' : 'Build had errors');
          ctx?.onThought?.(buildSuccess ? '✅ Build succeeded' : '⚠️ Build had errors');
        } catch (e2) {
          buildOutput = `Build execution unavailable: ${e2 instanceof Error ? e2.message : String(e2)}`;
          buildSuccess = false;
        }
      }
    }

    ctx?.onProgress?.(0.5, 'Packaging files into ZIP...');
    ctx?.onThought?.('📦 Packaging files...');
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const file of files) {
      const normalizedPath = file.path.replace(/\\/g, '/');
      zip.file(normalizedPath, file.content);
    }

    if (build_command && buildOutput) {
      const logPath = 'build-output.log';
      zip.file(logPath, buildOutput);
    }

    const summary = [
      `Project: ${outputName}`,
      `Files: ${files.length}`,
      entry ? `Entry: ${entry}` : '',
      build_command ? `Build: ${build_command.slice(0, 100)}${build_command.length > 100 ? '...' : ''}` : '',
      build_command ? `Build status: ${buildSuccess ? 'Passed' : 'Failed (see build-output.log)'}` : '',
      build_command && buildOutput ? `Build output: ${buildOutput.slice(0, 300)}${buildOutput.length > 300 ? '...' : ''}` : '',
    ].filter(Boolean).join('\n');

    ctx?.onProgress?.(0.7, 'Compressing...');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, (meta) => {
      ctx?.onProgress?.(0.7 + (meta.percent / 100) * 0.25, `Compressing... ${Math.round(meta.percent)}%`);
    });

    ctx?.onProgress?.(0.95, 'Finalizing...');
    useGiaStore.getState().addNotification(`${outputName} ready`);

    if (isNative()) {
      try {
        const base64 = await blobToBase64(blob);
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({ path: outputName, data: base64, directory: Directory.Documents });
        useGiaStore.getState().addNotification(`${outputName} saved to Documents`);
        return {
          success: true,
          content: `## ${outputName} built and saved to Documents\n\n${summary}`,
        };
      } catch {
        triggerDownload(blob, outputName);
        return {
          success: true,
          content: `## ${outputName} built (native save failed, downloaded instead)\n\n${summary}`,
        };
      }
    }

    triggerDownload(blob, outputName);
    return {
      success: true,
      content: `## ${outputName} built successfully\n\n${summary}\n\nDownload started.`,
    };
  },
};

const SKILL_REGISTRY: Record<string, string> = {
  'developer': 'https://raw.githubusercontent.com/alpha-1-design/gia-skills/main/skills/developer.json',
  'researcher': 'https://raw.githubusercontent.com/alpha-1-design/gia-skills/main/skills/researcher.json',
  'tutor': 'https://raw.githubusercontent.com/alpha-1-design/gia-skills/main/skills/tutor.json',
  'creative': 'https://raw.githubusercontent.com/alpha-1-design/gia-skills/main/skills/creative.json',
  'security': 'https://raw.githubusercontent.com/alpha-1-design/gia-skills/main/skills/security.json',
};

async function fetchSkillDefinition(source: string): Promise<Skill> {
  if (SKILL_REGISTRY[source]) {
    source = SKILL_REGISTRY[source];
  }

  if (source.startsWith('http://') || source.startsWith('https://')) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Failed to fetch skill: ${response.status} ${response.statusText}`);
    return response.json() as Promise<Skill>;
  }

  if (source.startsWith('data:')) {
    const b64 = source.split(',')[1];
    const decoded = atob(b64);
    return JSON.parse(decoded) as Skill;
  }

  const terminalService = (await import('../TerminalService')).default;
  const result = await terminalService.exec(`curl -sL "${source}"`, undefined, undefined, 30000);
  if (result.exitCode !== 0 || !result.output) throw new Error(`Failed to fetch skill via terminal: ${result.output || 'no output'}`);
  return JSON.parse(result.output) as Skill;
}

const installSkill: Tool = {
  id: 'install_skill',
  name: 'install_skill',
  description: 'Install a new skill from a URL, package name, or inline definition. Skills are registered in GIA\'s neural skill system and can reprogram GIA\'s behavior, tone, and tool access.',
  schema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'Skill source: URL to a skill JSON file, a known package name (developer/researcher/tutor/creative/security), or a data: URI with base64-encoded JSON',
      },
      url: {
        type: 'string',
        description: 'Direct URL to a skill JSON definition (alternative to source)',
      },
      name: {
        type: 'string',
        description: 'Override name for the skill (if not set, uses the name from the definition)',
      },
      id: {
        type: 'string',
        description: 'Override ID for the skill (if not set, uses the id from the definition)',
      },
      systemPrompt: {
        type: 'string',
        description: 'Override system prompt for the skill (if not set, uses the one from the definition)',
      },
    },
    required: [],
  },
  execute: async (args) => {
    const schema = z.object({
      source: z.string().optional(),
      url: z.string().url('Invalid URL').optional(),
      name: z.string().max(100).optional(),
      id: z.string().max(100).optional(),
      systemPrompt: z.string().max(10000).optional(),
    });

    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return {
        success: false,
        content: '',
        error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      };
    }

    const { source, url, name: overrideName, id: overrideId, systemPrompt: overridePrompt } = parsed.data;
    const fetchSource = source || url;
    if (!fetchSource) {
      return {
        success: false,
        content: '',
        error: 'Provide a "source" URL, package name, or "url" to fetch a skill definition.',
      };
    }

    try {
      const skill = await fetchSkillDefinition(fetchSource);

      if (!skill.id || !skill.name || !skill.systemPrompt) {
        return {
          success: false,
          content: '',
          error: 'Invalid skill definition: requires id, name, and systemPrompt fields.',
        };
      }

      const finalSkill: Skill = {
        id: overrideId || skill.id,
        name: overrideName || skill.name,
        description: skill.description || '',
        systemPrompt: overridePrompt || skill.systemPrompt,
        tools: skill.tools || [],
        category: skill.category || 'user',
      };

      const store = useGiaStore.getState();
      const exists = store.skills.find(s => s.id === finalSkill.id);
      if (exists) {
        return {
          success: true,
          content: `## Skill already installed\n\n**${finalSkill.name}** (\`${finalSkill.id}\`) is already in your skill list. Activate it with the skill picker or set it as active.`,
        };
      }

      store.addSkill(finalSkill);
      store.addNotification(`🧠 Skill installed: ${finalSkill.name}`);

      return {
        success: true,
        content: `## 🧠 Skill Installed: ${finalSkill.name}\n\n- **ID:** \`${finalSkill.id}\`\n- **Description:** ${finalSkill.description || 'No description'}\n- **Tools:** ${finalSkill.tools.length > 0 ? finalSkill.tools.join(', ') : 'None specified'}\n- **Category:** ${finalSkill.category}\n\nYou can now activate it from the skill picker in the chat module, or ask GIA to switch to it.`,
      };
    } catch (e: unknown) {
      return {
        success: false,
        content: '',
        error: `Failed to install skill: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};

export const buildTools: Tool[] = [buildProject, installSkill];
