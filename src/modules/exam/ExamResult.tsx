import React from 'react';
import { Award, BarChart3, AlertTriangle, CheckCircle2, XCircle, Brain, Clock, RefreshCw } from 'lucide-react';
import { QuizResult, Question } from './types';

interface ExamResultProps {
  result: QuizResult;
  questions: Question[];
  onNewQuiz: () => void;
  onRetry: () => void;
  onPracticeTopic: (topic: string) => void;
}

const ExamResult: React.FC<ExamResultProps> = ({ result, questions, onNewQuiz, onRetry, onPracticeTopic }) => {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {/* Score card */}
      <div className="gia-card p-6 text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center" style={{
          background: 'var(--gia-surface-2)',
          border: '1px solid var(--gia-border)',
        }}>
          {result.score >= 70 ? <Award size={28} style={{ color: 'var(--gia-text)' }} />
            : result.score >= 40 ? <BarChart3 size={28} style={{ color: 'var(--gia-muted)' }} />
            : <AlertTriangle size={28} style={{ color: '#f87171' }} />}
        </div>
        <p className="text-3xl font-bold" style={{ color: 'var(--gia-text)' }}>
          {result.score}%
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--gia-muted)' }}>
          {result.correct}/{result.total} correct
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { label: 'Correct', value: result.correct, color: '#34d399', icon: CheckCircle2 },
          { label: 'Incorrect', value: result.incorrect, color: '#f87171', icon: XCircle },
          { label: 'Skipped', value: result.skipped, color: 'var(--gia-muted-2)', icon: AlertTriangle },
        ] as const).map(s => (
          <div key={s.label} className="gia-card p-3 text-center">
            <s.icon size={14} className="mx-auto mb-1" style={{ color: s.color }} />
            <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--gia-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Time */}
      <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-muted)' }}>
        <Clock size={12} style={{ color: 'var(--gia-muted)' }} />
        Time spent: {Math.floor(result.timeSpent / 60)}m {result.timeSpent % 60}s
      </div>

      {/* Weak areas */}
      {result.weakAreas.length > 0 && (
        <div className="gia-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain size={13} style={{ color: 'var(--gia-muted)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Areas to Improve</span>
          </div>
          <p className="text-[10px] mb-2" style={{ color: 'var(--gia-muted-2)' }}>Tap a topic to practice it next.</p>
          <div className="flex flex-wrap gap-1.5">
            {result.weakAreas.map(area => (
              <button key={area} onClick={() => onPracticeTopic(area)}
                className="text-[10px] px-2.5 py-1 rounded-lg tap-feedback transition-colors"
                style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}>
                {area}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Answer review */}
      <div className="space-y-2">
        <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Review Answers</p>
        {questions.map((q, qi) => {
          const ans = result.answers[qi];
          return (
            <div key={q.id} className="gia-card p-3">
              <div className="flex items-start gap-2">
                {ans.correct ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: '#34d399' }} />
                  : <XCircle size={14} className="mt-0.5 shrink-0" style={{ color: '#f87171' }} />}
                <div className="min-w-0">
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--gia-text)' }}>{q.question}</p>
                  <p className="text-[10px] mt-1" style={{ color: ans.correct ? '#34d399' : '#f87171' }}>
                    {ans.correct ? `Correct: ${q.options[q.correctAnswer]}` : `Your answer: ${ans.selected >= 0 ? q.options[ans.selected] : 'Skipped'} · Correct: ${q.options[q.correctAnswer]}`}
                  </p>
                  <details className="mt-2">
                    <summary className="text-[10px] cursor-pointer select-none" style={{ color: 'var(--gia-muted)' }}>Why?</summary>
                    <p className="text-[11px] leading-relaxed mt-1" style={{ color: 'var(--gia-muted)' }}>{q.explanation}</p>
                  </details>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pb-4">
        <button onClick={onNewQuiz}
          className="flex-1 text-xs py-3 rounded-xl border tap-feedback"
          style={{ borderColor: 'var(--gia-border)', color: 'var(--gia-muted)' }}>
          <RefreshCw size={12} className="inline mr-1" /> New Quiz
        </button>
        <button onClick={onRetry}
          className="flex-1 text-xs py-3 rounded-xl font-semibold"
          style={{ background: 'var(--gia-text)', color: 'var(--gia-bg)' }}>
          Retry Same Subject
        </button>
      </div>
    </div>
  );
};

export default React.memo(ExamResult);
