import { z } from 'zod';
import type { Tool } from './types';
import pdfService from '../PDFService';

const readPdfTool: Tool = {
  id: 'read_pdf',
  name: 'read_pdf',
  description: 'Read and extract text content from a PDF file. Supports local files (via file path on mobile) or base64-encoded PDF data. Returns extracted text with page markers.',
  schema: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'Path to a local PDF file (mobile/desktop only)' },
      base64: { type: 'string', description: 'Base64-encoded PDF data (data:application/pdf;base64,...)' },
      url: { type: 'string', description: 'URL to download a PDF from (will fetch and extract)' },
      maxChars: { type: 'number', description: 'Maximum characters to extract (default: 50000)' },
    },
  },
  execute: async (args, ctx) => {
    const schema = z.object({
      filePath: z.string().optional(),
      base64: z.string().optional(),
      url: z.string().url().optional(),
      maxChars: z.number().min(100).max(500000).default(200000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: 'Provide one of: filePath, base64, or url pointing to a PDF file.' };
    }

    const { filePath, base64, url, maxChars } = parsed.data;

    if (!filePath && !base64 && !url) {
      return { success: false, content: '', error: 'Provide one of: filePath, base64, or url pointing to a PDF file.' };
    }

    ctx?.onProgress?.(0.1, 'Reading PDF...');
    ctx?.onThought?.('📄 Extracting text from PDF...');

    try {
      let text = '';

      if (url) {
        ctx?.onProgress?.(0.3, 'Downloading PDF...');
        ctx?.onThought?.(`📥 Downloading PDF from ${new URL(url).hostname}...`);
        const res = await fetch(url, { signal: ctx?.signal });
        if (!res.ok) throw new Error(`Failed to download: ${res.status} ${res.statusText}`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('pdf') && !url.endsWith('.pdf')) {
          return { success: false, content: '', error: `URL does not appear to be a PDF (content-type: ${contentType}). Use read_url for other document types.` };
        }
        const buffer = await res.arrayBuffer();
        ctx?.onProgress?.(0.6, 'Extracting text...');
        text = await pdfService.extractFromBuffer(buffer);
      } else if (base64) {
        ctx?.onProgress?.(0.5, 'Extracting text...');
        text = await pdfService.extractTextFromBase64(base64);
      } else if (filePath) {
        ctx?.onProgress?.(0.3, 'Reading file...');
        // Try sandbox first, then local
        try {
          const { default: SandboxService } = await import('../SandboxService');
          const available = await SandboxService.ensureAvailable();
          if (available) {
            const result = await SandboxService.exec(
              `python3 -c "
import subprocess, base64, sys
try:
    subprocess.run(['pip', 'install', 'pymupdf'], capture_output=True, timeout=30)
    import fitz
    doc = fitz.open('${filePath.replace(/'/g, "\\'")}')
    text = ''
    for i, page in enumerate(doc):
        text += f'[Page {i+1}]\n{page.get_text()}\n\n'
    print(text[:${maxChars}])
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
"`,
              { timeout: 60000 }
            );
            if (result.stdout && !result.stderr) {
              text = result.stdout;
            }
          }
        } catch { /* fall through */ }

        if (!text) {
          // Try reading as base64 from device filesystem
          return { success: false, content: '', error: `Could not read PDF at ${filePath}. On mobile, the file may need to be opened via the file picker first.` };
        }
      }

      if (!text || text.trim().length === 0) {
        return { success: false, content: '', error: 'PDF appears to be empty or contains no extractable text (may be scanned images).' };
      }

      if (text.length > maxChars) {
        text = text.slice(0, maxChars) + '\n\n[... truncated at ' + maxChars + ' characters]';
      }

      const pageCount = (text.match(/\[Page \d+\]/g) || []).length;
      ctx?.onProgress?.(1, 'Done');
      ctx?.onThought?.(`✅ Extracted ${text.length} chars from ${pageCount || '?'} page(s)`);

      return {
        success: true,
        content: `**PDF Content** (${pageCount || '?'} pages, ${text.length} chars)\n\n${text}`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'PDF extraction failed';
      ctx?.onThought?.(`❌ ${msg}`);
      return { success: false, content: '', error: msg };
    }
  },
};

export const pdfTools: Tool[] = [readPdfTool];
