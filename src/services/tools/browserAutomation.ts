import { z } from 'zod';
import type { Tool, ToolContext } from './types';

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
  description: 'Click an element by CSS selector in the active Android in-app browser. The web browser is read-only. Use browser_navigate first.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL of the active page for context' },
      selector: { type: 'string', description: 'CSS selector for the element to click (e.g. "button.submit", "#login", "a[href=/dashboard]")' },
      waitMs: { type: 'number', description: 'Milliseconds to wait for page changes after the click (default: 500)' },
    },
    required: ['url', 'selector'],
  },
  execute: async (args, ctx?: ToolContext) => {
    const schema = z.object({
      url: z.string().url(),
      selector: z.string().min(1).max(500),
      waitMs: z.number().min(0).max(5000).default(500),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    const { url, selector, waitMs } = parsed.data;
    ctx?.onProgress?.(0.1, 'Clicking element...');
    ctx?.onThought?.(`🖱️ Clicking "${selector}" on ${new URL(url).hostname}...`);

    try {
      const browser = (await import('../GIAInAppBrowser')).default;
      const result = await browser.click(selector, waitMs);
      ctx?.onProgress?.(1, 'Done');
      ctx?.onThought?.('✅ Click successful');
      return {
        success: true,
        content: `Clicked "${selector}"\n**URL:** ${result.url || url}\n**Title:** ${result.title || '(unknown)'}${result.text ? `\n\n${result.text.slice(0, 3000)}` : ''}`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Click failed';
      ctx?.onThought?.(`❌ ${msg}`);
      return { success: false, content: '', error: msg };
    }
  },
};

const browserFillTool: Tool = {
  id: 'browser_fill',
  name: 'browser_fill',
  description: 'Fill a form input by CSS selector in the active Android in-app browser. The web browser is read-only.',
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
      const browser = (await import('../GIAInAppBrowser')).default;
      const result = await browser.fill(selector, value, submit);
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
  description: 'Scroll the active Android in-app browser page. The web browser is read-only.',
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
      const browser = (await import('../GIAInAppBrowser')).default;
      const result = await browser.scroll(direction, amount);
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
