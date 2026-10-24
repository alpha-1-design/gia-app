import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GraduationCap, Clock, AlertCircle, RefreshCw, ArrowLeft, Settings } from 'lucide-react';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore } from '../store/useGiaStore';
import { genId } from '../utils/id';
import ExamSetup from './exam/ExamSetup';
import ExamQuiz from './exam/ExamQuiz';
import ExamResult from './exam/ExamResult';
import ExamReference from './exam/ExamReference';
import ThinkingDots from '../components/feedback/ThinkingDots';
import type { ExamSystem, ExamMode, Difficulty, Question, QuizResult, Subject, LearningProfile } from './exam/types';
import { SUBJECTS_STORAGE_KEY, DEFAULT_SUBJECTS } from './exam/types';
import { buildRetryPrompt, generateWithRetry } from '../utils/generateWithRetry';
import { normalizeExamQuestions, normalizeExamSubjects } from './exam/normalizeExamOutput';

const TIMER_SECONDS_PER_QUESTION = 60;

function loadCachedSubjects(): Subject[] | null {
  try {
    const raw = localStorage.getItem(SUBJECTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].name && parsed[0].topics) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return null;
}

function saveCachedSubjects(subjects: Subject[]): void {
  try { localStorage.setItem(SUBJECTS_STORAGE_KEY, JSON.stringify(subjects)); } catch { /* ignore */ }
}

function loadAssessmentProfile(): LearningProfile | null {
  try {
    const raw = localStorage.getItem('gia-learning-profile');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.weakAreas) return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

function saveAssessmentProfile(profile: LearningProfile): void {
  try { localStorage.setItem('gia-learning-profile', JSON.stringify(profile)); } catch { /* ignore */ }
}

function describeGenerationError(message: string): { title: string; body: string } {
  const lower = message.toLowerCase();
  if (/no internet|offline|network|failed to fetch|fetch failed/.test(lower)) {
    return {
      title: 'GIA needs a connection',
      body: 'The model could not be reached. Check your network, then let GIA try again.',
    };
  }
  if (/rate limit|limit reached|quota|too many requests|429/.test(lower)) {
    return {
      title: 'GIA is being rate-limited',
      body: 'The provider is asking GIA to slow down. Wait a moment, then try again, or switch provider in Settings.',
    };
  }
  if (/api key|credential|token|authorization|permission|approval|sign in|provider/.test(lower)) {
    return {
      title: 'GIA needs a working provider',
      body: 'The model is not ready to answer. Check the active provider and its key in Settings, then try again.',
    };
  }
  if (/no valid json|json|format|empty response|invalid response|parse/.test(lower)) {
    return {
      title: 'GIA could not read the reply',
      body: 'The model answered, but not in the format a quiz needs. GIA can ask it to correct the response.',
    };
  }
  if (/only \d+ of \d+|fewer|incomplete|question/.test(lower)) {
    return {
      title: 'GIA stopped short',
      body: 'The model returned an incomplete question set. Try again, or ask for fewer questions.',
    };
  }
  return {
    title: 'GIA could not build this quiz',
    body: 'The model did not return a usable set of questions. Nothing has been substituted.',
  };
}

const ExamModule: React.FC = () => {
  const [examSystem, setExamSystem] = useState<ExamSystem>('WASSCE');
  const [examMode, setExamMode] = useState<ExamMode>('study');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [questionCount, setQuestionCount] = useState(10);
  const [subjects, setSubjects] = useState<Subject[]>(() => loadCachedSubjects() ?? DEFAULT_SUBJECTS);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<QuizResult | null>(null);
  const [tab, setTab] = useState<'setup' | 'quiz' | 'result' | 'ref'>('setup');
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [retryStatus, setRetryStatus] = useState('');
  const [profile, setProfile] = useState<LearningProfile | null>(() => loadAssessmentProfile());
  const setModule = useGiaStore(s => s.setModule);
  const submitQuizRef = useRef<() => void>(() => {});

  // Warn before leaving during a quiz
  useEffect(() => {
    if (tab !== 'quiz' || questions.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [tab, questions.length]);

  const fetchSubjects = useCallback(async () => {
    try {
      const { data: parsed } = await generateWithRetry<{ subjects: Subject[] }>(
        retry => GiaBrain.generate({
          prompt: buildRetryPrompt(`List the main subjects for ${examSystem} exams in West Africa.`, retry),
          systemPrompt: `You are an expert in West African education. Respond with valid JSON only:
{"subjects":[{"name":"Subject Name","topics":["Topic 1","Topic 2","Topic 3","Topic 4","Topic 5"]}]}
Include 6-10 subjects with 4-6 topics each. Pure JSON, no markdown.`,
          systemPromptMode: 'append',
          forceJson: true,
          temperature: 0.3,
          maxTokens: 2000,
        }),
        { moduleName: 'ExamModule', maxRetries: 2, transform: normalizeExamSubjects }
      );
      if (parsed.subjects && parsed.subjects.length > 0) {
        setSubjects(parsed.subjects);
        saveCachedSubjects(parsed.subjects);
      }
    } catch {
      // Subjects already set from cache/default — no visible error needed
    }
  }, [examSystem]);

  // Background refresh: always show subjects immediately (cache/default),
  // then quietly try to get better ones from AI
  useEffect(() => {
    if (tab === 'setup') fetchSubjects();
  }, [examSystem, tab, fetchSubjects]);

  const handleGenerateQuestions = useCallback(async (overrides: {
    subject?: string;
    topic?: string;
    examMode?: ExamMode;
    examSystem?: ExamSystem;
    difficulty?: Difficulty;
    questionCount?: number;
  } = {}) => {
    const activeSubject = overrides.subject ?? subject;
    const activeTopic = overrides.topic ?? topic;
    const activeExamMode = overrides.examMode ?? examMode;
    const activeExamSystem = overrides.examSystem ?? examSystem;
    const activeDifficulty = overrides.difficulty ?? difficulty;
    const activeQuestionCount = overrides.questionCount ?? questionCount;

    if (!activeSubject) {
      setError('Select a subject first');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setQuestions([]);
    setTimerActive(false);
    setTimeLeft(0);
    setTab('quiz');
    setCurrentIndex(0);
    setSelectedAnswers({});
    setSubmittedQuestions(new Set());

    const modeDesc = activeExamMode === 'quiz' ? 'multiple choice quiz questions'
      : activeExamMode === 'timed' ? 'timed multiple choice exam questions'
      : activeExamMode === 'study' ? 'study questions with detailed explanations'
      : 'WAEC/NECO past question style';

    try {
      const topicContext = activeTopic ? ` focusing on ${activeTopic}` : '';
      const currentProfile = loadAssessmentProfile();
      const weakContext = currentProfile?.weakAreas && currentProfile.weakAreas.length > 0
        ? `\nThe student needs practice on: ${currentProfile.weakAreas.map(w => `${w.topic} (${w.subject})`).join(', ')}. Generate questions targeting these weak areas first.`
        : '';
      const { data: parsed } = await generateWithRetry<{ questions: Question[] }>(
        retry => GiaBrain.generate({
          prompt: buildRetryPrompt(`Generate ${activeQuestionCount} ${modeDesc} for ${activeExamSystem} ${activeSubject}${topicContext} at ${activeDifficulty} difficulty.${weakContext}`, retry),
          systemPrompt: `You are a ${activeExamSystem} exam expert. Generate accurate, exam-standard questions. Respond with valid JSON:
{"questions":[{"id":"1","question":"Question text?","options":["A. Option","B. Option","C. Option","D. Option"],"correctAnswer":0,"explanation":"Why this is correct","topic":"Topic name"}]}
correctAnswer is 0-indexed. Each must have exactly 4 options. Exam-level accuracy required. Pure JSON, no markdown.`,
          systemPromptMode: 'append',
          forceJson: true,
          temperature: 0.4,
          maxTokens: Math.min(6000, 1500 + activeQuestionCount * 300),
        }),
        {
          moduleName: 'ExamModule',
          maxRetries: 2,
          transform: value => normalizeExamQuestions(value, activeQuestionCount, activeTopic || activeSubject),
          onRetry: () => setRetryStatus('GIA is reworking the response format...'),
        }
      );
      const qs = parsed.questions.map((q) => ({ ...q, id: genId() }));
      setQuestions(qs);

      if (activeExamMode === 'timed') {
        setTimeLeft(qs.length * TIMER_SECONDS_PER_QUESTION);
        setTimerActive(true);
      }
      setStartTime(Date.now());
    } catch (err: unknown) {
      setQuestions([]);
      setTimerActive(false);
      setTimeLeft(0);
      setError(err instanceof Error ? err.message : 'The model did not return a usable set of questions.');
    } finally {
      setLoading(false);
      setRetryStatus('');
    }
  }, [subject, topic, examMode, examSystem, difficulty, questionCount]);

  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  useEffect(() => {
    if (timerActive && timeLeft <= 0 && startTime > 0) {
      setTimerActive(false);
      submitQuizRef.current?.();
    }
  }, [timerActive, timeLeft, startTime]);

  const handleAnswer = (questionId: string, optionIndex: number) => {
    if (submittedQuestions.has(questionId)) return;
    setSelectedAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmitAnswer = (questionId: string) => {
    if (selectedAnswers[questionId] === undefined) return;
    setSubmittedQuestions(prev => new Set(prev).add(questionId));
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
    const score = Math.round((correct / questions.length) * 100);

    setResult({
      total: questions.length, correct, incorrect, skipped,
      score, answers, weakAreas, timeSpent,
    });
    setTab('result');
    useGiaStore.getState().addExamResult({
      id: genId(), examSystem, subject, topic,
      score, correct, total: questions.length,
      weakAreas, timestamp: Date.now(), timeSpent,
    });
    useGiaStore.getState().addNotification(`${examSystem} ${subject} quiz: ${correct}/${questions.length} (${score}%)`);

    // Update learning profile with weak areas from this quiz
    setProfile(prev => {
      const existing = prev || { weakAreas: [], strongAreas: [], overallScore: 0, totalAssessments: 0, lastUpdated: 0 };
      const newWeakAreas = weakAreas.map(area => {
        const existingArea = existing.weakAreas.find(w => w.topic === area);
        if (existingArea) {
          return { ...existingArea, score: Math.round((existingArea.score + (100 - score)) / 2), recommendations: existingArea.recommendations };
        }
        return { subject, topic: area, score: 100 - score, recommendations: [`Review ${area} in ${subject} — this needs practice`] };
      });
      const updatedWeak = [...newWeakAreas, ...existing.weakAreas.filter(w => !weakAreas.includes(w.topic))].slice(0, 15);
      const strongAreas = score >= 70
        ? [...existing.strongAreas.filter(s => s.topic !== (topic || subject)), { subject, topic: topic || subject, score }].slice(0, 15)
        : existing.strongAreas;
      const avgScore = Math.round((existing.overallScore * existing.totalAssessments + score) / (existing.totalAssessments + 1));
      const updated: LearningProfile = {
        weakAreas: updatedWeak, strongAreas, overallScore: avgScore,
        totalAssessments: existing.totalAssessments + 1, lastUpdated: Date.now(),
      };
      saveAssessmentProfile(updated);
      return updated;
    });
  };
  submitQuizRef.current = handleSubmitQuiz;

  const handleNewQuiz = () => {
    setTab('setup');
    setQuestions([]);
    setResult(null);
    setError('');
    setRetryStatus('');
    setTimerActive(false);
    setTimeLeft(0);
    setSelectedAnswers({});
    setSubmittedQuestions(new Set());
  };

  const handlePracticeTopic = (area: string) => {
    setTopic(area);
    void handleGenerateQuestions({ topic: area });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--gia-bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
        <div className="flex items-center gap-2">
          <GraduationCap size={16} style={{ color: 'var(--gia-muted)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Exam Mode</span>
        </div>
        {tab === 'quiz' && (
          <div className="flex items-center gap-2">
            {examMode === 'timed' && timerActive && (
              <div className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg" style={{
                background: timeLeft < 60 ? 'rgba(239,68,68,0.12)' : 'var(--gia-surface-2)',
                color: timeLeft < 60 ? '#f87171' : 'var(--gia-text)',
                border: `1px solid ${timeLeft < 60 ? 'rgba(239,68,68,0.3)' : 'var(--gia-border)'}`,
              }}>
                <Clock size={11} /> {formatTime(timeLeft)}
              </div>
            )}
            <span className="text-xs" style={{ color: 'var(--gia-muted)' }}>
              {questions.length > 0 ? `${currentIndex + 1}/${questions.length}` : '...'}
            </span>
          </div>
        )}
      </div>

      {/* Tab bar */}
      {tab !== 'quiz' && tab !== 'result' && (
        <div className="flex gap-1 px-4 pt-3 pb-0 shrink-0">
          {([
            { id: 'setup' as const, label: 'Setup' },
            { id: 'ref' as const, label: 'Reference' },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all tap-feedback"
              style={{
                background: tab === t.id ? 'var(--gia-surface-2)' : 'transparent',
                color: tab === t.id ? 'var(--gia-text)' : 'var(--gia-muted)',
                fontWeight: tab === t.id ? 600 : 400,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'setup' && (
        <ExamSetup
          examSystem={examSystem} setExamSystem={setExamSystem}
          examMode={examMode} setExamMode={setExamMode}
          subject={subject} setSubject={setSubject}
          topic={topic} setTopic={setTopic}
          difficulty={difficulty} setDifficulty={setDifficulty}
          questionCount={questionCount} setQuestionCount={setQuestionCount}
          subjects={subjects} loading={loading} error={error}
          onStart={() => { void handleGenerateQuestions(); }}
          profile={profile}
          onProfileUpdate={setProfile}
        />
      )}

      {tab === 'ref' && (
        <ExamReference
          profile={profile}
          onProfileUpdate={setProfile}
          onStartQuiz={(subj, top) => {
            setSubject(subj);
            setTopic(top || '');
            void handleGenerateQuestions({ subject: subj, topic: top || '' });
          }}
        />
      )}

      {tab === 'quiz' && (
        <>
          {loading && questions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
              <ThinkingDots visible color="bg-[var(--gia-text)]" size={7} />
              <div className="space-y-2">
                <p className="text-sm font-medium" style={{ color: 'var(--gia-text)' }}>GIA is writing your questions</p>
                <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>
                  {retryStatus || `Building ${questionCount} questions for ${subject}${topic ? ` · ${topic}` : ''}.`}
                </p>
              </div>
            </div>
          ) : questions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6 text-center">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>
                <AlertCircle size={20} style={{ color: 'var(--gia-muted)' }} />
              </div>
              <div className="space-y-2 max-w-sm">
                <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>{describeGenerationError(error).title}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--gia-muted)' }}>{describeGenerationError(error).body}</p>
              </div>
              {error && (
                <div className="w-full max-w-sm text-left px-3 py-2.5 rounded-xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--gia-muted-2)' }}>GIA said</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--gia-muted)' }}>{error}</p>
                </div>
              )}
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <button onClick={() => { void handleGenerateQuestions(); }}
                  className="gia-btn w-full flex items-center justify-center gap-2"
                  style={{ background: 'var(--gia-text)', color: 'var(--gia-bg)', fontWeight: 600 }}>
                  <RefreshCw size={14} /> Try again
                </button>
                <button onClick={() => { setTab('setup'); setError(''); }}
                  className="w-full flex items-center justify-center gap-2 text-xs py-2.5 rounded-xl transition-colors"
                  style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}>
                  <ArrowLeft size={14} /> Change setup
                </button>
                <button onClick={() => setModule('settings')}
                  className="w-full flex items-center justify-center gap-2 text-xs py-2.5 rounded-xl transition-colors"
                  style={{ background: 'transparent', border: '1px solid var(--gia-border)', color: 'var(--gia-muted)' }}>
                  <Settings size={14} /> Open settings
                </button>
              </div>
            </div>
          ) : (
            <ExamQuiz
              questions={questions}
              currentIndex={currentIndex}
              onNavigateTo={(idx) => { setCurrentIndex(idx); }}
              selectedAnswers={selectedAnswers}
              handleAnswer={handleAnswer}
              submittedQuestions={submittedQuestions}
              handleSubmitAnswer={handleSubmitAnswer}
              handleSubmitQuiz={handleSubmitQuiz}
            />
          )}
        </>
      )}

      {tab === 'result' && result && (
        <ExamResult
          result={result}
          questions={questions}
          onNewQuiz={handleNewQuiz}
          onRetry={() => { void handleGenerateQuestions(); }}
          onPracticeTopic={handlePracticeTopic}
        />
      )}
    </div>
  );
};

export default ExamModule;
