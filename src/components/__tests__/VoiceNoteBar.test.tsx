import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { VoiceNoteBar } from '../VoiceNoteBar';

afterEach(cleanup);

describe('VoiceNoteBar', () => {
  it('shows the timer and lets you send or discard while recording', () => {
    const onSend = vi.fn();
    const onCancel = vi.fn();
    render(<VoiceNoteBar state="recording" elapsed={7400} levels={[0.2, 0.9]} status="" onCancel={onCancel} onSend={onSend} />);
    expect(screen.getByText('0:07')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /send voice note/i }));
    fireEvent.click(screen.getByRole('button', { name: /discard voice note/i }));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('locks both buttons while transcribing and shows what is happening', () => {
    render(<VoiceNoteBar state="transcribing" elapsed={0} levels={[]} status="Loading Whisper…" onCancel={() => {}} onSend={() => {}} />);
    expect(screen.getByText('Loading Whisper…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send voice note/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /discard voice note/i })).toBeDisabled();
  });
});
