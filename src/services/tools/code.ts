import { z } from 'zod';
import CodeRunner from '../CodeRunner';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

const codeExecution: Tool = {
  id: 'code_execution',
  name: 'code_execution',
  description: 'Execute a code snippet in a sandboxed environment. Specify the language (js, python, or ts) and the code to run.',
  schema: {
    type: 'object',
    properties: {
      language: { type: 'string', description: 'Language of the code (js, python, ts)' },
      code: { type: 'string', description: 'Code to execute' },
    },
    required: ['language', 'code'],
  },
  execute: async ({ language, code }) => {
    const codeSchema = z.object({
      language: z.enum(['js', 'python', 'ts']),
      code: z.string().min(1, "Code is required").max(10000, "Code too long"),
    });

    const validationResult = codeSchema.safeParse({ language, code });
    if (!validationResult.success) {
      return {
        success: false,
        content: '',
        error: `Invalid code execution parameters: ${validationResult.error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`,
      };
    }

    try {
      const result = await CodeRunner.run({ language: language as string, code: code as string });
      return { success: true, content: result.output || result.error || 'Code executed (no output)' };
    } catch (e: unknown) {
      return { success: false, content: '', error: (e instanceof Error ? e.message : String(e)) };
    }
  },
};

export function registerCodeTools() {
  ToolRegistry.register(codeExecution);
}
