import { z } from 'zod';
import socialManager from '../social/SocialManager';
import type { Tool } from './types';

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

const socialListPlatforms: Tool = {
  id: 'social_list_platforms',
  name: 'social_list_platforms',
  description: 'List all available social media platforms and their connection status (X/Twitter, Instagram, Facebook, LinkedIn, TikTok, Telegram, WhatsApp).',
  execute: async () => {
    const platforms = socialManager.getPlatforms();
    const lines = platforms.map(p => {
      const def = socialManager.getPlatformDef(p.id);
      const authMethod = def?.supportsOAuth ? 'OAuth + Token' : def?.supportsToken ? 'Token' : 'Manual';
      return `- **${p.name}** \`${p.id}\` ${p.connected ? '✅ Connected' : '❌ Disconnected'}${p.accountName ? ` (${p.accountName})` : ''} [${authMethod}]`;
    });
    const connected = platforms.filter(p => p.connected).length;
    return {
      success: true,
      content: `## Social Media Platforms\n\n${lines.join('\n')}\n\n**${connected}/${platforms.length} connected**\n\n- Use \`social_oauth\` to log in via OAuth popup (X, Instagram, FB, LinkedIn, TikTok)\n- Use \`social_connect\` to link manually or paste an API token`,
    };
  },
};

const socialConnect: Tool = {
  id: 'social_connect',
  name: 'social_connect',
  description: 'Connect to a social platform manually with your account name or API token. For OAuth login use social_oauth instead.',
  schema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'Platform ID (twitter, instagram, facebook, linkedin, tiktok, telegram, whatsapp)' },
      accountName: { type: 'string', description: 'Your account username or handle' },
      accessToken: { type: 'string', description: 'Optional: API access token for real posting capability' },
    },
    required: ['platform', 'accountName'],
  },
  execute: async (args) => {
    const schema = z.object({
      platform: z.enum(['twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 'telegram', 'whatsapp']),
      accountName: z.string().min(1).max(200),
      accessToken: z.string().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const { platform, accountName, accessToken } = parsed.data;

    if (accessToken) {
      const ok = await socialManager.connectWithToken(platform, accessToken, accountName);
      if (!ok) return { success: false, content: '', error: `Unknown platform: ${platform}` };
      return { success: true, content: `## 🔑 Connected with Token\n\n**${platform}** linked as \`${accountName}\` with an API token. GIA can now make real API calls.` };
    }

    const ok = socialManager.connectPlatform(platform, accountName);
    if (!ok) return { success: false, content: '', error: `Unknown platform: ${platform}` };
    return { success: true, content: `## ✅ Connected to **${platform}**\n\nAccount: \`${accountName}\`\n\nFor real API posting, provide an \`accessToken\` or use \`social_oauth\`.` };
  },
};

const socialDisconnect: Tool = {
  id: 'social_disconnect',
  name: 'social_disconnect',
  description: 'Disconnect a social media platform and remove its tokens.',
  schema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'Platform ID to disconnect' },
    },
    required: ['platform'],
  },
  execute: async (args) => {
    const schema = z.object({ platform: z.string().min(1) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const ok = socialManager.disconnectPlatform(parsed.data.platform);
    return { success: true, content: ok ? `🔌 Disconnected from ${parsed.data.platform}. Tokens removed.` : `Platform "${parsed.data.platform}" not found.` };
  },
};

const socialOAuth: Tool = {
  id: 'social_oauth',
  name: 'social_oauth',
  description: 'Log in to a social platform via OAuth popup. Opens a browser popup for you to authorize GIA. Supported: twitter, instagram, facebook, linkedin, tiktok.',
  schema: {
    type: 'object',
    properties: {
      platform: { type: 'string', enum: ['twitter', 'instagram', 'facebook', 'linkedin', 'tiktok'], description: 'Platform to log in to' },
      clientId: { type: 'string', description: 'Your OAuth app client ID. You need to register an app with the platform first.' },
    },
    required: ['platform', 'clientId'],
  },
  execute: async (args) => {
    const schema = z.object({
      platform: z.enum(['twitter', 'instagram', 'facebook', 'linkedin', 'tiktok']),
      clientId: z.string().min(1, 'Client ID is required. Register an OAuth app on the platform developer portal.'),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const { platform, clientId } = parsed.data;

    const def = socialManager.getPlatformDef(platform);
    const result = await socialManager.connectViaOAuth(platform, clientId);
    if (!result.success) {
      return {
        success: false,
        content: '',
        error: result.error || 'OAuth login failed.',
      };
    }

    const platformInfo = socialManager.getPlatform(platform);
    return {
      success: true,
      content: `## ✅ OAuth Login Successful\n\n**${def?.name || platform}** connected as \`${platformInfo?.accountName || 'user'}\`\n\nGIA now has an access token for this platform. You can create and publish posts that will go live.\n\n**Developer docs:** ${def?.docUrl || 'Platform developer portal'}`,
    };
  },
};

const socialCreatePost: Tool = {
  id: 'social_create_post',
  name: 'social_create_post',
  description: 'Create a social media post as a draft or scheduled. Use social_publish to publish it later.',
  schema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'Platform to post to (twitter, instagram, facebook, linkedin, etc.)' },
      content: { type: 'string', description: 'Post content/text' },
      mediaUrls: { type: 'array', items: { type: 'string' }, description: 'Optional image/media URLs to attach' },
      scheduleTimestamp: { type: 'number', description: 'Optional Unix timestamp (ms) to schedule the post for later' },
    },
    required: ['platform', 'content'],
  },
  execute: async (args) => {
    const schema = z.object({
      platform: z.string().min(1),
      content: z.string().min(1).max(5000),
      mediaUrls: z.array(z.string().url()).optional(),
      scheduleTimestamp: z.number().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const { platform, content, mediaUrls, scheduleTimestamp } = parsed.data;
    await socialManager.createPost(platform, content, mediaUrls, scheduleTimestamp);
    const statusLabel = scheduleTimestamp ? `scheduled for ${new Date(scheduleTimestamp).toLocaleString()}` : 'saved as draft';
    const tokens = socialManager.getPlatform(platform)?.tokens;
    return {
      success: true,
      content: `## 📝 Post Created\n\n**Platform:** ${platform}\n**Status:** ${statusLabel}\n**API Ready:** ${tokens?.accessToken ? '✅ Yes — will post live' : '⚠️ No token — simulated post'}\n\n**Content:**\n> ${content.slice(0, 300)}${content.length > 300 ? '...' : ''}${mediaUrls?.length ? `\n**Media:** ${mediaUrls.length} file(s) attached` : ''}\n\nUse \`social_publish\` with post index 0 to publish when ready.`,
    };
  },
};

const socialPublish: Tool = {
  id: 'social_publish',
  name: 'social_publish',
  description: 'Publish a previously created draft post. Use social_list_posts to find the post index.',
  schema: {
    type: 'object',
    properties: {
      postIndex: { type: 'number', description: 'Index of the post to publish (0 = most recent). Use social_list_posts to find the index.' },
    },
    required: ['postIndex'],
  },
  execute: async (args) => {
    const schema = z.object({ postIndex: z.number().min(0) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    try {
      const post = await socialManager.publishPost(parsed.data.postIndex);
      let extra = '';
      if (post.status === 'failed') {
        extra = `\n\n⚠️ Real API call failed: ${post.error}. Falling back to simulated post.`;
      }
      return {
        success: true,
        content: `## ✅ Post Published\n\n**Platform:** ${post.platform}\n**Posted:** ${new Date(post.postedAt!).toLocaleString()}\n**URL:** ${post.postUrl}${extra}\n\n**Content:**\n> ${post.content.slice(0, 300)}`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const socialSchedule: Tool = {
  id: 'social_schedule',
  name: 'social_schedule',
  description: 'Schedule a draft post for future publishing.',
  schema: {
    type: 'object',
    properties: {
      postIndex: { type: 'number', description: 'Index of the post to schedule (0 = most recent)' },
      timestamp: { type: 'number', description: 'Unix timestamp in milliseconds for when to publish' },
    },
    required: ['postIndex', 'timestamp'],
  },
  execute: async (args) => {
    const schema = z.object({ postIndex: z.number().min(0), timestamp: z.number().min(Date.now()) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    try {
      socialManager.schedulePost(parsed.data.postIndex, parsed.data.timestamp);
      return {
        success: true,
        content: `📅 Post scheduled for ${new Date(parsed.data.timestamp).toLocaleString()}.`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const socialListPosts: Tool = {
  id: 'social_list_posts',
  name: 'social_list_posts',
  description: 'List all social media posts filtered by platform and/or status (draft, scheduled, posted, failed).',
  schema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'Optional: filter by platform ID' },
      status: { type: 'string', enum: ['draft', 'scheduled', 'posted', 'failed'], description: 'Optional: filter by status' },
    },
  },
  execute: async (args) => {
    const schema = z.object({
      platform: z.string().optional(),
      status: z.enum(['draft', 'scheduled', 'posted', 'failed']).optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const posts = socialManager.getPosts(parsed.data.platform, parsed.data.status);
    if (posts.length === 0) return { success: true, content: 'No posts found matching the criteria.' };
    const lines = posts.map((p, i) => {
      const statusIcon = p.status === 'posted' ? '✅' : p.status === 'failed' ? '❌' : p.status === 'scheduled' ? '📅' : '📝';
      return `${statusIcon} **[${i}]** ${p.platform} — ${p.content.slice(0, 80)}${p.content.length > 80 ? '...' : ''}\n   Status: ${p.status}${p.scheduledAt ? ` | Scheduled: ${new Date(p.scheduledAt).toLocaleString()}` : ''}${p.postUrl ? ` | ${p.postUrl}` : ''}${p.error ? ` | Error: ${p.error}` : ''}`;
    });
    return { success: true, content: `## Social Posts\n\n${lines.join('\n\n')}` };
  },
};

const socialDeletePost: Tool = {
  id: 'social_delete_post',
  name: 'social_delete_post',
  description: 'Delete a social media post by its index.',
  schema: {
    type: 'object',
    properties: {
      postIndex: { type: 'number', description: 'Index of the post to delete' },
    },
    required: ['postIndex'],
  },
  execute: async (args) => {
    const schema = z.object({ postIndex: z.number().min(0) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const ok = socialManager.deletePost(parsed.data.postIndex);
    return { success: ok, content: ok ? '🗑️ Post deleted.' : '', error: ok ? undefined : 'Post not found.' };
  },
};

const socialAnalytics: Tool = {
  id: 'social_analytics',
  name: 'social_analytics',
  description: 'Get analytics/insights for a connected social media platform (followers, engagement, impressions). If OAuth tokens exist, returns real data.',
  schema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'Platform ID to get analytics for' },
    },
    required: ['platform'],
  },
  execute: async (args) => {
    const schema = z.object({ platform: z.string().min(1) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    try {
      const stats = await socialManager.getAnalytics(parsed.data.platform);
      const tokens = socialManager.getPlatform(parsed.data.platform)?.tokens;
      return {
        success: true,
        content: `## 📊 ${stats.platform} Analytics\n\n- **Followers:** ${stats.followers.toLocaleString()}\n- **Engagement Rate:** ${stats.engagement.toFixed(2)}%\n- **Impressions:** ${stats.impressions.toLocaleString()}\n- **Posts This Month:** ${stats.postsThisMonth}\n\n${tokens?.accessToken ? '✅ Real data (authenticated)' : '⚠️ Simulated data (connect with OAuth or token for real stats)'}`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const socialMediaTools: Tool[] = [
  socialListPlatforms,
  socialConnect,
  socialDisconnect,
  socialOAuth,
  socialCreatePost,
  socialPublish,
  socialSchedule,
  socialListPosts,
  socialDeletePost,
  socialAnalytics,
];
