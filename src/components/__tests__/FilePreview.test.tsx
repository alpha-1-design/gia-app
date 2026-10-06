import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FilePreview from '../FilePreview';
import type { Attachment } from '../../hooks/useFileAttachments';

describe('FilePreview', () => {
  it('shows the extracted PDF text already attached for GIA', () => {
    const attachment: Attachment = {
      name: 'report.pdf',
      type: 'application/pdf',
      content: '[Page 1]\nQuarterly results',
    };
    render(<FilePreview attachment={attachment} />);

    fireEvent.click(screen.getByRole('button', { name: /report\.pdf/i }));

    expect(screen.getByText(/\[Page 1\]/)).toBeInTheDocument();
    expect(screen.getByText(/Quarterly results/)).toBeInTheDocument();
  });

  it('displays extraction errors as errors, not as document text', () => {
    const attachment: Attachment = {
      name: 'private.pdf',
      type: 'application/pdf',
      content: '',
      error: 'This PDF is encrypted.',
    };
    render(<FilePreview attachment={attachment} />);

    fireEvent.click(screen.getByRole('button', { name: /private\.pdf/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('This PDF is encrypted.');
  });

  it('explains when a PDF has no selectable text', () => {
    const attachment: Attachment = { name: 'scan.pdf', type: 'application/pdf', content: '' };
    render(<FilePreview attachment={attachment} />);

    fireEvent.click(screen.getByRole('button', { name: /scan\.pdf/i }));

    expect(screen.getByText(/scanned PDF; OCR is not available/i)).toBeInTheDocument();
  });
});
