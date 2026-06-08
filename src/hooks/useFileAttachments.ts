import { useState, useCallback, useRef } from 'react';
import GiaBrain from '../services/GiaBrain';
import PDFService from '../services/PDFService';
import { useGiaStore } from '../store/useGiaStore';

export type Attachment = { name: string; type: string; content: string; preview?: string };

export function useFileAttachments(activeModel: string, activeProvider: string, providerLabel: string) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const addFiles = useCallback(async (files: File[], isImage = false) => {
    if (isImage && !GiaBrain.isVisionCapable(activeModel, activeProvider)) {
      useGiaStore.getState().addNotification(`This provider (${providerLabel}) may not support image analysis.`);
    }
    const newAtts: Attachment[] = [];
    for (const file of files) {
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
            } catch {
              newAtts.push({ name: file.name, type: file.type, content: 'Failed to extract PDF text.' });
            }
            resolve();
          };
          reader.onerror = onError;
          reader.readAsDataURL(file);
        } else {
          reader.onload = () => { newAtts.push({ name: file.name, type: file.type || 'text/plain', content: reader.result as string }); resolve(); };
          reader.onerror = onError;
          reader.readAsText(file);
        }
      });
    }
    setAttachments(prev => [...prev, ...newAtts]);
  }, [activeModel, activeProvider, providerLabel]);

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
    if (!hasImage) return;
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
    dragCounter,
    addFiles, handleFile, handlePaste,
    handleDragEnter, handleDragLeave, handleDragOver, handleDrop,
    removeAttachment,
  };
}
