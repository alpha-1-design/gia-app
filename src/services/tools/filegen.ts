import SandboxService from '../SandboxService';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

async function ensureSandbox() {
  const ok = await SandboxService.ensureAvailable();
  if (!ok) throw new Error('No sandbox available — neither the remote sandbox server (node server/sandbox-server.cjs) nor the on-device Alpine terminal could be reached.');
}

/** Markdown line describing how to get a generated file, honest about
 *  whether a real clickable download link is available (remote sandbox
 *  server) or not (on-device native fallback — no HTTP server to link to). */
export function describeDownload(filename: string, dlUrl: string | null): string {
  return dlUrl
    ? `[⬇ Download ${filename}](${dlUrl})`
    : `Saved to \`${filename}\` in the on-device sandbox. Ask me to \`download_file\` it to save it to your device.`;
}

/** Gets a file's bytes regardless of which sandbox backend is active. */
export async function getFileBlob(path: string, dlUrl: string | null): Promise<Blob> {
  if (dlUrl) {
    const response = await fetch(dlUrl);
    if (!response.ok) throw new Error(`File not found or inaccessible: ${path} (HTTP ${response.status})`);
    return response.blob();
  }
  // Native fallback has no HTTP server to fetch from — read the file's
  // content directly through the terminal instead.
  const content = await SandboxService.readFile(path);
  return new Blob([content]);
}

const generate_file: Tool = {
  id: 'generate_file',
  name: 'generate_file',
  description: 'Generate a formatted document file (PDF, PowerPoint, Word, or ZIP) from content. Files are stored in the sandbox workspace and a preview link is provided.',
  schema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['pdf', 'pptx', 'docx', 'zip'],
        description: 'Output file format',
      },
      filename: {
        type: 'string',
        description: 'Output filename (e.g. "report.pdf", "slides.pptx", "doc.docx", "archive.zip"). Extension must match format.',
      },
      title: {
        type: 'string',
        description: 'Document title (used in PDF headers, PPTX title slide, DOCX title)',
      },
      content: {
        type: 'string',
        description: 'Document content in markdown format (used for PDF, DOCX). For PDF/DOCX this is the body text. Required for pdf/docx.',
      },
      slides: {
        type: 'string',
        description: 'JSON array of slide objects. Each: { "title": "...", "content": "..." }. Required for pptx format.',
      },
      subtitle: {
        type: 'string',
        description: 'Subtitle for PPTX title slide (only for pptx format)',
      },
    },
    required: ['format', 'filename'],
  },
  execute: async (args) => {
    const format = String(args.format || '');
    const filename = String(args.filename || '');
    const title = args.title ? String(args.title) : '';

    if (!format || !['pdf', 'pptx', 'docx', 'zip'].includes(format)) {
      return { success: false, content: '', error: `Unsupported format: ${format}. Use pdf, pptx, docx, or zip.` };
    }

    await ensureSandbox();

    try {
      const scriptMap: Record<string, string> = {
        pdf: 'gen_pdf.py',
        pptx: 'gen_pptx.py',
        docx: 'gen_docx.py',
      };
      const script = scriptMap[format];

      if (format === 'zip') {
        const filesArg = args.files ? String(args.files) : '';
        if (!filesArg) {
          return { success: false, content: '', error: 'files is required for zip format (space-separated file paths)' };
        }
        const files = filesArg.split(/\s+/).filter(Boolean);
        filename.replace(/\.zip$/i, '');
        const cmds = [`cd /workspace`, `zip -r "${filename}" ${files.map(f => `"${f}"`).join(' ')}`];
        const result = await SandboxService.exec(cmds.join(' && '));
        if (result.exitCode !== 0) {
          return { success: false, content: result.stdout || '', error: result.stderr || `Zip failed (exit ${result.exitCode})` };
        }
        const dlUrl = SandboxService.downloadUrl(filename);
        return {
          success: true,
          content: [``, describeDownload(filename, dlUrl), '', '```visual', JSON.stringify({ type: 'file_preview', data: { url: dlUrl, name: filename, format: 'zip', files: files } }), '```', ''].join('\n'),
        };
      }

      const input: Record<string, unknown> = { filename, title, content: args.content };

      if (format === 'pptx') {
        let slides: unknown[];
        try {
          slides = JSON.parse(String(args.slides || '[]'));
        } catch {
          return { success: false, content: '', error: 'slides must be a valid JSON array of { title, content } objects' };
        }
        input.slides = slides;
        if (args.subtitle) input.subtitle = String(args.subtitle);
      }

      const inputJson = JSON.stringify(input);
      const inputPath = `_gen_${Date.now()}_input.json`;
      await SandboxService.writeFile(inputPath, inputJson);

      const execResult = await SandboxService.exec(`python3 /workspace/${script} < /workspace/${inputPath}`);
      await SandboxService.delete(inputPath);

      if (execResult.exitCode !== 0) {
        return { success: false, content: execResult.stdout || '', error: execResult.stderr || `Generation failed (exit ${execResult.exitCode})` };
      }

      const dlUrl = SandboxService.downloadUrl(filename);
      const visualBlock = JSON.stringify({ type: 'file_preview', data: { url: dlUrl, name: filename, format } });

      return {
        success: true,
        content: [
          `Generated **${filename}**`,
          describeDownload(filename, dlUrl),
          '',
          '```visual',
          visualBlock,
          '```',
          '',
          `To open in-app, click the download link above. The file is also available in the sandbox workspace.`,
        ].join('\n'),
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const edit_document: Tool = {
  id: 'edit_document',
  name: 'edit_document',
  description: 'Edit an existing document in the sandbox workspace. Reads the file, applies user-specified changes, and saves. Supports plain text, markdown, code files, and JSON.',
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file in the sandbox workspace (e.g. "report.md", "data.json")' },
      changes: { type: 'string', description: 'Description of the changes to apply (e.g. "change the title to New Title", "add a line after line 5")' },
      newContent: { type: 'string', description: 'If provided, replaces the entire file content with this value. Use for full rewrites.' },
    },
    required: ['path'],
  },
  execute: async (args) => {
    const filePath = String(args.path || '');
    const changes = args.changes ? String(args.changes) : '';
    const newContent = args.newContent !== undefined ? String(args.newContent) : undefined;

    if (!filePath) return { success: false, content: '', error: 'path is required' };

    await ensureSandbox();

    try {
      if (newContent !== undefined) {
        await SandboxService.writeFile(filePath, newContent);
        return {
          success: true,
          content: `Updated \`${filePath}\` (full content replacement).\n\n${describeDownload(filePath, SandboxService.downloadUrl(filePath))}`,
        };
      }

      const currentContent = await SandboxService.readFile(filePath);
      return {
        success: true,
        content: [
          `**File:** \`${filePath}\``,
          '',
          '```',
          currentContent.slice(0, 5000) + (currentContent.length > 5000 ? '\n... (truncated)' : ''),
          '```',
          '',
          changes ? `**Requested changes:** ${changes}` : '',
          '',
          'To edit, use `newContent` with the complete updated file content, or describe specific changes and I will apply them.',
        ].join('\n'),
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const download_file: Tool = {
  id: 'download_file',
  name: 'download_file',
  description: 'Download a file from the sandbox workspace to the user\'s device. Triggers a browser/device download dialog for any file in the sandbox workspace.',
  schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file in the sandbox workspace (e.g. "report.pdf", "slides.pptx", "data/results.json")',
      },
      filename: {
        type: 'string',
        description: 'Optional custom filename for the downloaded file. Defaults to the basename of path.',
      },
    },
    required: ['path'],
  },
  execute: async (args) => {
    const path = String(args.path || '');
    if (!path) return { success: false, content: '', error: 'path is required' };

    await ensureSandbox();

    try {
      const dlUrl = SandboxService.downloadUrl(path);
      const filename = args.filename ? String(args.filename) : path.split('/').pop() || 'file';

      const blob = await getFileBlob(path, dlUrl);
      const { triggerDownload } = await import('./helpers');
      triggerDownload(blob, filename);

      return {
        success: true,
        content: `Downloaded \`${path}\` as \`${filename}\` (${(blob.size / 1024).toFixed(1)} KB) successfully.`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const filegenTools: Tool[] = [generate_file, edit_document, download_file];


export function registerFilegenTools() {
  for (const tool of filegenTools) ToolRegistry.register(tool);
}
