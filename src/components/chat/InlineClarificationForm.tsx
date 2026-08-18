import React, { useState } from 'react';
import { Send } from 'lucide-react';
import type { ClarificationField } from '../../store/useGiaStore';

interface InlineClarificationFormProps {
  question: string;
  fields: ClarificationField[];
  loading: boolean;
  onSubmit: (composedAnswer: string) => void;
}

// The screenshot this was built from showed a numbered multi-question form
// (radio group, dropdown, free-text field) with one "Send answers" button,
// rendered inline under GIA's own message rather than as a blocking bottom
// sheet -- consistent with everything else fixed this session about not
// hiding interactive things behind panels/sheets. Submitting composes a
// single readable answer string and hands it to the exact same
// handleClarificationAnswer used by the legacy single-question path, so no
// changes were needed to the generation/continuation flow itself.
export const InlineClarificationForm: React.FC<InlineClarificationFormProps> = ({
  question,
  fields,
  loading,
  onSubmit,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const setAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const requiredUnanswered = fields.some((f) => !answers[f.id]?.trim());

  const handleSubmit = () => {
    const composed = fields
      .map((f, i) => `${i + 1}. ${f.label}\n${answers[f.id]?.trim() || '(no answer)'}`)
      .join('\n\n');
    onSubmit(composed);
  };

  return (
    <div className="mt-3 rounded-2xl p-4" style={{ background: 'var(--gia-surface-1)', border: '1px solid var(--gia-border)' }}>
      {question && (
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--gia-text)' }}>{question}</p>
      )}
      <div className="space-y-4">
        {fields.map((field, i) => (
          <div key={field.id}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--gia-text)' }}>
              {i + 1}. {field.label}
            </p>

            {field.type === 'radio' && (
              <div role="radiogroup" aria-label={field.label} className="space-y-1.5">
                {(field.options || []).map((opt) => {
                  const selected = answers[field.id] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setAnswer(field.id, opt)}
                      disabled={loading}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-all tap-feedback disabled:opacity-40"
                      style={{
                        background: selected ? 'rgba(168,85,247,0.12)' : 'var(--gia-surface-2)',
                        border: `1px solid ${selected ? 'rgba(168,85,247,0.4)' : 'var(--gia-border)'}`,
                        color: selected ? '#c084fc' : 'var(--gia-text)',
                      }}
                    >
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                        style={{ border: `2px solid ${selected ? '#a855f7' : 'var(--gia-muted-2)'}` }}
                      >
                        {selected && <span className="w-2 h-2 rounded-full" style={{ background: '#a855f7' }} />}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {field.type === 'select' && (
              <select
                aria-label={field.label}
                value={answers[field.id] || ''}
                onChange={(e) => setAnswer(field.id, e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-40"
                style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}
              >
                <option value="" disabled>Choose…</option>
                {(field.options || []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {field.type === 'text' && (
              <input
                type="text"
                aria-label={field.label}
                value={answers[field.id] || ''}
                onChange={(e) => setAnswer(field.id, e.target.value)}
                placeholder={field.placeholder || 'Type an answer…'}
                disabled={loading}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-40"
                style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || requiredUnanswered}
        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 tap-feedback"
        style={{ background: '#a855f7', color: '#fff' }}
      >
        <Send size={14} /> Send answers
      </button>
    </div>
  );
};

export default InlineClarificationForm;
