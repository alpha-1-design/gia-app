import { describe, expect, it } from 'vitest';
import { normalizeExamQuestions, normalizeExamSubjects, normalizeLearningAssessment } from './normalizeExamOutput';

describe('normalizeExamQuestions', () => {
  it('normalizes a root object containing a nested questions array', () => {
    expect(normalizeExamQuestions({
      questions: [{
        prompt: 'What is 2 + 2?',
        choices: { A: '3', B: '4', C: '5', D: '6' },
        correctAnswer: 'B',
        reason: 'Adding two and two gives four.',
      }],
    }, 1, 'Arithmetic').questions[0]).toMatchObject({
      question: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      correctAnswer: 1,
      explanation: 'Adding two and two gives four.',
      topic: 'Arithmetic',
    });
  });

  it('rejects missing options and insufficient requested questions', () => {
    expect(() => normalizeExamQuestions({ questions: [{
      question: 'Question?',
      options: ['A', 'B', 'C'],
      correctAnswer: 0,
    }] }, 1, 'Topic')).toThrow('exactly four');
    expect(() => normalizeExamQuestions({ questions: [{
      question: 'Question?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 0,
    }] }, 2, 'Topic')).toThrow('1 of 2');
  });
});

describe('normalizeExamSubjects', () => {
  it('accepts topic objects and returns validated subject entries', () => {
    expect(normalizeExamSubjects({ subjects: [{ title: 'Science', topics: [{ name: 'Energy' }] }] }))
      .toEqual({ subjects: [{ name: 'Science', topics: ['Energy'] }] });
  });
});

describe('normalizeLearningAssessment', () => {
  it('normalizes aliases and clamps an out-of-range score', () => {
    expect(normalizeLearningAssessment({
      weak_areas: ['Fractions'],
      strengths: [{ name: 'Geometry', subject: 'Math' }],
      score: 120,
    })).toEqual({
      weakAreas: [{ subject: 'General', topic: 'Fractions', recommendations: [] }],
      strongAreas: [{ subject: 'Math', topic: 'Geometry' }],
      overallScore: 100,
    });
  });
});
