import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GraduationCap, Clock, WifiOff, Loader2 } from 'lucide-react';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore } from '../store/useGiaStore';
import { genId } from '../utils/id';
import ExamSetup from './exam/ExamSetup';
import ExamQuiz from './exam/ExamQuiz';
import ExamResult from './exam/ExamResult';
import ExamReference from './exam/ExamReference';
import type { ExamSystem, ExamMode, Difficulty, Question, QuizResult, Subject, LearningProfile } from './exam/types';
import { SUBJECTS_STORAGE_KEY, DEFAULT_SUBJECTS } from './exam/types';
import { generateWithRetry } from '../utils/generateWithRetry';
import { getFallbackQuestions, loadCachedQuestions, saveQuestionsToCache } from './exam/FallbackQuestions';

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
  const [showExplanation, setShowExplanation] = useState(false);
  const [tab, setTab] = useState<'setup' | 'quiz' | 'result' | 'ref'>('setup');
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [usedFallback, setUsedFallback] = useState(false);
  const [retryStatus, setRetryStatus] = useState('');
  const [profile, setProfile] = useState<LearningProfile | null>(() => loadAssessmentProfile());
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
        () => GiaBrain.generate({
          prompt: `List the main subjects for ${examSystem} exams in West Africa.`,
          systemPrompt: `You are an expert in West African education. Respond with valid JSON only:
{"subjects":[{"name":"Subject Name","topics":["Topic 1","Topic 2","Topic 3","Topic 4","Topic 5"]}]}
Include 6-10 subjects with 4-6 topics each. Pure JSON, no markdown.`,
          systemPromptMode: 'append',
          forceJson: true,
          temperature: 0.3,
          maxTokens: 2000,
        }),
        { moduleName: 'ExamModule', maxRetries: 2 }
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
      const currentProfile = loadAssessmentProfile();
      const weakContext = currentProfile?.weakAreas && currentProfile.weakAreas.length > 0
        ? `\nThe student needs practice on: ${currentProfile.weakAreas.map(w => `${w.topic} (${w.subject})`).join(', ')}. Generate questions targeting these weak areas first.`
        : '';
      const { data: parsed } = await generateWithRetry<{ questions: Question[] }>(
        () => GiaBrain.generate({
          prompt: `Generate ${questionCount} ${modeDesc} for ${examSystem} ${subject}${topicContext} at ${difficulty} difficulty.${weakContext}`,
          systemPrompt: `You are a ${examSystem} exam expert. Generate accurate, exam-standard questions. Respond with valid JSON:
{"questions":[{"id":"1","question":"Question text?","options":["A. Option","B. Option","C. Option","D. Option"],"correctAnswer":0,"explanation":"Why this is correct","topic":"Topic name"}]}
correctAnswer is 0-indexed. Each must have exactly 4 options. Exam-level accuracy required. Pure JSON, no markdown.`,
          systemPromptMode: 'append',
          forceJson: true,
          temperature: 0.4,
          maxTokens: 3000,
        }),
        { moduleName: 'ExamModule', onRetry: (attempt, err) => setRetryStatus(`Retry ${attempt + 1}/4: ${err}`) }
      );
      if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error('AI returned an invalid response format. Please try again.');
      }
      const qs = parsed.questions.map((q) => ({ ...q, id: genId() }));
      setQuestions(qs);
      saveQuestionsToCache(subject, qs);
      setUsedFallback(false);

      if (examMode === 'timed') {
        setTimeLeft(qs.length * TIMER_SECONDS_PER_QUESTION);
        setTimerActive(true);
      }
      setStartTime(Date.now());
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '';
      const shouldFallback = errMsg.includes('No internet') || errMsg.includes('offline') || errMsg.includes('network');

      if (!shouldFallback) {
        const cached = loadCachedQuestions(subject);
        if (cached && cached.length > 0) {
          setQuestions(cached);
          setUsedFallback(true);
          setError('');
          if (examMode === 'timed') {
            setTimeLeft(cached.length * TIMER_SECONDS_PER_QUESTION);
            setTimerActive(true);
          }
          setStartTime(Date.now());
          return;
        }
      }

      const fallback = getFallbackQuestions(subject, questionCount);
      setQuestions(fallback);
      setUsedFallback(true);
      setError('');

      if (examMode === 'timed') {
        setTimeLeft(fallback.length * TIMER_SECONDS_PER_QUESTION);
        setTimerActive(true);
      }
      setStartTime(Date.now());
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
    useGiaStore.getState().addNotification(`📝 ${examSystem} ${subject} quiz: ${correct}/${questions.length} (${score}%)`);

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
    setSelectedAnswers({});
    setSubmittedQuestions(new Set());
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
                background: tab === t.id ? 'rgba(245,158,11,0.15)' : 'transparent',
                color: tab === t.id ? '#f59e0b' : 'var(--gia-muted)',
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
          onStart={handleGenerateQuestions}
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
            setTab('setup');
          }}
        />
      )}

      {tab === 'quiz' && (
        <>
          {loading && questions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <Loader2 size={32} className="animate-spin" style={{ color: '#f59e0b' }} />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium" style={{ color: 'var(--gia-text)' }}>Generating questions...</p>
                {retryStatus ? (
                  <p className="text-xs" style={{ color: '#f59e0b' }}>{retryStatus}</p>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>This may take a few seconds</p>
                )}
              </div>
            </div>
          ) : (
            <>
              {usedFallback && (
                <div className="flex items-center gap-2 px-4 py-2 text-xs" style={{
                  background: 'rgba(234,179,8,0.1)',
                  color: '#eab308',
                  borderBottom: '1px solid rgba(234,179,8,0.2)',
                }}>
                  <WifiOff size={12} />
                  Using cached or sample questions. AI-generated questions may not be available — check your internet connection or AI provider settings.
                </div>
              )}
              <ExamQuiz
                questions={questions}
                currentIndex={currentIndex}
                onNavigateTo={(idx) => { setCurrentIndex(idx); setShowExplanation(false); }}
                selectedAnswers={selectedAnswers}
                handleAnswer={handleAnswer}
                submittedQuestions={submittedQuestions}
                handleSubmitAnswer={handleSubmitAnswer}
                showExplanation={showExplanation}
                handleSubmitQuiz={handleSubmitQuiz}
              />
            </>
          )}
        </>
      )}

      {tab === 'result' && result && (
        <ExamResult
          result={result}
          questions={questions}
          onNewQuiz={handleNewQuiz}
          onRetry={handleGenerateQuestions}
        />
      )}
    </div>
  );
};

export default ExamModule;
