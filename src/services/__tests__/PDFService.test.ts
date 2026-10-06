import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  version: '6.3.289',
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import * as pdfjs from 'pdfjs-dist';
import PDFService, { extractPageText } from '../PDFService';

function configurePdf(numPages: number, pageText = 'Readable page') {
  const pdf = {
    numPages,
    getPage: vi.fn(async () => ({
      getTextContent: vi.fn(async () => ({
        items: [{ str: pageText, transform: [1, 0, 0, 1, 10, 20], width: pageText.length * 5 }],
      })),
    })),
  };
  const loadingTask = {
    promise: Promise.resolve(pdf),
    destroy: vi.fn(async () => {}),
  };
  vi.mocked(pdfjs.getDocument).mockReturnValue(loadingTask as unknown as ReturnType<typeof pdfjs.getDocument>);
  return { pdf, loadingTask };
}

describe('PDFService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
  });

  it('joins text items in reading order and respects line endings', () => {
    const result = extractPageText({
      items: [
        { str: 'First', transform: [1, 0, 0, 1, 10, 10], width: 20 },
        { str: 'word', transform: [1, 0, 0, 1, 32, 10], width: 16 },
        { str: 'Second', transform: [1, 0, 0, 1, 10, 5], width: 20, hasEOL: true },
        { str: 'line', transform: [1, 0, 0, 1, 10, 0], width: 12, hasEOL: true },
      ],
    });
    expect(result).toBe('First word\nSecond\nline');
  });

  it('returns extracted page text and releases parser resources', async () => {
    const { loadingTask } = configurePdf(1);
    const text = await PDFService.extractFromBuffer(new Uint8Array([1, 2, 3]).buffer);
    expect(text).toContain('[Page 1]\nReadable page');
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it('bounds extraction work for very long PDFs', async () => {
    const { pdf } = configurePdf(251, '');
    const text = await PDFService.extractFromBuffer(new Uint8Array([1]).buffer);
    expect(pdf.getPage).toHaveBeenCalledTimes(250);
    expect(text).toContain('[Text extraction stopped after 250 of 251 pages.]');
  });

  it('reports parser failures instead of returning guessed text from raw PDF bytes', async () => {
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.reject(new Error('Invalid PDF structure')),
      destroy: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof pdfjs.getDocument>);

    await expect(PDFService.extractFromBuffer(new TextEncoder().encode('%PDF (not actual extracted text)').buffer))
      .rejects.toThrow(/Could not parse this PDF/);
  });
});
