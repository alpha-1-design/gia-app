import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SettingsScrollControls from '../SettingsScrollControls';

describe('SettingsScrollControls', () => {
  it('offers top and bottom jumps for a long settings page', async () => {
    const scrollRef = React.createRef<HTMLDivElement>();
    const { container } = render(
      <>
        <div ref={scrollRef} data-testid="settings-scroll">
          <div>Long settings</div>
        </div>
        <SettingsScrollControls scrollRef={scrollRef} />
      </>,
    );
    const scrollContainer = container.querySelector('[data-testid="settings-scroll"]') as HTMLDivElement;
    Object.defineProperties(scrollContainer, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 1500 },
      scrollTo: { configurable: true, value: vi.fn() },
    });
    fireEvent.scroll(scrollContainer);

    const bottomButton = await screen.findByRole('button', { name: 'Scroll settings to bottom' });
    fireEvent.click(bottomButton);
    expect(scrollContainer.scrollTo).toHaveBeenCalledWith({ top: 1500, behavior: 'smooth' });

    Object.defineProperty(scrollContainer, 'scrollTop', { configurable: true, value: 700 });
    fireEvent.scroll(scrollContainer);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Scroll settings to top' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Scroll settings to bottom' })).toBeInTheDocument();

    Object.defineProperty(scrollContainer, 'scrollTop', { configurable: true, value: 1500 });
    fireEvent.scroll(scrollContainer);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Scroll settings to bottom' })).not.toBeInTheDocument());
  });
});
