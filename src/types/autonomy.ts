export type GoalStatus = 'active' | 'paused' | 'completed' | 'failed';
export type GoalPriority = 'low' | 'medium' | 'high' | 'critical';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
export type Outcome = 'success' | 'partial' | 'failure';

export interface Goal {
  id: string;
  title: string;
  description: string;
  priority: GoalPriority;
  status: GoalStatus;
  created: number;
  updated: number;
  deadline?: number;
  progress: number;
  parentGoalId?: string;
  subGoalIds: string[];
  planId?: string;
  reflectionIds: string[];
  tags: string[];
  source: 'user' | 'autonomous' | 'suggestion';
}

export interface Plan {
  id: string;
  goalId: string;
  steps: PlanStep[];
  status: 'active' | 'completed' | 'failed';
  created: number;
  updated: number;
}

export interface PlanStep {
  id: string;
  description: string;
  action: string;
  expectedOutcome: string;
  status: StepStatus;
  result?: string;
  reflectionId?: string;
  assignedTool?: string;
}

export interface Reflection {
  id: string;
  goalId: string;
  stepId?: string;
  timestamp: number;
  outcome: Outcome;
  assessment: string;
  lessonsLearned: string[];
  confidence: number;
  suggestedNextAction?: string;
}

export interface AutonomousState {
  enabled: boolean;
  proactivenessLevel: number;
  maxConcurrentGoals: number;
  reflectionRequired: boolean;
  idleThresholdMs: number;
}

export const DEFAULT_AUTONOMOUS_STATE: AutonomousState = {
  enabled: false,
  proactivenessLevel: 0.5,
  maxConcurrentGoals: 3,
  reflectionRequired: true,
  idleThresholdMs: 60 * 1000,
};
