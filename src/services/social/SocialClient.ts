import type { OAuthTokens } from './OAuthManager';

interface PostResult {
  success: boolean;
  postUrl?: string;
  error?: string;
}

interface ProfileInfo {
  name: string;
  username: string;
  bio?: string;
  followers: number;
  profileUrl: string;
}

interface AnalyticsResult {
  platform: string;
  followers: number;
  engagement: number;
  impressions: number;
  postsThisMonth: number;
}

async function fetchWithToken(url: string, options: RequestInit = {}, token: string): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
}

export async function postToPlatform(
  platform: string,
  content: string,
  tokens: OAuthTokens,
): Promise<PostResult> {
  switch (platform) {
    case 'twitter':
      return postToTwitter(content, tokens);
    case 'facebook':
      return postToFacebook(content, tokens);
    case 'linkedin':
      return postToLinkedIn(content, tokens);
    case 'telegram':
      return { success: false, error: 'Use telegram_post tool for Telegram' };
    default:
      return { success: false, error: `Real API posting not yet supported for ${platform}` };
  }
}

export async function getProfileInfo(
  platform: string,
  tokens: OAuthTokens,
): Promise<ProfileInfo> {
  switch (platform) {
    case 'twitter':
      return getTwitterProfile(tokens);
    case 'facebook':
      return getFacebookProfile(tokens);
    case 'linkedin':
      return getLinkedInProfile(tokens);
    default:
      return {
        name: 'Connected User',
        username: 'user',
        followers: 0,
        profileUrl: `https://${platform}.com`,
      };
  }
}

export async function getPlatformAnalytics(
  platform: string,
  tokens: OAuthTokens,
): Promise<AnalyticsResult> {
  if (platform === 'twitter') {
    try {
      const me = await getTwitterProfile(tokens);
      return {
        platform,
        followers: me.followers,
        engagement: 0,
        impressions: 0,
        postsThisMonth: 0,
      };
    } catch {
      return { platform, followers: 0, engagement: 0, impressions: 0, postsThisMonth: 0 };
    }
  }
  return { platform, followers: 0, engagement: 0, impressions: 0, postsThisMonth: 0 };
}

async function postToTwitter(
  content: string,
  tokens: OAuthTokens,
): Promise<PostResult> {
  const res = await fetchWithToken('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: content }),
  }, tokens.accessToken);

  const data = await res.json();
  if (!res.ok) return { success: false, error: data.detail || data.title || 'Twitter API error' };
  return { success: true, postUrl: `https://twitter.com/twitter/status/${data.data.id}` };
}

async function postToFacebook(
  content: string,
  tokens: OAuthTokens,
): Promise<PostResult> {
  const meRes = await fetchWithToken('https://graph.facebook.com/v22.0/me/accounts?limit=1', {}, tokens.accessToken);
  const meData = await meRes.json();
  const pageId = meData.data?.[0]?.id;
  if (!pageId) return { success: false, error: 'No Facebook page found. Make sure you have a page connected.' };

  const res = await fetch(`https://graph.facebook.com/v22.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: content, access_token: tokens.accessToken }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error?.message || 'Facebook API error' };
  return { success: true, postUrl: `https://facebook.com/${data.id}` };
}

async function postToLinkedIn(
  content: string,
  tokens: OAuthTokens,
): Promise<PostResult> {
  const meRes = await fetchWithToken('https://api.linkedin.com/v2/userinfo', {}, tokens.accessToken);
  const meData = await meRes.json();
  const sub = meData.sub;
  if (!sub) return { success: false, error: 'Could not get LinkedIn profile' };

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202412',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: `urn:li:person:${sub}`,
      lifecycleState: 'PUBLISHED',
      visibility: 'PUBLIC',
      commentary: content,
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.message || data.error?.message || 'LinkedIn API error' };
  return { success: true, postUrl: `https://linkedin.com/posts/${sub}` };
}

async function getTwitterProfile(tokens: OAuthTokens): Promise<ProfileInfo> {
  const res = await fetchWithToken('https://api.twitter.com/2/users/me?user.fields=public_metrics,description', {}, tokens.accessToken);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to get Twitter profile');
  return {
    name: data.data.name,
    username: data.data.username,
    bio: data.data.description,
    followers: data.data.public_metrics?.followers_count || 0,
    profileUrl: `https://twitter.com/${data.data.username}`,
  };
}

async function getFacebookProfile(tokens: OAuthTokens): Promise<ProfileInfo> {
  const res = await fetchWithToken('https://graph.facebook.com/v22.0/me?fields=name,accounts{name,id,fan_count}', {}, tokens.accessToken);
  const data = await res.json();
  const page = data.accounts?.data?.[0];
  return {
    name: page?.name || data.name,
    username: data.id || '',
    followers: page?.fan_count || 0,
    profileUrl: `https://facebook.com/${page?.id || data.id}`,
  };
}

async function getLinkedInProfile(tokens: OAuthTokens): Promise<ProfileInfo> {
  const res = await fetchWithToken('https://api.linkedin.com/v2/userinfo', {}, tokens.accessToken);
  const data = await res.json();
  return {
    name: data.name || '',
    username: data.sub || '',
    profileUrl: `https://linkedin.com/in/${data.sub}`,
    followers: 0,
  };
}
