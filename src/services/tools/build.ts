import { z } from 'zod';
import { useGiaStore } from '../../store/useGiaStore';
import { isNativePlatform } from '../../utils/helpers';
import { triggerDownload, blobToBase64 } from './helpers';
import SandboxService, { SANDBOX_BUDGETS, type SandboxFileEntry } from '../SandboxService';
import type { Tool, ToolContext } from './types';
import type { Skill } from '../../store/useGiaStore';

const isNative = isNativePlatform;

/** Directories excluded when packaging the built project into a ZIP —
 *  dependency folders and VCS/build metadata would bloat the archive. */
const PACKAGE_EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__']);
const MAX_PACKAGED_FILES = 500;
const MAX_PACKAGED_BYTES = 10 * 1024 * 1024;

function normalizeLanguage(val: unknown): 'sh' | 'python' | 'js' | 'cpp' {
  if (typeof val !== 'string' || !val.trim()) return 'sh';
  const l = val.toLowerCase().trim();
  if (['python', 'python3', 'py', 'python2'].includes(l)) return 'python';
  if (['js', 'javascript', 'node', 'nodejs', 'ts', 'typescript'].includes(l)) return 'js';
  if (['cpp', 'c++', 'c', 'cplusplus'].includes(l)) return 'cpp';
  return 'sh';
}

/** Single-quote shell escaping for sandbox paths (same scheme as SandboxService). */
function shellQuotePath(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Resolve the requested target directory to an absolute sandbox path. */
function resolveTargetDir(raw: string | undefined): string {
  const candidate = (raw || useGiaStore.getState().activeProjectPath || 'gia-build').trim();
  const normalized = candidate.replace(/\\/g, '/');
  if (normalized.split('/').filter(Boolean).includes('..')) {
    throw new Error('target_dir cannot traverse parent directories.');
  }
  if (normalized.startsWith('/')) return normalized.replace(/\/+$/, '') || '/';
  return `/workspace/${normalized.replace(/^\/+/, '')}`.replace(/\/+$/, '');
}

interface PackagedFile {
  path: string;
  content: string;
}

/** Recursively read the project directory from the sandbox FS so the ZIP
 *  reflects the ACTUAL on-disk state after the build command ran —
 *  including generated files — not just the in-memory file list. */
async function collectDirectory(dir: string, prefix = ''): Promise<PackagedFile[]> {
  const entries: SandboxFileEntry[] = await SandboxService.list(dir);
  const out: PackagedFile[] = [];
  let totalBytes = 0;
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDir) {
      if (PACKAGE_EXCLUDED_DIRS.has(entry.name)) continue;
      out.push(...await collectDirectory(`${dir}/${entry.name}`, relativePath));
      if (out.length > MAX_PACKAGED_FILES) break;
      continue;
    }
    if (out.length >= MAX_PACKAGED_FILES) {
      throw new Error(`Project exceeds the ${MAX_PACKAGED_FILES}-file packaging limit. Exclude generated folders or push to GitHub instead.`);
    }
    totalBytes += entry.size;
    if (totalBytes > MAX_PACKAGED_BYTES) {
      throw new Error(`Project exceeds the ${Math.round(MAX_PACKAGED_BYTES / 1024 / 1024)}MB packaging limit. Exclude large assets and package them separately.`);
    }
    const content = await SandboxService.readFile(`${dir}/${entry.name}`);
    out.push({ path: relativePath, content });
  }
  return out;
}

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
        description: 'Optional build/install command to run before packaging (e.g. "npm install && npm run build", "pip install -r requirements.txt", "gcc -o output main.c"). Runs inside the sandbox in target_dir.',
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
      target_dir: {
        type: 'string',
        description: 'Sandbox directory the project is written to (default: the active project path, else /workspace/gia-build). Files are written here before any build command runs.',
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
      language: z.preprocess(normalizeLanguage, z.enum(['sh', 'python', 'js', 'cpp'])).default('sh'),
      output_filename: z.string().max(200).default('project.zip'),
      entry: z.string().max(500).optional(),
      target_dir: z.string().max(500).optional(),
    });

    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return {
        success: false,
        content: '',
        error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      };
    }

    const { files, build_command, output_filename, entry } = parsed.data;
    const outputName = output_filename.endsWith('.zip') ? output_filename : `${output_filename}.zip`;

    let targetDir: string;
    try {
      targetDir = resolveTargetDir(parsed.data.target_dir);
    } catch (error) {
      return { success: false, content: '', error: error instanceof Error ? error.message : String(error) };
    }

    ctx?.onProgress?.(0.05, `Creating project with ${files.length} files...`);
    ctx?.onThought?.(`🔨 Building ${outputName} — ${files.length} files`);
    useGiaStore.getState().addNotification(`Building ${outputName}...`);

    // The sandbox is now the source of truth: files land on disk BEFORE any
    // build command runs, so installs/compilers can actually see them.
    if (!await SandboxService.ensureAvailable()) {
      return {
        success: false,
        content: '',
        error: 'No sandbox available — building on disk needs either the sandbox server or the on-device terminal (Settings → Terminal).',
      };
    }

    ctx?.onProgress?.(0.1, `Writing ${files.length} files to ${targetDir}...`);
    try {
      await SandboxService.exec(`mkdir -p ${shellQuotePath(targetDir)}`, { workdir: '/workspace' });
      for (const file of files) {
        const relativePath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
        if (!relativePath || relativePath.split('/').includes('..')) {
          return { success: false, content: '', error: `Refusing to write unsafe file path: ${file.path}` };
        }
        const segments = relativePath.split('/');
        const parentDir = segments.slice(0, -1).join('/');
        if (parentDir) {
          const mkdirResult = await SandboxService.exec(`mkdir -p ${shellQuotePath(`${targetDir}/${parentDir}`)}`, { workdir: '/workspace' });
          if (mkdirResult.exitCode !== 0) {
            return { success: false, content: '', error: `Could not create directory ${parentDir}: ${mkdirResult.stderr || mkdirResult.stdout || `exit ${mkdirResult.exitCode}`}` };
          }
        }
        await SandboxService.writeFile(`${targetDir}/${relativePath}`, file.content);
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed writing project files to the sandbox: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    let buildOutput = '';
    let buildStatus = 'not run';

    if (build_command) {
      ctx?.onProgress?.(0.25, `Running build: ${build_command.slice(0, 80)}...`);
      ctx?.onThought?.(`⚙️ Running build command...`);
      useGiaStore.getState().addNotification(`Running build: ${build_command.slice(0, 60)}...`);

      try {
        const result = await SandboxService.exec(build_command, { workdir: targetDir, timeout: SANDBOX_BUDGETS.long });
        const parts: string[] = [];
        if (result.stdout) parts.push(result.stdout);
        if (result.stderr) parts.push(`[stderr]\n${result.stderr}`);
        buildOutput = parts.join('\n') || '(no output)';
        buildStatus = result.exitCode === 0 ? 'Passed' : `Failed (exit code ${result.exitCode})`;
        if (result.exitCode !== 0) {
          useGiaStore.getState().addNotification('Build failed — check output');
          ctx?.onThought?.(`⚠️ Build exited with code ${result.exitCode}`);
        } else {
          useGiaStore.getState().addNotification('Build completed');
          ctx?.onThought?.('✅ Build succeeded');
        }
      } catch (error) {
        buildStatus = 'Failed (could not execute)';
        buildOutput = `Build execution unavailable: ${error instanceof Error ? error.message : String(error)}`;
        useGiaStore.getState().addNotification('Build failed — check output');
        ctx?.onThought?.('⚠️ Build command could not run');
      }
      ctx?.onProgress?.(0.45, buildStatus.startsWith('Passed') ? 'Build succeeded' : `Build ${buildStatus}`);
    }

    ctx?.onProgress?.(0.55, 'Reading built project from disk...');
    ctx?.onThought?.('📦 Packaging files...');

    // Package from the ACTUAL directory contents so build-generated files are
    // included, not just the declared input files.
    let packaged: PackagedFile[];
    try {
      packaged = await collectDirectory(targetDir);
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Could not package the built project: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (const file of packaged) {
      zip.file(file.path, file.content);
    }

    if (build_command) {
      const logParts = [`$ ${build_command}`, `Status: ${buildStatus}`, '', buildOutput];
      zip.file('build-output.log', logParts.join('\n'));
    }

    const summary = [
      `Project: ${outputName}`,
      `Directory: ${targetDir}`,
      `Files: ${packaged.length}`,
      entry ? `Entry: ${entry}` : '',
      build_command ? `Build: ${build_command.slice(0, 100)}${build_command.length > 100 ? '...' : ''}` : '',
      build_command ? `Build status: ${buildStatus}` : '',
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
