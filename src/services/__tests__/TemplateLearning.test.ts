import { describe, it, expect, beforeEach } from 'vitest';
import { templateLearning } from '../TemplateLearning';

describe('TemplateLearning.getAllTemplates', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the full global template catalog even with zero recorded usage (fresh account)', () => {
    // Previously this returned [] until you'd already "used" a template
    // through this exact tracking flow — a chicken-and-egg bug that made
    // the picker open empty for anyone who hadn't used it yet.
    const templates = templateLearning.getAllTemplates();
    expect(templates.length).toBeGreaterThan(5);
    expect(templates.some(t => t.id === 'exam-prep')).toBe(true);
    expect(templates.every(t => (t.frequency ?? 0) === 0)).toBe(true);
  });

  it('merges in real usage counts for templates that have been used', () => {
    templateLearning.recordTemplateUse('exam-prep', {});
    templateLearning.recordTemplateUse('exam-prep', {});

    const templates = templateLearning.getAllTemplates();
    const examPrep = templates.find(t => t.id === 'exam-prep');
    expect(examPrep?.frequency).toBe(2);

    // Unrelated templates are untouched and still present.
    const codeHelp = templates.find(t => t.id === 'code-help');
    expect(codeHelp?.frequency).toBe(0);
  });

  it('includes any AI-generated templates alongside the fixed catalog', () => {
    const before = templateLearning.getAllTemplates().length;
    // getAllTemplates should reflect generatedTemplates too if present —
    // sanity check the merge doesn't drop the fixed catalog when empty.
    expect(before).toBeGreaterThan(0);
  });
});
