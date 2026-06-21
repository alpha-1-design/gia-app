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

export interface LearningProfile {
  weakAreas: { subject: string; topic: string; score: number; recommendations: string[] }[];
  strongAreas: { subject: string; topic: string; score: number }[];
  overallScore: number;
  totalAssessments: number;
  lastUpdated: number;
}

const SUBJECTS_STORAGE_KEY = 'gia-exam-subjects';
const ASSESSMENT_FILE_KEY = 'gia-assessment-file';

export { SUBJECTS_STORAGE_KEY, ASSESSMENT_FILE_KEY };

export const DEFAULT_SUBJECTS: Subject[] = [
  { name: 'Mathematics', topics: ['Algebra', 'Geometry', 'Trigonometry', 'Statistics', 'Calculus', 'Probability', 'Number Theory', 'Vectors'] },
  { name: 'English Language', topics: ['Comprehension', 'Grammar', 'Essay Writing', 'Oral English', 'Literature', 'Summary', 'Vocabulary', 'Lexis & Structure'] },
  { name: 'Physics', topics: ['Mechanics', 'Waves & Optics', 'Thermodynamics', 'Electromagnetism', 'Modern Physics', 'Nuclear Physics', 'Measurements', 'Practical'] },
  { name: 'Chemistry', topics: ['Atomic Structure', 'Bonding', 'Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry', 'Electrochemistry', 'Chemical Reactions', 'Practical'] },
  { name: 'Biology', topics: ['Cell Biology', 'Genetics', 'Ecology', 'Human Physiology', 'Plant Biology', 'Evolution', 'Microbiology', 'Reproduction'] },
  { name: 'Social Studies', topics: ['Government', 'History', 'Geography', 'Economics', 'Civics', 'Culture', 'Constitution', 'Human Rights'] },
  { name: 'Economics', topics: ['Microeconomics', 'Macroeconomics', 'Development Economics', 'International Trade', 'Money & Banking', 'Public Finance', 'Economic Systems', 'Labor Markets'] },
  { name: 'Government', topics: ['Political Systems', 'Constitution', 'Executive Branch', 'Legislature', 'Judiciary', 'Political Parties', 'International Relations', 'Public Administration'] },
  { name: 'History', topics: ['West African Kingdoms', 'Colonial Era', 'Independence Movements', 'Post-Independence', 'World Wars', 'African Union', 'Cold War', 'Modern History'] },
  { name: 'Geography', topics: ['Physical Geography', 'Human Geography', 'Map Reading', 'Climate', 'Population', 'Agriculture', 'Urbanization', 'Environmental Issues'] },
  { name: 'Literature in English', topics: ['Prose', 'Poetry', 'Drama', 'African Literature', 'Shakespeare', 'Literary Devices', 'Critical Analysis', 'Oral Literature'] },
  { name: 'Agricultural Science', topics: ['Crop Production', 'Animal Husbandry', 'Soil Science', 'Farm Management', 'Agricultural Economics', 'Fisheries', 'Forestry', 'Agricultural Extension'] },
  { name: 'Further Mathematics', topics: ['Pure Mathematics', 'Mechanics', 'Statistics & Probability', 'Linear Algebra', 'Calculus', 'Coordinate Geometry', 'Complex Numbers', 'Differential Equations'] },
  { name: 'Financial Accounting', topics: ['Bookkeeping', 'Financial Statements', 'Partnership Accounts', 'Company Accounts', 'Cost Accounting', 'Public Sector Accounting', 'Inventory Valuation', 'Interpretation of Accounts'] },
  { name: 'Commerce', topics: ['Trade', 'Marketing', 'Insurance', 'Transportation', 'Business Finance', 'International Trade', 'Advertising', 'E-commerce'] },
  { name: 'Christian Religious Studies', topics: ['Old Testament', 'New Testament', 'Life of Jesus', 'Pauline Epistles', 'Prophets', 'Ethics', 'Biblical Themes', 'Worship'] },
  { name: 'Islamic Religious Studies', topics: ['Quran', 'Hadith', 'Tawheed', 'Fiqh', 'Islamic History', 'Prophet Muhammad', 'Islamic Ethics', 'Prayer & Worship'] },
  { name: 'French', topics: ['Grammar', 'Comprehension', 'Essay Writing', 'Oral French', 'Translation', 'Culture & Civilization', 'Vocabulary', 'Literature'] },
  { name: 'Computer Science', topics: ['Programming', 'Algorithms', 'Data Structures', 'Database', 'Networks', 'Operating Systems', 'Web Development', 'Software Engineering'] },
  { name: 'Home Economics', topics: ['Food & Nutrition', 'Textiles', 'Family Studies', 'Home Management', 'Child Development', 'Consumer Education', 'Meal Planning', 'Fashion Design'] },
];
