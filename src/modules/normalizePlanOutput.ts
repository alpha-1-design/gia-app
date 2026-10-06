type JsonObject = Record<string, unknown>;

export interface NormalizedPlanStep {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  eta?: string;
}

export interface NormalizedPlan {
  title: string;
  steps: NormalizedPlanStep[];
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

export function normalizePlanOutput(value: unknown, defaultTitle: string): NormalizedPlan {
  const object = isObject(value) ? value : {};
  const candidateSteps: unknown = Array.isArray(value) ? value : [
    object.steps, object.tasks, object.actions, object.timeline, object.plan, object.data,
  ].find(Array.isArray);
  if (!Array.isArray(candidateSteps) || candidateSteps.length === 0) {
    throw new Error('No actionable plan steps were found in the AI response.');
  }
  const rawSteps: unknown[] = candidateSteps;

  const steps = rawSteps.slice(0, 12).map((raw, index): NormalizedPlanStep => {
    const step: JsonObject = isObject(raw) ? raw : { title: raw };
    const title = text(step.title ?? step.name ?? step.task ?? step.action ?? step.step ?? step.text);
    if (!title) throw new Error(`Plan step ${index + 1} has no title.`);
    const rawPriority = text(step.priority ?? step.importance).toLowerCase();
    const priority = rawPriority === 'high' || rawPriority === 'critical' || rawPriority === 'urgent' ? 'high'
      : rawPriority === 'low' || rawPriority === 'optional' ? 'low'
        : 'medium';
    const description = text(step.description ?? step.details ?? step.instructions) || title;
    const eta = text(step.eta ?? step.timeframe ?? step.deadline ?? step.duration);
    return {
      id: text(step.id) || `step-${index + 1}`,
      title,
      description,
      priority,
      ...(eta ? { eta } : {}),
    };
  });

  return {
    title: text(object.title ?? object.planTitle ?? object.name) || defaultTitle,
    steps,
  };
}
