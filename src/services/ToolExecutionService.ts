import { executeToolBlocks, type ExecutionState } from './brain/toolRunner';
import { BrainRequest } from './providers/types';

class ToolExecutionService {
  async execute(text: string, state: ExecutionState, onThought: BrainRequest['onThought'], signal: AbortSignal | undefined, sourcesAcc: string[], messageId: string | undefined, allowedToolIds?: string[]) {
    return executeToolBlocks(text, state, onThought, signal, sourcesAcc, messageId, allowedToolIds);
  }
}

export default new ToolExecutionService();
