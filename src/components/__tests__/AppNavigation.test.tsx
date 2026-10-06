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
    });
  });

  it('animates the GIA mark into a hamburger and toggles the module drawer', async () => {
    render(
      <>
        <AppNavigation />
        <ProfileDrawer />
      </>
    );

    const navigationButton = screen.getByRole('button', { name: 'Open navigation' });
    expect(navigationButton).toHaveTextContent('GIA');
    expect(document.querySelector('[title="No AI provider connected"]')).not.toBeNull();
    fireEvent.click(navigationButton);
    expect(useGiaStore.getState().showLeftDrawer).toBe(true);
    const closeButton = screen.getByRole('button', { name: 'Close navigation' });
    expect(closeButton).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('app-navigation-drawer')).not.toBeNull();
    await waitFor(() => expect(closeButton.querySelectorAll('svg line')).toHaveLength(3));

    fireEvent.click(closeButton);
    expect(useGiaStore.getState().showLeftDrawer).toBe(false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveTextContent('GIA'));
  });
});
