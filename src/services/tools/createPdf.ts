import type { Tool } from './types';
import { pdfGenerationService } from '../PdfGenerationService';

interface PendingSaveEntry {
  blob: Blob;
  filename: string;
}

interface WindowWithPendingSaves extends Window {
  __giaPendingSaves?: Record<string, PendingSaveEntry>;
}

let pendingSaveCounter = 0;

function generateFilename(title: string): string {
  const safe = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return safe ? `${safe}.pdf` : 'document.pdf';
}

export const createPdfTool: Tool = {
  id: 'create_pdf',
  name: 'create_pdf',
  description: 'Generate a PDF document from markdown content with title, optional author, and optional filename. Returns a preview that can be saved to the device.',
  schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Document title (appears at the top of the PDF)',
      },
      content: {
        type: 'string',
        description: 'Document body in plain text or simple markdown (supports # headings, **bold**, - lists, numbered lists)',
      },
      filename: {
        type: 'string',
        description: 'Optional output filename (defaults to title-based name with .pdf extension)',
      },
      author: {
        type: 'string',
        description: 'Optional author name shown in the document header',
      },
    },
    required: ['title', 'content'],
  },
  execute: async (args) => {
    try {
      const title = String(args.title || '');
      const content = String(args.content || '');
      const filename = args.filename ? String(args.filename) : generateFilename(title);
      const author = args.author ? String(args.author) : undefined;

      if (!title.trim()) {
        return { success: false, content: '', error: 'title is required' };
      }
      if (!content.trim()) {
        return { success: false, content: '', error: 'content is required' };
      }

      const pdfBytes = await pdfGenerationService.generate({ title, body: content, author });
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const key = `pdf_${++pendingSaveCounter}_${Date.now()}`;
      const w = window as WindowWithPendingSaves;
      const pendingSaves = w.__giaPendingSaves || {};
      pendingSaves[key] = { blob, filename };
      w.__giaPendingSaves = pendingSaves;

      const visualBlock = JSON.stringify({
        type: 'file_preview',
        data: {
          url,
          name: filename,
          format: 'pdf',
          pendingSaveKey: key,
        },
      });

      return {
        success: true,
        content: [
          `Generated **${filename}** (${(pdfBytes.length / 1024).toFixed(1)} KB)`,
          '',
          '```visual',
          visualBlock,
          '```',
          '',
          `Preview above — click Save to download or save to device.`,
        ].join('\n'),
      };
    } catch (e) {
      return {
        success: false,
        content: '',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
};
