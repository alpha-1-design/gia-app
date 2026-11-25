import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ToastStack from '../ToastStack';
import type { Toast } from '../ToastStack';

// Regression guards for the rebuilt toast rows: they used a CSS class
// (animate-slide-in-right) that never existed, and had no exit animation at
// all — toasts just vanished. Rows are now motion.divs inside an
// AnimatePresence keyed by id.

afterEach(cleanup);

const baseToast: Toast = {
  id: 't1',
  type: 'success',
  title: 'Saved',
  message: 'Your workspace was saved',
  duration: 0, // disable the auto-dismiss timer for deterministic tests
};

const errorToast: Toast = {
  id: 't2',
  type: 'error',
  title: 'Disk full',
  message: 'Not enough space',
  duration: 0,
};

function setup(toasts: Toast[], onDismiss = vi.fn()) {
  return render(<ToastStack toasts={toasts} onDismiss={onDismiss} />);
}

describe('ToastStack', () => {
  it('renders each toast with its title, message and role="alert"', () => {
    setup([baseToast, errorToast]);
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Your workspace was saved')).toBeInTheDocument();
    expect(screen.getByText('Disk full')).toBeInTheDocument();
    expect(screen.getAllByRole('alert').length).toBe(2);
  });

  it('invokes onDismiss with the toast id when the close button is pressed', () => {
    const onDismiss = vi.fn();
    setup([baseToast], onDismiss);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith('t1');
  });

  it('auto-dismisses after the toast duration elapses', async () => {
    const onDismiss = vi.fn();
    render(<ToastStack toasts={[{ ...baseToast, id: 't3', duration: 50 }]} onDismiss={onDismiss} />);
    await waitFor(() => expect(onDismiss).toHaveBeenCalledWith('t3'), { timeout: 1500 });
  });

  it('keeps a removed toast mounted for its exit animation, then unmounts it', async () => {
    const onDismiss = vi.fn();
    const { rerender, queryByText } = setup([baseToast, errorToast], onDismiss);
    expect(screen.getByText('Disk full')).toBeInTheDocument();

    rerender(<ToastStack toasts={[baseToast]} onDismiss={onDismiss} />);

    // The removed row must still be in the DOM immediately after the list
    // change — AnimatePresence defers the unmount so the slide-out plays
    // (previously the row popped out with no exit at all).
    expect(queryByText('Disk full')).not.toBeNull();

    // Once the exit animation completes the row is gone.
    await waitFor(() => expect(queryByText('Disk full')).toBeNull(), { timeout: 3000 });
    // The surviving toast stays.
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });
});
