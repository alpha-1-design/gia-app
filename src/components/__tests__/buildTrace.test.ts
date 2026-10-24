import { describe, expect, it } from 'vitest';
import { buildTrace, extractJobPlan, formatJobDuration } from '../turn/buildTrace';
import type { MessageSegment } from '../../store/useGiaStore';

const START = 1_700_000_000_000;

function segment(overrides: Partial<MessageSegment> & Pick<MessageSegment, 'type' | 'content'>): MessageSegment {
  return {
    id: `seg-${Math.random().toString(36).slice(2)}`,
    startedAt: START,
    ...overrides,
  };
}

function page(url: string, status: MessageSegment['toolStatus'] = 'done'): MessageSegment {
  return segment({
    type: 'tool',
    content: `🧠 read_url → url: ${url}\n✅ call-${url} completed successfully`,
    toolName: 'read_url',
    toolStatus: status,
  });
}

describe('buildTrace', () => {
  it('groups repeated actions and dedupes their details', () => {
    const groups = buildTrace([
      page('https://github.com/openai'),
      page('https://github.com/openai'),
      page('https://github.com/anthropics'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      verb: 'Browsed',
      singular: 'page',
      plural: 'pages',
      count: 3,
      failed: false,
    });
    expect(groups[0].details).toEqual(['github.com/openai', 'github.com/anthropics']);
  });

  it('keeps different outcomes in separate rows', () => {
    const groups = buildTrace([
      segment({
        type: 'tool',
        content: '🧠 web_search → query: ghana legal tech\n✅ call-1 completed successfully',
        toolName: 'web_search',
        toolStatus: 'done',
      }),
      page('https://example.com'),
    ]);

    expect(groups.map(group => group.verb)).toEqual(['Searched', 'Browsed']);
  });

  it('marks a group failed when any action in it failed', () => {
    const groups = buildTrace([
      page('https://example.com', 'done'),
      page('https://broken.example', 'failed'),
    ]);

    expect(groups[0].failed).toBe(true);
  });

  it('marks a group running while any action in it is running', () => {
    const groups = buildTrace([
      page('https://example.com', 'done'),
      page('https://pending.example', 'running'),
    ]);

    expect(groups[0].running).toBe(true);
  });

  it('never puts a filled form value in the visible details', () => {
    const groups = buildTrace([
      segment({
        type: 'tool',
        content: '🧠 browser_fill → selector: #email, value: secret@example.com\n✅ call-1 completed successfully',
        toolName: 'browser_fill',
        toolStatus: 'done',
      }),
    ]);

    expect(groups[0].details).toEqual(['#email']);
    expect(groups[0].details.join(' ')).not.toContain('secret@example.com');
  });
});

describe('extractJobPlan', () => {
  it('lifts the sentence before the first tool out of the final answer', () => {
    const segments = [
      segment({ type: 'text', content: 'I’ll check the docs first.' }),
      page('https://example.com'),
      segment({ type: 'text', content: 'Here is the answer.' }),
    ];

    expect(extractJobPlan(segments, 'I’ll check the docs first.\n\nHere is the answer.')).toEqual({
      plan: 'I’ll check the docs first.',
      body: 'Here is the answer.',
    });
  });

  it('does nothing when there is no tool call or no matching prefix', () => {
    const textOnly = [segment({ type: 'text', content: 'Hello.' })];
    expect(extractJobPlan(textOnly, 'Hello.').plan).toBe('');

    const segments = [
      segment({ type: 'text', content: 'I’ll check.' }),
      page('https://example.com'),
    ];
    expect(extractJobPlan(segments, 'The final answer came first.').plan).toBe('');
  });
});

describe('formatJobDuration', () => {
  it('formats seconds and minutes', () => {
    expect(formatJobDuration(8_000)).toBe('8s');
    expect(formatJobDuration(84_000)).toBe('1m 24s');
    expect(formatJobDuration(0)).toBe('');
  });
});
