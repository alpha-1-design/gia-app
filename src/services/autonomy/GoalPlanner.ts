import { logger } from '../../utils/logger';
import GiaBrain from '../GiaBrain';
import { useProviderStore } from '../../store/useProviderStore';
import type { PlanStep } from '../../types/autonomy';

interface DecompositionResult {
  steps: Omit<PlanStep, 'id'>[];
  summary: string;
}

export class GoalPlanner {
  async decompose(goalTitle: string, goalDescription: string): Promise<DecompositionResult> {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];
    if (!config?.enabled || !config?.apiKey) {
      return this.fallbackDecompose(goalTitle, goalDescription);
    }

    const prompt = `You are a goal planning assistant. Break down the following goal into concrete, actionable steps.

Goal: ${goalTitle}
Description: ${goalDescription}

Return ONLY valid JSON with this exact structure:
{
  "steps": [
    {
      "description": "Brief step description",
      "action": "What GIA should do to accomplish this step",
      "expectedOutcome": "What success looks like for this step",
      "assignedTool": "Which tool might be useful (web_search, terminal_run, filesystem_read, etc.) or null"
    }
  ],
  "summary": "One-sentence plan summary"
}

Rules:
- Return 3-8 steps maximum
- Each step must be specific and actionable
- Steps should be in logical order
- The first step should always be research/understanding
- The last step should deliver the final result
- Use assignedTool only when a specific tool is clearly needed

Return ONLY the JSON, no other text.`;

    try {
      const res = await GiaBrain.generate({
        prompt,
        maxTokens: 2000,
        forceJson: true,
      });

      const parsed = JSON.parse(res.text);
      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        return {
          steps: parsed.steps.map((s: { description: string; action: string; expectedOutcome?: string; assignedTool?: string }) => ({
            description: s.description || 'Untitled step',
            action: s.action || 'Work on this step',
            expectedOutcome: s.expectedOutcome || 'Step completed successfully',
            assignedTool: s.assignedTool || undefined,
          })),
          summary: parsed.summary || `Plan to ${goalTitle.toLowerCase()}`,
        };
      }
    } catch (e) {
      logger.warn('[GoalPlanner] LLM decomposition failed, using fallback:', e);
    }

    return this.fallbackDecompose(goalTitle, goalDescription);
  }

  private fallbackDecompose(title: string, description: string): DecompositionResult {
    return {
      steps: [
        {
          description: `Research and understand: ${title}`,
          action: `Research the topic of "${title}" to gather current information and context. ${description}`,
          expectedOutcome: 'Clear understanding of the domain and requirements',
          assignedTool: 'web_search',
          status: 'pending',
        },
        {
          description: `Analyze and plan approach for: ${title}`,
          action: `Based on research, analyze what needs to be done for: ${description}`,
          expectedOutcome: 'Solid plan of action',
          status: 'pending',
        },
        {
          description: `Execute the main work for: ${title}`,
          action: `Carry out the core work described by: ${description}`,
          expectedOutcome: 'Primary work completed successfully',
          status: 'pending',
        },
        {
          description: `Review and refine: ${title}`,
          action: `Review what was done, check for quality and completeness`,
          expectedOutcome: 'Work reviewed and polished',
          status: 'pending',
        },
        {
          description: `Deliver final result for: ${title}`,
          action: `Present the completed work with a clear summary`,
          expectedOutcome: 'Final result delivered to the user',
          status: 'pending',
        },
      ],
      summary: `Systematic approach to ${title.toLowerCase()}: research, plan, execute, review, deliver.`,
    };
  }
}

export const goalPlanner = new GoalPlanner();
