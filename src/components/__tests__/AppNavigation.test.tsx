import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AppNavigation from '../AppNavigation';
import ProfileDrawer from '../ProfileDrawer';
import { useGiaStore } from '../../store/useGiaStore';

describe('App navigation drawer toggle', () => {
  beforeEach(() => {
    useGiaStore.setState({
      currentModule: 'chat',
      showLeftDrawer: false,
      connectionStatus: 'online',
      providerConnected: false,
      reduceMotion: true,
    });
  });

  it('shows a persistent menu button and toggles the module drawer', async () => {
    render(
      <>
        <AppNavigation />
        <ProfileDrawer />
      </>
    );

    const navigationButton = screen.getByRole('button', { name: 'Open navigation' });
    expect(navigationButton.querySelector('.lucide-menu')).not.toBeNull();
    expect(screen.getByText('GIA')).not.toBeNull();
    expect(screen.getByLabelText('Current module: Chat')).not.toBeNull();
    expect(document.querySelector('[title="No AI provider connected"]')).not.toBeNull();
    fireEvent.click(navigationButton);
    expect(useGiaStore.getState().showLeftDrawer).toBe(true);
    const closeButton = screen.getByRole('button', { name: 'Close navigation' });
    expect(closeButton).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('app-navigation-drawer')).not.toBeNull();
    await waitFor(() => expect(closeButton.querySelector('.lucide-x')).not.toBeNull());

    fireEvent.click(closeButton);
    expect(useGiaStore.getState().showLeftDrawer).toBe(false);
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Open navigation' }).querySelector('.lucide-menu')).not.toBeNull(),
      { timeout: 3000 },
    );
  }, 15000);
});
