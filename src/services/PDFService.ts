import * as pdfjsLib from 'pdfjs-dist';

const pdfVersion = pdfjsLib.version;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfVersion}/pdf.worker.min.js`;

const extractPageText = (textContent: any): string => {
  const items: { str: string; x: number; y: number; width: number }[] = textContent.items.map((item: any) => ({
    str: item.str,
    x: item.transform?.[4] ?? 0,
    y: item.transform?.[5] ?? 0,
    width: item.width ?? 0,
  }));

  items.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: string[] = [];
  let lastY = items[0]?.y ?? 0;
  let line = '';

  for (const item of items) {
    if (Math.abs(item.y - lastY) > 2) {
      if (line) lines.push(line.trim());
      line = item.str;
      lastY = item.y;
    } else {
      const gap = item.x - (line.length > 0 ? items[items.indexOf(item) - 1]?.x ?? 0 : 0);
      line += gap > item.width * 2 ? '  ' : ' ';
      line += item.str;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines.join('\n');
};

export class PDFService {
  private static instance: PDFService;
  static getInstance() { if (!this.instance) this.instance = new PDFService(); return this.instance; }

  async extractText(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      return this.extractFromBuffer(arrayBuffer);
    } catch (e) {
      throw new Error(`PDF Extraction failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async extractTextFromBase64(base64: string): Promise<string> {
    try {
      const binaryString = atob(base64.split(',')[1]);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      return this.extractFromBuffer(bytes.buffer);
    } catch (e) {
      throw new Error(`PDF Extraction failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async extractFromBuffer(buffer: ArrayBuffer): Promise<string> {
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = extractPageText(textContent);
      fullText += `[Page ${i}]\n${pageText}\n\n`;
    }
    return fullText.trim();
  }
}

export default PDFService.getInstance();
