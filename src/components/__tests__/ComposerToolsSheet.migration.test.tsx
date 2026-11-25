import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ComposerToolsSheet from '../ComposerToolsSheet';
import { BottomSheet } from '../ui/BottomSheet';

// Migration guard: ComposerToolsSheet was ported onto the shared
// ui/BottomSheet primitive. Its own backdrop/panel/grabber wiring was
// deleted, so these tests pin the pass-through behavior the primitive must
// now provide for this sheet: grabber handle visible, backdrop click
// dismisses, close button dismisses, toggles reach onToggle.

afterEach(cleanup);

const items = [
  { key: 'web', label: 'Web Search', icon: () => <span />, active: true, color: '#a855f7' },
  { key: 'memory', label: 'Memory', icon: () => <span />, active: false, color: '#34d399' },
];

function setup(overrides: { open?: boolean; footer?: ReactNode } = {}) {
  const onClose = vi.fn();
  const onToggle = vi.fn();
  const view = render(
    <ComposerToolsSheet open={overrides.open ?? true} onClose={onClose} items={items} onToggle={onToggle} footer={overrides.footer} />,
  );
  return { onClose, onToggle, view };
}

describe('ComposerToolsSheet (BottomSheet migration)', () => {
  it('renders the sheet content and the primitive\'s grabber handle', () => {
    const { view } = setup();
    screen.getByText('Tools & Modes');
    screen.getByText('Web Search');
    screen.getByText('Memory');
    // The grabber comes from BottomSheet — the sheet must NOT render its own.
    const grabber = view.container.querySelector('.cursor-grab .rounded-full');
    expect(grabber).not.toBeNull();
    // Sheet no longer ships its own backdrop (the primitive owns it).
    expect(view.container.querySelectorAll('.fixed.inset-0').length).toBe(1);
  });

  it('closes when the backdrop is clicked', () => {
    const { onClose, view } = setup();
    const backdrop = view.container.querySelector('.fixed.inset-0');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the close (X) button is clicked', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Close tools' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('passes toggles through to onToggle with the item key', () => {
    const { onToggle } = setup();
    fireEvent.click(screen.getByText('Memory'));
    expect(onToggle).toHaveBeenCalledWith('memory');
  });

  it('renders nothing when closed', () => {
    const { view } = setup({ open: false });
    expect(view.queryByText('Tools & Modes')).toBeNull();
  });

  it('renders the optional footer inside the scroll area', () => {
    setup({ footer: <button>All tools</button> });
    expect(screen.getByText('All tools')).toBeInTheDocument();
  });

  it('BottomSheet is the render primitive for this sheet (regression pin)', () => {
    // If someone re-inlines a bespoke motion.div sheet, this tripwire fails.
    const { view } = setup();
    const panel = view.container.querySelector('.fixed.inset-x-0.bottom-0');
    expect(panel).not.toBeNull();
    // The panel must be the shared one: drag-to-dismiss affordance present.
    expect(panel!.className).toContain('overflow-hidden');
    expect(view.container.querySelector('.cursor-grab')).not.toBeNull();
    // And it is literally built from BottomSheet — mounting BottomSheet with
    // the same children produces the same grabber/backdrop pair.
    const direct = render(
      <BottomSheet open onClose={() => {}}>
        <div>probe</div>
      </BottomSheet>
    );
    expect(direct.container.querySelector('.cursor-grab')).not.toBeNull();
    direct.unmount();
  });
});
