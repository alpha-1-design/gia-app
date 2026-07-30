import { describe, it, expect, beforeEach, vi } from 'vitest';
import { default as registry } from '../ToolRegistry';
import type { Tool } from '../tools/types';

describe('ToolRegistry (integration)', () => {
  beforeEach(() => {
    // Clear all tools between tests by getting and unregistering each
    for (const tool of registry.getAll()) {
      registry.unregister(tool.id);
    }
  });

  const makeTool = (id: string, overrides: Partial<Tool> = {}): Tool => ({
    id,
    name: id,
    description: `Tool ${id}`,
    execute: async () => ({ success: true, content: 'ok' }),
    ...overrides,
  });

  it('starts empty', () => {
    expect(registry.getAll()).toEqual([]);
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('registers and retrieves a single tool', () => {
    const tool = makeTool('test-tool');
    registry.register(tool);
    expect(registry.get('test-tool')).toBe(tool);
    expect(registry.getAll()).toHaveLength(1);
  });

  it('overwrites on duplicate id with warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t1 = makeTool('dup', { description: 'first' });
    const t2 = makeTool('dup', { description: 'second' });
    registry.register(t1);
    registry.register(t2);
    expect(registry.get('dup')?.description).toBe('second');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dup'));
    warn.mockRestore();
  });

  it('returns null schema for unknown tool', () => {
    expect(registry.getToolSchema('void')).toBeNull();
  });

  it('returns schema for a tool that has one', () => {
    const schema = { type: 'object' as const, properties: { x: { type: 'string' } }, required: ['x'] };
    const tool = makeTool('schema-tool', { schema });
    registry.register(tool);
    expect(registry.getToolSchema('schema-tool')).toEqual(schema);
  });

  it('getAllToolSchemas collects all schemas keyed by id', () => {
    const t1 = makeTool('a', { schema: { type: 'object' as const, properties: { a: {} }, required: [] } });
    const t2 = makeTool('b'); // no schema
    const t3 = makeTool('c', { schema: { type: 'object' as const, properties: { c: {} }, required: ['c'] } });
    registry.register(t1);
    registry.register(t2);
    registry.register(t3);
    const schemas = registry.getAllToolSchemas();
    expect(Object.keys(schemas)).toEqual(['a', 'c']);
    expect(schemas.a?.properties).toEqual({ a: {} });
    expect(schemas.c?.required).toEqual(['c']);
  });

  it('unregister removes a tool', () => {
    const tool = makeTool('removable');
    registry.register(tool);
    expect(registry.getAll()).toHaveLength(1);
    const removed = registry.unregister('removable');
    expect(removed).toBe(true);
    expect(registry.get('removable')).toBeUndefined();
  });

  it('unregister returns false for unknown id', () => {
    expect(registry.unregister('ghost')).toBe(false);
  });

  it('handles many registrations', () => {
    for (let i = 0; i < 100; i++) {
      registry.register(makeTool(`bulk-${i}`));
    }
    expect(registry.getAll()).toHaveLength(100);
    expect(registry.get('bulk-42')).toBeDefined();
  });
});
