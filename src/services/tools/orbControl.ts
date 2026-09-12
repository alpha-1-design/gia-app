import { executeOrbAction, isOrbActionPayload } from '../OrbControlActions';
import type { Tool } from './types';

/**
 * orb_act — drive the phone directly from the chat (same action path the
 * floating orb uses). The accessibility service must be running
 * (Settings → Accessibility → GIA Screen Agent) for taps/scrolls/back to work.
 */
const orbActTool: Tool = {
  id: 'orb_act',
  name: 'orb_act',
  description:
    'Control the phone screen directly: tap by visible text or coordinates, scroll, open an app, press back, or send the user the current screen capture. Executes via the GIA accessibility service / floating orb bridge. Use this after capturing screen content when the user asks you to interact with the phone.',
  schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['tap', 'tap_text', 'scroll', 'open_app', 'go_back', 'send_photo'],
        description: 'The device action to perform',
      },
      x: {
        type: 'number',
        description: 'Absolute pixel x coordinate (required when action=tap)',
      },
      y: {
        type: 'number',
        description: 'Absolute pixel y coordinate (required when action=tap)',
      },
      text: {
        type: 'string',
        description: 'Visible text to tap (required when action=tap_text)',
      },
      direction: {
        type: 'string',
        enum: ['up', 'down', 'left', 'right'],
        description: 'Scroll direction (used when action=scroll)',
      },
      app: {
        type: 'string',
        description: 'App name or package id to open (required when action=open_app), e.g. "YouTube" or "com.spotify.music"',
      },
      caption: {
        type: 'string',
        description: 'Why GIA is sending the picture (used when action=send_photo)',
      },
    },
    required: ['action'],
  },
  execute: async (args) => {
    try {
      if (!isOrbActionPayload(args)) {
        return { success: false, content: '', error: 'An `action` is required for orb_act.' };
      }
      const result = await executeOrbAction(args as Record<string, unknown>, null);
      if (!result) {
        return { success: false, content: '', error: `Unknown orb action: ${String(args.action)}` };
      }
      return { success: true, content: `## ✅ Orb\n${result}` };
    } catch (e) {
      return {
        success: false,
        content: '',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
};

export const orbControlTools: Tool[] = [orbActTool];