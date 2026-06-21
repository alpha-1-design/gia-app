#!/usr/bin/env node
/**
 * GIA Web Browser Agent — navigate, fill forms, click, screenshot, extract.
 * Uses Playwright with system Chromium.
 * Input: JSON as command-line argument or stdin {action, url, selector, value, query, options}
 * Actions: navigate, extract, fill, click, screenshot, search, get_text, get_html, scroll
 */
const { chromium } = require('playwright');

const CHROMIUM_PATH = '/usr/bin/chromium-browser';

const ACTIONS = {
  navigate: async (page, args) => {
    await page.goto(args.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(args.options?.wait ?? 1000);
    return {
      url: page.url(),
      title: await page.title(),
      content: await page.evaluate(() => document.body.innerText.slice(0, 10000)),
    };
  },

  extract: async (page, args) => {
    const sel = args.selector;
    const timeout = args.options?.timeout ?? 5000;
    if (!sel) {
      return { text: await page.evaluate(() => document.body.innerText.slice(0, 20000)) };
    }
    try {
      await page.waitForSelector(sel, { timeout });
      const text = await page.$eval(sel, el => el.textContent);
      const html = await page.$eval(sel, el => el.outerHTML);
      return { text: text?.trim(), html };
    } catch {
      return { error: `Selector '${sel}' not found` };
    }
  },

  fill: async (page, args) => {
    const { selector, value } = args;
    const timeout = args.options?.timeout ?? 5000;
    try {
      await page.waitForSelector(selector, { timeout });
      await page.click(selector);
      await page.fill(selector, '');
      await page.fill(selector, value);
      return { success: true, filled: selector };
    } catch (e) {
      return { error: `Failed to fill '${selector}': ${e.message}` };
    }
  },

  click: async (page, args) => {
    const { selector } = args;
    const timeout = args.options?.timeout ?? 5000;
    try {
      await page.waitForSelector(selector, { timeout });
      await page.click(selector);
      await page.waitForTimeout(args.options?.wait ?? 1000);
      return { success: true, clicked: selector, url: page.url(), title: await page.title() };
    } catch (e) {
      return { error: `Failed to click '${selector}': ${e.message}` };
    }
  },

  screenshot: async (page, args) => {
    const buf = await page.screenshot({ type: 'png', fullPage: args.options?.fullPage ?? false });
    return { screenshot: buf.toString('base64'), format: 'png', size: buf.length };
  },

  get_html: async (page, args) => {
    if (args.selector) {
      const htmls = await page.$$eval(args.selector, els => els.map(el => el.outerHTML));
      return { html: htmls };
    }
    return { html: await page.content() };
  },

  get_text: async (page) => {
    return { text: await page.evaluate(() => document.body.innerText.slice(0, 20000)) };
  },

  scroll: async (page, args) => {
    const dir = args.direction ?? 'down';
    const amt = args.amount ?? 500;
    switch (dir) {
      case 'down': await page.evaluate(y => window.scrollBy(0, y), amt); break;
      case 'up': await page.evaluate(y => window.scrollBy(0, -y), amt); break;
      case 'bottom': await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); break;
      case 'top': await page.evaluate(() => window.scrollTo(0, 0)); break;
    }
    return { scrolled: dir, pixels: amt };
  },
};

async function main() {
  const raw = process.argv[2] || await new Promise(r => {
    let d = '';
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => r(d));
  });

  let args;
  try { args = JSON.parse(raw); } catch { args = { action: 'navigate', url: raw }; }

  const action = args.action || 'navigate';
  const handler = ACTIONS[action];
  if (!handler) throw new Error(`Unknown action: ${action}. Valid: ${Object.keys(ACTIONS).join(', ')}`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 GIA/1.0',
  });
  const page = await context.newPage();

  try {
    if (args.url && !['search'].includes(action)) {
      await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    const result = await handler(page, args);
    result.success = true;
    result.action = action;
    result.url = page.url();
    result.title = await page.title();
    console.log(JSON.stringify(result));
  } catch (e) {
    console.log(JSON.stringify({ success: false, error: e.message, action }));
  } finally {
    await browser.close();
  }
}

main();
