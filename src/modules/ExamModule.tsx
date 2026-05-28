import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GraduationCap, Clock, CheckCircle2, XCircle, Brain, BarChart3, Loader2, BookOpen, FileText, RefreshCw, ChevronRight, Award, AlertTriangle, Trash2 } from 'lucide-react';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore, ExamResult } from '../store/useGiaStore';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { extractJSON } from '../utils/helpers';

type ExamSystem = 'WASSCE' | 'BECE' | 'JAMB' | 'CUSTOM';
type ExamMode = 'quiz' | 'timed' | 'study' | 'past';
type Difficulty = 'easy' | 'medium' | 'hard';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  topic: string;
}

interface QuizResult {
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score: number;
  answers: { questionId: string; selected: number; correct: boolean }[];
  weakAreas: string[];
  timeSpent: number;
}

interface Subject {
  name: string;
  topics: string[];
}

const genId = () => {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => '0123456789abcdefghijklmnopqrstuvwxyz'[b % 36]).join('');
};

const EXAM_SYSTEMS: ExamSystem[] = ['WASSCE', 'BECE', 'JAMB', 'CUSTOM'];

const ExamModule: React.FC = () => {
  const [examSystem, setExamSystem] = useState<ExamSystem>('WASSCE');
  const [examMode, setExamMode] = useState<ExamMode>('study');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [questionCount, setQuestionCount] = useState(10);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<QuizResult | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [tab, setTab] = useState<'setup' | 'quiz' | 'result'>('setup');
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [showPastQuestions, setShowPastQuestions] = useState(false);
  const { addNotification } = useGiaStore();
  const submitQuizRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (tab === 'setup') fetchSubjects();
  }, [examSystem]);

  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setTimerActive(false);
          submitQuizRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await GiaBrain.generate({
        prompt: `List the main subjects for ${examSystem} exams in West Africa.`,
        systemPrompt: `You are an expert in West African education. Respond with valid JSON only:
{"subjects":[{"name":"Subject Name","topics":["Topic 1","Topic 2","Topic 3","Topic 4","Topic 5"]}]}
Include 6-10 subjects with 4-6 topics each. Pure JSON, no markdown.`,
        systemPromptMode: 'append',
        forceJson: true,
        temperature: 0.3,
        maxTokens: 2000,
      });
      const parsed = extractJSON(res.text);
      setSubjects(parsed.subjects ?? []);
    } catch {
      setSubjects([
        { name: 'Mathematics', topics: ['Algebra', 'Geometry', 'Trigonometry', 'Statistics', 'Calculus'] },
        { name: 'English Language', topics: ['Comprehension', 'Grammar', 'Essay Writing', 'Oral English', 'Literature'] },
        { name: 'Science', topics: ['Physics', 'Chemistry', 'Biology', 'Integrated Science', 'Practical'] },
        { name: 'Social Studies', topics: ['Government', 'History', 'Geography', 'Economics', 'Civics'] },
      ]);
    } finally {
      setLoading(false);
    }
  }, [examSystem]);

  const handleGenerateQuestions = useCallback(async () => {
    if (!subject) {
      setError('Select a subject first');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setTab('quiz');
    setCurrentIndex(0);
    setSelectedAnswers({});
    setSubmittedQuestions(new Set());
    setShowExplanation(false);

    const modeDesc = examMode === 'quiz' ? 'multiple choice quiz questions'
      : examMode === 'timed' ? 'timed multiple choice exam questions'
      : examMode === 'study' ? 'study questions with detailed explanations'
      : 'WAEC/NECO past question style';

    try {
      const topicContext = topic ? ` focusing on ${topic}` : '';
      const res = await GiaBrain.generate({
        signal: AbortSignal.timeout(30_000),
        prompt: `Generate ${questionCount} ${modeDesc} for ${examSystem} ${subject}${topicContext} at ${difficulty} difficulty.`,
        systemPrompt: `You are a ${examSystem} exam expert. Generate accurate, exam-standard questions. Respond with valid JSON:
{"questions":[{"id":"1","question":"Question text?","options":["A. Option","B. Option","C. Option","D. Option"],"correctAnswer":0,"explanation":"Why this is correct","topic":"Topic name"}]}
correctAnswer is 0-indexed. Each must have exactly 4 options. Exam-level accuracy required. Pure JSON, no markdown.`,
        systemPromptMode: 'append',
        forceJson: true,
        temperature: 0.4,
        maxTokens: 3000,
      });
      const parsed = extractJSON(res.text);
      if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error('AI returned an invalid response format. Please try again.');
      }
      const qs = parsed.questions.map((q: any) => ({ ...q, id: genId() }));
      setQuestions(qs);

      if (examMode === 'timed') {
        const seconds = qs.length * 60;
        setTimeLeft(seconds);
        setTimerActive(true);
      }
      setStartTime(Date.now());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not generate questions. Try again.');
      setTab('setup');
    } finally {
      setLoading(false);
    }
  }, [subject, topic, examMode, examSystem, difficulty, questionCount]);

  const handleAnswer = (questionId: string, optionIndex: number) => {
    if (submittedQuestions.has(questionId)) return;
    setSelectedAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmitAnswer = (questionId: string) => {
    if (selectedAnswers[questionId] === undefined) return;
    setSubmittedQuestions(prev => new Set(prev).add(questionId));
    setShowExplanation(true);
  };

  const handleSubmitQuiz = () => {
    setTimerActive(false);
    const answers = questions.map(q => ({
      questionId: q.id,
      selected: selectedAnswers[q.id] ?? -1,
      correct: selectedAnswers[q.id] === q.correctAnswer,
    }));
    const correct = answers.filter(a => a.correct).length;
    const incorrect = answers.filter(a => a.selected !== -1 && !a.correct).length;
    const skipped = answers.filter(a => a.selected === -1).length;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    const wrongTopics = questions
      .filter((q, i) => answers[i]?.selected !== q.correctAnswer)
      .map(q => q.topic);
    const weakAreas = [...new Set(wrongTopics)].slice(0, 5);

    setResult({
      total: questions.length,
      correct,
      incorrect,
      skipped,
      score: Math.round((correct / questions.length) * 100),
      answers,
      weakAreas,
      timeSpent,
    });
    setTab('result');
    useGiaStore.getState().addExamResult({
      id: genId(),
      examSystem,
      subject,
      topic,
      score: Math.round((correct / questions.length) * 100),
      correct,
      total: questions.length,
      weakAreas,
      timestamp: Date.now(),
      timeSpent,
    });
    addNotification(`📝 ${examSystem} ${subject} quiz: ${correct}/${questions.length} (${Math.round((correct / questions.length) * 100)}%)`);
  };
  submitQuizRef.current = handleSubmitQuiz;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading && tab === 'setup') {
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
    <div className="flex flex-col h-full" style={{ background: 'var(--gia-bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
        <div className="flex items-center gap-2">
          <GraduationCap size={16} style={{ color: '#f59e0b' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Exam Mode</span>
        </div>
        {tab === 'quiz' && (
          <div className="flex items-center gap-2">
            {examMode === 'timed' && timerActive && (
              <div className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg" style={{
                background: timeLeft < 60 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                color: timeLeft < 60 ? '#f87171' : '#f59e0b',
                border: `1px solid ${timeLeft < 60 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
              }}>
                <Clock size={11} /> {formatTime(timeLeft)}
              </div>
            )}
            <span className="text-xs" style={{ color: 'var(--gia-muted)' }}>
              {currentIndex + 1}/{questions.length}
            </span>
          </div>
        )}
      </div>

      {/* Setup Tab */}
      {tab === 'setup' && (
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

          <button onClick={handleGenerateQuestions} disabled={!subject || loading}
            className="gia-btn w-full" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontWeight: 600 }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
            {loading ? 'Generating...' : `Start ${examMode === 'timed' ? 'Timed Exam' : examMode === 'past' ? 'Past Questions' : examMode === 'quiz' ? 'Quiz' : 'Study Session'}`}
          </button>

          {/* History */}
          <ExamHistory />
        </div>
      )}

      {/* Quiz Tab */}
      {tab === 'quiz' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 shrink-0" style={{ background: 'var(--gia-surface-2)' }}>
            <div className="h-full transition-all duration-300" style={{
              width: `${questions.length ? ((Object.keys(submittedQuestions).length) / questions.length) * 100 : 0}%`,
              background: 'linear-gradient(90deg, #f59e0b, #d97706)',
            }} />
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {questions.length > 0 && (
              <div className="space-y-4">
                <div className="gia-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                      Q{currentIndex + 1}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>{questions[currentIndex].topic}</span>
                  </div>

                  <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--gia-text)' }}>
                    {questions[currentIndex].question}
                  </p>

                  <div className="space-y-2">
                    {questions[currentIndex].options.map((opt, oi) => {
                      const isSelected = selectedAnswers[questions[currentIndex].id] === oi;
                      const isSubmitted = submittedQuestions.has(questions[currentIndex].id);
                      const isCorrect = questions[currentIndex].correctAnswer === oi;
                      let borderColor = 'var(--gia-border)';
                      let bgColor = 'var(--gia-surface-2)';
                      let textColor = 'var(--gia-text)';
                      let prefix = String.fromCharCode(65 + oi);

                      if (isSubmitted) {
                        if (isCorrect) {
                          borderColor = 'rgba(52,211,153,0.5)';
                          bgColor = 'rgba(16,185,129,0.1)';
                          textColor = '#34d399';
                        } else if (isSelected) {
                          borderColor = 'rgba(248,113,113,0.5)';
                          bgColor = 'rgba(239,68,68,0.08)';
                          textColor = '#f87171';
                        }
                      } else if (isSelected) {
                        borderColor = 'rgba(245,158,11,0.6)';
                        bgColor = 'rgba(245,158,11,0.1)';
                        textColor = '#f59e0b';
                      }

                      return (
                        <button key={oi} onClick={() => handleAnswer(questions[currentIndex].id, oi)}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all tap-feedback"
                          style={{ borderColor: borderColor, background: bgColor, color: textColor }}>
                          <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                            style={{
                              background: isSubmitted && isCorrect ? 'rgba(52,211,153,0.2)' : isSubmitted && isSelected ? 'rgba(239,68,68,0.2)' : isSelected ? 'rgba(245,158,11,0.2)' : 'var(--gia-surface-3)',
                              color: isSubmitted && isCorrect ? '#34d399' : isSubmitted && isSelected ? '#f87171' : isSelected ? '#f59e0b' : 'var(--gia-muted)',
                            }}>
                            {prefix}
                          </span>
                          <span className="text-sm flex-1">{opt.replace(/^[A-D]\.\s*/, '')}</span>
                          {isSubmitted && isCorrect && <CheckCircle2 size={14} style={{ color: '#34d399' }} />}
                          {isSubmitted && isSelected && !isCorrect && <XCircle size={14} style={{ color: '#f87171' }} />}
                        </button>
                      );
                    })}
                  </div>

                  {!submittedQuestions.has(questions[currentIndex].id) && selectedAnswers[questions[currentIndex].id] !== undefined && (
                    <button onClick={() => handleSubmitAnswer(questions[currentIndex].id)}
                      className="mt-3 text-xs font-medium px-4 py-2 rounded-xl w-full"
                      style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
                      Submit Answer
                    </button>
                  )}

                  {showExplanation && submittedQuestions.has(questions[currentIndex].id) && (
                    <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#f59e0b' }}>Explanation</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--gia-muted)' }}>{questions[currentIndex].explanation}</p>
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex gap-2">
                  <button onClick={() => { setCurrentIndex(prev => Math.max(0, prev - 1)); setShowExplanation(false); }}
                    disabled={currentIndex === 0}
                    className="flex-1 text-xs py-2.5 rounded-xl border tap-feedback disabled:opacity-30"
                    style={{ borderColor: 'var(--gia-border)', color: 'var(--gia-muted)' }}>
                    ← Previous
                  </button>
                  {currentIndex < questions.length - 1 ? (
                    <button onClick={() => { setCurrentIndex(prev => prev + 1); setShowExplanation(false); }}
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
                  {questions.map((q, qi) => {
                    const isSubmitted = submittedQuestions.has(q.id);
                    const isCurrent = qi === currentIndex;
                    return (
                      <button key={q.id} onClick={() => { setCurrentIndex(qi); setShowExplanation(false); }}
                        className="w-6 h-6 rounded-lg text-[10px] font-mono transition-all tap-feedback"
                        style={{
                          background: isCurrent ? 'rgba(245,158,11,0.2)' : isSubmitted ? 'rgba(52,211,153,0.2)' : 'var(--gia-surface-2)',
                          border: `1px solid ${isCurrent ? 'rgba(245,158,11,0.4)' : isSubmitted ? 'rgba(52,211,153,0.3)' : 'var(--gia-border)'}`,
                          color: isCurrent ? '#f59e0b' : isSubmitted ? '#34d399' : 'var(--gia-muted)',
                        }}>
                        {qi + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result Tab */}
      {tab === 'result' && result && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Score card */}
          <div className="gia-card p-6 text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center" style={{
              background: result.score >= 70 ? 'rgba(52,211,153,0.15)' : result.score >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
              border: `2px solid ${result.score >= 70 ? 'rgba(52,211,153,0.3)' : result.score >= 40 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              {result.score >= 70 ? <Award size={28} style={{ color: '#34d399' }} />
                : result.score >= 40 ? <BarChart3 size={28} style={{ color: '#f59e0b' }} />
                : <AlertTriangle size={28} style={{ color: '#f87171' }} />}
            </div>
            <p className="text-3xl font-bold" style={{ color: result.score >= 70 ? '#34d399' : result.score >= 40 ? '#f59e0b' : '#f87171' }}>
              {result.score}%
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--gia-muted)' }}>
              {result.correct}/{result.total} correct
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Correct', value: result.correct, color: '#34d399', icon: CheckCircle2 },
              { label: 'Incorrect', value: result.incorrect, color: '#f87171', icon: XCircle },
              { label: 'Skipped', value: result.skipped, color: 'var(--gia-muted-2)', icon: AlertTriangle },
            ].map(s => (
              <div key={s.label} className="gia-card p-3 text-center">
                <s.icon size={14} className="mx-auto mb-1" style={{ color: s.color }} />
                <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--gia-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Time */}
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', color: 'var(--gia-muted)' }}>
            <Clock size={12} style={{ color: '#f59e0b' }} />
            Time spent: {Math.floor(result.timeSpent / 60)}m {result.timeSpent % 60}s
          </div>

          {/* Weak areas */}
          {result.weakAreas.length > 0 && (
            <div className="gia-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain size={13} style={{ color: '#f59e0b' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Areas to Improve</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.weakAreas.map(area => (
                  <span key={area} className="text-[10px] px-2.5 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                    {area}
                  </span>
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
                    <div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--gia-text)' }}>{q.question}</p>
                      <p className="text-[10px] mt-1" style={{ color: ans.correct ? '#34d399' : '#f87171' }}>
                        {ans.correct ? `Correct: ${q.options[q.correctAnswer]}` : `Your answer: ${ans.selected >= 0 ? q.options[ans.selected] : 'Skipped'} · Correct: ${q.options[q.correctAnswer]}`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pb-4">
            <button onClick={() => {
              setTab('setup');
              setQuestions([]);
              setResult(null);
              setSelectedAnswers({});
              setSubmittedQuestions(new Set());
            }}
              className="flex-1 text-xs py-3 rounded-xl border tap-feedback"
              style={{ borderColor: 'var(--gia-border)', color: 'var(--gia-muted)' }}>
              <RefreshCw size={12} className="inline mr-1" /> New Quiz
            </button>
            <button onClick={handleGenerateQuestions}
              className="flex-1 text-xs py-3 rounded-xl font-semibold"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white' }}>
              Retry Same Subject
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ExamHistory: React.FC = () => {
  const [show, setShow] = useState(false);
  const history = useGiaStore((s) => s.examHistory);
  const clearExamHistory = useGiaStore((s) => s.clearExamHistory);

  if (history.length === 0) return null;

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button onClick={() => setShow(e => !e)} className="flex items-center justify-between w-full tap-feedback">
        <div className="flex items-center gap-2">
          <BarChart3 size={13} style={{ color: '#f59e0b' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Past Results ({history.length})</span>
        </div>
        <ChevronRight size={13} style={{ color: 'var(--gia-muted)', transform: show ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {show && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {history.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: 'var(--gia-surface-2)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0" style={{
                background: r.score >= 70 ? 'rgba(52,211,153,0.15)' : r.score >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                color: r.score >= 70 ? '#34d399' : r.score >= 40 ? '#f59e0b' : '#f87171',
              }}>
                {r.score}%
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate" style={{ color: 'var(--gia-text)' }}>{r.subject}</p>
                <p className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>
                  {r.examSystem} · {r.correct}/{r.total} · {Math.floor(r.timeSpent / 60)}m
                </p>
              </div>
              <span className="text-[8px]" style={{ color: 'var(--gia-muted-2)' }}>
                {new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}

      {show && history.length > 0 && (
        <button onClick={() => { if (confirm('Clear all exam history?')) clearExamHistory(); }}
          className="text-[10px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
          <Trash2 size={10} /> Clear History
        </button>
      )}
    </div>
  );
};

export default React.memo(ExamModule);
