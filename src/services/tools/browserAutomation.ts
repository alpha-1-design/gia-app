import { z } from 'zod';
import type { Tool, ToolContext } from './types';
import ToolRegistry from '../ToolRegistry';

function formatZodError(issues: z.ZodIssue[]): string {
  return issues.map(i => {
    const path = i.path.length > 0 ? `"${i.path.join('.')}"` : 'value';
    if (i.code === 'invalid_type') {
      const info = i as unknown as { expected: string; received: string };
      return `${path}: expected ${info.expected}, got ${info.received === 'undefined' ? 'nothing' : info.received}`;
    }
    return i.message;
  }).join('; ');
}

const browserClickTool: Tool = {
  id: 'browser_click',
  name: 'browser_click',
  description: 'Click an element on a web page by CSS selector. Requires a server-side Playwright browser. Use after browser_navigate to interact with the loaded page.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL of the page (will navigate if different from current)' },
      selector: { type: 'string', description: 'CSS selector for the element to click (e.g. "button.submit", "#login", "a[href=/dashboard]")' },
      waitMs: { type: 'number', description: 'Milliseconds to wait after click (default: 1000)' },
    },
    required: ['url', 'selector'],
  },
  execute: async (args, ctx?: ToolContext) => {
    const schema = z.object({
      url: z.string().url(),
      selector: z.string().min(1).max(500),
      waitMs: z.number().min(0).max(30000).default(1000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    const { url, selector, waitMs } = parsed.data;
    ctx?.onProgress?.(0.1, 'Clicking element...');
    ctx?.onThought?.(`🖱️ Clicking "${selector}" on ${new URL(url).hostname}...`);

    try {
      const serverUrl = localStorage.getItem('gia-playwright-server') || 'http://localhost:3091';
      const res = await fetch(`${serverUrl}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'click',
          url,
          selector,
          options: { wait: waitMs },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const result = await res.json();
      ctx?.onProgress?.(1, 'Done');
      ctx?.onThought?.('✅ Click successful');
      return {
        success: true,
        content: `Clicked "${selector}"\n**URL:** ${result.url || url}\n**Title:** ${result.title || '(unknown)'}${result.text ? `\n\n${result.text.slice(0, 3000)}` : ''}`,
      };
    } catch (e) {
      // Fallback: try sandbox server
      try {
        const { default: SandboxService } = await import('../SandboxService');
        const available = await SandboxService.ensureAvailable();
        if (available) {
          const safeSelector = selector.replace(/'/g, "\u0027");
          const script = `node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('${url}', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.click('${safeSelector}');
  await page.waitForTimeout(${waitMs});
  const text = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  const title = await page.title();
  console.log(JSON.stringify({ success: true, text, title, url: page.url() }));
  await browser.close();
})();
"`;
          const result = await SandboxService.exec(script, { timeout: 30000 });
          if (result.stdout) {
            const data = JSON.parse(result.stdout);
            ctx?.onProgress?.(1, 'Done');
            ctx?.onThought?.('✅ Click successful via sandbox');
            return {
              success: true,
              content: `Clicked "${selector}"\n**URL:** ${data.url || url}\n**Title:** ${data.title || ''}${data.text ? `\n\n${data.text.slice(0, 3000)}` : ''}`,
            };
          }
        }
      } catch { /* fall through */ }
      const msg = e instanceof Error ? e.message : 'Click failed';
      ctx?.onThought?.(`❌ ${msg}`);
      return { success: false, content: '', error: `${msg}\n\nRequires a Playwright server. Set one up with: node server/browse_web.js` };
    }
  },
};

const browserFillTool: Tool = {
  id: 'browser_fill',
  name: 'browser_fill',
  description: 'Fill a form input on a web page by CSS selector. Clicks the field, clears it, and types the value.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL of the page' },
      selector: { type: 'string', description: 'CSS selector for the input field' },
      value: { type: 'string', description: 'Value to type into the field' },
      submit: { type: 'boolean', description: 'Press Enter after filling (default: false)' },
    },
    required: ['url', 'selector', 'value'],
  },
  execute: async (args, ctx?: ToolContext) => {
    const schema = z.object({
      url: z.string().url(),
      selector: z.string().min(1).max(500),
      value: z.string().min(1).max(5000),
      submit: z.boolean().default(false),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    const { url, selector, value, submit } = parsed.data;
    ctx?.onProgress?.(0.1, 'Filling form...');
    ctx?.onThought?.(`📝 Filling "${selector}" on ${new URL(url).hostname}...`);

    try {
      const serverUrl = localStorage.getItem('gia-playwright-server') || 'http://localhost:3091';
      const res = await fetch(`${serverUrl}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fill',
          url,
          selector,
          value,
          options: { submit },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const result = await res.json();
      ctx?.onProgress?.(1, 'Done');
      ctx?.onThought?.('✅ Form filled');
      return {
        success: true,
        content: `Filled "${selector}" with "${value.slice(0, 50)}${value.length > 50 ? '...' : ''}"\n**URL:** ${result.url || url}`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Fill failed';
      return { success: false, content: '', error: msg };
    }
  },
};

const browserScrollTool: Tool = {
  id: 'browser_scroll',
  name: 'browser_scroll',
  description: 'Scroll a web page in a direction. Useful for reading long pages or reaching bottom content.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL of the page' },
      direction: { type: 'string', enum: ['down', 'up', 'top', 'bottom'], description: 'Scroll direction (default: down)' },
      amount: { type: 'number', description: 'Pixels to scroll (default: 500)' },
    },
    required: ['url'],
  },
  execute: async (args, ctx?: ToolContext) => {
    const schema = z.object({
      url: z.string().url(),
      direction: z.enum(['down', 'up', 'top', 'bottom']).default('down'),
      amount: z.number().min(0).max(10000).default(500),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    const { url, direction, amount } = parsed.data;
    ctx?.onThought?.(`📜 Scrolling ${direction}...`);

    try {
      const serverUrl = localStorage.getItem('gia-playwright-server') || 'http://localhost:3091';
      const res = await fetch(`${serverUrl}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scroll', url, direction, amount }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const result = await res.json();
      ctx?.onThought?.('✅ Scrolled');
      return {
        success: true,
        content: `Scrolled ${direction} by ${amount}px\n**URL:** ${result.url || url}${result.text ? `\n\n${result.text.slice(0, 3000)}` : ''}`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Scroll failed';
      return { success: false, content: '', error: msg };
    }
  },
};

export const browserAutomationTools: Tool[] = [browserClickTool, browserFillTool, browserScrollTool];


export function registerBrowserAutomationTools() {
  for (const tool of browserAutomationTools) ToolRegistry.register(tool);
}
