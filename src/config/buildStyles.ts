export interface BuildStyle {
  id: string;
  label: string;
  tagline: string;
  /** "r, g, b" accent used for the card border and glow. */
  rgb: string;
  /** Design direction handed to GIA, written the way you would brief a designer. */
  directive: string;
}

export const BUILD_STYLES: BuildStyle[] = [
  { id: 'neon-glass', label: 'Neon Glass', tagline: 'True black, cyan glow', rgb: '34, 211, 238',
    directive: 'True black (#000) background, frosted-glass cards with 1px translucent borders, cyan (#22d3ee) accent glow, soft blur, rounded-2xl corners, subtle motion that respects prefers-reduced-motion.' },
  { id: 'aurora', label: 'Aurora', tagline: 'Teal, violet, pink drift', rgb: '139, 92, 246',
    directive: 'Dark canvas with an animated teal-to-violet-to-pink gradient mesh used sparingly for hero areas and primary buttons; clean sans-serif; generous spacing.' },
  { id: 'terminal', label: 'Terminal', tagline: 'Monospace hacker green', rgb: '74, 222, 128',
    directive: 'Monospace type, green-on-black palette, command-prompt styling, blinking caret accents, dense information layout, no rounded corners.' },
  { id: 'brutalist', label: 'Brutalist', tagline: 'Loud, flat, thick borders', rgb: '250, 204, 21',
    directive: 'Neo-brutalist: thick black borders, hard offset shadows, flat saturated colours (yellow, pink, blue) on off-white, oversized bold type, zero gradients.' },
  { id: 'editorial', label: 'Editorial', tagline: 'Serif, calm, magazine', rgb: '244, 244, 245',
    directive: 'Magazine layout: large serif headlines, comfortable reading measure, muted neutral palette, thin rules, restrained accent colour, lots of whitespace.' },
  { id: 'soft-pastel', label: 'Soft Pastel', tagline: 'Friendly and rounded', rgb: '249, 168, 212',
    directive: 'Light, friendly UI: pastel pink/mint/lavender accents, very rounded shapes, soft shadows, playful but readable type, large touch targets.' },
  { id: 'synthwave', label: 'Synthwave', tagline: 'Retro sunset grid', rgb: '232, 121, 249',
    directive: '80s synthwave: deep purple-to-black gradient, magenta and cyan neon lines, perspective grid accents, chrome-style headings, glowing buttons.' },
  { id: 'minimal-mono', label: 'Minimal Mono', tagline: 'Black, white, nothing extra', rgb: '212, 212, 216',
    directive: 'Strict monochrome: black, white and one grey. No shadows or gradients, hairline dividers, small caps labels, content first.' },
  { id: 'earth', label: 'Earth & Gold', tagline: 'Warm, West African inspired', rgb: '245, 158, 11',
    directive: 'Warm palette of deep brown, terracotta, gold and cream with subtle kente-inspired geometric borders used as dividers only; high contrast; friendly and proud.' },
  { id: 'corporate', label: 'Clean Corporate', tagline: 'Trustworthy dashboard', rgb: '96, 165, 250',
    directive: 'Professional dashboard look: white and slate surfaces, one blue accent, clear hierarchy, tidy tables and cards, data-dense but calm, excellent contrast.' },
];

export interface BuildStarter {
  id: string;
  label: string;
  summary: string;
  prompt: string;
  tags: string[];
}

export const BUILD_STARTERS: BuildStarter[] = [
  { id: 'weather', label: 'Weather dashboard', summary: 'Search a city, see conditions and a 5-day forecast', tags: ['api', 'cards'],
    prompt: 'Build a weather dashboard: search any city, show current conditions, feels-like, humidity, wind, air quality and a 5-day forecast. Use the free Open-Meteo API (no key). Remember the last city.' },
  { id: 'flashcards', label: 'Exam flashcards', summary: 'Spaced repetition for WASSCE or BECE', tags: ['study', 'offline'],
    prompt: 'Build an offline flashcard app for exam revision: create decks, add cards, study with spaced repetition (Leitner boxes), track streaks and per-deck progress. Save everything locally and allow JSON export and import.' },
  { id: 'habits', label: 'Habit tracker', summary: 'Daily check-ins, streaks, weekly chart', tags: ['productivity'],
    prompt: 'Build a habit tracker: add habits, check them off each day, show current and best streaks and a weekly completion chart. Works offline and keeps data in the browser.' },
  { id: 'expenses', label: 'Expense tracker', summary: 'Log spending, categories, monthly totals', tags: ['finance'],
    prompt: 'Build an expense tracker for mobile money users: log income and spending with categories, show monthly totals, a category breakdown chart, and a budget bar per category. Local-only storage and CSV export.' },
  { id: 'kanban', label: 'Kanban board', summary: 'Drag cards between columns', tags: ['productivity', 'interactive'],
    prompt: 'Build a kanban board with draggable cards between To do, Doing and Done, card details, labels, and touch-friendly drag and drop. Persist to local storage.' },
  { id: 'quiz', label: 'Quiz maker', summary: 'Timed multiple-choice with scoring', tags: ['study', 'interactive'],
    prompt: 'Build a quiz app: load questions from a JSON file, show timed multiple-choice questions, give instant feedback and explanations, and finish with a score summary and a review of wrong answers.' },
  { id: 'portfolio', label: 'Portfolio site', summary: 'One-page personal site with projects', tags: ['website'],
    prompt: 'Build a fast one-page portfolio site with hero, about, projects grid, skills and a contact section. Fully responsive, accessible, and under 100 KB with no frameworks.' },
  { id: 'landing', label: 'Landing page', summary: 'Product page with pricing and FAQ', tags: ['website'],
    prompt: 'Build a conversion-focused landing page for a product: hero with call to action, features, social proof, pricing table with a monthly/yearly toggle, FAQ accordion and footer.' },
  { id: 'json-viewer', label: 'JSON explorer', summary: 'Paste JSON, browse it as a tree', tags: ['tool', 'json'],
    prompt: 'Build a JSON explorer: paste or upload JSON, validate it with clear error positions, browse it as a collapsible tree, search keys and values, copy paths, and pretty-print or minify.' },
  { id: 'chat-ui', label: 'Chat interface', summary: 'Messaging UI with bubbles and typing', tags: ['ui', 'interactive'],
    prompt: 'Build a polished chat interface: message bubbles, typing indicator, timestamps, auto-scroll, an emoji picker and an attachment preview. UI only, with a fake echo bot.' },
];

/** Final prompt: what to build, then how it should look. */
export function composeBuildPrompt(prompt: string, style: BuildStyle | null | undefined): string {
  if (!style) return prompt;
  return `${prompt}\n\nStyle: ${style.label}. ${style.directive}`;
}

export function findBuildStyle(id: string | null | undefined): BuildStyle | undefined {
  return BUILD_STYLES.find(s => s.id === id);
}
