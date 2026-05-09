import * as pdfjsLib from 'pdfjs-dist';

// Use a local worker or a CDN worker for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export class PDFService {
  private static instance: PDFService;
  static getInstance() { if (!this.instance) this.instance = new PDFService(); return this.instance; }

  async extractText(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `[Page ${i}]\n${pageText}\n\n`;
      }

      return fullText.trim();
    } catch (e) {
      throw new Error(`PDF Extraction failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async extractTextFromBase64(base64: string): Promise<string> {
    try {
      const binaryString = atob(base64.split(',')[1]);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `[Page ${i}]\n${pageText}\n\n`;
      }

      return fullText.trim();
    } catch (e) {
      throw new Error(`PDF Extraction failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

export default PDFService.getInstance();
