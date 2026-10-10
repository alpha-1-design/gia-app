import { createHighlighterCore, type HighlighterCore, type LanguageInput, type ThemeInput } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

let corePromise: Promise<HighlighterCore> | null = null;

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  md: 'markdown',
  mdx: 'markdown',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  bashrc: 'bash',
  cpp: 'cpp',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  rs: 'rust',
  svg: 'xml',
  xml: 'xml',
  plain: 'plaintext',
  text: 'plaintext',
  txt: 'plaintext',
  log: 'plaintext',
  yml: 'yaml',
  diff: 'diff',
};

const LANGUAGES: Record<string, () => Promise<{ default: unknown }>> = {
  javascript: () => import('@shikijs/langs/javascript'),
  jsx: () => import('@shikijs/langs/jsx'),
  typescript: () => import('@shikijs/langs/typescript'),
  tsx: () => import('@shikijs/langs/tsx'),
  python: () => import('@shikijs/langs/python'),
  html: () => import('@shikijs/langs/html'),
  css: () => import('@shikijs/langs/css'),
  scss: () => import('@shikijs/langs/scss'),
  json: () => import('@shikijs/langs/json'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  markdown: () => import('@shikijs/langs/markdown'),
  bash: () => import('@shikijs/langs/bash'),
  yaml: () => import('@shikijs/langs/yaml'),
  sql: () => import('@shikijs/langs/sql'),
  go: () => import('@shikijs/langs/go'),
  rust: () => import('@shikijs/langs/rust'),
  java: () => import('@shikijs/langs/java'),
  cpp: () => import('@shikijs/langs/cpp'),
  c: () => import('@shikijs/langs/c'),
  csharp: () => import('@shikijs/langs/csharp'),
  ruby: () => import('@shikijs/langs/ruby'),
  php: () => import('@shikijs/langs/php'),
  swift: () => import('@shikijs/langs/swift'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  dart: () => import('@shikijs/langs/dart'),
  lua: () => import('@shikijs/langs/lua'),
  diff: () => import('@shikijs/langs/diff'),
  xml: () => import('@shikijs/langs/xml'),
};

const THEMES: Record<string, () => Promise<{ default: unknown }>> = {
  'github-dark': () => import('@shikijs/themes/github-dark'),
  'github-light': () => import('@shikijs/themes/github-light'),
};

function resolveLanguageName(lang?: string): string | null {
  const clean = (lang || '').trim().toLowerCase();
  if (!clean) return 'plaintext';
  const resolved = LANGUAGE_ALIASES[clean] || clean;
  if (resolved === 'plaintext') return 'plaintext';
  return LANGUAGES[resolved] ? resolved : null;
}

const loadedLanguages = new Set<string>();
const loadedThemes = new Set<string>();

function getCore(): Promise<HighlighterCore> {
  if (!corePromise) {
    corePromise = createHighlighterCore({
      themes: [],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return corePromise;
}

export function shikiThemeForDocument(): 'github-dark' | 'github-light' {
  if (typeof document === 'undefined') return 'github-dark';
  const theme = document.documentElement.dataset.theme || 'dark';
  return theme === 'light' ? 'github-light' : 'github-dark';
}

export function supportedShikiTheme(theme?: string): 'github-dark' | 'github-light' {
  return theme === 'github-light' ? 'github-light' : 'github-dark';
}

async function ensureLanguage(core: HighlighterCore, name: string): Promise<void> {
  if (loadedLanguages.has(name)) return;
  if (name === 'plaintext') {
    loadedLanguages.add(name);
    return;
  }
  const loader = LANGUAGES[name];
  if (!loader) return;
  const mod = await loader();
  if ('default' in (mod as { default?: unknown })) {
    await core.loadLanguage((mod as { default: LanguageInput }).default);
    loadedLanguages.add(name);
  }
}

async function ensureTheme(core: HighlighterCore, name: string): Promise<void> {
  if (loadedThemes.has(name)) return;
  const loader = THEMES[name];
  if (!loader) return;
  const mod = await loader();
  if ('default' in (mod as { default?: unknown })) {
    await core.loadTheme((mod as { default: ThemeInput }).default);
    loadedThemes.add(name);
  }
}

export async function shikiHighlightToHtml(code: string, lang?: string, theme?: string): Promise<string | null> {
  const language = resolveLanguageName(lang);
  if (!language) return null;
  const resolvedTheme = supportedShikiTheme(theme);
  try {
    const core = await getCore();
    await Promise.all([ensureLanguage(core, language), ensureTheme(core, resolvedTheme)]);
    return core.codeToHtml(code, { lang: language, theme: resolvedTheme });
  } catch {
    return null;
  }
}

const htmlCache = new Map<string, string>();

export function cachedShikiHtml(code: string, lang?: string, theme?: string): string | null {
  const key = `${theme ?? shikiThemeForDocument()}|${lang ?? ''}|${code}`;
  return htmlCache.get(key) ?? null;
}

export function storeShikiHtml(code: string, lang: string | undefined, theme: string, html: string): void {
  const key = `${theme}|${lang ?? ''}|${code}`;
  htmlCache.set(key, html);
  if (htmlCache.size > 60) {
    const oldest = htmlCache.keys().next().value;
    if (oldest !== undefined) htmlCache.delete(oldest);
  }
}