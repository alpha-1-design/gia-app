import oauthManager, { type OAuthConfig, type OAuthTokens } from './OAuthManager';
import { getPlatformDef, type PlatformDef } from './PlatformConfig';
import { postToPlatform, getProfileInfo, getPlatformAnalytics } from './SocialClient';

export interface SocialPlatform {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  /** True only when a credential capable of real API calls is present.
   *  `connected` can be true (config saved) while `live` is false
   *  (posts/analytics will be simulated until a real token is added). */
  live: boolean;
  accountName?: string;
  tokens?: OAuthTokens;
}

const LIVE_TOKEN_KEYS = ['accessToken', 'apiToken', 'botToken', 'bearerToken'] as const;

function computeLive(tokens?: OAuthTokens): boolean {
  if (!tokens) return false;
  return LIVE_TOKEN_KEYS.some(k => Boolean((tokens as unknown as Record<string, unknown>)[k]));
}

export interface SocialPost {
  platform: string;
  content: string;
  mediaUrls?: string[];
  scheduledAt?: number;
  status: 'draft' | 'scheduled' | 'posted' | 'simulated' | 'failed';
  postedAt?: number;
  postUrl?: string;
  error?: string;
}

export interface SocialAnalytics {
  platform: string;
  followers: number;
  engagement: number;
  impressions: number;
  postsThisMonth: number;
  /** False when no real API data could be fetched — numbers are zeroed, not guessed. */
  live: boolean;
}

class SocialManager {
  private platforms: Map<string, SocialPlatform> = new Map();
  private posts: SocialPost[] = [];
  private storeKey = 'gia-social-posts';
  private tokensKey = 'gia-social-tokens';

  constructor() {
    this.registerDefaults();
    this.loadTokens();
    this.loadPosts();
  }

  private registerDefaults() {
    const defaults: SocialPlatform[] = [
      { id: 'twitter', name: 'X (Twitter)', icon: 'message-circle', connected: false, live: false },
      { id: 'instagram', name: 'Instagram', icon: 'camera', connected: false, live: false },
      { id: 'facebook', name: 'Facebook', icon: 'thumbs-up', connected: false, live: false },
      { id: 'linkedin', name: 'LinkedIn', icon: 'briefcase', connected: false, live: false },
      { id: 'tiktok', name: 'TikTok', icon: 'music', connected: false, live: false },
      { id: 'telegram', name: 'Telegram', icon: 'send', connected: false, live: false },
      { id: 'whatsapp', name: 'WhatsApp', icon: 'message-circle', connected: false, live: false },
    ];
    for (const p of defaults) this.platforms.set(p.id, p);
  }

  private loadTokens() {
    try {
      const raw = localStorage.getItem(this.tokensKey);
      if (raw) {
        const tokens: Record<string, OAuthTokens> = JSON.parse(raw);
        for (const [id, t] of Object.entries(tokens)) {
          const platform = this.platforms.get(id);
          if (platform) {
            platform.tokens = t;
            platform.connected = true;
            platform.live = computeLive(t);
            if (t.expiresAt && t.expiresAt > Date.now()) {
              platform.connected = true;
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  private saveTokens() {
    const tokens: Record<string, OAuthTokens> = {};
    for (const [id, p] of this.platforms) {
      if (p.tokens) tokens[id] = p.tokens;
    }
    try {
      localStorage.setItem(this.tokensKey, JSON.stringify(tokens));
    } catch { /* ignore */ }
  }

  private loadPosts() {
    try {
      const raw = localStorage.getItem(this.storeKey);
      if (raw) this.posts = JSON.parse(raw);
    } catch { this.posts = []; }
  }

  private savePosts() {
    try {
      localStorage.setItem(this.storeKey, JSON.stringify(this.posts));
    } catch { /* ignore */ }
  }

  getPlatforms(): SocialPlatform[] {
    return Array.from(this.platforms.values());
  }

  getPlatform(id: string): SocialPlatform | undefined {
    return this.platforms.get(id);
  }

  getPlatformDef(id: string): PlatformDef | undefined {
    return getPlatformDef(id);
  }

  connectPlatform(platformId: string, config: Record<string, string>): boolean {
    const platform = this.platforms.get(platformId);
    if (!platform) return false;
    platform.connected = true;
    platform.accountName = config.accountName || config.accessToken || config.botToken || config.clientId || platformId;
    platform.tokens = { ...(platform.tokens || {}), ...config } as OAuthTokens;
    platform.live = computeLive(platform.tokens);
    this.saveTokens();
    return true;
  }

  disconnectPlatform(platformId: string): boolean {
    const platform = this.platforms.get(platformId);
    if (!platform) return false;
    platform.connected = false;
    platform.live = false;
    platform.accountName = undefined;
    platform.tokens = undefined;
    this.saveTokens();
    return true;
  }

  async connectViaOAuth(platformId: string, clientId: string): Promise<{ success: boolean; error?: string }> {
    const def = getPlatformDef(platformId);
    if (!def) return { success: false, error: `Unknown platform: ${platformId}` };
    if (!def.oauth) return { success: false, error: `${def.name} doesn't support OAuth login. Use connector-based setup instead.` };

    const config: OAuthConfig = { ...def.oauth, clientId };
    try {
      const tokens = await oauthManager.startFlow(config);
      const platform = this.platforms.get(platformId);
      if (!platform) return { success: false, error: 'Platform not found' };

      platform.tokens = tokens;
      platform.connected = true;
      platform.live = computeLive(tokens);

      try {
        const profile = await getProfileInfo(platformId, tokens);
        platform.accountName = profile.username || profile.name;
      } catch {
        platform.accountName = 'oauth-user';
      }

      this.saveTokens();
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'OAuth failed' };
    }
  }

  async connectWithToken(platformId: string, accessToken: string, accountName?: string): Promise<boolean> {
    const platform = this.platforms.get(platformId);
    if (!platform) return false;
    platform.tokens = { accessToken };
    platform.connected = true;
    platform.live = computeLive(platform.tokens);
    platform.accountName = accountName || 'token-user';
    this.saveTokens();
    return true;
  }

  async createPost(
    platform: string,
    content: string,
    mediaUrls?: string[],
    scheduleAt?: number,
  ): Promise<SocialPost> {
    const post: SocialPost = {
      platform,
      content,
      mediaUrls,
      scheduledAt: scheduleAt,
      status: scheduleAt ? 'scheduled' : 'draft',
    };
    this.posts.unshift(post);
    this.savePosts();
    return post;
  }

  async publishPost(postId: number): Promise<SocialPost> {
    const post = this.posts[postId];
    if (!post) throw new Error('Post not found');

    const platform = this.platforms.get(post.platform);
    const tokens = platform?.tokens;
    const live = computeLive(tokens);

    try {
      if (live) {
        const result = await postToPlatform(post.platform, post.content, tokens!);
        if (result.success) {
          post.status = 'posted';
          post.postedAt = Date.now();
          post.postUrl = result.postUrl;
        } else {
          post.status = 'failed';
          post.error = result.error;
          this.savePosts();
          throw new Error(result.error);
        }
      } else {
        // No live credential — do NOT fabricate a plausible-looking URL or
        // claim 'posted'. Nothing was actually sent to the platform.
        post.status = 'simulated';
        post.postedAt = Date.now();
        post.postUrl = undefined;
      }
      this.savePosts();
      return post;
    } catch (e) {
      post.status = 'failed';
      post.error = e instanceof Error ? e.message : 'Unknown error';
      this.savePosts();
      throw e;
    }
  }

  schedulePost(postId: number, timestamp: number): void {
    const post = this.posts[postId];
    if (!post) throw new Error('Post not found');
    post.scheduledAt = timestamp;
    post.status = 'scheduled';
    this.savePosts();
  }

  deletePost(postId: number): boolean {
    if (postId >= 0 && postId < this.posts.length) {
      this.posts.splice(postId, 1);
      this.savePosts();
      return true;
    }
    return false;
  }

  getPosts(platform?: string, status?: string): SocialPost[] {
    let filtered = this.posts;
    if (platform) filtered = filtered.filter(p => p.platform === platform);
    if (status) filtered = filtered.filter(p => p.status === status);
    return filtered;
  }

  async getAnalytics(platform: string): Promise<SocialAnalytics> {
    const tokens = this.platforms.get(platform)?.tokens;
    if (tokens?.accessToken) {
      try {
        const real = await getPlatformAnalytics(platform, tokens);
        if (real.followers > 0) return { ...real, live: true };
      } catch { /* fall through to unavailable state below */ }
    }
    // No live credential, or the real API call failed — report unavailable
    // rather than inventing plausible-looking numbers.
    return {
      platform,
      followers: 0,
      engagement: 0,
      impressions: 0,
      postsThisMonth: 0,
      live: false,
    };
  }
}

export default new SocialManager();
