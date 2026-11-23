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
      // Real registered camera tool id (src/services/tools/camera.ts) —
      // the map previously used the stale id "image_generation_cam", so
      // the in-app gate silently no-op'd for the camera.
      expect(permissionsForTool('capture_photo')).toEqual(['camera']);
      expect(permissionsForTool('geolocation_get_current_position')).toEqual(['location']);
      expect(permissionsForTool('notifications_send')).toEqual(['notifications']);
    });

    it('never maps a stale tool id that no longer exists in the registry', () => {
      // These ids once lived in TOOL_PERMISSIONS but match no registered
      // tool — keeping them mapped would be dead weight hiding real drift.
      expect(permissionsForTool('camera_capture')).toEqual([]);
      expect(permissionsForTool('image_generation_cam')).toEqual([]);
      expect(permissionsForTool('geolocation_watch')).toEqual([]);
      expect(permissionsForTool('local_notify')).toEqual([]);
      expect(permissionsForTool('schedule_task')).toEqual([]);
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
      await expect(ensureGranted('capture_photo', 'Camera')).resolves.toBe(true);
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

    it('queues concurrent permission requests instead of dropping them', async () => {
      // Regression: two parallel tools asking at once used to overwrite the
      // first request's pending slot — its promise never resolved and the
      // tool hung until its 120s timeout.
      const first = ensureGranted('get_contacts', 'Contacts');
      const second = ensureGranted('send_sms', 'Send SMS');
      await Promise.resolve();
      await Promise.resolve();
      const state = usePermissionStore.getState();
      expect(state.pending).not.toBeNull();
      expect(state.queue.length).toBe(1); // the second request is waiting
      usePermissionStore.getState().resolvePending(true, false);
      await expect(first).resolves.toBe(true);
      // The queued request must now be on screen, not lost.
      const after = usePermissionStore.getState();
      expect(after.pending).not.toBeNull();
      expect(after.pending!.permission).toBe('sms');
      usePermissionStore.getState().resolvePending(true, false);
      await expect(second).resolves.toBe(true);
    });
  });
});
