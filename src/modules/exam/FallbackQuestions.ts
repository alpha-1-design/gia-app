import type { Question, Subject } from './types';

export const FALLBACK_SUBJECTS: Subject[] = [
  {
    name: 'Mathematics',
    topics: ['Algebra', 'Geometry', 'Trigonometry', 'Statistics', 'Calculus'],
  },
  {
    name: 'English Language',
    topics: ['Comprehension', 'Grammar', 'Essay Writing', 'Oral English', 'Literature'],
  },
  {
    name: 'Science',
    topics: ['Physics', 'Chemistry', 'Biology', 'Integrated Science', 'Practical'],
  },
  {
    name: 'Social Studies',
    topics: ['Government', 'History', 'Geography', 'Economics', 'Civics'],
  },
];

function fallbackQuestions(subject: string, count: number): Question[] {
  const bank: Record<string, Question[]> = {
    Mathematics: [
      { id: '1', question: 'Solve for x: 2x + 5 = 13', options: ['A. x = 3', 'B. x = 4', 'C. x = 5', 'D. x = 6'], correctAnswer: 1, explanation: '2x + 5 = 13 → 2x = 8 → x = 4', topic: 'Algebra' },
      { id: '2', question: 'What is the area of a triangle with base 6cm and height 4cm?', options: ['A. 10 cm²', 'B. 12 cm²', 'C. 24 cm²', 'D. 48 cm²'], correctAnswer: 1, explanation: 'Area = ½ × base × height = ½ × 6 × 4 = 12 cm²', topic: 'Geometry' },
      { id: '3', question: 'Simplify: 3(x + 2) - 2(x - 1)', options: ['A. x + 4', 'B. x + 8', 'C. 5x + 4', 'D. 5x + 8'], correctAnswer: 1, explanation: '3x + 6 - 2x + 2 = x + 8', topic: 'Algebra' },
      { id: '4', question: 'What is the probability of rolling an even number on a fair six-sided die?', options: ['A. 1/6', 'B. 1/3', 'C. 1/2', 'D. 2/3'], correctAnswer: 2, explanation: 'Even numbers: 2, 4, 6 → 3/6 = 1/2', topic: 'Statistics' },
      { id: '5', question: 'Find the mean of: 4, 8, 12, 16, 20', options: ['A. 10', 'B. 12', 'C. 14', 'D. 16'], correctAnswer: 1, explanation: 'Sum = 60, n = 5, mean = 60/5 = 12', topic: 'Statistics' },
      { id: '6', question: 'If sin θ = 3/5, what is cos θ?', options: ['A. 2/5', 'B. 3/5', 'C. 4/5', 'D. 5/4'], correctAnswer: 2, explanation: 'sin²θ + cos²θ = 1 → cos²θ = 1 - 9/25 = 16/25 → cos θ = 4/5', topic: 'Trigonometry' },
      { id: '7', question: 'What is the derivative of x³?', options: ['A. x²', 'B. 3x²', 'C. 3x', 'D. x⁴/4'], correctAnswer: 1, explanation: 'd/dx(xⁿ) = nxⁿ⁻¹, so d/dx(x³) = 3x²', topic: 'Calculus' },
      { id: '8', question: 'A car travels 240 km in 3 hours. What is its average speed?', options: ['A. 60 km/h', 'B. 80 km/h', 'C. 100 km/h', 'D. 120 km/h'], correctAnswer: 1, explanation: 'Speed = distance/time = 240/3 = 80 km/h', topic: 'Algebra' },
      { id: '9', question: 'What is the value of log₁₀(100)?', options: ['A. 1', 'B. 2', 'C. 10', 'D. 100'], correctAnswer: 1, explanation: 'log₁₀(100) = log₁₀(10²) = 2', topic: 'Algebra' },
      { id: '10', question: 'What is the sum of interior angles of a pentagon?', options: ['A. 360°', 'B. 540°', 'C. 720°', 'D. 900°'], correctAnswer: 1, explanation: 'Sum = (n-2) × 180° = (5-2) × 180° = 540°', topic: 'Geometry' },
    ],
    'English Language': [
      { id: '1', question: 'Choose the correct spelling:', options: ['A. Accommodate', 'B. Acommodate', 'C. Accommodate', 'D. Acomodate'], correctAnswer: 2, explanation: '"Accommodate" has two c\'s and two m\'s', topic: 'Grammar' },
      { id: '2', question: 'Identify the figure of speech: "The world is a stage."', options: ['A. Simile', 'B. Metaphor', 'C. Personification', 'D. Hyperbole'], correctAnswer: 1, explanation: 'A metaphor directly compares two unlike things without using "like" or "as"', topic: 'Literature' },
      { id: '3', question: 'Which sentence is grammatically correct?', options: ['A. He don\'t know the answer', 'B. He doesn\'t know the answer', 'C. He not know the answer', 'D. He no know the answer'], correctAnswer: 1, explanation: '"Doesn\'t" is the correct contraction of "does not" for third-person singular', topic: 'Grammar' },
      { id: '4', question: 'What is the past tense of "go"?', options: ['A. Goed', 'B. Went', 'C. Gone', 'D. Going'], correctAnswer: 1, explanation: '"Go" is an irregular verb; its past tense is "went"', topic: 'Grammar' },
      { id: '5', question: 'The main character in a story is called the:', options: ['A. Antagonist', 'B. Protagonist', 'C. Narrator', 'D. Author'], correctAnswer: 1, explanation: 'The protagonist is the main character around whom the story revolves', topic: 'Literature' },
      { id: '6', question: 'Choose the correct preposition: "She is interested ___ learning French."', options: ['A. in', 'B. on', 'C. at', 'D. for'], correctAnswer: 0, explanation: '"Interested in" is the correct collocation', topic: 'Grammar' },
      { id: '7', question: 'What is the synonym of "benevolent"?', options: ['A. Mean', 'B. Kind', 'C. Angry', 'D. Fearful'], correctAnswer: 1, explanation: '"Benevolent" means well-meaning, kindly', topic: 'Comprehension' },
      { id: '8', question: 'Identify the type of sentence: "Please close the door."', options: ['A. Declarative', 'B. Interrogative', 'C. Imperative', 'D. Exclamatory'], correctAnswer: 2, explanation: 'An imperative sentence gives a command or request', topic: 'Grammar' },
      { id: '9', question: 'What is the plural of "child"?', options: ['A. Childs', 'B. Childes', 'C. Children', 'D. Childrens'], correctAnswer: 2, explanation: '"Children" is the irregular plural of "child"', topic: 'Grammar' },
      { id: '10', question: 'Which literary device repeats initial consonant sounds?', options: ['A. Rhyme', 'B. Alliteration', 'C. Assonance', 'D. Onomatopoeia'], correctAnswer: 1, explanation: 'Alliteration is the repetition of initial consonant sounds in nearby words', topic: 'Literature' },
    ],
    Science: [
      { id: '1', question: 'What is the chemical symbol for water?', options: ['A. H₂O', 'B. CO₂', 'C. NaCl', 'D. O₂'], correctAnswer: 0, explanation: 'Water consists of two hydrogen atoms and one oxygen atom', topic: 'Chemistry' },
      { id: '2', question: 'What force keeps planets in orbit around the sun?', options: ['A. Centrifugal force', 'B. Gravity', 'C. Magnetism', 'D. Friction'], correctAnswer: 1, explanation: 'Gravitational attraction between the sun and planets keeps them in orbit', topic: 'Physics' },
      { id: '3', question: 'What is the powerhouse of the cell?', options: ['A. Nucleus', 'B. Ribosome', 'C. Mitochondria', 'D. Golgi apparatus'], correctAnswer: 2, explanation: 'Mitochondria generate most of the cell\'s ATP through cellular respiration', topic: 'Biology' },
      { id: '4', question: 'What is the speed of light in vacuum?', options: ['A. 3 × 10⁶ m/s', 'B. 3 × 10⁸ m/s', 'C. 3 × 10¹⁰ m/s', 'D. 3 × 10⁴ m/s'], correctAnswer: 1, explanation: 'The speed of light is approximately 3 × 10⁸ meters per second', topic: 'Physics' },
      { id: '5', question: 'What gas do plants absorb from the atmosphere?', options: ['A. Oxygen', 'B. Nitrogen', 'C. Carbon dioxide', 'D. Hydrogen'], correctAnswer: 2, explanation: 'Plants absorb CO₂ during photosynthesis to produce glucose', topic: 'Biology' },
      { id: '6', question: 'What is the pH of pure water?', options: ['A. 0', 'B. 7', 'C. 14', 'D. 1'], correctAnswer: 1, explanation: 'Pure water has a neutral pH of 7', topic: 'Chemistry' },
      { id: '7', question: 'Which planet is known as the Red Planet?', options: ['A. Venus', 'B. Jupiter', 'C. Mars', 'D. Saturn'], correctAnswer: 2, explanation: 'Mars appears reddish due to iron oxide (rust) on its surface', topic: 'Physics' },
      { id: '8', question: 'What is the atomic number of carbon?', options: ['A. 4', 'B. 6', 'C. 8', 'D. 12'], correctAnswer: 1, explanation: 'Carbon has 6 protons, giving it atomic number 6', topic: 'Chemistry' },
      { id: '9', question: 'Which blood cells fight infection?', options: ['A. Red blood cells', 'B. White blood cells', 'C. Platelets', 'D. Plasma'], correctAnswer: 1, explanation: 'White blood cells (leukocytes) are key to the immune system', topic: 'Biology' },
      { id: '10', question: 'What is the SI unit of force?', options: ['A. Joule', 'B. Watt', 'C. Newton', 'D. Pascal'], correctAnswer: 2, explanation: 'The newton (N) is the SI unit of force', topic: 'Physics' },
    ],
  };

  if (bank[subject]) {
    return bank[subject].slice(0, count);
  }
  const generic: Question[] = [];
  for (let i = 0; i < count; i++) {
    generic.push({
      id: String(i + 1),
      question: `Sample question ${i + 1} for ${subject}. Please try again with a working internet connection for better questions.`,
      options: ['A. Option A', 'B. Option B', 'C. Option C', 'D. Option D'],
      correctAnswer: 0,
      explanation: 'This is a placeholder question. Connect to the internet and try again for AI-generated questions.',
      topic: 'General',
    });
  }
  return generic;
}

export function getFallbackQuestions(subject: string, count: number): Question[] {
  return fallbackQuestions(subject, Math.min(count, 10));
}

export function loadCachedQuestions(subject: string): Question[] | null {
  try {
    const raw = localStorage.getItem(`gia-exam-questions-${subject}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

export function saveQuestionsToCache(subject: string, questions: Question[]): void {
  try {
    const existing = JSON.parse(localStorage.getItem('gia-exam-cache-list') || '[]') as string[];
    if (!existing.includes(subject)) {
      existing.push(subject);
      localStorage.setItem('gia-exam-cache-list', JSON.stringify(existing));
    }
    localStorage.setItem(`gia-exam-questions-${subject}`, JSON.stringify(questions));
  } catch {}
}

export function getCachedSubjects(): string[] {
  try {
    return JSON.parse(localStorage.getItem('gia-exam-cache-list') || '[]');
  } catch { return []; }
}

export function clearQuestionCache(): void {
  try {
    const list: string[] = JSON.parse(localStorage.getItem('gia-exam-cache-list') || '[]');
    for (const s of list) {
      localStorage.removeItem(`gia-exam-questions-${s}`);
    }
    localStorage.removeItem('gia-exam-cache-list');
  } catch {}
}
