import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LegalGate from '../LegalGate';
import { useGiaStore } from '../../store/useGiaStore';
import { LEGAL_VERSION, needsLegalAcceptance } from '../../utils/legal';

describe('LegalGate', () => {
  beforeEach(() => {
    useGiaStore.setState({ legalAcceptedVersion: '' });
  });

  it('blocks first-time users until they accept', () => {
    render(<LegalGate />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const agree = screen.getByRole('button', { name: /agree and continue/i });
    expect(agree).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(agree).toBeEnabled();
    fireEvent.click(agree);
    expect(useGiaStore.getState().legalAcceptedVersion).toBe(LEGAL_VERSION);
  });

  it('renders nothing once the current version is accepted', () => {
    useGiaStore.setState({ legalAcceptedVersion: LEGAL_VERSION });
    const { container } = render(<LegalGate />);
    expect(container).toBeEmptyDOMElement();
  });

  it('asks again when the legal version changes', () => {
    expect(needsLegalAcceptance('1999-01')).toBe(true);
    expect(needsLegalAcceptance(LEGAL_VERSION)).toBe(false);
  });

  it('lets the user read both documents', () => {
    render(<LegalGate />);
    expect(screen.getByText(/what stays on your device/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /terms of service/i }));
    expect(screen.getByText(/AI can be wrong/i)).toBeInTheDocument();
  });

  it('declining shows a message and keeps the gate up', () => {
    render(<LegalGate />);
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));
    return screen.findByRole('alert').then(el => {
      expect(el).toHaveTextContent(/can.t run without accepting/i);
      expect(useGiaStore.getState().legalAcceptedVersion).toBe('');
    });
  });
});
