import { describe, it, expect, beforeEach } from 'vitest';
import { controlTools } from '../controls';
import { useGiaStore } from '../../../store/useGiaStore';

const requestClarification = controlTools.find((t) => t.id === 'request_clarification')!;

describe('request_clarification tool', () => {
  beforeEach(() => {
    useGiaStore.setState({ clarification: null });
  });

  it('stores a flat single-question clarification when no fields are given', async () => {
    await requestClarification.execute({ question: 'Continue?', options: ['Yes', 'No'] });
    const c = useGiaStore.getState().clarification;
    expect(c?.question).toBe('Continue?');
    expect(c?.options).toEqual(['Yes', 'No']);
    expect(c?.fields).toBeUndefined();
  });

  it('stores parsed fields for a multi-field form', async () => {
    await requestClarification.execute({
      question: 'Two quick things I need from you',
      fields: [
        { id: 'where', label: 'Where should this run?', type: 'radio', options: ['No-code app', 'My own setup'] },
        { id: 'tool', label: 'Where should leads land?', type: 'select', options: ['HubSpot', 'Other'] },
        { id: 'note', label: 'Anything else?', type: 'text', placeholder: 'Optional' },
      ],
    });
    const c = useGiaStore.getState().clarification;
    expect(c?.fields).toHaveLength(3);
    expect(c?.fields?.[0]).toMatchObject({ id: 'where', type: 'radio', options: ['No-code app', 'My own setup'] });
    expect(c?.fields?.[2]).toMatchObject({ id: 'note', type: 'text', placeholder: 'Optional' });
  });

  it('drops malformed field entries instead of throwing (missing label, bad type)', async () => {
    await requestClarification.execute({
      question: 'q',
      fields: [
        { id: 'ok', label: 'Valid field', type: 'text' },
        { id: 'bad-type', label: 'Bad type', type: 'checkbox' },
        { label: 'Missing id', type: 'text' },
      ],
    });
    const c = useGiaStore.getState().clarification;
    expect(c?.fields).toHaveLength(1);
    expect(c?.fields?.[0].id).toBe('ok');
  });

  it('falls back to flat mode when fields is an empty array', async () => {
    await requestClarification.execute({ question: 'q', options: ['A', 'B'], fields: [] });
    const c = useGiaStore.getState().clarification;
    expect(c?.fields).toBeUndefined();
  });
});
