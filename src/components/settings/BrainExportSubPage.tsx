import React, { useState, useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';
import { exportBrainToFile, importBrainFromFile, loadCloudConfig, saveCloudConfig, CloudConfig } from '../../services/BrainExport';
import { SubPageHeader } from './SubPageHeader';

export const BrainExportSubPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(loadCloudConfig);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      exportBrainToFile();
      useGiaStore.getState().addNotification('Brain exported');
    } catch (e: unknown) {
      setImportResult({ success: false, message: e instanceof Error ? e.message : 'Export failed' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    const result = await importBrainFromFile(file);
    setImportResult(result);
    useGiaStore.getState().addNotification(result.message);
    e.target.value = '';
  };

  const saveCloud = () => {
    saveCloudConfig(cloudConfig);
    useGiaStore.getState().addNotification('Cloud config saved');
  };

  const handleCloudUpload = async () => {
    if (!cloudConfig.url) return;
    setUploadStatus('Uploading...');
    try {
      const { exportBrainToCloud } = await import('../../services/BrainExport');
      const msg = await exportBrainToCloud(cloudConfig);
      setUploadStatus(msg);
      useGiaStore.getState().addNotification('Brain uploaded to cloud');
    } catch (e: unknown) {
      setUploadStatus(`Failed: ${e instanceof Error ? e.message : 'Upload error'}`);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
      <SubPageHeader title="Brain Export" onBack={onBack} />

      <div className="gia-card p-4 flex flex-col gap-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--gia-muted)' }}>Download Backup</label>
          <p className="text-[10px] mt-1 mb-3" style={{ color: 'var(--gia-muted-2)' }}>
            Export all memories, GIA identity, skills, and profile as a JSON file.
          </p>
          <button onClick={handleExport} className="gia-btn flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
            <Download size={13} /> Export Brain
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--gia-border)' }} />

        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--gia-muted)' }}>Restore Backup</label>
          <p className="text-[10px] mt-1 mb-3" style={{ color: 'var(--gia-muted-2)' }}>
            Upload a previously exported .gia-brain.json file to restore.
          </p>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} className="gia-btn flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
            <Upload size={13} /> Import Brain
          </button>
          {importResult && (
            <p className={`text-[11px] mt-2 ${importResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
              {importResult.message}
            </p>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--gia-border)' }} />

        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--gia-muted)' }}>Cloud Backup</label>
          <p className="text-[10px] mt-1 mb-3" style={{ color: 'var(--gia-muted-2)' }}>
            Sync your brain to any WebDAV or S3-compatible endpoint (self-hosted, Google Drive via third-party, etc.)
          </p>
          <div className="flex flex-col gap-3">
            <input className="gia-input" value={cloudConfig.url} onChange={e => setCloudConfig({ ...cloudConfig, url: e.target.value })} placeholder="WebDAV/S3 endpoint URL" />
            <input className="gia-input" value={cloudConfig.username} onChange={e => setCloudConfig({ ...cloudConfig, username: e.target.value })} placeholder="Username (optional)" />
            <input className="gia-input" type="password" value={cloudConfig.password} onChange={e => setCloudConfig({ ...cloudConfig, password: e.target.value })} placeholder="Password (optional)" />
            <div className="flex gap-2">
              <button onClick={saveCloud} className="gia-btn flex-1 text-[11px]" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
                Save Config
              </button>
              <button onClick={handleCloudUpload} className="gia-btn flex-1 text-[11px]" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>
                Upload Now
              </button>
            </div>
            {uploadStatus && (
              <p className="text-[11px]" style={{ color: uploadStatus.startsWith('Failed') ? '#f87171' : '#34d399' }}>
                {uploadStatus}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
