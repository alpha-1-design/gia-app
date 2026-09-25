import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Capacitor } from '@capacitor/core';

/**
 * PermissionService — the bridge between GIA's tools and the phone's
 * permission system.
 *
 * Guarantees:
 *  1. Every tool that touches a protected capability is mapped to the
 *     permission(s) it needs (TOOL_PERMISSIONS, audited against
 *     AndroidManifest.xml).
 *  2. Before such a tool executes, brain/toolRunner calls ensureGranted():
 *     - already granted (OS + in-app) → resolves true, zero popups.
 *     - otherwise → a single in-app popup explains WHY, with buttons to
 *       grant (triggers the native runtime prompt if the OS hasn't asked),
 *       open system settings (if the OS prompt was permanently denied), or
 *       deny (the tool is skipped and GIA is told why).
 *  3. The user can flip every permission in Settings → Permissions, and see
 *     which tools depend on each one.
 */

export type PermissionId =
  | 'camera'
  | 'microphone'
  | 'location'
  | 'contacts'
  | 'sms'
  | 'notifications'
  | 'storage'
  | 'overlay'
  | 'exactAlarm'
  | 'notificationsPolicy'
  | 'batteryExemption'
  | 'installPackages';

export type GrantState = 'granted' | 'denied' | 'ask';

interface PendingRequest {
  id: string;
  permission: PermissionId;
  toolName: string;
  reason: string;
  resolve: (granted: boolean) => void;
}

interface PermissionStoreState {
  grants: Record<PermissionId, GrantState>;
  pending: PendingRequest | null;
  setGrant: (id: PermissionId, state: GrantState) => void;
  requestPermission: (req: PendingRequest) => void;
  resolvePending: (granted: boolean, dontAskAgain: boolean) => void;
}

export const usePermissionStore = create<PermissionStoreState>()(
  persist(
    (set, get) => ({
      grants: {
        camera: 'ask', microphone: 'ask', location: 'ask', contacts: 'ask',
        sms: 'ask', notifications: 'ask', storage: 'ask', overlay: 'ask',
        exactAlarm: 'ask', notificationsPolicy: 'ask',
        batteryExemption: 'ask', installPackages: 'ask',
      },
      pending: null,
      setGrant: (id, state) => set(s => ({ grants: { ...s.grants, [id]: state } })),
      requestPermission: (req) => set({ pending: req }),
      resolvePending: (granted, dontAskAgain) => {
        const pending = get().pending;
        if (!pending) return;
        set(s => ({
          pending: null,
          grants: dontAskAgain
            ? { ...s.grants, [pending.permission]: granted ? 'granted' : 'denied' }
            : s.grants,
        }));
        pending.resolve(granted);
      },
    }),
    {
      name: 'gia-permissions',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ grants: s.grants }),
    },
  ),
);

/**
 * The tool → permission map. Audited against AndroidManifest.xml:
 * a permission appears here only if the manifest declares it AND a tool
 * actually exercises it. Tools not listed need nothing sensitive.
 */
export const TOOL_PERMISSIONS: Record<string, PermissionId[]> = {
  image_generation_cam: ['camera'],
  analyze_image_camera: ['camera'],
  scan_document: ['camera'],
  camera_capture: ['camera'],
  get_user_location: ['location'],
  search_places: ['location'],
  get_directions: ['location'],
  geolocation_watch: ['location'],
  get_contacts: ['contacts'],
  send_sms: ['sms'],
  read_sms: ['sms'],
  send_whatsapp: ['notifications'],
  make_phone_call: ['contacts'],
  local_notify: ['notifications'],
  schedule_task: ['notifications'],
  set_alarm: ['exactAlarm'],
  set_reminder: ['exactAlarm'],
  screen_capture: ['overlay'],
  show_overlay: ['overlay'],
  toggle_dnd: ['notificationsPolicy'],
  install_update: ['installPackages'],
};

/** User-facing metadata per permission: label, why GIA asks, which tools use it. */
export const PERMISSION_METADATA: Record<PermissionId, {
  label: string;
  description: string;
  manifestName: string;
  tools: string[];
}> = {
  camera: {
    label: 'Camera',
    description: 'Take photos and scan documents when you ask GIA to capture something.',
    manifestName: 'android.permission.CAMERA',
    tools: ['camera capture, document scanning'],
  },
  microphone: {
    label: 'Microphone',
    description: 'Voice input, wake word, and voice conversation. Audio is transcribed on-device when possible.',
    manifestName: 'android.permission.RECORD_AUDIO',
    tools: ['voice input, wake word'],
  },
  location: {
    label: 'Location',
    description: 'Answer "where am I", nearby searches, weather for your area, and directions.',
    manifestName: 'ACCESS_COARSE_LOCATION + ACCESS_FINE_LOCATION',
    tools: ['get_user_location, search_places, get_directions'],
  },
  contacts: {
    label: 'Contacts',
    description: 'Find a phone number when you ask GIA to call or message someone by name.',
    manifestName: 'android.permission.READ_CONTACTS',
    tools: ['get_contacts, make_phone_call'],
  },
  sms: {
    label: 'SMS',
    description: 'Send texts on your explicit request. GIA never reads messages silently.',
    manifestName: 'SEND_SMS + RECEIVE_SMS',
    tools: ['send_sms, read_sms'],
  },
  notifications: {
    label: 'Notifications',
    description: 'Alert you about reminders, scheduled tasks, and completed background work.',
    manifestName: 'android.permission.POST_NOTIFICATIONS',
    tools: ['local_notify, schedule_task'],
  },
  storage: {
    label: 'Files & Storage',
    description: 'Read files you attach and save documents, builds, and backups you create.',
    manifestName: 'READ_MEDIA_* / legacy external storage',
    tools: ['filesystem tools, document reader, backups'],
  },
  overlay: {
    label: 'Display Over Other Apps',
    description: 'Show the floating orb and quick actions above other apps.',
    manifestName: 'android.permission.SYSTEM_ALERT_WINDOW',
    tools: ['screen orb, screen_capture'],
  },
  exactAlarm: {
    label: 'Alarms & Reminders',
    description: 'Fire reminders and alarms at the exact time you asked.',
    manifestName: 'android.permission.SCHEDULE_EXACT_ALARM',
    tools: ['set_alarm, set_reminder'],
  },
  notificationsPolicy: {
    label: 'Do Not Disturb Access',
    description: 'Let GIA mute notifications during focus sessions, on your request.',
    manifestName: 'android.permission.ACCESS_NOTIFICATION_POLICY',
    tools: ['toggle_dnd'],
  },
  batteryExemption: {
    label: 'Battery Optimization Exemption',
    description: 'Keep the wake word listener and background tasks alive reliably.',
    manifestName: 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    tools: ['background services, wake word'],
  },
  installPackages: {
    label: 'Install Updates',
    description: 'Let GIA install its own updates when you approve one.',
    manifestName: 'android.permission.REQUEST_INSTALL_PACKAGES',
    tools: ['install_update'],
  },
};

/** Tools that map to no in-app permission — anything unlisted is allowed. */
export function permissionsForTool(toolId: string): PermissionId[] {
  return TOOL_PERMISSIONS[toolId] ?? [];
}

/** True when every permission a tool needs is currently granted. */
export function isToolPermitted(toolId: string): boolean {
  const required = permissionsForTool(toolId);
  const { grants } = usePermissionStore.getState();
  return required.every(p => grants[p] === 'granted');
}

async function requestNativePermission(permission: PermissionId): Promise<boolean | null> {
  try {
    switch (permission) {
      case 'camera': {
        const { Camera } = await import('@capacitor/camera');
        const s = await Camera.requestPermissions();
        return s.camera === 'granted';
      }
      case 'microphone': {
        const { SpeechRecognition } = await import('@capgo/capacitor-speech-recognition');
        const s = await SpeechRecognition.requestPermissions();
        return s.speechRecognition === 'granted';
      }
      case 'location': {
        const { Geolocation } = await import('@capacitor/geolocation');
        const s = await Geolocation.requestPermissions();
        return s.location === 'granted' || s.coarseLocation === 'granted';
      }
      case 'contacts': {
        const { Contacts } = await import('@capacitor-community/contacts');
        const s = await Contacts.requestPermissions();
        return (s as { contacts?: string }).contacts === 'granted';
      }
      case 'notifications': {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const s = await LocalNotifications.requestPermissions();
        return s.display === 'granted';
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Open the Android settings page for this permission (used when the OS prompt
 * was permanently denied and only Settings can re-enable it). Falls back to
 * the app's settings page on the web / unsupported permission.
 */
export async function openSystemSettings(permission: PermissionId): Promise<void> {
  const map: Partial<Record<PermissionId, string>> = {
    overlay: 'android.settings.ACTION_MANAGE_OVERLAY_PERMISSION',
    exactAlarm: 'android.settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM',
    notificationsPolicy: 'android.settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS',
    batteryExemption: 'android.settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    installPackages: 'android.settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES',
  };
  const action = map[permission];
  if (Capacitor.isNativePlatform()) {
    try {
      const { registerPlugin } = await import('@capacitor/core');
      const Core = registerPlugin('GIACore');
      const open = (Core as { openAppSettings?: (o: { action: string }) => Promise<void> }).openAppSettings;
      await open?.({ action: action || 'android.settings.ACTION_APPLICATION_DETAILS_SETTINGS' });
      return;
    } catch { /* fall through */ }
  }
  window.open('https://support.google.com/android/answer/9431959', '_blank');
}

/**
 * The single gate the tool executor calls before running a sensitive tool.
 * Resolves true when the tool may run; false when the user denied and GIA
 * should adapt (an observation with the reason is generated by the caller).
 */
export async function ensureGranted(toolId: string, toolName: string): Promise<boolean> {
  const required = permissionsForTool(toolId);
  if (required.length === 0) return true;

  const store = usePermissionStore.getState();

  for (const permission of required) {
    // Read fresh state each iteration — earlier iterations in this same call
    // may have just changed it.
    const current = usePermissionStore.getState().grants[permission];
    // Fast path: user already granted everything.
    if (current === 'granted') continue;
    // Sticky deny: the user said never ask — GIA adapts without prompting.
    if (current === 'denied') return false;

    const meta = PERMISSION_METADATA[permission];

    // First time: fire the native runtime prompt directly (no popup needed —
    // the OS dialog IS the explanation surface for first contact).
    if (store.grants[permission] === 'ask' && Capacitor.isNativePlatform()) {
      const result = await requestNativePermission(permission);
      if (result === true) {
        store.setGrant(permission, 'granted');
        continue;
      }
      if (result === false) {
        // Native prompt denied. Ask in-app once so the user understands the
        // impact and can retry via system settings if they change their mind.
        const granted = await askInApp(permission, toolName, meta.description);
        if (granted) { store.setGrant(permission, 'granted'); continue; }
        store.setGrant(permission, 'denied');
        return false;
      }
      // result === null (web or unqueryable) — fall through to in-app ask.
    }

    const granted = await askInApp(permission, toolName, meta.description);
    store.setGrant(permission, granted ? 'granted' : 'denied');
    if (!granted) return false;
  }
  return true;
}

function askInApp(permission: PermissionId, toolName: string, reason: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    usePermissionStore.getState().requestPermission({
      id: `${permission}-${Date.now()}`,
      permission,
      toolName,
      reason,
      resolve,
    });
  });
}
