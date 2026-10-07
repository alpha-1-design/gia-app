import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CredentialVaultSection } from '../CredentialVaultSection';
import { useCredentialStore } from '../../../store/useCredentialStore';

afterEach(() => {
  cleanup();
  useCredentialStore.setState({ credentials: {} });
});

describe('CredentialVaultSection', () => {
  it('renders without an infinite re-render loop when empty', () => {
    render(<CredentialVaultSection />);
    expect(screen.getByText(/No service credentials saved yet/i)).toBeDefined();
  });

  it('lists saved credentials without looping', () => {
    useCredentialStore.setState({
      credentials: {
        openweather: {
          serviceId: 'openweather',
          label: 'OpenWeather',
          kind: 'api_key',
          value: 'secret',
          updatedAt: Date.now(),
        },
      },
    });
    render(<CredentialVaultSection />);
    expect(screen.getByText('OpenWeather')).toBeDefined();
  });
});
