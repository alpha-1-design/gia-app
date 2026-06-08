export type ExamSystem = 'WASSCE' | 'BECE' | 'JAMB' | 'CUSTOM';
export type ExamMode = 'quiz' | 'timed' | 'study' | 'past';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  topic: string;
}

export interface QuizResult {
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score: number;
  answers: { questionId: string; selected: number; correct: boolean }[];
  weakAreas: string[];
  timeSpent: number;
}

export interface Subject {
  name: string;
  topics: string[];
}
