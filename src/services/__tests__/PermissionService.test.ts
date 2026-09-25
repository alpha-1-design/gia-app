import { describe, it, expect, beforeEach } from 'vitest';
import {
  permissionsForTool,
  isToolPermitted,
  ensureGranted,
  usePermissionStore,
  TOOL_PERMISSIONS,
  PERMISSION_METADATA,
} from '../PermissionService';

describe('PermissionService', () => {
  beforeEach(() => {
    // Reset every permission to 'ask' between tests.
    const store = usePermissionStore.getState();
    for (const key of Object.keys(store.grants) as Array<keyof typeof store.grants>) {
      store.setGrant(key, 'ask');
    }
  });

  describe('tool → permission map', () => {
    it('maps sensitive tools to the right permissions', () => {
      expect(permissionsForTool('get_user_location')).toEqual(['location']);
      expect(permissionsForTool('send_sms')).toEqual(['sms']);
      expect(permissionsForTool('image_generation_cam')).toEqual(['camera']);
    });

    it('returns nothing for tools that need no protected capability', () => {
      expect(permissionsForTool('web_search')).toEqual([]);
      expect(permissionsForTool('note_create')).toEqual([]);
      expect(permissionsForTool('completely_unknown_tool')).toEqual([]);
    });

    it('never maps a tool to a permission the manifest does not declare', () => {
      // Every permission referenced by a tool must have metadata — metadata
      // is where the manifest audit lives (PERMISSIONS.md documents it too).
      for (const perms of Object.values(TOOL_PERMISSIONS)) {
        for (const p of perms) {
          expect(PERMISSION_METADATA[p]).toBeDefined();
          expect(PERMISSION_METADATA[p].manifestName).toMatch(/^android\.|^ACCESS_|^SEND_|^READ_|^com\.termux/);
        }
      }
    });
  });

  describe('isToolPermitted', () => {
    it('is false while the permission is still "ask"', () => {
      expect(isToolPermitted('get_user_location')).toBe(false);
    });

    it('is true once granted', () => {
      usePermissionStore.getState().setGrant('location', 'granted');
      expect(isToolPermitted('get_user_location')).toBe(true);
    });

    it('is false when denied', () => {
      usePermissionStore.getState().setGrant('location', 'denied');
      expect(isToolPermitted('get_user_location')).toBe(false);
    });
  });

  describe('ensureGranted — the gate', () => {
    it('resolves true instantly for tools with no mapped permission', async () => {
      await expect(ensureGranted('web_search', 'Web Search')).resolves.toBe(true);
    });

    it('resolves true when already granted (no popup)', async () => {
      usePermissionStore.getState().setGrant('camera', 'granted');
      await expect(ensureGranted('camera_capture', 'Camera')).resolves.toBe(true);
      expect(usePermissionStore.getState().pending).toBeNull();
    });

    it('opens the in-app popup when the permission is "ask" and resolves on grant', async () => {
      const promise = ensureGranted('send_sms', 'Send SMS');
      // Let the gate reach the popup.
      await Promise.resolve();
      await Promise.resolve();
      const pending = usePermissionStore.getState().pending;
      expect(pending).not.toBeNull();
      expect(pending!.permission).toBe('sms');
      usePermissionStore.getState().resolvePending(true, false);
      await expect(promise).resolves.toBe(true);
      expect(usePermissionStore.getState().grants.sms).toBe('granted');
    });

    it('resolves false and records the denial when the user denies', async () => {
      const promise = ensureGranted('get_contacts', 'Contacts');
      await Promise.resolve();
      await Promise.resolve();
      usePermissionStore.getState().resolvePending(false, true);
      await expect(promise).resolves.toBe(false);
      expect(usePermissionStore.getState().grants.contacts).toBe('denied');
      // A subsequent call is denied immediately — no popup again.
      await expect(ensureGranted('get_contacts', 'Contacts')).resolves.toBe(false);
      expect(usePermissionStore.getState().pending).toBeNull();
    });
  });
});
