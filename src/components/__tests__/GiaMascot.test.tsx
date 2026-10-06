import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GiaMascot from '../GiaMascot';

describe('GiaMascot', () => {
  it('provides an accessible description of the mascot', () => {
    render(<GiaMascot />);

    expect(screen.getByRole('img', { name: 'GIA mascot, a friendly robot sitting on a glowing orb' })).toBeInTheDocument();
  });
});
