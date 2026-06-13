import { describe, it, expect } from 'vitest';
import {
  createStreamParser,
  processStreamChunk,
  stripToolBlocks,
  processStreamForDisplay,
  flushThinkBlock,
} from '../streamParser';

describe('createStreamParser', () => {
  it('returns initial state', () => {
    const state = createStreamParser();
    expect(state).toEqual({
      accumulated: '',
      thoughtsAccumulated: '',
      inThinkBlock: false,
      inToolBlock: false,
      inJsonBlock: false,
      jsonBlockBuffer: '',
      pendingBacktickCount: 0,
    });
  });
});

describe('processStreamChunk', () => {
  it('passes plain text through unchanged', () => {
    const state = createStreamParser();
    const result = processStreamChunk('Hello world', state);
    expect(result).toBe('Hello world');
    expect(state.accumulated).toBe('Hello world');
  });

  it('accumulates across multiple chunks', () => {
    const state = createStreamParser();
    processStreamChunk('Hello ', state);
    processStreamChunk('world', state);
    expect(state.accumulated).toBe('Hello world');
  });

  describe('think blocks', () => {
    it('suppresses content inside <think> tags', () => {
      const state = createStreamParser();
      const result = processStreamChunk('before <think>internal</think> after', state);
      expect(result).toBe('before  after');
      expect(state.accumulated).toBe('before  after');
      expect(state.thoughtsAccumulated).toBe('internal');
    });

    it('handles think block split across chunks', () => {
      const state = createStreamParser();
      processStreamChunk('before <think>inter', state);
      expect(state.accumulated).toBe('before ');
      expect(state.thoughtsAccumulated).toBe('inter');
      expect(state.inThinkBlock).toBe(true);

      const result = processStreamChunk('nal</think> after', state);
      expect(result).toBe(' after');
      expect(state.accumulated).toBe('before  after');
      expect(state.thoughtsAccumulated).toBe('internal');
      expect(state.inThinkBlock).toBe(false);
    });

    it('handles unclosed think block', () => {
      const state = createStreamParser();
      const result = processStreamChunk('before <think>still thinking', state);
      expect(result).toBe('before ');
      expect(state.thoughtsAccumulated).toBe('still thinking');
      expect(state.inThinkBlock).toBe(true);
    });
  });

  describe('tool blocks', () => {
    it('suppresses content inside ```tool blocks', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        'before\n```tool\n{"id":"test","args":{}}\n```\nafter',
        state,
      );
      // Extra newline remains from tool block position
      expect(result).toBe('before\n\nafter');
    });

    it('handles tool block split across chunks', () => {
      const state = createStreamParser();
      processStreamChunk('before\n```tool\n{"id":"te', state);
      expect(state.inToolBlock).toBe(true);

      const result = processStreamChunk('st","args":{}}\n```\nafter', state);
      expect(result).toBe('\nafter');
      expect(state.inToolBlock).toBe(false);
    });

    it('handles tool block ending with triple backticks immediately', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        'before\n```tool\n{"id":"test","args":{}}\n```',
        state,
      );
      expect(result).toBe('before\n');
    });
  });

  describe('backtick edge cases', () => {
    it('handles trailing backticks at chunk boundary', () => {
      const state = createStreamParser();
      processStreamChunk('hello', state);
      const result = processStreamChunk('``', state);
      expect(result).toBe('');
      expect(state.pendingBacktickCount).toBe(2);
    });

    it('tracks pending backticks at chunk boundaries', () => {
      const state = createStreamParser();
      processStreamChunk('hello', state);
      expect(state.pendingBacktickCount).toBe(0);
      processStreamChunk('``', state);
      expect(state.pendingBacktickCount).toBe(2);
    });

    it('detects trailing backtick on a single-tick chunk', () => {
      const state = createStreamParser();
      processStreamChunk('hello', state);
      processStreamChunk('`', state);
      expect(state.pendingBacktickCount).toBe(1);
    });
  });

  describe('mixed think and tool blocks', () => {
    it('handles think block before tool block', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        'a <think>thought</think> b\n```tool\n{"id":"x","args":{}}\n``` c',
        state,
      );
      expect(result).toBe('a  b\n c');
      expect(state.accumulated).toBe('a  b\n c');
    });

    it('handles tool block before think block', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        'a\n```tool\n{"id":"x","args":{}}\n``` b <think>thought</think> c',
        state,
      );
      expect(result).toBe('a\n b  c');
    });
  });
});

describe('stripToolBlocks', () => {
  it('removes ```tool blocks', () => {
    const result = stripToolBlocks('a\n```tool\n{"id":"x"}\n```\nb');
    expect(result).toBe('a\n\nb');
  });

  it('removes JSON blocks with tool/function/name keys', () => {
    const result = stripToolBlocks(
      'before\n```json\n{"name": "test", "args": {}}\n```\nafter',
    );
    expect(result).toBe('before\n\nafter');
  });

  it('returns empty string when nothing remains', () => {
    const result = stripToolBlocks('```tool\n{"id":"x"}\n```');
    expect(result).toBe('');
  });
});

describe('processStreamForDisplay', () => {
  it('strips tool blocks and returns result', () => {
    const result = processStreamForDisplay(
      'hello\n```tool\n{"id":"x"}\n```\nworld',
    );
    expect(result).toBe('hello\n\nworld');
  });

  it('returns empty string when only tool blocks remain', () => {
    const result = processStreamForDisplay('```tool\n{"id":"x"}\n```');
    expect(result).toBe('');
  });
});

describe('flushThinkBlock', () => {
  it('flushes unclosed think block into accumulated', () => {
    const state = createStreamParser();
    state.inThinkBlock = true;
    state.thoughtsAccumulated = 'ongoing thought';
    const result = flushThinkBlock(state);
    expect(result).toContain('ongoing thought');
    expect(state.inThinkBlock).toBe(false);
  });

  it('does nothing when not in think block', () => {
    const state = createStreamParser();
    state.thoughtsAccumulated = 'some thought';
    const result = flushThinkBlock(state);
    expect(result).toBe('');
  });
});
