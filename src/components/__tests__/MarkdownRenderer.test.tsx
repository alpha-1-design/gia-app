import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MarkdownRenderer from '../MarkdownRenderer';

describe('MarkdownRenderer — tables', () => {
  it('parses bold syntax inside table headers and cells instead of showing literal asterisks', () => {
    const content = [
      '| Component | Status |',
      '| --- | --- |',
      '| **Battery** | 77% — healthy |',
      '| **Network** | Online via **4G** |',
    ].join('\n');

    const { container } = render(<MarkdownRenderer content={content} />);

    // The literal markdown markers should be gone...
    expect(container.textContent).not.toContain('**Battery**');
    expect(container.textContent).not.toContain('**Network**');
    expect(container.textContent).not.toContain('**4G**');

    // ...and actually rendered as <strong> elements.
    const strongTexts = Array.from(container.querySelectorAll('strong')).map(el => el.textContent);
    expect(strongTexts).toContain('Battery');
    expect(strongTexts).toContain('Network');
    expect(strongTexts).toContain('4G');
  });

  it('still renders plain table cells without emphasis correctly', () => {
    const content = [
      '| A | B |',
      '| --- | --- |',
      '| one | two |',
    ].join('\n');
    const { container } = render(<MarkdownRenderer content={content} />);
    expect(container.textContent).toContain('one');
    expect(container.textContent).toContain('two');
  });
});
