import { logger } from '../../utils/logger';
import GiaBrain from '../GiaBrain';
import { useProviderStore } from '../../store/useProviderStore';
import { useAutonomyStore } from '../../store/useAutonomyStore';
import type { Outcome, Reflection } from '../../types/autonomy';

export class ReflectionEngine {
  async evaluate(
    goalId: string,
    stepDescription: string,
    action: string,
    result: string,
  ): Promise<Omit<Reflection, 'id' | 'timestamp'>> {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];
    if (!config?.enabled || !config?.apiKey) {
      return this.fallbackEvaluate(result);
    }

    const prompt = `You are a self-reflection engine. Evaluate the outcome of an action taken toward a goal.

Step description: ${stepDescription}
Action taken: ${action}
Result: ${result.slice(0, 2000)}

Return ONLY valid JSON with this exact structure:
{
  "outcome": "success" | "partial" | "failure",
  "assessment": "Brief assessment of what happened (1-2 sentences)",
  "lessonsLearned": ["Lesson 1", "Lesson 2"],
  "confidence": 0.0-1.0,
  "suggestedNextAction": "What to do next based on this outcome, or null if the step is done"
}

Rules:
- "success" = step completed as expected
- "partial" = some progress made but not fully complete
- "failure" = step could not be completed
- confidence reflects how sure you are of this assessment
- 1-3 lessons learned maximum
- suggestedNextAction should help adapt the plan

Return ONLY the JSON, no other text.`;

    try {
      const res = await GiaBrain.generate({
        prompt,
        maxTokens: 1000,
        forceJson: true,
      });

      const parsed = JSON.parse(res.text);
      return {
        goalId,
        outcome: parsed.outcome || 'partial',
        assessment: parsed.assessment || 'Action completed with mixed results',
        lessonsLearned: Array.isArray(parsed.lessonsLearned) ? parsed.lessonsLearned.slice(0, 3) : [],
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
        suggestedNextAction: parsed.suggestedNextAction || undefined,
      };
    } catch (e) {
      logger.warn('[ReflectionEngine] LLM evaluation failed, using fallback:', e);
      return this.fallbackEvaluate(result);
    }
  }

  private fallbackEvaluate(result: string): Omit<Reflection, 'id' | 'timestamp'> {
    const success = result.length > 0 && !result.includes('error') && !result.includes('failed');
    return {
      goalId: '',
      outcome: success ? 'success' : 'failure',
      assessment: success ? 'Step executed successfully' : 'Step encountered issues during execution',
      lessonsLearned: success ? [] : ['Need to verify tool results more carefully'],
      confidence: 0.6,
      suggestedNextAction: success ? undefined : 'Retry with a different approach',
    };
  }

  record(goalId: string, stepId: string | undefined, outcome: Outcome, assessment: string): string | undefined {
    if (!useAutonomyStore.getState().config.reflectionRequired && outcome === 'success') return undefined;
    const store = useAutonomyStore.getState();
    return store.addReflection({ goalId, stepId, outcome, assessment, lessonsLearned: [], confidence: 0.8 });
  }
}

export const reflectionEngine = new ReflectionEngine();
