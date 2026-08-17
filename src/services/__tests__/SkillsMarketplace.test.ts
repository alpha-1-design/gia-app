import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SkillsMarketplace from '../SkillsMarketplace';

// SkillsMP's real API (https://skillsmp.com/docs/api) only exposes
// GET /api/v1/skills/search and requires a `q` param -- there's no bare
// browse-everything endpoint. The old code called a URL that endpoint
// doesn't support at all (wrong path, `sort=trending` isn't a real param),
// which silently returned zero results forever. This test locks in the
// fix: multiple real search queries, fetched and merged/deduped.
describe('SkillsMarketplace external registry fetch', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('queries the documented SkillsMP search endpoint (not the old broken /skills?sort=trending URL)', async () => {
    const calledUrls: string[] = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calledUrls.push(url);
      if (url.includes('skillsmp.com')) {
        return new Response(JSON.stringify({ skills: [] }), { status: 200 });
      }
      // Other registries (GitHub-based): return an empty array so they no-op.
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;

    await SkillsMarketplace.fetchSkills(true);

    const smpUrls = calledUrls.filter((u) => u.includes('skillsmp.com'));
    expect(smpUrls.length).toBeGreaterThan(0);
    for (const u of smpUrls) {
      expect(u).toContain('/api/v1/skills/search?q=');
      expect(u).not.toContain('sort=trending');
      // Must not hit the old, nonexistent bare-list path.
      expect(u).not.toMatch(/\/api\/v1\/skills\?/);
    }
  });

  it('merges and dedupes results from multiple SkillsMP queries', async () => {
    const dupeSkill = {
      slug: 'seo-writer',
      name: 'SEO Writer',
      description: 'Writes SEO copy',
      author: 'jane',
      version: '1.0.0',
      category: 'writing',
      tags: ['seo'],
      downloads: 10,
      rating: 5,
    };
    const otherSkill = { ...dupeSkill, slug: 'automator', name: 'Automator' };

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('skillsmp.com') && url.includes('q=automation')) {
        return new Response(JSON.stringify({ skills: [dupeSkill, otherSkill] }), { status: 200 });
      }
      if (url.includes('skillsmp.com')) {
        // Every other query returns the same dupeSkill again -- must be deduped.
        return new Response(JSON.stringify({ skills: [dupeSkill] }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;

    const skills = await SkillsMarketplace.fetchSkills(true);
    const smpResults = skills.filter((s) => s.source === 'skillsmp');

    const ids = smpResults.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect(ids).toContain('smp-seo-writer');
    expect(ids).toContain('smp-automator');
  });

  it('one failing SkillsMP query does not block the others', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('skillsmp.com') && url.includes('q=automation')) {
        return new Response('', { status: 500 });
      }
      if (url.includes('skillsmp.com') && url.includes('q=coding')) {
        return new Response(
          JSON.stringify({ skills: [{ slug: 'ok', name: 'OK Skill', description: 'd', author: 'a', version: '1.0.0', category: 'general', tags: [], downloads: 0, rating: 0 }] }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ skills: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const skills = await SkillsMarketplace.fetchSkills(true);
    expect(skills.some((s) => s.id === 'smp-ok')).toBe(true);
  });
});
