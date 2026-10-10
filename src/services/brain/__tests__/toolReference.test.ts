import { describe, expect, it, beforeAll } from 'vitest';
import { registerAllTools } from '../../tools/index';
import {
  buildToolReferenceTable,
  countModelTools,
  isToolVisibleToModel,
  listModelTools,
  trimToolDescription,
} from '../toolReference';

describe('toolReference', () => {
  beforeAll(() => {
    registerAllTools();
  });

  it('exposes every schema-backed registered tool plus virtual sub_agent_call', () => {
    const ids = listModelTools().map((tool) => tool.id);
    expect(ids).toContain('web_search');
    expect(ids).toContain('sub_agent_call');
    expect(ids.length).toBe(countModelTools());
  });

  it('hides internal plumbing tools', () => {
    expect(isToolVisibleToModel('device_plugin_info')).toBe(false);
    expect(isToolVisibleToModel('gateway_daemon_start')).toBe(false);
    expect(isToolVisibleToModel('geolocation_get_current_position')).toBe(false);
    expect(isToolVisibleToModel('clipboard_read')).toBe(false);
    expect(isToolVisibleToModel('share_content')).toBe(false);
    expect(isToolVisibleToModel('haptic_vibrate')).toBe(false);
    expect(isToolVisibleToModel('notifications_request_permissions')).toBe(false);
    expect(isToolVisibleToModel('web_search')).toBe(true);
  });

  it('generates a compact table of well-formed rows', () => {
    const table = buildToolReferenceTable();
    const rows = table.split('\n').filter((line) => line.startsWith('| `'));
    expect(rows.length).toBe(countModelTools());
    for (const row of rows) {
      expect(row).toMatch(/^\| `[a-zA-Z0-9_]+` \| .+ \| .+ \|$/);
      expect(row.length).toBeLessThan(220);
    }
  });

  it('truncates long descriptions and keeps a short fallback', () => {
    const long = 'a '.repeat(200);
    expect(trimToolDescription(long).length).toBeLessThanOrEqual(72);
    expect(trimToolDescription('short description')).toBe('short description');
  });
});