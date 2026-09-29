/**
 * check_website — lets GIA look at her own public website (and the latest
 * GitHub release) and report whether they are current.
 *
 * Every stage narrates itself through ctx.onThought / ctx.onProgress, so the
 * work log shows GIA checking the site step by step instead of a silent pause.
 */
import type { Tool, ToolContext } from './types';
import pkg from '../../../package.json';

export const SITE_URL = 'https://alpha-1-design.github.io/gia-app/';
const RELEASE_API = 'https://api.github.com/repos/alpha-1-design/gia-app/releases/latest';

const VERSION_RE = /\bv?(\d+\.\d+\.\d+\.\d+)\b/g;

/** Every 4-part version string mentioned in a block of text, de-duplicated in order of appearance. */
export function extractVersions(text: string): string[] {
  const seen: string[] = [];
  for (const m of text.matchAll(VERSION_RE)) if (!seen.includes(m[1])) seen.push(m[1]);
  return seen;
}

/** Markdown-style headings (# … ####) found in scraped page content. */
export function extractHeadings(markdown: string, limit = 40): string[] {
  const out: string[] = [];
  for (const line of markdown.split('\n')) {
    const m = line.match(/^#{1,4}\s+(.+?)\s*$/);
    if (m && !out.includes(m[1])) out.push(m[1]);
    if (out.length >= limit) break;
  }
  return out;
}

export interface SiteVerdict {
  status: 'current' | 'stale' | 'unknown';
  summary: string;
}

/** Compare what the site advertises against the app build and the latest release. */
export function judgeSite(appVersion: string, siteVersions: string[], latestRelease: string | null): SiteVerdict {
  if (siteVersions.length === 0) {
    return { status: 'unknown', summary: 'The site does not mention a version number.' };
  }
  const advertised = siteVersions[0];
  const target = latestRelease ?? appVersion;
  if (siteVersions.includes(target)) {
    return { status: 'current', summary: `The site mentions v${target}, which matches the ${latestRelease ? 'latest release' : 'app build'}.` };
  }
  return { status: 'stale', summary: `The site advertises v${advertised} but the ${latestRelease ? 'latest release' : 'app build'} is v${target}.` };
}

const siteCheckTool: Tool = {
  id: 'check_website', name: 'check_website',
  description: "Check GIA's own public website (alpha-1-design.github.io/gia-app). Loads the live page, lists its sections, and compares the version it shows against this app build and the latest GitHub release, so you can tell the user whether the site is up to date and what is missing. Use when asked about the website, landing page, or whether the site reflects the latest features.",
  schema: {
    type: 'object',
    properties: {
      maxChars: { type: 'number', description: 'Max characters of page content to return (default 12000)' },
    },
  },
  execute: async ({ maxChars }, ctx?: ToolContext) => {
    const limit = (maxChars as number) || 12000;
    try {
      ctx?.onProgress?.(0.1, 'Opening GIA website');
      ctx?.onThought?.('🌐 Opening the GIA website…');
      const { default: fallback } = await import('../FallbackWebSearch');
      const page = await fallback.scrape(SITE_URL, 60000);
      ctx?.onProgress?.(0.5, 'Reading sections');
      const headings = extractHeadings(page.content);
      ctx?.onThought?.(`📄 Loaded "${page.title || 'GIA'}" — ${page.content.length.toLocaleString()} chars, ${headings.length} headings`);

      ctx?.onProgress?.(0.7, 'Checking latest release');
      ctx?.onThought?.('🔎 Comparing with the latest GitHub release…');
      let latest: string | null = null;
      try {
        const res = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
        if (res.ok) {
          const json = (await res.json()) as { tag_name?: string };
          latest = json.tag_name ? json.tag_name.replace(/^v/, '') : null;
        }
      } catch {
        ctx?.onThought?.('⚠️ Could not reach GitHub — comparing against this app build instead');
      }

      const appVersion = pkg.version;
      const versions = extractVersions(page.content);
      const verdict = judgeSite(appVersion, versions, latest);
      ctx?.onThought?.(verdict.status === 'current' ? `✅ ${verdict.summary}` : `⚠️ ${verdict.summary}`);
      ctx?.onProgress?.(1, 'Done');

      const body = [
        `# GIA website check`,
        `**URL:** ${SITE_URL}`,
        `**This app build:** v${appVersion}`,
        `**Latest GitHub release:** ${latest ? `v${latest}` : 'unavailable'}`,
        `**Versions shown on the site:** ${versions.length ? versions.map(v => `v${v}`).join(', ') : 'none found'}`,
        `**Verdict:** ${verdict.status.toUpperCase()} — ${verdict.summary}`,
        ``,
        `## Sections on the site`,
        headings.length ? headings.map(h => `- ${h}`).join('\n') : '- (none detected)',
        ``,
        `## Page content (truncated)`,
        page.content.slice(0, limit),
      ].join('\n');
      return { success: true, content: body, sources: [{ title: page.title || 'GIA website', url: SITE_URL }] };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Website check failed';
      ctx?.onThought?.(`❌ Couldn't load the website: ${msg}`);
      return { success: false, content: '', error: `Couldn't load ${SITE_URL}: ${msg}` };
    }
  },
};

export const siteCheckTools: Tool[] = [siteCheckTool];
