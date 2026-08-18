import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InlineClarificationForm from '../InlineClarificationForm';
import type { ClarificationField } from '../../../store/useGiaStore';

const fields: ClarificationField[] = [
  { id: 'where', label: 'Where should this run?', type: 'radio', options: ['No-code app', 'My own setup'] },
  { id: 'tool', label: 'Where should the leads land?', type: 'select', options: ['HubSpot', 'Airtable', 'Other'] },
  { id: 'other', label: 'If you picked Other, name your tool', type: 'text', placeholder: 'Tool name' },
];

describe('InlineClarificationForm', () => {
  it('renders every field with its label, numbered in order', () => {
    render(<InlineClarificationForm question="Two quick things I need from you" fields={fields} loading={false} onSubmit={vi.fn()} />);
    screen.getByText('Two quick things I need from you');
    screen.getByText('1. Where should this run?');
    screen.getByText('2. Where should the leads land?');
    screen.getByText('3. If you picked Other, name your tool');
  });

  it('renders radio options as a radiogroup and selecting one marks it checked', () => {
    render(<InlineClarificationForm question="q" fields={fields} loading={false} onSubmit={vi.fn()} />);
    const option = screen.getByRole('radio', { name: 'No-code app' });
    expect(option).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(option);
    expect(option).toHaveAttribute('aria-checked', 'true');
  });

  it('disables Send answers until every field has a value', () => {
    render(<InlineClarificationForm question="q" fields={fields} loading={false} onSubmit={vi.fn()} />);
    const sendBtn = screen.getByRole('button', { name: /send answers/i });
    expect(sendBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: 'No-code app' }));
    expect(sendBtn).toBeDisabled(); // still missing select + text

    fireEvent.change(screen.getByLabelText('Where should the leads land?'), { target: { value: 'HubSpot' } });
    expect(sendBtn).toBeDisabled(); // still missing text field

    fireEvent.change(screen.getByLabelText('If you picked Other, name your tool'), { target: { value: 'n/a' } });
    expect(sendBtn).not.toBeDisabled();
  });

  it('composes all answers into one string and calls onSubmit', () => {
    const onSubmit = vi.fn();
    render(<InlineClarificationForm question="q" fields={fields} loading={false} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('radio', { name: 'My own setup' }));
    fireEvent.change(screen.getByLabelText('Where should the leads land?'), { target: { value: 'Airtable' } });
    fireEvent.change(screen.getByLabelText('If you picked Other, name your tool'), { target: { value: 'n/a' } });
    fireEvent.click(screen.getByRole('button', { name: /send answers/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const composed = onSubmit.mock.calls[0][0] as string;
    expect(composed).toContain('My own setup');
    expect(composed).toContain('Airtable');
    expect(composed).toContain('n/a');
  });

  it('disables all inputs and the submit button while loading', () => {
    render(<InlineClarificationForm question="q" fields={fields} loading={true} onSubmit={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'No-code app' })).toBeDisabled();
    expect(screen.getByLabelText('Where should the leads land?')).toBeDisabled();
    expect(screen.getByRole('button', { name: /send answers/i })).toBeDisabled();
  });
});
