import { z } from 'zod';
import type { Tool } from './types';
import bibleService from '../BibleService';
import messagingBridge from '../MessagingBridge';
import { useGiaStore } from '../../store/useGiaStore';
import { getIntervalMs, isNativePlatform } from '../../utils/helpers';
import { GIAMedia } from '../../services/GIAMedia';

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

const bibleVerse: Tool = {
  id: 'bible_verse',
  name: 'bible_verse',
  description: 'Get a Bible verse — verse of the day, search by keyword, or read a chapter.',
  schema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['daily', 'search', 'chapter'], description: 'daily = verse of the day, search = find verses by keyword, chapter = read full chapter' },
      query: { type: 'string', description: 'For search: keyword phrase. For chapter: book name (e.g. "John 3"). Not needed for daily.' },
    },
    required: ['type'],
  },
  execute: async (args) => {
    const schema = z.object({
      type: z.enum(['daily', 'search', 'chapter']),
      query: z.string().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    try {
      if (parsed.data.type === 'daily') {
        const verse = await bibleService.getVerseOfDay();
        return {
          success: true,
          content: `## 📖 Verse of the Day\n\n**${verse.reference}** (${verse.translation})\n\n> ${verse.text}\n\n_Let this word dwell in your heart today._`,
        };
      }
      if (parsed.data.type === 'search' && parsed.data.query) {
        const verses = await bibleService.searchVerse(parsed.data.query);
        if (verses.length === 0) return { success: true, content: `No verses found for "${parsed.data.query}". Try a different translation or keyword.` };
        const lines = verses.map(v => `**${v.reference}**\n> ${v.text}`);
        return { success: true, content: `## 📖 Search Results: "${parsed.data.query}"\n\n${lines.join('\n\n')}` };
      }
      if (parsed.data.type === 'chapter' && parsed.data.query) {
        const match = parsed.data.query.match(/^(\w+)\s*(\d+)$/);
        if (!match) return { success: false, content: '', error: 'Format: "Book Chapter" e.g. "John 3"' };
        const verses = await bibleService.getChapter(match[1], parseInt(match[2]));
        if (verses.length === 0) return { success: true, content: `Chapter not found.` };
        const lines = verses.map(v => `${v.reference}\n${v.text}`);
        return { success: true, content: `## 📖 ${parsed.data.query}\n\n${lines.join('\n\n')}` };
      }
      return { success: true, content: 'Specify a query for search or chapter mode.' };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Failed to fetch verse' };
    }
  },
};

const dailyDevotion: Tool = {
  id: 'daily_devotion',
  name: 'daily_devotion',
  description: 'Get a daily devotional message with a Bible verse and prayer.',
  execute: async () => {
    const devotion = bibleService.getDailyDevotional();
    return {
      success: true,
      content: `## ${devotion.title}\n\n**${devotion.verse.reference}**\n> ${devotion.verse.text}\n\n${devotion.message}\n\n*Prayer:* ${devotion.prayer}`,
    };
  },
};

const setupMorningBriefing: Tool = {
  id: 'setup_morning_briefing',
  name: 'setup_morning_briefing',
  description: 'Set up a daily morning briefing sent to your Telegram. GIA will send you news, Bible verse, weather, calendar events, and motivation every morning.',
  schema: {
    type: 'object',
    properties: {
      channel: { type: 'string', enum: ['telegram', 'whatsapp'], description: 'Where to send the briefing (telegram recommended)' },
      time: { type: 'string', description: 'Time for the briefing in 24h format. Default: "07:00". Example: "06:30"' },
    },
    required: ['channel'],
  },
  execute: async (args) => {
    const schema = z.object({
      channel: z.enum(['telegram', 'whatsapp']),
      time: z.string().optional().default('07:00'),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!messagingBridge.isConnected(parsed.data.channel)) {
      return {
        success: false,
        content: '',
        error: `${parsed.data.channel} is not connected. Use messaging_setup_${parsed.data.channel} first.`,
      };
    }

    const [hours, minutes] = parsed.data.time.split(':').map(Number);
    const now = new Date();
    const firstRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    if (firstRun.getTime() <= now.getTime()) {
      firstRun.setDate(firstRun.getDate() + 1);
    }

    const prompt = `You are GIA creating the user's daily briefing. Compose a warm, personal morning message that includes:

1. 🌅 **Good morning greeting** — personalized and warm
2. 📖 **Bible verse of the day** — fetch using bible_verse tool with type "daily"
3. 📰 **Top news** — fetch 3-5 top news headlines using web_search for "latest news today"
4. 📅 **Today's schedule** — check calendar events for today using calendar_list_events with timeMin set to today 00:00 and timeMax to today 23:59
5. 💪 **Motivation** — a short motivational thought for the day
6. 🙏 **Prayer** — a short prayer for the day

Format it beautifully for Telegram with emojis and clear sections. Be encouraging and warm. Sign off as "Your GIA"`;

    const addScheduledTask = useGiaStore.getState().addScheduledTask;
    const taskId = `briefing-${Date.now()}`;
    addScheduledTask({
      id: taskId,
      title: `🌅 Daily Morning Briefing (${parsed.data.time})`,
      prompt,
      cronLabel: `Daily at ${parsed.data.time}`,
      interval: 'daily',
      nextRun: firstRun.getTime(),
      status: 'pending',
      channel: parsed.data.channel,
    });

    const channelLabel = parsed.data.channel === 'telegram' ? 'Telegram' : 'WhatsApp';
    return {
      success: true,
      content: `## ✅ Morning Briefing Scheduled!\n\n**Channel:** ${channelLabel}\n**Time:** Every day at ${parsed.data.time}\n**First run:** ${firstRun.toLocaleString()}\n\nEvery morning, GIA will:\n- 📖 Share a Bible verse of the day\n- 📰 Give you top news headlines\n- 📅 Check your calendar events\n- 💪 Send motivation and a prayer\n\n**Requires:** Long-Running Mode enabled so the scheduler runs in background.\n\n*You can also just ask me "good morning" anytime for an instant briefing!*`,
    };
  },
};

const setReminder: Tool = {
  id: 'set_reminder',
  name: 'set_reminder',
  description: 'Set a recurring reminder for anything — habits, medication, water intake, prayers, chores. GIA will remind you at the scheduled time via the app and on Telegram/WhatsApp.',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'What to remind you about (e.g. "Drink water", "Evening prayer", "Take medication")' },
      interval: { type: 'string', enum: ['hourly', 'daily', 'weekly'], description: 'How often to remind' },
      time: { type: 'string', description: 'For daily: time in 24h format (e.g. "08:00"). For weekly: day + time (e.g. "Monday 09:00"). Default: now + interval' },
      details: { type: 'string', description: 'Optional extra context for the reminder' },
      channel: { type: 'string', enum: ['telegram', 'whatsapp'], description: 'Optional channel to send reminders through' },
    },
    required: ['title', 'interval'],
  },
  execute: async (args) => {
    const schema = z.object({
      title: z.string().min(1, 'Reminder title is required'),
      interval: z.enum(['hourly', 'daily', 'weekly']),
      time: z.string().optional(),
      details: z.string().max(500).optional(),
      channel: z.enum(['telegram', 'whatsapp']).optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    let firstRun = Date.now();
    if (parsed.data.time) {
      const [hours, minutes] = parsed.data.time.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const candidate = new Date();
        candidate.setHours(hours, minutes, 0, 0);
        if (candidate.getTime() > Date.now()) {
          firstRun = candidate.getTime();
        } else {
          candidate.setDate(candidate.getDate() + 1);
          firstRun = candidate.getTime();
        }
      }
    } else {
      firstRun = Date.now() + getIntervalMs(parsed.data.interval);
    }

    const prompt = `Reminder: ${parsed.data.title}${parsed.data.details ? `\nDetails: ${parsed.data.details}` : ''}\n\nGenerate a friendly reminder message about this. Be encouraging. If it's a spiritual reminder, include a short Bible verse.`;

    const addScheduledTask = useGiaStore.getState().addScheduledTask;
    addScheduledTask({
      id: `reminder-${Date.now()}`,
      title: `⏰ ${parsed.data.title}`,
      prompt,
      cronLabel: `${parsed.data.interval}${parsed.data.time ? ` at ${parsed.data.time}` : ''}`,
      interval: parsed.data.interval,
      nextRun: firstRun,
      status: 'pending',
    });

    const intervalLabel = parsed.data.interval === 'hourly' ? 'every hour' : parsed.data.interval === 'daily' ? 'every day' : 'every week';
    return {
      success: true,
      content: `## ✅ Reminder Set\n\n**${parsed.data.title}**\n**Frequency:** ${intervalLabel}${parsed.data.time ? ` at ${parsed.data.time}` : ''}\n**First reminder:** ${new Date(firstRun).toLocaleString()}\n\nI'll remind you when the time comes. Keep **Long-Running Mode** on so I never miss a reminder!`,
    };
  },
};



const playMusic: Tool = {
  id: 'play_music',
  name: 'play_music',
  description: 'Play music — on your device, via YouTube, YouTube Music, Spotify, or from a URL. On Android, GIA can find and play songs from your local music library directly.',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Song name, artist, or what you want to listen to' },
      platform: { type: 'string', enum: ['device', 'youtube', 'youtube_music', 'spotify', 'audio_url'], description: 'Where to play from. device = local music library (Android only), youtube = general YouTube, youtube_music = YouTube Music, spotify = Spotify, audio_url = direct audio URL' },
      url: { type: 'string', description: 'Direct audio URL (only for platform=audio_url)' },
    },
    required: ['query'],
  },
  execute: async (args) => {
    const schema = z.object({
      query: z.string().min(1, 'Song name is required'),
      platform: z.enum(['device', 'youtube', 'youtube_music', 'spotify', 'audio_url']).optional().default('youtube_music'),
      url: z.string().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    const encoded = encodeURIComponent(parsed.data.query);

    try {
      // ── Native Android device playback ──────────────────────
      if (parsed.data.platform === 'device') {
        if (!isNativePlatform()) {
          return { success: false, content: '', error: 'Device music playback requires the Android app. Try platform=youtube or platform=spotify instead.' };
        }

        const result = await GIAMedia.searchSongs({ query: parsed.data.query });
        if (result.count === 0) {
          return { success: true, content: `🎵 No songs found on your device matching "${parsed.data.query}". Try a different search or platform.` };
        }

        const song = result.songs[0];
        await GIAMedia.play({
          path: song.path,
          title: song.title,
          artist: song.artist,
        });

        const minutes = Math.floor(song.duration / 60000);
        const seconds = Math.floor((song.duration % 60000) / 1000);
        const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        return {
          success: true,
          content: `🎵 Now playing from your device: **${song.title}**${song.artist ? ` by *${song.artist}*` : ''} (${durationStr})`,
        };
      }

      // ── Audio URL playback (web Audio API) ──────────────────
      if (parsed.data.platform === 'audio_url' && parsed.data.url) {
        const audio = new Audio(parsed.data.url);
        audio.play().then(() => {
          if (navigator.mediaSession) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: parsed.data.query,
              artist: 'GIA Music',
            });
          }
        }).catch(() => {});
        return { success: true, content: `🎵 Now playing: **${parsed.data.query}** from URL.` };
      }

      // ── Spotify ─────────────────────────────────────────────
      if (parsed.data.platform === 'spotify') {
        window.open(`https://open.spotify.com/search/${encoded}`, '_blank');
        return { success: true, content: `🎵 Opened Spotify search for **${parsed.data.query}**.` };
      }

      // ── YouTube Music ───────────────────────────────────────
      if (parsed.data.platform === 'youtube_music') {
        window.open(`https://music.youtube.com/search?q=${encoded}`, '_blank');
        return { success: true, content: `🎵 Opened YouTube Music search for **${parsed.data.query}**.` };
      }

      // ── YouTube (general) ───────────────────────────────────
      window.open(`https://www.youtube.com/results?search_query=${encoded}`, '_blank');
      return { success: true, content: `🎵 Opened YouTube search for **${parsed.data.query}**.` };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Failed to play music' };
    }
  },
};

export const personalTools: Tool[] = [
  bibleVerse,
  dailyDevotion,
  setupMorningBriefing,
  setReminder,
  playMusic,
];
