import { logger } from '../utils/logger';

type PdfJsLib = typeof import('pdfjs-dist');
type PdfTextItem = { str?: string; transform?: number[]; width?: number; hasEOL?: boolean };
let pdfjsLib: PdfJsLib | null = null;
let pdfInitPromise: Promise<PdfJsLib> | null = null;

const MAX_PDF_FILE_BYTES = 50 * 1024 * 1024;
const MAX_PDF_PAGES = 250;
const MAX_EXTRACTED_CHARACTERS = 250_000;

async function getPdfJs(): Promise<PdfJsLib> {
  if (pdfjsLib) return pdfjsLib;
  if (!pdfInitPromise) {
    pdfInitPromise = (async () => {
      const lib = (await import('pdfjs-dist')) as PdfJsLib;
      const pdfVersion = lib.version;
      try {
        const viteWorkerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        const res = await fetch(viteWorkerUrl, { method: 'HEAD' });
        lib.GlobalWorkerOptions.workerSrc = res.ok
          ? viteWorkerUrl
          : `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfVersion}/pdf.worker.min.mjs`;
      } catch (error) {
        logger.warn('[PDFService] Bundled worker check failed; using the matching CDN worker:', error);
        lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfVersion}/pdf.worker.min.mjs`;
      }
      pdfjsLib = lib;
      return lib;
    })().catch((error: unknown) => {
      pdfInitPromise = null;
      throw error;
    });
  }
  return pdfInitPromise;
}

export function extractPageText(textContent: { items: PdfTextItem[] }): string {
  const items = textContent.items
    .filter((item): item is PdfTextItem & { str: string } => typeof item.str === 'string')
    .map(item => ({
      str: item.str,
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
      width: item.width ?? 0,
      hasEOL: item.hasEOL ?? false,
    }));

  items.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: string[] = [];
  let lastY = items[0]?.y ?? 0;
  let lastX = 0;
  let lastWidth = 0;
  let line = '';

  for (const item of items) {
    if (line && Math.abs(item.y - lastY) > 2) {
      lines.push(line.trim());
      line = '';
    }
    if (line) {
      const gap = item.x - (lastX + lastWidth);
      line += gap > Math.max(2, item.width * 0.15) ? '  ' : ' ';
    }
    line += item.str;
    lastY = item.y;
    lastX = item.x;
    lastWidth = item.width;
    if (item.hasEOL) {
      lines.push(line.trim());
      line = '';
    }
  }

  if (line.trim()) lines.push(line.trim());
  return lines.join('\n');
}

export class PDFService {
  private static instance: PDFService;
  static getInstance() { if (!this.instance) this.instance = new PDFService(); return this.instance; }

  async extractText(file: File): Promise<string> {
    if (file.size > MAX_PDF_FILE_BYTES) {
      throw new Error(`PDF is larger than the ${MAX_PDF_FILE_BYTES / 1024 / 1024} MB processing limit.`);
    }
    try {
      return await this.extractFromBuffer(await file.arrayBuffer());
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async extractTextFromBase64(base64: string): Promise<string> {
    try {
      const payload = base64.split(',').pop() ?? '';
      const binaryString = atob(payload);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      return await this.extractFromBuffer(bytes.buffer);
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async extractFromBuffer(buffer: ArrayBuffer): Promise<string> {
    if (buffer.byteLength > MAX_PDF_FILE_BYTES) {
      throw new Error(`PDF is larger than the ${MAX_PDF_FILE_BYTES / 1024 / 1024} MB processing limit.`);
    }

    let loadingTask: ReturnType<PdfJsLib['getDocument']> | undefined;
    try {
      const lib = await getPdfJs();
      loadingTask = lib.getDocument({ data: buffer, useSystemFonts: true });
      const pdf = await loadingTask.promise;
      const pageLimit = Math.min(pdf.numPages, MAX_PDF_PAGES);
      let fullText = '';

      for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent() as unknown as { items: PdfTextItem[] };
        const pageText = extractPageText(textContent);
        const pagePrefix = `[Page ${pageNumber}]\n`;
        const remaining = MAX_EXTRACTED_CHARACTERS - fullText.length;
        if (remaining <= pagePrefix.length) {
          fullText += '\n[Text extraction stopped at the 250,000-character limit.]';
          break;
        }
        const pageContent = `${pagePrefix}${pageText}\n\n`;
        fullText += pageContent.slice(0, remaining);
        if (pageContent.length > remaining) {
          fullText += '\n[Text extraction stopped at the 250,000-character limit.]';
          break;
        }
        if (pageNumber % 5 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
      }

      if (pdf.numPages > pageLimit) {
        fullText += `\n[Text extraction stopped after ${MAX_PDF_PAGES} of ${pdf.numPages} pages.]`;
      }
      return fullText.trim();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (/password|encrypted/i.test(detail)) {
        throw new Error('This PDF is encrypted or password-protected and cannot be read.');
      }
      throw new Error(`Could not parse this PDF. It may be corrupted or use an unsupported format. ${detail}`);
    } finally {
      try {
        await loadingTask?.destroy();
      } catch (error) {
        logger.warn('[PDFService] Failed to release PDF parser resources:', error);
      }
    }
  }
}

export default PDFService.getInstance();
