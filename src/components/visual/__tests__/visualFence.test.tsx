/**
 * Screenshot 2 in the bug report showed a raw ```visual fence with the mind map
 * JSON printed as literal text in the message body. A properly line-anchored
 * fence should render the visual component instead.
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import MarkdownRenderer from '../../MarkdownRenderer';

const PAYLOAD = JSON.stringify({
  type: 'mindmap',
  data: { root: { name: 'GIA App Interactions', children: [{ name: 'Phone Calls' }] } },
});

afterEach(cleanup);

describe('MarkdownRenderer visual fences', () => {
  it('renders a line-anchored ```visual fence as a visual, not raw text', () => {
    const content = `Here is the map.\n\n\`\`\`visual\n${PAYLOAD}\n\`\`\`\n`;
    const { container } = render(<MarkdownRenderer content={content} isStreaming={false} />);

    // The card chrome proves the visual rendered.
    expect(container.textContent).toContain('Mind Map');
    // And the raw JSON must not appear anywhere in the output.
    expect(container.textContent).not.toContain('"type":"mindmap"');
    expect(container.textContent).not.toContain('```visual');
  });

  it('renders a bare visual JSON object with no fence (wrapBareVisualBlocks path)', () => {
    const content = `Some text.\n\n${PAYLOAD}`;
    const { container } = render(<MarkdownRenderer content={content} isStreaming={false} />);
    expect(container.textContent).toContain('Mind Map');
    expect(container.textContent).not.toContain('"type":"mindmap"');
  });

  it('shows a loading state while a visual block is still streaming', () => {
    const content = `\`\`\`visual\n${PAYLOAD}`;
    const { container } = render(<MarkdownRenderer content={content} isStreaming={true} />);
    // Partially-arrived visual: loading state, never the raw payload.
    expect(container.textContent).not.toContain('"type":"mindmap"');
  });
});
