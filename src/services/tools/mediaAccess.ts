import { z } from 'zod';
import type { Tool } from './types';
import { GIAMedia } from '../../services/GIAMedia';
import { isNativePlatform } from '../../utils/helpers';
import ToolRegistry from '../ToolRegistry';

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

const mediaAccess: Tool = {
  id: 'media_access',
  name: 'media_access',
  description: 'List, search, and browse the user\'s local music library. On Android, queries the device\'s MediaStore for audio files. Use this to find songs by title, artist, or album before playing them with play_music.',
  schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'search', 'status'], description: 'What to do: list = all songs (up to 50), search = find songs matching query, status = check current playback' },
      query: { type: 'string', description: 'Search term — matches against song title, artist, and album (only for action=search)' },
      limit: { type: 'number', description: 'Maximum results to return (default 20, max 100)' },
    },
    required: ['action'],
  },
  execute: async (args) => {
    const schema = z.object({
      action: z.enum(['list', 'search', 'status']),
      query: z.string().optional(),
      limit: z.number().min(1).max(100).optional().default(20),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!isNativePlatform()) {
      return {
        success: true,
        content: '## 📱 Media Library Access\n\nDevice music library is only available on Android. On web, you can use `play_music` with platforms like youtube, youtube_music, or spotify instead.',
      };
    }

    try {
      if (parsed.data.action === 'status') {
        const status = await GIAMedia.getStatus();
        if (!status.isRunning) {
          return { success: true, content: 'No music is currently playing.' };
        }
        const minutes = Math.floor(status.currentPosition / 60000);
        const seconds = Math.floor((status.currentPosition % 60000) / 1000);
        const totalMin = Math.floor(status.duration / 60000);
        const totalSec = Math.floor((status.duration % 60000) / 1000);
        return {
          success: true,
          content: status.isPlaying
            ? `🎵 Currently playing at ${minutes}:${seconds.toString().padStart(2, '0')} / ${totalMin}:${totalSec.toString().padStart(2, '0')}`
            : `⏸️ Paused at ${minutes}:${seconds.toString().padStart(2, '0')} / ${totalMin}:${totalSec.toString().padStart(2, '0')}`,
        };
      }

      if (parsed.data.action === 'search') {
        if (!parsed.data.query) {
          return { success: false, content: '', error: 'query is required for action=search' };
        }
        const result = await GIAMedia.searchSongs({ query: parsed.data.query });
        const songs = result.songs.slice(0, parsed.data.limit);

        if (songs.length === 0) {
          return { success: true, content: `No songs found matching "${parsed.data.query}".` };
        }

        const songList = songs.map((s, i) => {
          const min = Math.floor(s.duration / 60000);
          const sec = Math.floor((s.duration % 60000) / 1000);
          return `${i + 1}. **${s.title}**${s.artist ? ` — ${s.artist}` : ''} (${min}:${sec.toString().padStart(2, '0')})`;
        }).join('\n');

        return {
          success: true,
          content: `## 🎵 Songs matching "${parsed.data.query}"\n\n${songList}\n\n${result.count > parsed.data.limit ? `\n_Showing ${parsed.data.limit} of ${result.count} results_` : ''}\n\nTo play one: \`\`\`tool\n{"id":"play_music","args":{"query":"SONG_NAME","platform":"device"}}\n\`\`\``,
        };
      }

      // list all songs
      const result = await GIAMedia.listSongs();
      const songs = result.songs.slice(0, parsed.data.limit);

      if (songs.length === 0) {
        return { success: true, content: 'No music found on your device.' };
      }

      const songList = songs.map((s, i) => {
        const min = Math.floor(s.duration / 60000);
        const sec = Math.floor((s.duration % 60000) / 1000);
        return `${i + 1}. **${s.title}**${s.artist ? ` — ${s.artist}` : ''} (${min}:${sec.toString().padStart(2, '0')})${s.album ? ` — *${s.album}*` : ''}`;
      }).join('\n');

      return {
        success: true,
        content: `## 🎵 Your Music Library\n\n${songList}\n\n${result.count > parsed.data.limit ? `\n_Showing ${parsed.data.limit} of ${result.count} songs_` : `_${result.count} songs total_`}\n\nTo search: \`\`\`tool\n{"id":"media_access","args":{"action":"search","query":"ARTIST or SONG"}}\n\`\`\`\nTo play: \`\`\`tool\n{"id":"play_music","args":{"query":"SONG_NAME","platform":"device"}}\n\`\`\``,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Failed to access media library' };
    }
  },
};

export const mediaAccessTools: Tool[] = [mediaAccess];


export function registerMediaAccessTools() {
  for (const tool of mediaAccessTools) ToolRegistry.register(tool);
}
