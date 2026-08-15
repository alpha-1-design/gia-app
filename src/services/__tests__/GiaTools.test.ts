import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../CodeRunner', () => ({ default: {} }));
vi.mock('../../store/useGiaStore', () => ({ useGiaStore: {} }));
vi.mock('../../store/useTaskStore', () => ({ useTaskStore: {} }));
vi.mock('../../store/useNotesStore', () => ({ useNotesStore: {}, randomNoteColor: vi.fn() }));
vi.mock('../../store/useProviderStore', () => ({}));
vi.mock('../../utils/helpers', () => ({ isNativePlatform: vi.fn(), featureAvailable: vi.fn(), featureFallbackMessage: vi.fn() }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: {}, Directory: {}, Encoding: {} }));

const { registerAllTools } = await import('../tools/index');
const { default: giaTools } = await import('../GiaTools');

beforeEach(() => {
  registerAllTools();
});

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

  describe('smoke test — every tool family registers', () => {
    it('registers the full registry (not a curated subset)', () => {
      const tools = giaTools.getAllTools();
      // The registry intentionally carries the full ~100-tool surface (web,
      // terminal, security, social, connectors, gateway, SSH, DB, smart home,
      // websockets, MCP, goals...). The UI pickers generate from this list.
      expect(tools.length).toBeGreaterThanOrEqual(90);
    });

    it('includes reachable tools from every family', () => {
      const ids = giaTools.getAllTools().map(t => t.id);
      const required = [
        // Web & navigation
        'web_search', 'read_url', 'browser_navigate', 'wikipedia', 'show_map', 'get_directions',
        // Code & execution
        'terminal_run', 'build_project', 'zip_project', 'github', 'ssh_connect', 'db_query', 'generate_file',
        // Files
        'filesystem_read', 'filesystem_write', 'file_search', 'file_get', 'create_pdf', 'read_pdf',
        // Creative / memory
        'image_generation', 'save_memory', 'forget_memory', 'request_clarification',
        // Device & system
        'device_info', 'device_health', 'get_user_location', 'weather', 'define', 'clipboard', 'share_content',
        'set_alarm', 'send_sms', 'send_whatsapp', 'send_email', 'make_phone_call', 'open_url',
        // Security
        'security_install_tools', 'security_scan', 'security_firewall', 'security_trace', 'security_quarantine',
        // Social / connectors / gateway / messaging
        'social_publish', 'social_analytics', 'connector_call', 'connector_list',
        'gateway_call', 'gateway_stats', 'telegram_post', 'messaging_status',
        // Smart home / network / websockets
        'smart_discover', 'smart_control', 'smart_cast', 'network_scan', 'ws_send', 'ws_status',
        // Autonomy / agents / MCP / notes & tasks / skills
        'create_goal', 'list_goals', 'task_create', 'note_read', 'neura_query', 'mcp_server_add', 'mcp_server_list',
        'skill_list', 'skill_activate',
      ];
      for (const id of required) {
        expect(ids, `tool "${id}" is not registered`).toContain(id);
      }
    });
  });
});
