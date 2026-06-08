import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GraduationCap, Clock } from 'lucide-react';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore } from '../store/useGiaStore';
import { extractJSON } from '../utils/helpers';
import { genId } from '../utils/id';
import ExamSetup from './exam/ExamSetup';
import ExamQuiz from './exam/ExamQuiz';
import ExamResult from './exam/ExamResult';
import type { ExamSystem, ExamMode, Difficulty, Question, QuizResult, Subject } from './exam/types';
import { logger } from '../utils/logger';

async function generateWithJsonRetry<T>(
  generateFn: () => Promise<{ text: string }>,
  maxRetries = 2
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await generateFn();
      const parsed = extractJSON<T>(res.text);
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(`[ExamModule] JSON parse attempt ${attempt + 1} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('Failed to parse JSON after retries');
}

const TIMER_SECONDS_PER_QUESTION = 60;

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
  const submitQuizRef = useRef<() => void>(() => {});

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const parsed = await generateWithJsonRetry<{ subjects: Subject[] }>(
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
        2
      );
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
      const parsed = await generateWithJsonRetry<{ questions: Question[] }>(
        () => GiaBrain.generate({
          signal: AbortSignal.timeout(30_000),
          prompt: `Generate ${questionCount} ${modeDesc} for ${examSystem} ${subject}${topicContext} at ${difficulty} difficulty.`,
          systemPrompt: `You are a ${examSystem} exam expert. Generate accurate, exam-standard questions. Respond with valid JSON:
{"questions":[{"id":"1","question":"Question text?","options":["A. Option","B. Option","C. Option","D. Option"],"correctAnswer":0,"explanation":"Why this is correct","topic":"Topic name"}]}
correctAnswer is 0-indexed. Each must have exactly 4 options. Exam-level accuracy required. Pure JSON, no markdown.`,
          systemPromptMode: 'append',
          forceJson: true,
          temperature: 0.4,
          maxTokens: 3000,
        }),
        2
      );
      if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error('AI returned an invalid response format. Please try again.');
      }
      const qs = parsed.questions.map((q) => ({ ...q, id: genId() }));
      setQuestions(qs);

      if (examMode === 'timed') {
        setTimeLeft(qs.length * TIMER_SECONDS_PER_QUESTION);
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
  submitQuizRef.current = handleSubmitQuiz;

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
    useGiaStore.getState().addNotification(`📝 ${examSystem} ${subject} quiz: ${correct}/${questions.length} (${Math.round((correct / questions.length) * 100)}%)`);
  };

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
              {currentIndex + 1}/{questions.length}
            </span>
          </div>
        )}
      </div>

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
        />
      )}

      {tab === 'quiz' && (
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

export default React.memo(ExamModule);
