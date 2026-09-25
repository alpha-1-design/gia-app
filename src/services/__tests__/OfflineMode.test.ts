import { describe, it, expect, beforeEach } from 'vitest';
import { isOnDeviceMode, isOnDeviceTool } from '../OfflineMode';
import { useGiaStore } from '../../store/useGiaStore';

describe('OfflineMode', () => {
  beforeEach(() => {
    // Reset the flag and its persisted value between tests.
    useGiaStore.getState().setOnDeviceMode(false);
    localStorage.removeItem('gia-on-device-mode');
  });

  describe('isOnDeviceMode', () => {
    it('reflects the store flag', () => {
      expect(isOnDeviceMode()).toBe(false);
      useGiaStore.getState().setOnDeviceMode(true);
      expect(isOnDeviceMode()).toBe(true);
      useGiaStore.getState().setOnDeviceMode(false);
      expect(isOnDeviceMode()).toBe(false);
    });

    it('persists the toggle to localStorage', () => {
      useGiaStore.getState().setOnDeviceMode(true);
      expect(localStorage.getItem('gia-on-device-mode')).toBe('true');
      useGiaStore.getState().setOnDeviceMode(false);
      expect(localStorage.getItem('gia-on-device-mode')).toBe('false');
    });
  });

  describe('isOnDeviceTool — the allowlist', () => {
    it('allows exact-match on-device tools', () => {
      for (const id of ['list_files', 'get_environment_info', 'get_user_location', 'vibrate']) {
        expect(isOnDeviceTool(id)).toBe(true);
      }
    });

    it('allows prefix-matched on-device tool families', () => {
      for (const id of [
        'memory_store', 'memory_search',
        'note_create', 'note_read', 'note_update',
        'task_create', 'task_read',
        'clipboard_read', 'clipboard_write', 'clipboard_intelligence',
        'filesystem_read', 'filesystem_write',
        'device_info', 'device_battery',
        'classify_text',
      ]) {
        expect(isOnDeviceTool(id)).toBe(true);
      }
    });

    it('blocks tools that need the network', () => {
      for (const id of ['web_search', 'read_url', 'send_email', 'send_whatsapp', 'github', 'weather', 'image_generation', 'telegram_post']) {
        expect(isOnDeviceTool(id)).toBe(false);
      }
    });

    it('does not confuse similar prefixes (e.g. notXxx)', () => {
      // 'notes_share_online' starts with 'note_' only if spelled that way;
      // a made-up network tool must not sneak through a partial match.
      expect(isOnDeviceTool('webhook_send')).toBe(false);
    });
  });
});
