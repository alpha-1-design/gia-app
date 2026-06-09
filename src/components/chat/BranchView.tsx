import React, { useState } from 'react';
import { GitBranch, Plus, Trash2, Check, X } from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';
import type { ChatSession } from '../../store/useGiaStore';

interface BranchViewProps {
  session: ChatSession;
  onClose: () => void;
  messages: { id: string; content: string; role: string }[];
}

export const BranchView: React.FC<BranchViewProps> = ({ session, onClose, messages }) => {
  const { switchBranch, addBranch, renameBranch, deleteBranch, addNotification } = useGiaStore();
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);

  const branchIds = (() => {
    if (!session) return [];
    function collect(nodes: { message: { branchId?: string }; children: unknown[] }[], arr: string[]) {
      for (const node of nodes) {
        if (node.message.branchId) {
          if (!arr.includes(node.message.branchId)) arr.push(node.message.branchId!);
        }
        collect(node.children as { message: { branchId?: string }; children: unknown[] }[], arr);
      }
    }
    const result: string[] = [];
    collect(session.messages as { message: { branchId?: string }; children: unknown[] }[], result);
    return result;
  })();

  const branchNames = session.branches || {};
  const hasMultiple = branchIds.length > 1;

  const handleCreateBranch = () => {
    if (!selectedMsgId) {
      addNotification('Select a message to branch from');
      return;
    }
    addBranch(session.id, selectedMsgId);
    addNotification('Branch created');
    setSelectedMsgId(null);
  };

  const handleSwitch = (branchId: string) => {
    switchBranch(session.id, branchId);
    addNotification(`Switched to ${branchNames[branchId]?.name || 'branch'}`);
    onClose();
  };

  const handleRename = (branchId: string) => {
    if (editName.trim()) {
      renameBranch(session.id, branchId, editName.trim());
      setEditingBranch(null);
      setEditName('');
    }
  };

  const handleDelete = (branchId: string) => {
    deleteBranch(session.id, branchId);
    addNotification('Branch deleted');
  };

  const currentBranchId = session.currentBranchId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-lg max-h-[80vh] mx-4 rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
          <div className="flex items-center gap-2">
            <GitBranch size={16} style={{ color: '#a855f7' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Branches</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800 transition-colors">
            <X size={14} style={{ color: 'var(--gia-muted)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {branchIds.map((branchId) => {
            const branchInfo = branchNames[branchId];
            const isActive = branchId === currentBranchId;
            const isEditing = editingBranch === branchId;

            return (
              <div
                key={branchId}
                className="rounded-xl p-3 transition-all"
                style={{
                  background: isActive ? 'rgba(168,85,247,0.08)' : 'var(--gia-surface-2)',
                  border: `1px solid ${isActive ? 'rgba(168,85,247,0.3)' : 'var(--gia-border)'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: isActive ? '#a855f7' : 'var(--gia-muted-2)' }}
                  />
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          className="gia-input text-xs flex-1"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRename(branchId); if (e.key === 'Escape') setEditingBranch(null); }}
                          autoFocus
                          placeholder="Branch name"
                        />
                        <button onClick={() => handleRename(branchId)} className="p-1 rounded hover:bg-zinc-700 text-emerald-400"><Check size={12} /></button>
                        <button onClick={() => setEditingBranch(null)} className="p-1 rounded hover:bg-zinc-700 text-zinc-400"><X size={12} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate" style={{ color: 'var(--gia-text)' }}>
                          {branchInfo?.name || `Branch ${branchId.slice(0, 6)}`}
                        </span>
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.2)', color: '#a855f7' }}>active</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => { setEditingBranch(branchId); setEditName(branchInfo?.name || ''); }}
                          className="p-1 rounded hover:bg-zinc-700 transition-colors"
                          style={{ color: 'var(--gia-muted)' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                        {!isActive && hasMultiple && (
                          <button onClick={() => handleDelete(branchId)} className="p-1 rounded hover:bg-zinc-700 transition-colors text-zinc-600 hover:text-rose-400">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {!isActive && (
                  <button
                    onClick={() => handleSwitch(branchId)}
                    className="mt-2 w-full text-[10px] py-1.5 rounded-lg transition-colors"
                    style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}
                  >
                    Switch to this branch
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 shrink-0" style={{ borderTop: '1px solid var(--gia-border)' }}>
          <p className="text-[10px] font-medium mb-2" style={{ color: 'var(--gia-muted)' }}>Create new branch from message</p>
          <div className="flex items-center gap-2">
            <select
              className="gia-input text-xs flex-1"
              value={selectedMsgId || ''}
              onChange={(e) => setSelectedMsgId(e.target.value || null)}
            >
              <option value="">Select a message...</option>
              {messages.slice(-10).map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.role}] {(m.content || '').slice(0, 60)}{m.content.length > 60 ? '…' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreateBranch}
              className="flex items-center gap-1 text-[10px] px-3 py-2 rounded-lg transition-colors"
              style={{ background: selectedMsgId ? '#a855f7' : 'var(--gia-surface-3)', color: selectedMsgId ? '#fff' : 'var(--gia-muted-2)' }}
              disabled={!selectedMsgId}
            >
              <Plus size={11} /> Fork
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
