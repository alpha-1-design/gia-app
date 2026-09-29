import { describe, it, expect } from 'vitest';
import { extractVersions, extractHeadings, judgeSite } from '../siteCheck';

describe('extractVersions', () => {
  it('finds 4-part versions once each, in order', () => {
    expect(extractVersions('GIA v2.4.0.14 … also 2.4.0.12 and v2.4.0.14 again')).toEqual(['2.4.0.14', '2.4.0.12']);
  });
  it('ignores 3-part numbers and dates', () => {
    expect(extractVersions('Node 20.11.1, released 2026.09.28')).toEqual([]);
  });
});

describe('extractHeadings', () => {
  it('collects markdown headings without duplicates', () => {
    const md = '# GIA\ntext\n## Features\n### Terminal\n## Features\n';
    expect(extractHeadings(md)).toEqual(['GIA', 'Features', 'Terminal']);
  });
});

describe('judgeSite', () => {
  it('is current when the site shows the latest release', () => {
    expect(judgeSite('2.4.0.14', ['2.4.0.14'], '2.4.0.14').status).toBe('current');
  });
  it('is stale when the site is behind the latest release', () => {
    const v = judgeSite('2.4.0.14', ['2.4.0.12'], '2.4.0.14');
    expect(v.status).toBe('stale');
    expect(v.summary).toContain('2.4.0.12');
    expect(v.summary).toContain('2.4.0.14');
  });
  it('falls back to the app build when GitHub is unreachable', () => {
    expect(judgeSite('2.4.0.14', ['2.4.0.14'], null).status).toBe('current');
    // Deliberately NOT the current app version above — this must stay a
    // different string, or bumping the version in this file on every
    // release makes both assertions identical and silently untestable.
    expect(judgeSite('2.4.0.14', ['1.0.0.0'], null).status).toBe('stale');
  });
  it('reports unknown when the site shows no version', () => {
    expect(judgeSite('2.4.0.14', [], '2.4.0.14').status).toBe('unknown');
  });
});
