import { useState, useCallback, useRef } from 'react';
import PDFService from '../services/PDFService';
import { knowledgeGraphService } from '../services/KnowledgeGraphService';

export type Attachment = { name: string; type: string; content: string; preview?: string };

// Pasting a long block of text (e.g. logs, an article, a big code dump)
// straight into the composer used to just dump the raw text into the input.
// On top of being unwieldy, a paste containing several newlines pasted into
// the single-line composer input could reach the input's Enter-to-send
// handler and auto-send before the user meant to. Past this size, treat the
// paste like a dropped file instead: attach it as a .txt file and leave the
// composer alone.
const PASTE_TO_FILE_CHAR_THRESHOLD = 500;
const PASTE_TO_FILE_LINE_THRESHOLD = 8;

export function shouldWrapPastedTextAsFile(text: string): boolean {
  if (!text) return false;
  if (text.length > PASTE_TO_FILE_CHAR_THRESHOLD) return true;
  const lineCount = text.split('\n').length;
  return lineCount > PASTE_TO_FILE_LINE_THRESHOLD;
}

export function useFileAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [processingFileName, setProcessingFileName] = useState('');
  const dragCounter = useRef(0);

  const addFiles = useCallback(async (files: File[], isImage = false) => {
    setProcessingFiles(true);
    const newAtts: Attachment[] = [];
    for (const file of files) {
      setProcessingFileName(file.name);
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        const onError = () => { newAtts.push({ name: file.name, type: file.type || 'application/octet-stream', content: `Failed to read file: ${file.name}` }); resolve(); };
        if (isImage || file.type.startsWith('image/')) {
          reader.onload = () => { newAtts.push({ name: file.name, type: file.type, content: '', preview: reader.result as string }); resolve(); };
          reader.onerror = onError;
          reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf') {
          reader.onload = async () => {
            try {
              const text = await PDFService.extractTextFromBase64(reader.result as string);
              newAtts.push({ name: file.name, type: file.type, content: text });
              if (text && text.length > 20) {
                knowledgeGraphService.extractFromDocument(file.name, text, `doc-${Date.now()}`);
              }
            } catch {
              newAtts.push({ name: file.name, type: file.type, content: 'Failed to extract PDF text.' });
            }
            resolve();
          };
          reader.onerror = onError;
          reader.readAsDataURL(file);
        } else {
          reader.onload = () => {
            const text = reader.result as string;
            newAtts.push({ name: file.name, type: file.type || 'text/plain', content: text });
            if (text && text.length > 20) {
              knowledgeGraphService.extractFromDocument(file.name, text, `doc-${Date.now()}`);
            }
            resolve();
          };
          reader.onerror = onError;
          reader.readAsText(file);
        }
      });
    }
    setAttachments(prev => [...prev, ...newAtts]);
    setProcessingFileName('');
    setProcessingFiles(false);
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, isImage = false) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    await addFiles(files, isImage);
    e.target.value = '';
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) { hasImage = true; break; }
    }
    if (hasImage) {
      e.preventDefault();
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(new File([file], `pasted-image-${Date.now()}.png`, { type: file.type }));
          }
        }
      }
      if (imageFiles.length > 0) addFiles(imageFiles, true);
      return;
    }

    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (shouldWrapPastedTextAsFile(text)) {
      // Stop the browser from inserting the raw text into the composer —
      // this both keeps the input clean and avoids the pasted newlines ever
      // reaching the input's Enter-to-send key handler.
      e.preventDefault();
      const file = new File([text], `pasted-text-${Date.now()}.txt`, { type: 'text/plain' });
      addFiles([file]);
    }
    // Short pastes fall through to the default browser paste behavior.
  }, [addFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    const imageFiles: File[] = [];
    const docFiles: File[] = [];
    for (const file of files) {
      if (file.type.startsWith('image/')) imageFiles.push(file);
      else docFiles.push(file);
    }
    if (imageFiles.length > 0) await addFiles(imageFiles, true);
    if (docFiles.length > 0) await addFiles(docFiles, false);
  }, [addFiles]);

  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  return {
    attachments, setAttachments,
    isDragging, setIsDragging,
    processingFiles, processingFileName,
    dragCounter,
    addFiles, handleFile, handlePaste,
    handleDragEnter, handleDragLeave, handleDragOver, handleDrop,
    removeAttachment,
  };
}
