import { describe, it, expect } from 'vitest';
import { pdfGenerationService } from '../PdfGenerationService';

describe('PdfGenerationService', () => {
  it('generates a PDF without throwing WinAnsi encoding errors on box drawing and unicode characters', async () => {
    const title = 'GIA Dashboard';
    const body = `
# Summary
─` + '─'.repeat(30) + `
- Feature 1: **Interactive Artifacts**
- Feature 2: PDF export with unicode — em-dash, bullets •, and quotes “hello”.
- Math & symbols: → 100% working ≤ 50ms.

## Section 2
Some text with extended unicode chars: test string with ─ and — and • and emojis 🚀!
    `;

    const pdfBytes = await pdfGenerationService.generate({ title, body, author: 'Alpha' });
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(100);
  });
});
