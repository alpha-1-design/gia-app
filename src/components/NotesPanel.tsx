import { useState, useMemo, useEffect } from 'react';
import { useNotesStore, GiaNote, randomNoteColor } from '../store/useNotesStore';
import { StickyNote, Plus, Pin, Trash2, Search, X, GitCompare } from 'lucide-react';
import { DiffViewer } from './DiffViewer';

function NoteCard({ note, onSelect, selected }: { note: GiaNote; onSelect: (n: GiaNote) => void; selected: boolean }) {
  const { togglePin, deleteNote } = useNotesStore();

  return (
    <div
      onClick={() => onSelect(note)}
      className={`group relative rounded-lg p-3 cursor-pointer transition-all hover:shadow-md border border-transparent hover:border-gray-200 dark:hover:border-gray-700 animate-in-slide ${
        selected ? 'ring-2 ring-blue-500 shadow-md' : ''
      }`}
      style={{ backgroundColor: note.color || '#fef3c7' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{note.title}</div>
          <div className="text-xs mt-1 line-clamp-3 opacity-80 whitespace-pre-wrap">
            {note.content}
          </div>
          <div className="text-[10px] mt-2 opacity-60">
            {new Date(note.updatedAt).toLocaleDateString()}
          </div>
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); togglePin(note.id); }}
            className={`p-1 rounded hover:bg-black/10 transition-colors ${note.pinned ? 'opacity-100' : 'opacity-50'}`}
          >
            <Pin size={12} className={note.pinned ? 'text-blue-600' : ''} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
            className="p-1 rounded hover:bg-black/10 transition-colors opacity-50 hover:opacity-100"
          >
            <Trash2 size={12} className="text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteEditor({ note, onClose }: { note: GiaNote; onClose: () => void }) {
  const { updateNote, addNote } = useNotesStore();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [showDiff, setShowDiff] = useState(false);
  const [originalContent, setOriginalContent] = useState(note.content);

  useEffect(() => {
    setOriginalContent(note.content);
    setTitle(note.title);
    setContent(note.content);
  }, [note.id, note.content, note.title]);

  const handleSave = () => {
    if (!title.trim()) return;
    if (note.id) {
      updateNote(note.id, { title: title.trim(), content });
    } else {
      addNote({ title: title.trim(), content, color: randomNoteColor(), pinned: false, tags: [] });
    }
    onClose();
  };

  const hasChanges = note.id ? content !== originalContent || title !== note.title : (!!title.trim() || !!content);

  if (showDiff && note.id) {
    const oldText = note.title + '\n\n' + originalContent;
    const newText = title + '\n\n' + content;
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-semibold">Changes — {note.title}</span>
          <button onClick={() => setShowDiff(false)} className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">Back to edit</button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          <DiffViewer oldText={oldText} newText={newText} oldFilename="original" newFilename="edited" height="100%" sideBySide={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-semibold">{note.id ? 'Edit Note' : 'New Note'}</span>
          <div className="flex gap-1">
            {note.id && hasChanges && (
              <button
                onClick={() => setShowDiff(true)}
                className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1"
              >
                <GitCompare size={12} /> Changes
              </button>
            )}
            <button
              onClick={handleSave}
              className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      <div className="flex-1 flex flex-col p-3 gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="text-sm font-semibold bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none pb-1 placeholder:text-gray-400"
          autoFocus
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your note here... (markdown supported)"
          className="flex-1 text-sm bg-transparent outline-none resize-none placeholder:text-gray-400 leading-relaxed"
        />
      </div>
    </div>
  );
}

export function NotesPanel() {
  const { notes } = useNotesStore();
  const [search, setSearch] = useState('');
  const [selectedNote, setSelectedNote] = useState<GiaNote | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    );
  }, [notes, search]);

  const pinned = useMemo(() => filtered.filter((n) => n.pinned), [filtered]);
  const unpinned = useMemo(() => filtered.filter((n) => !n.pinned), [filtered]);

  const handleSelect = (note: GiaNote) => {
    setSelectedNote(note);
    setCreating(false);
  };

  const handleNew = () => {
    setSelectedNote(null);
    setCreating(true);
  };

  if (creating) {
    return (
      <NoteEditor
        note={{ id: '', title: '', content: '', color: randomNoteColor(), pinned: false, tags: [], createdAt: 0, updatedAt: 0 }}
        onClose={() => setCreating(false)}
      />
    );
  }

  if (selectedNote) {
    return (
      <NoteEditor
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <StickyNote size={16} className="text-yellow-500" />
          <span className="font-semibold text-sm">Notes</span>
          <span className="text-xs text-gray-400">{notes.length}</span>
        </div>
        <button
          onClick={handleNew}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="px-3 py-2">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded pl-7 pr-2 py-1.5 bg-transparent outline-none placeholder:text-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {pinned.map((note) => (
          <NoteCard key={note.id} note={note} onSelect={handleSelect} selected={false} />
        ))}
        {unpinned.map((note) => (
          <NoteCard key={note.id} note={note} onSelect={handleSelect} selected={false} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-12">
            {search ? 'No notes match your search' : 'No notes yet. Click + to create one.'}
          </div>
        )}
      </div>
    </div>
  );
}
