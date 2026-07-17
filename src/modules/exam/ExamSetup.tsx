import React, { useRef, useState } from 'react';
import { Loader2, GraduationCap, BookOpen, Brain, Clock, FileText, Upload, X, Award, AlertTriangle, Lightbulb } from 'lucide-react';
import ExamHistory from './ExamHistory';
import type { ExamSystem, ExamMode, Difficulty, Subject, LearningProfile } from './types';
import { ASSESSMENT_FILE_KEY } from './types';
import GiaBrain from '../../services/GiaBrain';
import { useGiaStore } from '../../store/useGiaStore';
import { generateWithRetry } from '../../utils/generateWithRetry';

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
  profile: LearningProfile | null;
  onProfileUpdate: (p: LearningProfile | null) => void;
}

const EXAM_SYSTEMS: ExamSystem[] = ['WASSCE', 'BECE', 'JAMB', 'CUSTOM'];

const ExamSetup: React.FC<ExamSetupProps> = ({
  examSystem, setExamSystem, examMode, setExamMode,
  subject, setSubject, topic, setTopic,
  difficulty, setDifficulty, questionCount, setQuestionCount,
  subjects, loading, error, onStart,
  profile, onProfileUpdate,
}) => {
  const [assessing, setAssessing] = useState(false);
  const [assessFile, setAssessFile] = useState<{ name: string; content: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const addNotification = useGiaStore(s => s.addNotification);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      setAssessFile({ name: file.name, content: content.slice(0, 15000) });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAssess = async () => {
    if (!assessFile) return;
    setAssessing(true);
    try {
      addNotification('📊 Analyzing your work...');
      const { data: parsed } = await generateWithRetry<{
        weakAreas: { subject: string; topic: string; recommendations: string[] }[];
        strongAreas: { subject: string; topic: string }[];
        overallScore: number;
      }>(
        () => GiaBrain.generate({
          prompt: `Analyze this student's work and build a learning profile:\n\n${assessFile.content}`,
          systemPrompt: `You are an educational assessment expert. Analyze the submitted work and respond with valid JSON:
{"weakAreas":[{"subject":"Subject name","topic":"Specific topic","recommendations":["Study tip 1","Study tip 2"]}],"strongAreas":[{"subject":"Subject name","topic":"Topic name"}],"overallScore":65}
overallScore is 0-100. Be specific with recommendations. Pure JSON, no markdown.`,
          systemPromptMode: 'append',
          forceJson: true,
          temperature: 0.3,
          maxTokens: 2000,
        }),
        { moduleName: 'ExamAssessment' }
      );
      if (parsed.weakAreas || parsed.strongAreas) {
        const profile: LearningProfile = {
          weakAreas: (parsed.weakAreas || []).map(w => ({ ...w, score: 50, recommendations: w.recommendations || ['Review this topic'] })),
          strongAreas: (parsed.strongAreas || []).map(s => ({ ...s, score: 80 })),
          overallScore: parsed.overallScore ?? 50,
          totalAssessments: 1,
          lastUpdated: Date.now(),
        };
        onProfileUpdate(profile);
        localStorage.setItem('gia-learning-profile', JSON.stringify(profile));

        // Save assessment file + analysis to localStorage for later reference
        let existing: unknown[] = [];
        try { existing = JSON.parse(localStorage.getItem(ASSESSMENT_FILE_KEY) || '[]'); } catch { existing = []; }
        existing.push({
          fileName: assessFile.name,
          content: assessFile.content,
          timestamp: Date.now(),
          analysis: {
            weakAreas: profile.weakAreas,
            strongAreas: profile.strongAreas,
            overallScore: profile.overallScore,
          },
        });
        localStorage.setItem(ASSESSMENT_FILE_KEY, JSON.stringify(existing));

        setAssessFile(null);
        addNotification('✅ Profile built from your assessment');
      }
    } catch {
      addNotification('⚠️ Could not analyze file. Try again or use a different format.');
    } finally {
      setAssessing(false);
    }
  };

  const clearProfile = () => {
    localStorage.removeItem('gia-learning-profile');
    onProfileUpdate(null);
  };

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

      {/* File Assessment */}
      <div className="gia-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Upload size={13} style={{ color: '#a855f7' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Self-Assessment</span>
          <span className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>Upload test results or homework for GIA to analyze</span>
        </div>

        {assessFile && (
          <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2">
            <span className="text-xs text-indigo-400 flex-1 truncate">📎 {assessFile.name}</span>
            <button onClick={() => setAssessFile(null)} className="text-zinc-500 hover:text-rose-400"><X size={13} /></button>
          </div>
        )}

        <div className="flex gap-2">
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile} accept=".txt,.md,.csv,.json,.pdf" />
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-[11px] text-zinc-400 border border-zinc-800 rounded-lg px-3 py-2 hover:border-purple-300 hover:text-purple-400 transition-all">
            <Upload size={11} /> Choose file
          </button>
          {assessFile && (
            <button onClick={handleAssess} disabled={assessing}
              className="flex-1 text-xs py-2 rounded-lg font-semibold disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: 'white' }}>
              {assessing ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
              {assessing ? 'Analyzing...' : 'Analyze & Build Profile'}
            </button>
          )}
        </div>
      </div>

      {/* Learning Profile */}
      {profile && (
        <div className="gia-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award size={13} style={{ color: '#f59e0b' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Your Learning Profile</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{
                background: profile.overallScore >= 70 ? 'rgba(52,211,153,0.15)' : profile.overallScore >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                color: profile.overallScore >= 70 ? '#34d399' : profile.overallScore >= 40 ? '#f59e0b' : '#f87171',
              }}>
                {profile.overallScore}%
              </span>
              <button onClick={clearProfile} className="text-[10px] text-zinc-600 hover:text-rose-400">Clear</button>
            </div>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>
            {profile.totalAssessments} assessment{profile.totalAssessments !== 1 ? 's' : ''} · Last updated {new Date(profile.lastUpdated).toLocaleDateString()}
          </p>

          {profile.weakAreas.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={11} style={{ color: '#f87171' }} />
                <span className="text-[10px] font-semibold" style={{ color: '#f87171' }}>Needs Practice</span>
              </div>
              {profile.weakAreas.slice(0, 5).map((w, i) => (
                <div key={i} className="rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--gia-text)' }}>{w.topic}</span>
                    <span className="text-[10px]" style={{ color: '#f87171' }}>{w.subject} · {w.score}/100</span>
                  </div>
                  {w.recommendations.length > 0 && (
                    <div className="flex items-start gap-1.5 mt-1">
                      <Lightbulb size={9} style={{ color: '#f59e0b' }} className="mt-0.5 shrink-0" />
                      <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>{w.recommendations[0]}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {profile.strongAreas.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Award size={11} style={{ color: '#34d399' }} />
                <span className="text-[10px] font-semibold" style={{ color: '#34d399' }}>Strong Areas</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profile.strongAreas.slice(0, 8).map((s, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
                    {s.topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ExamHistory />
    </div>
  );
};

export default ExamSetup;