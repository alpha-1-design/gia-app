import { executeToolBlocks, type ExecutionState } from './brain/toolRunner';
import { BrainRequest } from './providers/types';

class ToolExecutionService {
  async execute(text: string, state: ExecutionState, onThought: BrainRequest['onThought'], signal: AbortSignal | undefined, sourcesAcc: string[], messageId: string | undefined) {
    return executeToolBlocks(text, state, onThought, signal, sourcesAcc, messageId);
  }
}

export default new ToolExecutionService();
