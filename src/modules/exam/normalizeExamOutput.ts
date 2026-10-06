import type { Question, Subject } from './types';

type JsonObject = Record<string, unknown>;

export interface NormalizedLearningAssessment {
  weakAreas: { subject: string; topic: string; recommendations: string[] }[];
  strongAreas: { subject: string; topic: string }[];
  overallScore: number;
}

interface AssessmentArea {
  subject: string;
  topic: string;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function firstValue(object: JsonObject, keys: string[]): unknown {
  return keys.map(key => object[key]).find(value => value !== undefined && value !== null);
}

function findArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return [];
  for (const key of keys) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate;
    if (isObject(candidate)) {
      const nested = findArray(candidate, keys);
      if (nested.length) return nested;
    }
  }
  return [];
}

export function normalizeExamQuestions(value: unknown, requestedCount: number, defaultTopic: string): { questions: Question[] } {
  const rawQuestions = findArray(value, ['questions', 'items', 'data', 'results', 'output']);
  if (!rawQuestions.length) throw new Error('No question list was found in the AI response.');

  const normalized = rawQuestions.map((raw, index): Question => {
    if (!isObject(raw)) throw new Error(`Question ${index + 1} is not an object.`);
    const question = textValue(firstValue(raw, ['question', 'prompt', 'text', 'stem']));
    const rawOptions = firstValue(raw, ['options', 'choices', 'answers']);
    const options = Array.isArray(rawOptions)
      ? rawOptions.map(option => isObject(option) ? textValue(firstValue(option, ['text', 'label', 'value'])) : textValue(option))
      : isObject(rawOptions)
        ? ['A', 'B', 'C', 'D'].map(letter => textValue(rawOptions[letter]))
        : [];
    if (!question || options.length !== 4 || options.some(option => !option)) {
      throw new Error(`Question ${index + 1} must include question text and exactly four non-empty options.`);
    }

    const rawAnswer = firstValue(raw, ['correctAnswer', 'correct_answer', 'answerIndex', 'answer_index', 'correctOption', 'answer', 'correct']);
    let correctAnswer: number | undefined;
    if (typeof rawAnswer === 'number' && Number.isInteger(rawAnswer)) {
      correctAnswer = rawAnswer;
    } else if (typeof rawAnswer === 'string') {
      const answer = rawAnswer.trim();
      const letterMatch = answer.match(/^(?:option\s*)?([a-d])(?:[\s).:-]|$)/i);
      if (letterMatch) {
        correctAnswer = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
      } else {
        const matchingOption = options.findIndex(option => option.toLowerCase() === answer.toLowerCase());
        if (matchingOption >= 0) correctAnswer = matchingOption;
        else if (/^\d+$/.test(answer)) correctAnswer = Number(answer);
      }
    }
    if (correctAnswer === undefined || correctAnswer < 0 || correctAnswer > 3) {
      throw new Error(`Question ${index + 1} has no valid zero-based correct answer (0–3 or A–D).`);
    }

    return {
      id: textValue(firstValue(raw, ['id', 'questionId', 'question_id'])) || `question-${index + 1}`,
      question,
      options,
      correctAnswer,
      explanation: textValue(firstValue(raw, ['explanation', 'reason', 'rationale', 'solution'])) || 'Review the question and the correct option.',
      topic: textValue(firstValue(raw, ['topic', 'category', 'subject'])) || defaultTopic,
    };
  });

  if (normalized.length < requestedCount) {
    throw new Error(`Only ${normalized.length} of ${requestedCount} requested questions were returned.`);
  }
  return { questions: normalized.slice(0, requestedCount) };
}

export function normalizeExamSubjects(value: unknown): { subjects: Subject[] } {
  const rawSubjects = findArray(value, ['subjects', 'items', 'data', 'results', 'output']);
  const subjects = rawSubjects.flatMap((raw): Subject[] => {
    if (!isObject(raw)) return [];
    const name = textValue(firstValue(raw, ['name', 'subject', 'title']));
    const rawTopics = firstValue(raw, ['topics', 'areas', 'units']);
    const topics = Array.isArray(rawTopics)
      ? rawTopics.map(topic => isObject(topic) ? textValue(firstValue(topic, ['name', 'title', 'topic'])) : textValue(topic)).filter(Boolean)
      : [];
    return name && topics.length ? [{ name, topics }] : [];
  });
  if (!subjects.length) throw new Error('No valid subjects with topic lists were found in the AI response.');
  return { subjects };
}

export function normalizeLearningAssessment(value: unknown): NormalizedLearningAssessment {
  if (!isObject(value)) throw new Error('The assessment response must be a JSON object.');
  const normalizeAreas = (raw: unknown, weak: boolean): Array<AssessmentArea & { recommendations?: string[] }> => {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((area): Array<AssessmentArea & { recommendations?: string[] }> => {
      if (typeof area === 'string') {
        const topic = area.trim();
        return topic ? [{ subject: 'General', topic, ...(weak ? { recommendations: [] } : {}) }] : [];
      }
      if (!isObject(area)) return [];
      const subject = textValue(firstValue(area, ['subject', 'course'])) || 'General';
      const topic = textValue(firstValue(area, ['topic', 'name', 'area']));
      if (!topic) return [];
      if (!weak) return [{ subject, topic }];
      const rawRecommendations = firstValue(area, ['recommendations', 'tips', 'actions']);
      const recommendations = Array.isArray(rawRecommendations)
        ? rawRecommendations.map(textValue).filter(Boolean)
        : textValue(rawRecommendations) ? [textValue(rawRecommendations)] : [];
      return [{ subject, topic, recommendations }];
    });
  };
  const weakAreas = normalizeAreas(firstValue(value, ['weakAreas', 'weak_areas', 'areasToImprove', 'gaps']), true)
    .map(area => ({ subject: area.subject, topic: area.topic, recommendations: area.recommendations ?? [] }));
  const strongAreas: AssessmentArea[] = normalizeAreas(firstValue(value, ['strongAreas', 'strong_areas', 'strengths']), false)
    .map(({ subject, topic }) => ({ subject, topic }));
  if (!weakAreas.length && !strongAreas.length) throw new Error('The assessment contained no valid strengths or areas to improve.');

  const overallScore = numericScore(firstValue(value, ['overallScore', 'overall_score', 'score']));
  if (overallScore === undefined) throw new Error('The assessment did not include a numeric overall score.');
  return { weakAreas, strongAreas, overallScore };
}

function numericScore(value: unknown): number | undefined {
  const score = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : undefined;
}
