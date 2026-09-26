/**
 * Regression tests for the mind map card.
 *
 * The card previously drew the root at x=0, so the left half of the root node
 * and its label were clipped off the left edge of the container. On a phone the
 * result looked like an empty box with a fragment of text in it, and the map
 * was wider than the viewport with no way to reach the right-hand branches.
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MindMapVisual } from '../MindMapVisual';

// The exact shape the agent produced in the bug report: root + 7 branches,
// several of which have their own children.
const REPORT_PAYLOAD = {
  name: 'GIA App Interactions',
  children: [
    { name: 'Open Apps/Websites', color: '#3b82f6', children: [{ name: 'Deep Links', color: '#93c5fd' }] },
    {
      name: 'Messaging & Communication',
      children: [
        { name: 'Send SMS', color: '#22c55e' },
        { name: 'Send WhatsApp', color: '#86efac' },
        { name: 'Send Email', color: '#f59e0b' },
        { name: 'Telegram Posts', color: '#fcd34d' },
      ],
    },
    { name: 'Phone Calls', color: '#ef4444' },
    {
      name: 'Device Control',
      children: [
        { name: 'Set Alarms', color: '#a855f7' },
        { name: 'Smart Devices (TVs, Lights)', color: '#d8b4fe' },
      ],
    },
    { name: 'Content & Social', children: [{ name: 'Social Media Posts', color: '#60a5fa' }] },
  ],
};

afterEach(cleanup);

describe('MindMapVisual', () => {
  it('renders the root label (it used to be clipped off the left edge)', () => {
    const { container } = render(<MindMapVisual data={{ root: REPORT_PAYLOAD }} />);
    // The root was previously drawn at x=0, so its left half was clipped by
    // the container. Assert on the full name via the <title> tooltip, which
    // carries the untruncated label.
    const titles = Array.from(container.querySelectorAll('svg title')).map(t => t.textContent);
    expect(titles).toContain('GIA App Interactions');
  });

  it('renders every leaf, including deeply nested ones', () => {
    const { container } = render(<MindMapVisual data={{ root: REPORT_PAYLOAD }} />);
    const titles = Array.from(container.querySelectorAll('svg title')).map(t => t.textContent);
    for (const label of [
      'Open Apps/Websites',
      'Deep Links',
      'Messaging & Communication',
      'Send SMS',
      'Send WhatsApp',
      'Send Email',
      'Telegram Posts',
      'Phone Calls',
      'Device Control',
      'Set Alarms',
      'Smart Devices (TVs, Lights)',
      'Content & Social',
      'Social Media Posts',
    ]) {
      expect(titles).toContain(label);
    }
  });

  it('gives the container a bounded height and both-axis scrolling', () => {
    const { container } = render(<MindMapVisual data={{ root: REPORT_PAYLOAD }} />);
    const scroller = container.querySelector('div.overflow-auto') as HTMLElement;
    expect(scroller).toBeTruthy();
    // A capped max-height is what lets the chat scroll past the card at all;
    // without it the map pushed everything below it off-screen.
    expect(scroller.style.maxHeight).toBeTruthy();
    expect(scroller.className).toContain('overscroll-contain');
  });

  it('collapses to a compact summary row and expands again', () => {
    render(<MindMapVisual data={{ root: REPORT_PAYLOAD }} />);

    // Collapse via the header toggle.
    fireEvent.click(screen.getByLabelText('Collapse'));
    const summary = screen.getByLabelText('Expand mind map');
    expect(summary).toBeInTheDocument();

    // Collapsed means the canvas is gone, not a shorter empty box.
    expect(screen.queryByLabelText('Zoom in')).not.toBeInTheDocument();

    fireEvent.click(summary);
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
  });

  it('zooms in and out within bounds', () => {
    render(<MindMapVisual data={{ root: REPORT_PAYLOAD }} />);
    const zoomIn = screen.getByLabelText('Zoom in');
    const pct = () => screen.getByText(/^\d+%$/).textContent;

    const before = pct();
    fireEvent.click(zoomIn);
    expect(pct()).not.toBe(before);

    // Zooming out repeatedly must clamp, never go negative/NaN.
    const zoomOut = screen.getByLabelText('Zoom out');
    for (let i = 0; i < 30; i++) fireEvent.click(zoomOut);
    expect(pct()).toMatch(/^\d+%$/);
    const value = Number(pct()!.replace('%', ''));
    expect(value).toBeGreaterThanOrEqual(20);
  });

  it('handles a single root with no children', () => {
    const { container } = render(<MindMapVisual data={{ root: { name: 'Alone' } }} />);
    const titles = Array.from(container.querySelectorAll('svg title')).map(t => t.textContent);
    expect(titles).toContain('Alone');
  });

  it('handles flat nodes with no root wrapper', () => {
    const { container } = render(<MindMapVisual data={{ title: 'Flat', nodes: [{ name: 'A' }, { name: 'B' }] }} />);
    const titles = Array.from(container.querySelectorAll('svg title')).map(t => t.textContent);
    expect(titles).toContain('A');
    expect(titles).toContain('B');
  });  it('does not mis-wire connectors when sibling names repeat', () => {
    // The old layout matched child -> position by NAME via layout.find(), so
    // two nodes sharing a label collapsed onto the same coordinates.
    const { container } = render(
      <MindMapVisual
        data={{
          root: {
            name: 'Root',
            children: [
              { name: 'Open', children: [{ name: 'Duplicate' }] },
              { name: 'Close', children: [{ name: 'Duplicate' }] },
            ],
          },
        }}
      />,
    );

    // Two distinct "Duplicate" nodes must both be present, not merged into one.
    const titles = Array.from(container.querySelectorAll('svg title')).map(t => t.textContent);
    expect(titles.filter(t => t === 'Duplicate')).toHaveLength(2);
  });
});
