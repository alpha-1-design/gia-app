import { describe, it, expect } from 'vitest';
import {
  findFenceClose,
  findJsonFenceClose,
  extractToolCalls,
  repairJson,
  parseJsonSafely,
} from '../jsonRepair';

describe('findJsonFenceClose', () => {
  it('finds the closing fence of a plain JSON body', () => {
    const body = '{"id":"x","args":{}}';
    const text = '```tool\n' + body + '\n```';
    const start = text.indexOf('\n') + 1;
    expect(findJsonFenceClose(text, start)).toBe(text.lastIndexOf('```'));
  });

  it('ignores a ``` sequence embedded inside a JSON string argument', () => {
    // A tool call whose argument is a fenced code block. The naive scan would
    // stop at the inner ```python fence and truncate the JSON.
    const body = '{"id":"terminal_run","args":{"code":"```python\\nprint(1)\\n```"}}';
    const text = '```tool\n' + body + '\n```';
    const start = text.indexOf('\n') + 1;
    const close = findJsonFenceClose(text, start);
    expect(close).toBe(text.lastIndexOf('```'));
    const extracted = text.slice(start, close).trim();
    expect(parseJsonSafely(extracted)).toEqual({
      id: 'terminal_run',
      args: { code: '```python\nprint(1)\n```' },
    });
  });

  it('handles multiple embedded fences inside one string argument', () => {
    const body = '{"id":"docs","args":{"md":"```a\\n```b\\n```c"}}';
    const text = '```tool\n' + body + '\n```';
    const start = text.indexOf('\n') + 1;
    const close = findJsonFenceClose(text, start);
    expect(close).toBe(text.lastIndexOf('```'));
    expect(parseJsonSafely(text.slice(start, close).trim())).toEqual({
      id: 'docs',
      args: { md: '```a\n```b\n```c' },
    });
  });

  it('returns -1 when no closing fence exists', () => {
    const text = '```tool\n{"id":"x"}';
    expect(findJsonFenceClose(text, text.indexOf('\n') + 1)).toBe(-1);
  });

  it('skips 4+ backticks that are not a close', () => {
    const body = '{"id":"x","args":{"sep":"````"}}';
    const text = '```tool\n' + body + '\n```';
    const start = text.indexOf('\n') + 1;
    expect(findJsonFenceClose(text, start)).toBe(text.lastIndexOf('```'));
  });
});

describe('findFenceClose (legacy, non-JSON)', () => {
  it('still finds the first valid closing fence for non-JSON bodies', () => {
    const text = '```visual\nSome prose with { unbalanced braces\n```';
    const start = text.indexOf('\n') + 1;
    expect(findFenceClose(text, start)).toBe(text.lastIndexOf('```'));
  });
});

describe('extractToolCalls', () => {
  it('extracts a single tool call', () => {
    const text = 'Here:\n```tool\n{"id":"search","args":{"q":"hi"}}\n```\nDone.';
    const calls = extractToolCalls(text);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ id: 'search', args: { q: 'hi' } });
  });

  it('extracts tool calls whose args contain fenced code blocks', () => {
    const text =
      '```tool\n{"id":"terminal_run","args":{"code":"```python\\nprint(1)\\n```"}}\n```';
    const calls = extractToolCalls(text);
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe('terminal_run');
    expect(calls[0].args).toEqual({ code: '```python\nprint(1)\n```' });
  });

  it('extracts multiple tool calls', () => {
    const text =
      '```tool\n{"id":"a","args":{}}\n```\nmid\n```tool\n{"id":"b","args":{"x":1}}\n```';
    const calls = extractToolCalls(text);
    expect(calls.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('ignores fences without a parseable id/args', () => {
    const text = '```tool\nnot json at all\n```';
    expect(extractToolCalls(text)).toEqual([]);
  });
});

describe('repairJson / parseJsonSafely', () => {
  it('strips a leading/trailing markdown fence', () => {
    expect(parseJsonSafely('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('repairs trailing commas', () => {
    expect(parseJsonSafely('{"a":1,}')).toEqual({ a: 1 });
  });

  it('returns null on unrecoverable input', () => {
    expect(parseJsonSafely('<<<not json>>>')).toBeNull();
  });

  it('repairJson slices to last valid closing bracket', () => {
    const repaired = repairJson('prefix {"a":1} suffix');
    expect(repaired).toContain('"a":1');
  });
});
