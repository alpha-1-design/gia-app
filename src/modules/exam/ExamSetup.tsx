import React from 'react';
import { Loader2, GraduationCap, BookOpen, Brain, Clock, FileText } from 'lucide-react';
import ExamHistory from './ExamHistory';
import type { ExamSystem, ExamMode, Difficulty, Subject } from './types';

interface ExamSetupProps {
  examSystem: ExamSystem;
  setExamSystem: (v: ExamSystem) => void;
  examMode: ExamMode;
  setExamMode: (v: ExamMode) => void;
  subject: string;
  setSubject: (v: string) => void;
  topic: string;
  setTopic: (v: string) => void;
  difficulty: Difficulty;
  setDifficulty: (v: Difficulty) => void;
  questionCount: number;
  setQuestionCount: (v: number) => void;
  subjects: Subject[];
  loading: boolean;
  error: string;
  onStart: () => void;
}

const EXAM_SYSTEMS: ExamSystem[] = ['WASSCE', 'BECE', 'JAMB', 'CUSTOM'];

const ExamSetup: React.FC<ExamSetupProps> = ({
  examSystem, setExamSystem, examMode, setExamMode,
  subject, setSubject, topic, setTopic,
  difficulty, setDifficulty, questionCount, setQuestionCount,
  subjects, loading, error, onStart,
}) => {
  if (loading) {
    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--gia-bg)' }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin" style={{ color: '#f59e0b' }} />
            <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>Loading subjects...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {/* Exam System */}
      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--gia-muted)' }}>Exam System</p>
        <div className="flex flex-wrap gap-2">
          {EXAM_SYSTEMS.map(es => (
            <button key={es} onClick={() => { setExamSystem(es); setSubject(''); setTopic(''); }}
              className="text-xs px-3 py-1.5 rounded-xl border transition-all tap-feedback"
              style={{
                background: examSystem === es ? 'rgba(245,158,11,0.15)' : 'var(--gia-surface)',
                border: `1px solid ${examSystem === es ? 'rgba(245,158,11,0.3)' : 'var(--gia-border)'}`,
                color: examSystem === es ? '#f59e0b' : 'var(--gia-muted)',
                fontWeight: examSystem === es ? 600 : 400,
              }}>
              {es}
            </button>
          ))}
        </div>
      </div>

      {/* Mode */}
      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--gia-muted)' }}>Mode</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: 'study' as ExamMode, icon: BookOpen, label: 'Study', desc: 'Learn with detailed explanations' },
            { id: 'quiz' as ExamMode, icon: Brain, label: 'Quiz', desc: 'Test your knowledge' },
            { id: 'timed' as ExamMode, icon: Clock, label: 'Timed Exam', desc: 'Race against the clock' },
            { id: 'past' as ExamMode, icon: FileText, label: 'Past Questions', desc: 'Real exam past papers' },
          ]).map(m => (
            <button key={m.id} onClick={() => setExamMode(m.id)}
              className="gia-card p-3 flex items-start gap-3 text-left tap-feedback transition-all"
              style={{ borderColor: examMode === m.id ? 'rgba(245,158,11,0.3)' : 'var(--gia-border)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: examMode === m.id ? 'rgba(245,158,11,0.15)' : 'var(--gia-surface-2)' }}>
                <m.icon size={14} style={{ color: examMode === m.id ? '#f59e0b' : 'var(--gia-muted)' }} />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>{m.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>{m.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Subject */}
      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--gia-muted)' }}>Subject</p>
        <div className="flex flex-wrap gap-2">
          {subjects.map(s => (
            <button key={s.name} onClick={() => { setSubject(s.name); setTopic(''); }}
              className="text-xs px-3 py-1.5 rounded-xl border transition-all tap-feedback"
              style={{
                background: subject === s.name ? 'rgba(245,158,11,0.15)' : 'var(--gia-surface)',
                border: `1px solid ${subject === s.name ? 'rgba(245,158,11,0.3)' : 'var(--gia-border)'}`,
                color: subject === s.name ? '#f59e0b' : 'var(--gia-muted)',
                fontWeight: subject === s.name ? 600 : 400,
              }}>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Topic */}
      {subject && subjects.find(s => s.name === subject)?.topics && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--gia-muted)' }}>Topic (optional)</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTopic('')}
              className="text-xs px-3 py-1.5 rounded-xl border transition-all tap-feedback"
              style={{
                background: !topic ? 'rgba(245,158,11,0.15)' : 'var(--gia-surface)',
                border: `1px solid ${!topic ? 'rgba(245,158,11,0.3)' : 'var(--gia-border)'}`,
                color: !topic ? '#f59e0b' : 'var(--gia-muted)',
                fontWeight: !topic ? 600 : 400,
              }}>
              All Topics
            </button>
            {subjects.find(s => s.name === subject)?.topics.map(t => (
              <button key={t} onClick={() => setTopic(t)}
                className="text-xs px-3 py-1.5 rounded-xl border transition-all tap-feedback"
                style={{
                  background: topic === t ? 'rgba(245,158,11,0.15)' : 'var(--gia-surface)',
                  border: `1px solid ${topic === t ? 'rgba(245,158,11,0.3)' : 'var(--gia-border)'}`,
                  color: topic === t ? '#f59e0b' : 'var(--gia-muted)',
                  fontWeight: topic === t ? 600 : 400,
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Difficulty & Count */}
      <div className="flex gap-4">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--gia-muted)' }}>Difficulty</p>
          <div className="flex gap-2">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className="text-xs px-3 py-1.5 rounded-xl border transition-all capitalize tap-feedback flex-1 text-center"
                style={{
                  background: difficulty === d ? 'rgba(245,158,11,0.15)' : 'var(--gia-surface)',
                  border: `1px solid ${difficulty === d ? 'rgba(245,158,11,0.3)' : 'var(--gia-border)'}`,
                  color: difficulty === d ? '#f59e0b' : 'var(--gia-muted)',
                  fontWeight: difficulty === d ? 600 : 400,
                }}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="w-32">
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--gia-muted)' }}>Questions: {questionCount}</p>
          <input type="range" min={5} max={30} step={5} value={questionCount}
            onChange={e => setQuestionCount(Number(e.target.value))}
            className="w-full" style={{ accentColor: '#f59e0b' }} />
        </div>
      </div>

      {error && (
        <div className="gia-card p-3" style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
          <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
        </div>
      )}

      <button onClick={onStart} disabled={!subject || loading}
        className="gia-btn w-full" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontWeight: 600 }}>
        {loading ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
        {loading ? 'Generating...' : `Start ${examMode === 'timed' ? 'Timed Exam' : examMode === 'past' ? 'Past Questions' : examMode === 'quiz' ? 'Quiz' : 'Study Session'}`}
      </button>

      <ExamHistory />
    </div>
  );
};

export default React.memo(ExamSetup);
