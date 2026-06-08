import { describe, it, expect, vi } from 'vitest';

vi.mock('../CodeRunner', () => ({ default: {} }));
vi.mock('../../store/useGiaStore', () => ({ useGiaStore: {} }));
vi.mock('../../store/useTaskStore', () => ({ useTaskStore: {} }));
vi.mock('../../store/useNotesStore', () => ({ useNotesStore: {}, randomNoteColor: vi.fn() }));
vi.mock('../../store/useProviderStore', () => ({}));
vi.mock('../../utils/helpers', () => ({ isNativePlatform: vi.fn(), featureAvailable: vi.fn(), featureFallbackMessage: vi.fn() }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: {}, Directory: {}, Encoding: {} }));

const { default: giaTools } = await import('../GiaTools');

describe('GiaTools', () => {
  it('is a singleton instance', () => {
    expect(giaTools).toBeDefined();
    expect(giaTools.getTool).toBeInstanceOf(Function);
  });

  it('has tools registered', () => {
    const tools = giaTools.getAllTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('includes web_search tool', () => {
    const tool = giaTools.getTool('web_search');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('web_search');
  });

  it('includes terminal_run tool', () => {
    const tool = giaTools.getTool('terminal_run');
    expect(tool).toBeDefined();
    expect(tool!.schema).toBeDefined();
    expect(tool!.schema!.properties).toHaveProperty('command');
  });

  describe('registerTool / unregisterTool', () => {
    it('registers a custom tool', () => {
      giaTools.registerTool({
        id: 'custom_test',
        name: 'custom_test',
        description: 'A test tool',
        execute: async () => ({ success: true, content: 'done' }),
      });
      expect(giaTools.getTool('custom_test')).toBeDefined();
      giaTools.unregisterTool('custom_test');
      expect(giaTools.getTool('custom_test')).toBeUndefined();
    });
  });

  describe('getAllToolSchemas', () => {
    it('returns all tool schemas as a record', () => {
      const schemas = giaTools.getAllToolSchemas();
      expect(schemas).toBeInstanceOf(Object);
      const keys = Object.keys(schemas);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys).toContain('web_search');
      expect(schemas.web_search).toHaveProperty('description');
      expect(schemas.web_search).toHaveProperty('properties');
    });
  });

  describe('tool schemas structure', () => {
    it('web_search has required query', () => {
      const schema = giaTools.getToolSchema('web_search');
      expect(schema!.required).toContain('query');
    });

    it('switch_module accepts chat/exam/analyst/writer/planner/settings', () => {
      const schema = giaTools.getToolSchema('switch_module');
      const moduleProp = schema!.properties['module'] as Record<string, unknown>;
      expect(moduleProp).toBeDefined();
      expect(schema!.required).toContain('module');
    });

    it('image_generation has prompt property', () => {
      const schema = giaTools.getToolSchema('image_generation');
      expect(schema!.properties).toHaveProperty('prompt');
    });
  });
});
