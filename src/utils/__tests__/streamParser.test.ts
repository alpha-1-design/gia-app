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
      segments: [],
      inThinkBlock: false,
      inToolBlock: false,
      inXmlToolBlock: false,
      xmlTagBuffer: '',
      xmlTagName: '',
      inJsonBlock: false,
      inArtifactBlock: false,
      jsonBlockBuffer: '',
      pendingBacktickCount: 0,
      toolBlockBuffer: '',
      artifactBlockBuffer: '',
      artifactConfigLine: '',
      artifacts: [],
      tasks: [],
      pendingTaskMarker: '',
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

  describe('visual blocks', () => {
    it('passes visual block through unchanged', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        'before\n```visual\n{"type":"3d","data":{"objects":[]}}\n```\nafter',
        state,
      );
      expect(result).toBe(
        'before\n```visual\n{"type":"3d","data":{"objects":[]}}\n```\nafter',
      );
      expect(state.accumulated).toBe(
        'before\n```visual\n{"type":"3d","data":{"objects":[]}}\n```\nafter',
      );
    });

    it('passes visual block with full 3d scene through unchanged', () => {
      const state = createStreamParser();
      const block =
        '```visual\n{"type":"3d","data":{"objects":[{"type":"box","size":1,"color":"#ff0000","position":[0,0,0]}],"lights":[{"type":"ambient","intensity":0.5}],"camera":{"position":[5,5,5]}}}\n```';
      const result = processStreamChunk(block, state);
      expect(result).toBe(block);
    });

    it('passes visual block with chart data through unchanged', () => {
      const state = createStreamParser();
      const block =
        '```visual\n{"type":"chart","data":{"series":[{"name":"Sales","values":[100,200,150]}]}}\n```';
      const result = processStreamChunk(block, state);
      expect(result).toBe(block);
    });

    it('handles visual block split across chunks', () => {
      const state = createStreamParser();
      processStreamChunk('before\n```visual\n{"type":"3d",', state);
      const result = processStreamChunk(
        '"data":{"objects":[]}}\n```\nafter',
        state,
      );
      expect(result).toBe('"data":{"objects":[]}}\n```\nafter');
      expect(state.accumulated).toBe(
        'before\n```visual\n{"type":"3d","data":{"objects":[]}}\n```\nafter',
      );
    });

    it('restores missing backticks when fence split across chunks with `visual` keyword', () => {
      const state = createStreamParser();
      const r1 = processStreamChunk('``', state);
      expect(r1).toBe('');
      expect(state.pendingBacktickCount).toBe(2);

      const r2 = processStreamChunk(
        'visual\n{"type":"3d","data":{"objects":[]}}\n```',
        state,
      );
      expect(r2).toBe(
        '```visual\n{"type":"3d","data":{"objects":[]}}\n```',
      );
      expect(state.accumulated).toBe(
        '```visual\n{"type":"3d","data":{"objects":[]}}\n```',
      );
    });

    it('restores single missing backtick when fence split with visual', () => {
      const state = createStreamParser();
      const r1 = processStreamChunk('``', state);
      expect(r1).toBe('');
      expect(state.pendingBacktickCount).toBe(2);

      const r2 = processStreamChunk(
        '`visual\n{"type":"3d"}\n```',
        state,
      );
      expect(r2).toBe('```visual\n{"type":"3d"}\n```');
      expect(state.accumulated).toBe('```visual\n{"type":"3d"}\n```');
    });

    it('drops backticks when next chunk does not start a valid fence', () => {
      const state = createStreamParser();
      processStreamChunk('some text ``', state);
      expect(state.pendingBacktickCount).toBe(2);

      const r2 = processStreamChunk('not a fence', state);
      expect(r2).toBe('not a fence');
      expect(state.accumulated).toBe('some text not a fence');
    });

    it('handles visual block with no closing fence', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        '```visual\n{"type":"3d","data":{"objects":[]}}',
        state,
      );
      expect(result).toBe(
        '```visual\n{"type":"3d","data":{"objects":[]}}',
      );
    });

    it('passes multiple visual blocks through unchanged', () => {
      const state = createStreamParser();
      const input =
        '```visual\n{"type":"3d"}\n```\ntext\n```visual\n{"type":"chart"}\n```';
      const result = processStreamChunk(input, state);
      expect(result).toBe(input);
    });
  });

  describe('json blocks', () => {
    it('passes non-tool json block through unchanged', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        '```json\n{"key": "value", "count": 42}\n```',
        state,
      );
      expect(result).toBe(
        '```json\n{"key": "value", "count": 42}\n```',
      );
    });

    it('suppresses tool-call json block', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        'before\n```json\n{"id": "123", "args": {}}\n```\nafter',
        state,
      );
      expect(result).toBe('before\n\nafter');
    });

    it('suppresses tool-call json block with name/input keys', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        '```json\n{"name": "search", "input": {"q": "test"}}\n```',
        state,
      );
      expect(result).toBe('');
    });

    it('handles non-tool json block split across chunks', () => {
      const state = createStreamParser();
      processStreamChunk('text\n```json\n{"key": "val', state);
      expect(state.inJsonBlock).toBe(true);
      expect(state.jsonBlockBuffer).toBe('\n{"key": "val');

      const result = processStreamChunk('ue"}\n```\nend', state);
      expect(result).toBe('```json\n{"key": "value"}\n```\nend');
      expect(state.accumulated).toBe(
        'text\n```json\n{"key": "value"}\n```\nend',
      );
    });

    it('handles tool-call json block split across chunks', () => {
      const state = createStreamParser();
      processStreamChunk('x\n```json\n{"id": "tes', state);
      expect(state.inJsonBlock).toBe(true);

      const result = processStreamChunk('t", "args": {}}\n```\ny', state);
      expect(result).toBe('\ny');
      expect(state.inJsonBlock).toBe(false);
    });
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

  describe('think + tool blocks restored', () => {
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

  describe('mixed visual + tool + think blocks', () => {
    it('passes visual through while suppressing tool block', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        '```visual\n{"type":"3d","data":{"objects":[]}}\n```\n' +
          '```tool\n{"id":"x","args":{}}\n```\n' +
          'result',
        state,
      );
      expect(result).toBe(
        '```visual\n{"type":"3d","data":{"objects":[]}}\n```\n\nresult',
      );
    });

    it('passes visual through while suppressing think content', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        '```visual\n{"type":"3d"}\n```\n<think>hidden</think> end',
        state,
      );
      expect(result).toBe('```visual\n{"type":"3d"}\n```\n end');
      expect(state.thoughtsAccumulated).toBe('hidden');
    });

    it('passes visual through while suppressing tool-call json block', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        '```visual\n{"type":"3d"}\n```\n' +
          '```json\n{"id":"y","args":{}}\n```',
        state,
      );
      expect(result).toBe('```visual\n{"type":"3d"}\n```\n');
    });

    it('passes non-tool json and visual blocks together', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        '```visual\n{"type":"3d"}\n```\n' +
          '```json\n{"setting":"value"}\n```',
        state,
      );
      expect(result).toBe(
        '```visual\n{"type":"3d"}\n```\n' +
          '```json\n{"setting":"value"}\n```',
      );
    });

    it('handles visual block between think and tool blocks', () => {
      const state = createStreamParser();
      const result = processStreamChunk(
        '<think>hidden</think>\n' +
          '```visual\n{"type":"3d"}\n```\n' +
          '```tool\n{"id":"z","args":{}}\n```\n' +
          'done',
        state,
      );
      expect(result).toBe('\n```visual\n{"type":"3d"}\n```\n\ndone');
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

    it('restores backticks for json fence across chunk boundary', () => {
      const state = createStreamParser();
      processStreamChunk('``', state);
      const r = processStreamChunk(
        'json\n{"setting":"value"}\n```',
        state,
      );
      // After fence close, the newline after ``` becomes separator
      expect(r).toBe('```json\n{"setting":"value"}\n```');
      expect(state.accumulated).toBe(
        '```json\n{"setting":"value"}\n```',
      );
    });

    it('drops backticks when next chunk is not a fence type', () => {
      const state = createStreamParser();
      processStreamChunk('text ``', state);
      const r = processStreamChunk('random text', state);
      expect(r).toBe('random text');
      expect(state.accumulated).toBe('text random text');
    });
  });
});

describe('stripToolBlocks', () => {
  it('removes ```tool blocks', () => {
    const result = stripToolBlocks('a\n```tool\n{"id":"x"}\n```\nb');
    expect(result).toBe('a\n\nb');
  });

  it('preserves visual blocks', () => {
    const result = stripToolBlocks(
      'a\n```visual\n{"type":"3d","data":{"objects":[]}}\n```\nb',
    );
    expect(result).toBe(
      'a\n```visual\n{"type":"3d","data":{"objects":[]}}\n```\nb',
    );
  });

  it('preserves non-tool json blocks', () => {
    const result = stripToolBlocks(
      '```json\n{"setting":"value"}\n```',
    );
    expect(result).toBe('```json\n{"setting":"value"}\n```');
  });

  it('removes JSON blocks with tool call indicators', () => {
    const result = stripToolBlocks(
      'before\n```json\n{"name": "test", "args": {}}\n```\nafter',
    );
    expect(result).toBe('before\n\nafter');
  });

  it('strips tool blocks but preserves visual blocks in mixed content', () => {
    const result = stripToolBlocks(
      '```visual\n{"type":"3d"}\n```\n' +
        '```tool\n{"id":"x"}\n```\n' +
        '```json\n{"setting":"value"}\n```',
    );
    expect(result).toBe(
      '```visual\n{"type":"3d"}\n```\n\n' +
        '```json\n{"setting":"value"}\n```',
    );
  });

  it('removes incomplete trailing tool blocks', () => {
    const result = stripToolBlocks(
      'text\n```tool\n{"id":"x","args":{}}\n```\n' +
        '```tool\n{"id":"y","args":{}}',
    );
      expect(result).toBe('text');
  });

  it('removes bare JSON objects with tool call indicators', () => {
    const result = stripToolBlocks(
      'before\n{"id": "x", "args": {}}\nafter',
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

  it('preserves visual blocks in final display', () => {
    const result = processStreamForDisplay(
      '```visual\n{"type":"3d","data":{"objects":[]}}\n```\n' +
        '```tool\n{"id":"x"}\n```',
    );
    expect(result).toBe(
      '```visual\n{"type":"3d","data":{"objects":[]}}\n```',
    );
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

  it('does nothing when no thoughts accumulated', () => {
    const state = createStreamParser();
    state.inThinkBlock = true;
    const result = flushThinkBlock(state);
    expect(result).toBe('');
  });
});
