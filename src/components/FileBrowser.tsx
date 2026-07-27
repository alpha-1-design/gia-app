import { logger } from '../utils/logger';
import React, { useState, useEffect, useCallback } from 'react';
import { Folder, File, ChevronRight, ArrowLeft, RefreshCw, X } from 'lucide-react';

interface FileEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
}

interface FileBrowserProps {
  onClose: () => void;
}

const FileBrowser: React.FC<FileBrowserProps> = ({ onClose }) => {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rootName, setRootName] = useState('');
  const [hasHandle, setHasHandle] = useState(false);
  const [filePreview, setFilePreview] = useState<{ path: string; content: string } | null>(null);

  const loadEntries = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const DesktopFS = (await import('../services/DesktopFS')).default;
      const result = await DesktopFS.listFiles(path);
      result.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const readFile = useCallback(async (path: string) => {
    try {
      const DesktopFS = (await import('../services/DesktopFS')).default;
      const content = await DesktopFS.readFile(path);
      setFilePreview({ path, content: content.slice(0, 5000) });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    (async () => {
      const DesktopFS = (await import('../services/DesktopFS')).default;
      setRootName(DesktopFS.rootName);
      setHasHandle(DesktopFS.hasHandle);
      if (DesktopFS.hasHandle) {
        loadEntries('');
      }
    })();
  }, [loadEntries]);

  const enterDir = (name: string) => {
    const newPath = currentPath ? `${currentPath}/${name}` : name;
    setCurrentPath(newPath);
    loadEntries(newPath);
  };

  const goUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.join('/');
    setCurrentPath(newPath);
    loadEntries(newPath);
  };

  const pickFolder = async () => {
    try {
      const DesktopFS = (await import('../services/DesktopFS')).default;
      const result = await DesktopFS.pickDirectory();
      if (result) {
        setRootName(result.name);
        setHasHandle(true);
        setCurrentPath('');
        loadEntries('');
      }
    } catch (e) { logger.error('[FileBrowser] Failed to pick directory:', e); }
  };

  const isTextFile = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    return ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'py', 'html', 'css', 'xml', 'yaml', 'yml', 'env', 'log', 'csv', 'toml', 'ini', 'cfg', 'conf'].includes(ext || '');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
          <div className="flex items-center gap-2">
            <Folder size={15} style={{ color: '#a855f7' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>
              {rootName || 'Project'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--gia-muted)' }}>
            <X size={14} />
          </button>
        </div>

        {/* Path breadcrumb */}
        <div className="flex items-center gap-1 px-4 py-2 shrink-0" style={{ background: 'rgba(0,0,0,0.15)' }}>
          <button
            onClick={() => { setCurrentPath(''); loadEntries(''); }}
            className="text-[10px] px-2 py-1 rounded-lg font-medium"
            style={{ color: currentPath ? '#a855f7' : 'var(--gia-text)', background: !currentPath ? 'rgba(168,85,247,0.1)' : 'transparent' }}
          >
            root
          </button>
          {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
            <React.Fragment key={i}>
              <ChevronRight size={10} style={{ color: 'var(--gia-muted-2)' }} />
              <span
                className="text-[10px] px-2 py-1 rounded-lg truncate max-w-[80px]"
                style={{
                  color: i === arr.length - 1 ? 'var(--gia-text)' : 'var(--gia-muted)',
                  background: i === arr.length - 1 ? 'rgba(255,255,255,0.05)' : 'transparent',
                }}
              >
                {part}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {!hasHandle ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Folder size={24} style={{ color: 'var(--gia-muted-2)' }} />
              <p className="text-xs" style={{ color: 'var(--gia-muted-2)' }}>No project folder selected</p>
              <button
                onClick={pickFolder}
                className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
                style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}
              >
                Pick Project Folder
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={16} className="animate-spin" style={{ color: 'var(--gia-muted)' }} />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
              <button onClick={() => loadEntries(currentPath)} className="text-[10px] px-3 py-1.5 rounded-lg" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
                Retry
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <File size={20} style={{ color: 'var(--gia-muted-2)' }} />
              <p className="text-xs" style={{ color: 'var(--gia-muted-2)' }}>Empty directory</p>
            </div>
          ) : (
            <>
              {currentPath && (
                <button
                  onClick={goUp}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all"
                  style={{ color: 'var(--gia-muted)' }}
                >
                  <ArrowLeft size={12} />
                  ..
                </button>
              )}
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => entry.kind === 'directory' ? enterDir(entry.name) : (isTextFile(entry.name) ? readFile(entry.path) : undefined)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all hover:opacity-80"
                  style={{ color: 'var(--gia-text)' }}
                >
                  {entry.kind === 'directory' ? (
                    <Folder size={14} style={{ color: '#f59e0b' }} />
                  ) : (
                    <File size={14} style={{ color: 'var(--gia-muted)' }} />
                  )}
                  <span className="truncate">{entry.name}</span>
                  {entry.kind === 'directory' && (
                    <ChevronRight size={10} style={{ color: 'var(--gia-muted-2)' }} className="ml-auto shrink-0" />
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        {/* File preview */}
        {filePreview && (
          <div className="shrink-0 max-h-[30vh] overflow-y-auto p-3" style={{ borderTop: '1px solid var(--gia-border)', background: 'rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium truncate" style={{ color: 'var(--gia-muted)' }}>{filePreview.path}</span>
              <button onClick={() => setFilePreview(null)} className="p-0.5 rounded" style={{ color: 'var(--gia-muted)' }}>
                <X size={10} />
              </button>
            </div>
            <pre className="text-[10px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: 'var(--gia-text)' }}>{filePreview.content}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileBrowser;
