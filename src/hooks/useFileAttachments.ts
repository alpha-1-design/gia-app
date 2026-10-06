import { useState, useCallback, useRef } from 'react';
import PDFService from '../services/PDFService';
import RAGService from '../services/RAGService';
import { knowledgeGraphService } from '../services/KnowledgeGraphService';
import { logger } from '../utils/logger';

export type Attachment = { name: string; type: string; content: string; preview?: string; error?: string };

const OFFICE_FILE_EXTENSIONS = /\.(?:docx|xlsx|pptx|odt|ods)$/i;
const TEXT_FILE_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'log', 'json', 'jsonl', 'xml', 'yaml', 'yml',
  'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'java', 'kt',
  'c', 'h', 'cpp', 'hpp', 'rs', 'go', 'sh', 'bat', 'sql', 'toml', 'ini', 'conf',
]);

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
    const indexText = (fileName: string, text: string) => {
      if (text.length <= 20) return;
      const id = `rag-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const title = fileName.replace(/\.[^/.]+$/, '');
      void knowledgeGraphService.extractFromDocument(fileName, text, `doc-${Date.now()}`).catch(error => {
        logger.warn('[useFileAttachments] Could not add document to the knowledge graph:', error);
      });
      void RAGService.indexDocument(id, title, text).catch(error => {
        logger.warn('[useFileAttachments] Could not index document for search:', error);
      });
    };

    try {
      for (const file of files) {
        setProcessingFileName(file.name);
        if (isImage || file.type.startsWith('image/')) {
          try {
            const preview = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image preview was not readable.'));
              reader.onerror = () => reject(reader.error || new Error('Image file could not be read.'));
              reader.readAsDataURL(file);
            });
            newAtts.push({ name: file.name, type: file.type, content: '', preview });
          } catch (error) {
            newAtts.push({
              name: file.name,
              type: file.type || 'application/octet-stream',
              content: '',
              error: error instanceof Error ? error.message : `Failed to read ${file.name}.`,
            });
          }
          continue;
        }

        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          try {
            const text = await PDFService.extractText(file);
            newAtts.push({ name: file.name, type: file.type || 'application/pdf', content: text });
            indexText(file.name, text);
          } catch (error) {
            newAtts.push({
              name: file.name,
              type: file.type || 'application/pdf',
              content: '',
              error: error instanceof Error ? error.message : 'PDF text extraction failed.',
            });
          }
          continue;
        }

        if (OFFICE_FILE_EXTENSIONS.test(file.name)) {
          newAtts.push({
            name: file.name,
            type: file.type || 'application/octet-stream',
            content: '',
            error: 'Office documents cannot be parsed directly from Chat yet. Export this file as PDF or plain text and attach it again.',
          });
          continue;
        }

        const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
        const isTextFile = file.type.startsWith('text/')
          || ['application/json', 'application/xml', 'application/javascript'].includes(file.type)
          || TEXT_FILE_EXTENSIONS.has(extension);
        if (!isTextFile) {
          newAtts.push({
            name: file.name,
            type: file.type || 'application/octet-stream',
            content: '',
            error: 'This file type is binary and cannot be previewed as text. Attach a PDF, image, or text-based file instead.',
          });
          continue;
        }

        try {
          const text = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('File contents were not readable.'));
            reader.onerror = () => reject(reader.error || new Error('File could not be read.'));
            reader.readAsText(file);
          });
          newAtts.push({ name: file.name, type: file.type || 'text/plain', content: text });
          indexText(file.name, text);
        } catch (error) {
          newAtts.push({
            name: file.name,
            type: file.type || 'application/octet-stream',
            content: '',
            error: error instanceof Error ? error.message : `Failed to read ${file.name}.`,
          });
        }
      }
      setAttachments(prev => [...prev, ...newAtts]);
    } finally {
      setProcessingFileName('');
      setProcessingFiles(false);
    }
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
