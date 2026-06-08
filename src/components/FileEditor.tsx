import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { FileCode, Edit3, Eye, Copy, Check } from 'lucide-react';

const EXT_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  json: 'json', md: 'markdown', css: 'css', html: 'html',
  py: 'python', rs: 'rust', go: 'go', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  yaml: 'yaml', yml: 'yaml', toml: 'toml',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  sql: 'sql', graphql: 'graphql', svg: 'xml',
  xml: 'xml', txt: 'text', env: 'dotenv',
};

function getLang(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return EXT_MAP[ext] || 'text';
}

function tokenize(text: string): { text: string; type: string }[] {
   const tokens: { text: string; type: string }[] = [];
   const patterns: [RegExp, string][] = [
     [/(\/\/.*|\/\*[\s\S]*?\*\/)/g, 'comment'],
     [/(["'`])(?:(?!\1|\\).|\\.)*\1/g, 'string'],
     [/\b(import|export|from|const|let|var|function|return|if|else|for|while|class|interface|type|extends|implements|async|await|new|throw|try|catch|finally|switch|case|default|break|continue|typeof|instanceof|in|of|this|super|yield|static|private|public|protected|readonly)\b/g, 'keyword'],
     [/\b(\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g, 'number'],
     [/\b(true|false|null|undefined|NaN|Infinity)\b/g, 'literal'],
   ];

   const allMatches: { index: number; text: string; type: string }[] = [];

   for (const [regex, type] of patterns) {
     let m;
     while ((m = regex.exec(text)) !== null) {
       allMatches.push({ index: m.index, text: m[0], type });
     }
   }

  allMatches.sort((a, b) => a.index - b.index);

  let prevEnd = 0;
  for (const match of allMatches) {
    if (match.index < prevEnd) continue;
    if (match.index > prevEnd) {
      tokens.push({ text: text.slice(prevEnd, match.index), type: 'plain' });
    }
    tokens.push({ text: match.text, type: match.type });
    prevEnd = match.index + match.text.length;
  }
  if (prevEnd < text.length) {
    tokens.push({ text: text.slice(prevEnd), type: 'plain' });
  }

  return tokens;
}

const STYLE: Record<string, React.CSSProperties> = {
  comment: { color: '#6b7280', fontStyle: 'italic' },
  keyword: { color: '#7c3aed', fontWeight: 600 },
  string: { color: '#059669' },
  number: { color: '#d97706' },
  literal: { color: '#dc2626' },
  plain: {},
};

interface FileEditorProps {
  filename: string;
  content: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
  height?: string;
}

export function FileEditor({ filename, content, onChange, readOnly = true, height = '400px' }: FileEditorProps) {
  const [editing, setEditing] = useState(!readOnly);
  const [editContent, setEditContent] = useState(content);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lang = useMemo(() => getLang(filename), [filename]);
  const lines = useMemo(() => content.split('\n'), [content]);

  useEffect(() => {
    setEditContent(content);
  }, [content]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleSave = useCallback(() => {
    if (onChange && editContent !== content) {
      onChange(editContent);
    }
    setEditing(false);
  }, [editContent, content, onChange]);

  const tokenizedLines = useMemo(
    () => lines.map((line) => tokenize(line)),
    [lines]
  );

  const lineNumWidth = `${String(lines.length).length}ch`;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <FileCode size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{filename}</span>
          <span className="text-[10px] text-gray-400 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">{lang}</span>
        </div>
        <div className="flex items-center gap-1">
          {!readOnly && (
            <button
              onClick={() => (editing ? handleSave() : setEditing(true))}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title={editing ? 'Save' : 'Edit'}
            >
              {editing ? <Eye size={14} /> : <Edit3 size={14} />}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Copy"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 overflow-auto">
          {editing ? (
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-full bg-transparent text-sm font-mono outline-none resize-none p-3 leading-relaxed"
              spellCheck={false}
            />
          ) : (
            <div className="flex">
              <div
                className="text-right px-2 py-3 text-xs leading-relaxed text-gray-400 dark:text-gray-600 select-none border-r border-gray-100 dark:border-gray-800 font-mono"
                style={{ minWidth: lineNumWidth }}
              >
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <div className="flex-1 py-3 px-3 text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre">
                {tokenizedLines.map((tokens, lineIdx) => (
                  <div key={lineIdx}>
                    {tokens.length > 0
                      ? tokens.map((t, ti) => (
                          <span key={ti} style={STYLE[t.type]}>
                            {t.text}
                          </span>
                        ))
                      : <span>&nbsp;</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
