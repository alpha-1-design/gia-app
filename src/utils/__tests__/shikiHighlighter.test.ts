import { describe, it, expect, afterAll } from 'vitest';
import { shikiHighlightToHtml, shikiThemeForDocument, supportedShikiTheme, cachedShikiHtml, storeShikiHtml } from '../shikiHighlighter';

describe('shikiHighlighter', () => {
  it('highlights a known language to shiki html with inline token spans', async () => {
    const html = await shikiHighlightToHtml('const x = 1', 'ts', 'github-dark');
    expect(html).not.toBeNull();
    expect(html).toContain('<pre');
    expect(html).toContain('shiki');
    expect(html).toContain('<span');
  });

  it('resolves language aliases (sh -> bash, log -> plaintext)', async () => {
    const bash = await shikiHighlightToHtml('echo hi', 'sh', 'github-dark');
    expect(bash).not.toBeNull();
    const plain = await shikiHighlightToHtml('just some log line', 'log', 'github-dark');
    expect(plain).not.toBeNull();
    expect(plain).toContain('just some log line');
  });

  it('returns null for unknown languages (caller falls back to plain/regex)', async () => {
    expect(await shikiHighlightToHtml('x', 'mermaid', 'github-dark')).toBeNull();
    expect(await shikiHighlightToHtml('x', 'nope-not-a-lang', 'github-dark')).toBeNull();
  });

  it('maps the document theme to a shiki theme', () => {
    document.documentElement.dataset.theme = 'light';
    expect(shikiThemeForDocument()).toBe('github-light');
    document.documentElement.dataset.theme = 'obsidian-aurora';
    expect(shikiThemeForDocument()).toBe('github-dark');
    expect(supportedShikiTheme('github-light')).toBe('github-light');
    expect(supportedShikiTheme('anything-else')).toBe('github-dark');
  });

  it('caches and reads html by (theme, lang, code)', () => {
    const html = '<pre class="shiki">x</pre>';
    storeShikiHtml('const a = 1', 'ts', 'github-dark', html);
    expect(cachedShikiHtml('const a = 1', 'ts', 'github-dark')).toBe(html);
    expect(cachedShikiHtml('const a = 1', 'ts', 'github-light')).toBeNull();
  });

  afterAll(() => {
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = 'dark';
  });
});