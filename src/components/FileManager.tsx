import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Upload, Search, Grid3x3, List, Trash2, Tag,
  FileText, FileCode, FileArchive, File, FolderOpen,
  Camera, Image as ImageIcon, Loader2,
} from 'lucide-react';
import { useFileStore, type StoredFile } from '../store/useFileStore';
import ConfirmDialog from './ConfirmDialog';

interface FileManagerProps {
  onClose: () => void;
}

const FILE_TYPE_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  image: ImageIcon,
  text: FileText,
  'application/json': FileCode,
  'application/pdf': FileText,
  'application/javascript': FileCode,
  'application/zip': FileArchive,
};

function getFileIcon(type: string) {
  const cat = type.split('/')[0];
  return FILE_TYPE_ICON[type] || FILE_TYPE_ICON[cat] || File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

const FileCard: React.FC<{ file: StoredFile; onDelete: (id: string) => void; onTag: (id: string) => void; isGridView: boolean }> = ({ file, onDelete, onTag, isGridView }) => {
  const Icon = getFileIcon(file.type);
  const isImage = file.type.startsWith('image/') && file.preview;

  if (isGridView) {
    return (
      <div className="group relative rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 transition-all overflow-hidden">
        <div className="aspect-square flex items-center justify-center bg-zinc-950/50 overflow-hidden">
          {isImage ? (
            <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
          ) : (
            <Icon size={32} className="text-zinc-600" />
          )}
        </div>
        <div className="p-2.5">
          <p className="text-[11px] font-medium truncate text-zinc-200">{file.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] text-zinc-500">{formatSize(file.size)}</span>
            <span className="text-[9px] text-zinc-600">{formatDate(file.uploadedAt)}</span>
          </div>
          {file.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {file.tags.slice(0, 3).map(t => (
                <span key={t} className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-900/30 text-violet-400 border border-violet-500/20">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onTag(file.id)} className="p-1 rounded-md bg-zinc-900/80 text-zinc-400 hover:text-violet-400"><Tag size={11} /></button>
          <button onClick={() => onDelete(file.id)} className="p-1 rounded-md bg-zinc-900/80 text-zinc-400 hover:text-rose-400"><Trash2 size={11} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-all group">
      {isImage ? (
        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
          <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
          <Icon size={18} className="text-zinc-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium truncate text-zinc-200">{file.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-zinc-500">{formatSize(file.size)}</span>
          <span className="text-[10px] text-zinc-600">{formatDate(file.uploadedAt)}</span>
          {file.tags.map(t => (
            <span key={t} className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-900/30 text-violet-400 border border-violet-500/20">{t}</span>
          ))}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => onTag(file.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-violet-400"><Tag size={12} /></button>
        <button onClick={() => onDelete(file.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400"><Trash2 size={12} /></button>
      </div>
    </div>
  );
};

const FileManager: React.FC<FileManagerProps> = ({ onClose }) => {
  const { files, addFile, deleteFile, addTag, removeTag, getAllTags, searchFiles } = useFileStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isGridView, setIsGridView] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [taggingFile, setTaggingFile] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [viewSource, setViewSource] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const allTags = getAllTags();

  const filtered = useMemo(() => {
    let result = searchQuery ? searchFiles(searchQuery) : [...files];
    if (activeTag) result = result.filter(f => f.tags.includes(activeTag));
    if (viewSource) result = result.filter(f => f.source === viewSource);
    result.sort((a, b) => b.uploadedAt - a.uploadedAt);
    return result;
  }, [files, searchQuery, activeTag, viewSource, searchFiles]);

  const handleFileAdd = useCallback(async (fileList: FileList | null, source: 'manual' | 'capture') => {
    if (!fileList) return;
    setUploading(true);
    const added: string[] = [];
    for (const file of Array.from(fileList)) {
      const isImage = file.type.startsWith('image/');
      const text = isImage ? '' : await file.text();
      const preview = isImage ? await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      }) : undefined;
      const id = addFile({
        name: file.name,
        type: file.type,
        size: file.size,
        content: text,
        preview,
        tags: [],
        source,
      });
      added.push(id);
    }
    setUploading(false);
  }, [addFile]);

  const handleDelete = useCallback((id: string) => {
    setConfirmDeleteId(id);
  }, []);

  const handleTag = useCallback((id: string) => {
    setTaggingFile(id);
    setTagInput('');
  }, []);

  const handleTagSubmit = useCallback(() => {
    if (!taggingFile || !tagInput.trim()) return;
    addTag(taggingFile, tagInput.trim().toLowerCase());
    setTagInput('');
  }, [taggingFile, tagInput, addTag]);

  const handleTagRemove = useCallback((fileId: string, tag: string) => {
    removeTag(fileId, tag);
  }, [removeTag]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileAdd(e.dataTransfer.files, 'manual');
  }, [handleFileAdd]);

  const sources = useMemo(() => {
    const s = new Set(files.map(f => f.source));
    return Array.from(s);
  }, [files]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-[80vh] rounded-2xl border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-100">File Manager</h2>
            <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full">{files.length} files</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsGridView(v => !v)} className={`p-1.5 rounded-lg transition-colors ${isGridView ? 'text-violet-400 bg-violet-900/20' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {isGridView ? <Grid3x3 size={14} /> : <List size={14} />}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300"><X size={14} /></button>
          </div>
        </div>

        <div className="px-4 py-2.5 border-b border-zinc-800/50 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40"
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="*/*"
              className="hidden"
              onChange={e => handleFileAdd(e.target.files, 'manual')}
            />
            <input
              ref={imgInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={e => handleFileAdd(e.target.files, 'manual')}
            />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-zinc-100 transition-colors">
              <Upload size={12} /> Upload
            </button>
            <button onClick={async () => {
              try {
                const { Camera: CapCamera, CameraResultType } = await import('@capacitor/camera');
                const photo = await CapCamera.getPhoto({ resultType: CameraResultType.DataUrl, quality: 85 });
                if (photo.dataUrl) {
                  const blob = await (await fetch(photo.dataUrl)).blob();
                  const fileName = `capture-${Date.now()}.${photo.format || 'jpg'}`;
                  const fileType = `image/${photo.format || 'jpeg'}`;
                  const file = new (globalThis.File as unknown as new (parts: BlobPart[], name: string, options?: FilePropertyBag) => File)([blob], fileName, { type: fileType });
                  const fileList = { 0: file, length: 1, item: (i: number) => i === 0 ? file : null };
                  handleFileAdd(fileList as unknown as FileList, 'capture');
                }
              } catch {
                imgInputRef.current?.click();
              }
            }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-zinc-100 transition-colors">
              <Camera size={12} /> Camera
            </button>
            {uploading && <Loader2 size={14} className="animate-spin text-violet-400" />}
          </div>

          {(allTags.length > 0 || sources.length > 0) && (
            <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => { setActiveTag(null); setViewSource(null); }}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors shrink-0 ${!activeTag && !viewSource ? 'bg-violet-900/30 border-violet-500/30 text-violet-400' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
              >
                All
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => { setActiveTag(activeTag === tag ? null : tag); setViewSource(null); }}
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors shrink-0 ${activeTag === tag ? 'bg-violet-900/30 border-violet-500/30 text-violet-400' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                >
                  {tag}
                </button>
              ))}
              {sources.map(src => (
                <button
                  key={src}
                  onClick={() => { setViewSource(viewSource === src ? null : src); setActiveTag(null); }}
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors shrink-0 ${viewSource === src ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                >
                  {src}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          ref={dropRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-800"
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
                <FolderOpen size={24} className="text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-500">No files</p>
              <p className="text-[10px] text-zinc-700 max-w-[200px]">Upload files from chat or drag & drop them here. GIA can search and reference them anytime.</p>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-900/30 border border-violet-500/20 text-xs text-violet-400 hover:bg-violet-900/50 transition-colors">
                <Upload size={12} /> Upload Files
              </button>
            </div>
          ) : isGridView ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map(file => (
                <div key={file.id} onClick={() => setPreviewFile(file)} className="cursor-pointer">
                  <FileCard file={file} onDelete={handleDelete} onTag={handleTag} isGridView />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(file => (
                <div key={file.id} onClick={() => setPreviewFile(file)} className="cursor-pointer">
                  <FileCard file={file} onDelete={handleDelete} onTag={handleTag} isGridView={false} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {taggingFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40"
            onClick={() => setTaggingFile(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 w-full max-w-xs shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-zinc-200 mb-3">Add Tag</h3>
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { handleTagSubmit(); setTaggingFile(null); } }}
                placeholder="Enter tag name..."
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 mb-3"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setTaggingFile(null)} className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-zinc-200">Cancel</button>
                <button onClick={() => { handleTagSubmit(); setTaggingFile(null); }} className="px-3 py-1.5 rounded-xl text-xs bg-violet-600 text-white hover:bg-violet-500">Add</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {previewFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewFile(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-lg max-h-[80vh] overflow-hidden shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 min-w-0">
                  {(() => { const Icon = getFileIcon(previewFile.type); return <Icon size={14} className="text-zinc-400 shrink-0" />; })()}
                  <p className="text-sm font-medium truncate text-zinc-200">{previewFile.name}</p>
                </div>
                <button onClick={() => setPreviewFile(null)} className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300"><X size={14} /></button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {previewFile.type.startsWith('image/') && previewFile.preview ? (
                  <img src={previewFile.preview} alt={previewFile.name} className="max-w-full rounded-lg" />
                ) : (
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">{previewFile.content.slice(0, 10000)}{previewFile.content.length > 10000 ? '\n\n... (truncated)' : ''}</pre>
                )}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-zinc-800">
                  <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{previewFile.type}</span>
                  <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{formatSize(previewFile.size)}</span>
                  <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{formatDate(previewFile.uploadedAt)}</span>
                  {previewFile.tags.map(t => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-900/30 text-violet-400 border border-violet-500/20 flex items-center gap-1">
                      {t}
                      <button onClick={() => handleTagRemove(previewFile.id, t)} className="hover:text-rose-400"><X size={8} /></button>
                    </span>
                  ))}
                  <button onClick={() => { setTaggingFile(previewFile.id); setPreviewFile(null); }} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-violet-400 border border-zinc-700">
                    + Tag
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete File?"
        message="This will permanently delete this file. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => { if (confirmDeleteId) deleteFile(confirmDeleteId); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </motion.div>
  );
};

export default FileManager;
