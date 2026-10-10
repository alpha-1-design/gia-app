import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentPreviewModal } from '../AttachmentPreviewModal';
import type { Attachment } from '../../../hooks/useFileAttachments';

const image = (overrides: Partial<Attachment> = {}): Attachment => ({
  name: 'photo.png',
  type: 'image/png',
  content: '',
  preview: 'data:image/png;base64,AAAA',
  ...overrides,
});

describe('AttachmentPreviewModal', () => {
  it('previews an image and offers region circling', () => {
    render(
      <AttachmentPreviewModal attachment={image()} onClose={vi.fn()} onReplace={vi.fn()} onRemove={vi.fn()} />,
    );

    expect(screen.getByAltText('photo.png')).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    expect(screen.getByRole('button', { name: /circle region/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument();
  });

  it('marks an annotated image as edited and resets to the original', () => {
    const onReplace = vi.fn();
    render(
      <AttachmentPreviewModal
        attachment={image({ original: 'data:image/png;base64,ORIGINAL', preview: 'data:image/png;base64,CROPPED' })}
        onClose={vi.fn()}
        onReplace={onReplace}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('Edited')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));

    expect(onReplace).toHaveBeenCalledWith(
      expect.objectContaining({ preview: 'data:image/png;base64,ORIGINAL', original: undefined }),
    );
  });

  it('shows text document contents and removes on request', () => {
    const onRemove = vi.fn();
    render(
      <AttachmentPreviewModal
        attachment={{ name: 'notes.txt', type: 'text/plain', content: 'hello world' }}
        onClose={vi.fn()}
        onReplace={vi.fn()}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText('hello world')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /circle region/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('surfaces extraction errors instead of document text', () => {
    render(
      <AttachmentPreviewModal
        attachment={{ name: 'secret.pdf', type: 'application/pdf', content: '', error: 'This PDF is encrypted.' }}
        onClose={vi.fn()}
        onReplace={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('This PDF is encrypted.');
    expect(screen.queryByRole('button', { name: /circle region/i })).not.toBeInTheDocument();
  });
});
