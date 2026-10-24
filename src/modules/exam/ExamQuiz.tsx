import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Question } from './types';

interface ExamQuizProps {
  questions: Question[];
  currentIndex: number;
  onNavigateTo: (idx: number) => void;
  selectedAnswers: Record<string, number>;
  handleAnswer: (questionId: string, optionIndex: number) => void;
  submittedQuestions: Set<string>;
  handleSubmitAnswer: (questionId: string) => void;
  handleSubmitQuiz: () => void;
}

const ExamQuiz: React.FC<ExamQuizProps> = ({
  questions, currentIndex, onNavigateTo,
  selectedAnswers, handleAnswer,
  submittedQuestions, handleSubmitAnswer,
  handleSubmitQuiz,
}) => {
  if (questions.length === 0) return null;

  const q = questions[currentIndex];
  const isSubmitted = submittedQuestions.has(q.id);
  const selected = selectedAnswers[q.id];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 shrink-0" style={{ background: 'var(--gia-surface-2)' }}>
        <div className="h-full transition-all duration-300" style={{
          width: `${questions.length ? (submittedQuestions.size / questions.length) * 100 : 0}%`,
          background: 'var(--gia-text)',
        }} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          <div className="gia-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg" style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-text)' }}>
                Q{currentIndex + 1}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>{q.topic}</span>
            </div>

            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--gia-text)' }}>
              {q.question}
            </p>

            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const isOptSelected = selected === oi;
                const isCorrect = q.correctAnswer === oi;
                let borderColor = 'var(--gia-border)';
                let bgColor = 'var(--gia-surface-2)';
                let textColor = 'var(--gia-text)';
                const prefix = String.fromCharCode(65 + oi);

                if (isSubmitted) {
                  if (isCorrect) {
                    borderColor = 'rgba(52,211,153,0.5)';
                    bgColor = 'rgba(16,185,129,0.1)';
                    textColor = '#34d399';
                  } else if (isOptSelected) {
                    borderColor = 'rgba(248,113,113,0.5)';
                    bgColor = 'rgba(239,68,68,0.08)';
                    textColor = '#f87171';
                  }
                } else if (isOptSelected) {
                  borderColor = 'var(--gia-border-2)';
                  bgColor = 'var(--gia-surface-3)';
                  textColor = 'var(--gia-text)';
                }

                return (
                  <button key={oi} onClick={() => handleAnswer(q.id, oi)} disabled={isSubmitted}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all tap-feedback disabled:cursor-default"
                    style={{ borderColor, background: bgColor, color: textColor }}>
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{
                        background: isSubmitted && isCorrect ? 'rgba(52,211,153,0.2)' : isSubmitted && isOptSelected ? 'rgba(239,68,68,0.2)' : isOptSelected ? 'var(--gia-text)' : 'var(--gia-surface-3)',
                        color: isSubmitted && isCorrect ? '#34d399' : isSubmitted && isOptSelected ? '#f87171' : isOptSelected ? 'var(--gia-bg)' : 'var(--gia-muted)',
                      }}>
                      {prefix}
                    </span>
                    <span className="text-sm flex-1">{opt.replace(/^[A-D]\.\s*/, '')}</span>
                    {isSubmitted && isCorrect && <CheckCircle2 size={14} style={{ color: '#34d399' }} />}
                    {isSubmitted && isOptSelected && !isCorrect && <XCircle size={14} style={{ color: '#f87171' }} />}
                  </button>
                );
              })}
            </div>

            {!isSubmitted && selected !== undefined && (
              <button onClick={() => handleSubmitAnswer(q.id)}
                className="mt-3 text-xs font-medium px-4 py-2 rounded-xl w-full"
                style={{ background: 'var(--gia-text)', border: '1px solid var(--gia-text)', color: 'var(--gia-bg)' }}>
                Submit Answer
              </button>
            )}

            {isSubmitted && (
              <div className="mt-3 p-3 rounded-xl" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  {selected === q.correctAnswer
                    ? <CheckCircle2 size={12} style={{ color: '#34d399' }} />
                    : <XCircle size={12} style={{ color: '#f87171' }} />}
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: selected === q.correctAnswer ? '#34d399' : '#f87171' }}>
                    {selected === q.correctAnswer ? 'Correct' : 'Not quite'}
                  </p>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--gia-muted)' }}>{q.explanation}</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            <button onClick={() => { onNavigateTo(Math.max(0, currentIndex - 1)); }}
              disabled={currentIndex === 0}
              className="flex-1 text-xs py-2.5 rounded-xl border tap-feedback disabled:opacity-30"
              style={{ borderColor: 'var(--gia-border)', color: 'var(--gia-muted)' }}>
              ← Previous
            </button>
            {currentIndex < questions.length - 1 ? (
              <button onClick={() => { onNavigateTo(currentIndex + 1); }}
                className="flex-1 text-xs py-2.5 rounded-xl border tap-feedback"
                style={{ borderColor: 'var(--gia-border)', background: 'var(--gia-surface-2)', color: 'var(--gia-text)' }}>
                Next →
              </button>
            ) : (
              <button onClick={handleSubmitQuiz}
                className="flex-1 text-xs py-2.5 rounded-xl font-semibold"
                style={{ background: 'var(--gia-text)', color: 'var(--gia-bg)' }}>
                Submit Quiz
              </button>
            )}
          </div>

          {/* Question dots */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            {questions.map((qItem, qi) => {
              const qSubmitted = submittedQuestions.has(qItem.id);
              const isCurrent = qi === currentIndex;
              return (
                <button key={qItem.id} onClick={() => { onNavigateTo(qi); }}
                  className="w-6 h-6 rounded-lg text-[10px] font-mono transition-all tap-feedback"
                  style={{
                    background: isCurrent ? 'var(--gia-text)' : qSubmitted ? 'var(--gia-surface-3)' : 'var(--gia-surface-2)',
                    border: `1px solid ${isCurrent ? 'var(--gia-text)' : qSubmitted ? 'var(--gia-border-2)' : 'var(--gia-border)'}`,
                    color: isCurrent ? 'var(--gia-bg)' : qSubmitted ? 'var(--gia-text)' : 'var(--gia-muted)',
                  }}>
                  {qi + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ExamQuiz);
