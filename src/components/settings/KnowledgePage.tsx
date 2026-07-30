import React, { useState, useEffect } from 'react';
import { Plus, X, FileText, Loader2, Trash2, Brain, Upload } from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';
import RAGService from '../../services/RAGService';
import { SubPageHeader } from './SubPageHeader';

interface IndexedDoc {
  id: string;
  title: string;
  createdAt: number;
  chunkCount: number;
  charCount: number;
}

export const KnowledgePage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [docs, setDocs] = useState<IndexedDoc[]>([]);
  const [stats, setStats] = useState({ docCount: 0, chunkCount: 0 });
  const [indexing, setIndexing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const addNotification = useGiaStore(s => s.addNotification);

  useEffect(() => {
    loadDocs();
    loadStats();
  }, []);

  const loadDocs = async () => {
    try {
      const list = await RAGService.listDocuments();
      setDocs(list.map((d: typeof list[0]) => ({
        id: d.id,
        title: d.title,
        createdAt: d.createdAt,
        chunkCount: d.chunkCount,
        charCount: d.charCount,
      })));
    } catch (e) {
      console.error('[KnowledgePage] Failed to load docs:', e);
    }
  };

  const loadStats = async () => {
    try {
      const s = await RAGService.getStats();
      setStats({ docCount: s.docCount, chunkCount: s.chunkCount });
    } catch (e) {
      console.error('[KnowledgePage] Failed to load stats:', e);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f =>
        ['text/plain', 'text/markdown', 'text/csv', 'application/pdf'].includes(f.type) ||
        f.name.match(/\.(txt|md|csv|pdf)$/i)
      );
      if (files.length > 0) setNewFiles(prev => [...prev, ...files]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f =>
        ['text/plain', 'text/markdown', 'text/csv', 'application/pdf'].includes(f.type) ||
        f.name.match(/\.(txt|md|csv|pdf)$/i)
      );
      if (files.length > 0) setNewFiles(prev => [...prev, ...files]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const indexFiles = async () => {
    if (newFiles.length === 0) return;
    setIndexing('batch');
    setError(null);
    setSuccess(null);

    try {
      for (const file of newFiles) {
        setIndexing(file.name);
        const text = await file.text();
        const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await RAGService.indexDocument(id, file.name, text);
      }
      setNewFiles([]);
      setShowAdd(false);
      setSuccess(`Indexed ${newFiles.length} document(s)`);
      addNotification(`✅ ${newFiles.length} document(s) indexed`);
      await loadDocs();
      await loadStats();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to index documents';
      setError(msg);
      addNotification(`❌ ${msg}`);
    } finally {
      setIndexing(null);
    }
  };

  const deleteDoc = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await RAGService.deleteDocument(id);
      await loadDocs();
      await loadStats();
      addNotification(`🗑️ Deleted "${title}"`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete';
      addNotification(`❌ ${msg}`);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
      <SubPageHeader title="Knowledge Base" onBack={onBack} />

      <div className="px-3 py-3 rounded-xl text-xs leading-relaxed" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: 'var(--gia-muted)' }}>
        <p className="font-semibold mb-2" style={{ color: '#10b981' }}>About Knowledge Base</p>
        <p className="mb-2">Upload documents (TXT, MD, CSV, PDF) to build a searchable knowledge base. GIA uses local embeddings to find relevant context when answering questions.</p>
        <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>Files are processed locally using ONNX embeddings. No data leaves your device.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="gia-card p-3 text-center" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
          <div className="text-2xl font-bold" style={{ color: '#10b981' }}>{stats.docCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Documents</div>
        </div>
        <div className="gia-card p-3 text-center" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
          <div className="text-2xl font-bold" style={{ color: '#a855f7' }}>{stats.chunkCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Chunks</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: '#10b981', color: '#fff' }}>
          <Plus size={16} /> Add Documents
        </button>
      </div>

      {/* Add Documents Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="gia-card w-full max-w-md p-0 overflow-hidden" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--gia-border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Add Documents</span>
              <button onClick={() => { setShowAdd(false); setNewFiles([]); }} className="p-1 rounded-lg hover:bg-white/5" style={{ color: 'var(--gia-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`p-6 rounded-xl border-2 border-dashed text-center transition-colors ${dragActive ? 'ring-2' : ''}`}
                style={{
                  borderColor: dragActive ? '#10b981' : 'var(--gia-border)',
                  background: dragActive ? 'rgba(16,185,129,0.1)' : 'var(--gia-bg)',
                  boxShadow: dragActive ? '0 0 0 2px #10b981' : 'none',
                  color: 'var(--gia-muted)',
                  cursor: 'pointer'
                }}
              >
                <Upload size={32} className="mx-auto mb-2" />
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--gia-text)' }}>Drag & drop files here</p>
                <p className="text-[11px] mb-3" style={{ color: 'var(--gia-muted)' }}>TXT, MD, CSV, PDF</p>
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <FileText size={12} /> Browse Files
                  <input type="file" multiple accept=".txt,.md,.csv,.pdf,text/*" onChange={handleFileSelect} className="hidden" />
                </label>
              </div>

              {newFiles.length > 0 && (
                <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                  <p className="text-xs font-medium" style={{ color: 'var(--gia-muted)' }}>Selected ({newFiles.length}):</p>
                  {newFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--gia-bg)', border: '1px solid var(--gia-border)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={14} style={{ color: '#10b981' }} />
                        <div className="min-w-0">
                          <p className="text-sm truncate" style={{ color: 'var(--gia-text)' }}>{file.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>{formatSize(file.size)}</p>
                        </div>
                      </div>
                      <button onClick={() => removeFile(i)} className="p-1 rounded hover:bg-white/5" style={{ color: 'var(--gia-muted)' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}
              {success && (
                <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                  {success}
                </div>
              )}

              <div className="flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--gia-border)' }}>
                <button onClick={() => { setShowAdd(false); setNewFiles([]); }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--gia-bg)', color: 'var(--gia-muted)', border: '1px solid var(--gia-border)' }}>
                  Cancel
                </button>
                <button onClick={indexFiles} disabled={newFiles.length === 0 || Boolean(indexing)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                  style={{ background: '#10b981', color: '#fff' }}>
                  {indexing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {indexing ? `Indexing ${indexing}...` : `Index ${newFiles.length} Document(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Documents List */}
      <div className="flex items-center gap-2 px-1">
        <Brain size={14} style={{ color: '#10b981' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Indexed Documents ({docs.length})</span>
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-12 text-xs" style={{ color: 'var(--gia-muted)' }}>
          <Brain size={48} className="mx-auto mb-4 opacity-30" />
          <p>No documents indexed yet</p>
          <p className="mt-1">Click "Add Documents" to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="gia-card p-4 flex items-center justify-between gap-4" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText size={20} style={{ color: '#10b981' }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--gia-text)' }}>{doc.title}</p>
                  <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>
                    {doc.chunkCount} chunks · {doc.charCount > 10000 ? (doc.charCount / 1000).toFixed(0) + 'KB' : doc.charCount + ' chars'} · {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button onClick={() => deleteDoc(doc.id, doc.title)} className="p-1.5 rounded-lg hover:bg-white/5 flex-shrink-0" style={{ color: 'var(--gia-muted)' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};