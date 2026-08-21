/**
 * suggestionEngine.ts — Deterministic follow-up suggestion generator.
 * Replaces the extra LLM call (generateFollowUpSuggestions) with local heuristics.
 * No API cost, no JSON parsing failures, instant response.
 */

const EXPLANATION_MARKERS = /(?:explain|describe|what is|what are|how does|how do|tell me|define|meaning of|overview of)/i;
const CODE_MARKERS = /(?:```|function |const |class |import |def |print\(|return |if\s*\(|for\s*\()/;
const COMPARISON_MARKERS = /(?:versus|vs\.?|compared to|difference between|better than|worse than|pros and cons|alternatives)/i;
const LIST_MARKERS = /(?:top \d|list of|examples of|types of|best |worst |should I )/i;
const TUTORIAL_MARKERS = /(?:step|step-by-step|guide|tutorial|how to|instructions)/i;


const ALL_SUGGESTIONS = {
  explainMore: [
    'Can you explain that more simply?',
    'What are the key takeaways?',
    'Can you break that down further?',
    'ELI5 — explain like I\'m five',
    'What\'s the most important point here?',
  ],
  examples: [
    'Can you give me a concrete example?',
    'Show me a real-world use case',
    'What does that look like in practice?',
    'Can you illustrate with code?',
  ],
  deeper: [
    'Go deeper on this topic',
    'What are the trade-offs?',
    'What are the common pitfalls?',
    'What should I watch out for?',
    'What are the edge cases?',
  ],
  compare: [
    'What are the alternatives?',
    'How does this compare to other approaches?',
    'What are the pros and cons?',
    'Which option is better for my use case?',
  ],
  practical: [
    'How do I actually implement this?',
    'What are the next steps?',
    'Can you create a step-by-step plan?',
    'What tools do I need for this?',
  ],
  related: [
    'What should I learn next?',
    'How does this connect to what we discussed before?',
    'What are related concepts I should know?',
    'Can you expand on the broader context?',
  ],
  general: [
    'Tell me more about that',
    'What else should I know?',
    'Can you summarize the key points?',
    'What\'s your recommendation?',
  ],
};

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}


export function generateSuggestions(content: string, userQuestion?: string): string[] {
  const pool = [...ALL_SUGGESTIONS.general];

  if (EXPLANATION_MARKERS.test(content) || EXPLANATION_MARKERS.test(userQuestion || '')) {
    pool.push(...ALL_SUGGESTIONS.examples);
    pool.push(...ALL_SUGGESTIONS.deeper);
  }

  if (CODE_MARKERS.test(content)) {
    pool.push(...ALL_SUGGESTIONS.examples);
    pool.push('Can you walk through the code?');
    pool.push('What does each part do?');
  }

  if (COMPARISON_MARKERS.test(content)) {
    pool.push(...ALL_SUGGESTIONS.compare);
  }

  if (LIST_MARKERS.test(content)) {
    pool.push(...ALL_SUGGESTIONS.practical);
    pool.push('Which option would you recommend?');
  }

  if (TUTORIAL_MARKERS.test(content)) {
    pool.push(...ALL_SUGGESTIONS.practical);
    pool.push('What are the prerequisites?');
  }

  // Always include some general follow-ups
  pool.push(...ALL_SUGGESTIONS.explainMore.slice(0, 2));
  pool.push(...ALL_SUGGESTIONS.related.slice(0, 1));

  // Deduplicate and pick 3
  const unique = [...new Set(pool)];
  return pickRandom(unique, 3);
}
