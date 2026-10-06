import { describe, expect, it } from 'vitest';
import { normalizePlanOutput } from './normalizePlanOutput';

describe('normalizePlanOutput', () => {
  it('accepts a nested task list and normalizes priority and missing descriptions', () => {
    expect(normalizePlanOutput({
      tasks: [{ name: 'Create outline', importance: 'urgent' }],
    }, 'Write a report')).toEqual({
      title: 'Write a report',
      steps: [{
        id: 'step-1',
        title: 'Create outline',
        description: 'Create outline',
        priority: 'high',
      }],
    });
  });

  it('rejects empty or untitled plans', () => {
    expect(() => normalizePlanOutput({ steps: [] }, 'Goal')).toThrow('No actionable');
    expect(() => normalizePlanOutput({ steps: [{}] }, 'Goal')).toThrow('no title');
  });
});
