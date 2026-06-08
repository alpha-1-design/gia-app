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
  showExplanation: boolean;
  handleSubmitQuiz: () => void;
}

const ExamQuiz: React.FC<ExamQuizProps> = ({
  questions, currentIndex, onNavigateTo,
  selectedAnswers, handleAnswer,
  submittedQuestions, handleSubmitAnswer,
  showExplanation, handleSubmitQuiz,
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
          background: 'linear-gradient(90deg, #f59e0b, #d97706)',
        }} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          <div className="gia-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
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
                  borderColor = 'rgba(245,158,11,0.6)';
                  bgColor = 'rgba(245,158,11,0.1)';
                  textColor = '#f59e0b';
                }

                return (
                  <button key={oi} onClick={() => handleAnswer(q.id, oi)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all tap-feedback"
                    style={{ borderColor, background: bgColor, color: textColor }}>
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{
                        background: isSubmitted && isCorrect ? 'rgba(52,211,153,0.2)' : isSubmitted && isOptSelected ? 'rgba(239,68,68,0.2)' : isOptSelected ? 'rgba(245,158,11,0.2)' : 'var(--gia-surface-3)',
                        color: isSubmitted && isCorrect ? '#34d399' : isSubmitted && isOptSelected ? '#f87171' : isOptSelected ? '#f59e0b' : 'var(--gia-muted)',
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
                style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
                Submit Answer
              </button>
            )}

            {showExplanation && isSubmitted && (
              <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#f59e0b' }}>Explanation</p>
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
                style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                Next →
              </button>
            ) : (
              <button onClick={handleSubmitQuiz}
                className="flex-1 text-xs py-2.5 rounded-xl font-semibold"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white' }}>
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
                    background: isCurrent ? 'rgba(245,158,11,0.2)' : qSubmitted ? 'rgba(52,211,153,0.2)' : 'var(--gia-surface-2)',
                    border: `1px solid ${isCurrent ? 'rgba(245,158,11,0.4)' : qSubmitted ? 'rgba(52,211,153,0.3)' : 'var(--gia-border)'}`,
                    color: isCurrent ? '#f59e0b' : qSubmitted ? '#34d399' : 'var(--gia-muted)',
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
