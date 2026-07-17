import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../services/GiaBrain', () => ({
  default: {
    generate: vi.fn(),
    isVisionCapable: vi.fn(() => false),
  },
}));

vi.mock('../../services/PDFService', () => ({
  default: {
    extractTextFromBase64: vi.fn(async () => 'Extracted PDF text'),
  },
}));

const mockAddNotification = vi.fn();

vi.mock('../../store/useGiaStore', () => ({
  useGiaStore: Object.assign(
    vi.fn(() => ({})),
    { getState: () => ({ addNotification: mockAddNotification }) }
  ),
}));

const { useFileAttachments, shouldWrapPastedTextAsFile } = await import('../useFileAttachments');

function createMockFile(name: string, type: string, content: string): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

describe('useFileAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useFileAttachments());
    expect(result.current.attachments).toEqual([]);
    expect(result.current.isDragging).toBe(false);
  });

  it('addFiles with text file adds attachment', async () => {
    const file = createMockFile('test.txt', 'text/plain', 'Hello world');
    const { result } = renderHook(() => useFileAttachments());
    await act(async () => {
      await result.current.addFiles([file]);
    });
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].name).toBe('test.txt');
    expect(result.current.attachments[0].type).toBe('text/plain');
    expect(result.current.attachments[0].content).toBe('Hello world');
  });

  it('addFiles with image file creates preview', async () => {
    const file = createMockFile('img.png', 'image/png', 'fake-png-data');
    const { result } = renderHook(() => useFileAttachments());
    await act(async () => {
      await result.current.addFiles([file], true);
    });
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].content).toBe('');
    expect(result.current.attachments[0].preview).toBeTruthy();
  });

  it('removeAttachment removes by index', async () => {
    const file1 = createMockFile('a.txt', 'text/plain', 'aaa');
    const file2 = createMockFile('b.txt', 'text/plain', 'bbb');
    const { result } = renderHook(() => useFileAttachments());
    await act(async () => {
      await result.current.addFiles([file1, file2]);
    });
    expect(result.current.attachments).toHaveLength(2);
    act(() => result.current.removeAttachment(0));
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].name).toBe('b.txt');
  });

  it('handleDragEnter increments counter and sets isDragging', () => {
    const { result } = renderHook(() => useFileAttachments());
    const e = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as React.DragEvent;
    act(() => result.current.handleDragEnter(e));
    expect(result.current.isDragging).toBe(true);
  });

  it('handleDragLeave decrements counter', () => {
    const { result } = renderHook(() => useFileAttachments());
    const e = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as React.DragEvent;
    act(() => result.current.handleDragEnter(e));
    expect(result.current.isDragging).toBe(true);
    act(() => result.current.handleDragLeave(e));
    expect(result.current.isDragging).toBe(false);
  });

  it('handleDragOver prevents default', () => {
    const { result } = renderHook(() => useFileAttachments());
    const e = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as React.DragEvent;
    act(() => result.current.handleDragOver(e));
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('handleDrop processes files and resets drag state', async () => {
    const file = createMockFile('dropped.txt', 'text/plain', 'dropped content');
    const { result } = renderHook(() => useFileAttachments());
    const e = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files: [file] },
    } as unknown as React.DragEvent;
    await act(async () => {
      await result.current.handleDrop(e);
    });
    expect(result.current.isDragging).toBe(false);
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].content).toBe('dropped content');
  });

  it('shouldWrapPastedTextAsFile is false for a short one-line paste', () => {
    expect(shouldWrapPastedTextAsFile('just a quick note')).toBe(false);
  });

  it('shouldWrapPastedTextAsFile is true for very long text', () => {
    expect(shouldWrapPastedTextAsFile('x'.repeat(600))).toBe(true);
  });

  it('shouldWrapPastedTextAsFile is true for many short lines', () => {
    const text = Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n');
    expect(shouldWrapPastedTextAsFile(text)).toBe(true);
  });

  function createClipboardEvent(text: string, hasImage = false) {
    const items = hasImage ? [{ type: 'image/png', getAsFile: () => createMockFile('x.png', 'image/png', '') }] : [];
    return {
      preventDefault: vi.fn(),
      clipboardData: { items, getData: () => text },
    } as unknown as React.ClipboardEvent;
  }

  it('handlePaste wraps a long text paste into a .txt attachment instead of letting it hit the composer', async () => {
    const { result } = renderHook(() => useFileAttachments());
    const longText = 'y'.repeat(1000);
    const e = createClipboardEvent(longText);
    await act(async () => {
      result.current.handlePaste(e);
    });
    expect(e.preventDefault).toHaveBeenCalled();
    await waitFor(() => expect(result.current.attachments).toHaveLength(1));
    expect(result.current.attachments[0].name).toMatch(/^pasted-text-.*\.txt$/);
    expect(result.current.attachments[0].content).toBe(longText);
  });

  it('handlePaste leaves a short text paste alone (default browser paste applies)', () => {
    const { result } = renderHook(() => useFileAttachments());
    const e = createClipboardEvent('hi there');
    act(() => { result.current.handlePaste(e); });
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(result.current.attachments).toHaveLength(0);
  });
});
