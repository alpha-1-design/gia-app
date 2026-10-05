import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import FloatingDownload from '../FloatingDownload';
import { useDownloadStore } from '../../store/useDownloadStore';
import { useGiaStore } from '../../store/useGiaStore';

describe('FloatingDownload', () => {
  beforeEach(() => {
    useDownloadStore.setState({ tasks: {} });
    useGiaStore.setState({ currentModule: 'chat' });
  });
  afterEach(cleanup);

  it('shows nothing when nothing is downloading', () => {
    const { container } = render(<FloatingDownload />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the live percentage away from Settings', () => {
    render(<FloatingDownload />);
    act(() => { useDownloadStore.getState().report('m', 'Qwen 0.5B', 'w', { loaded: 650, total: 1000 }); });
    expect(screen.getByRole('status')).toHaveAccessibleName(/Qwen 0\.5B downloading, 65 percent/);
  });

  it('hides while the Settings screen already shows progress, and returns after', () => {
    useGiaStore.setState({ currentModule: 'settings' });
    render(<FloatingDownload />);
    act(() => { useDownloadStore.getState().report('m', 'Qwen', 'w', { loaded: 1, total: 2 }); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => { useGiaStore.setState({ currentModule: "chat" }); });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('says it is ready when the download finishes', () => {
    render(<FloatingDownload />);
    act(() => {
      useDownloadStore.getState().report('m', 'Qwen', 'w', { loaded: 1, total: 2 });
      useDownloadStore.getState().finish('m');
    });
    expect(screen.getByRole('status')).toHaveAccessibleName(/Qwen is ready/);
  });
});
