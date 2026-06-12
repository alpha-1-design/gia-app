import type { OAuthConfig } from './OAuthManager';

export interface PlatformDef {
  id: string;
  name: string;
  icon: string;
  oauth: OAuthConfig | null;
  supportsOAuth: boolean;
  supportsToken: boolean;
  needsAppRegistration: boolean;
  docUrl: string;
}

const REDIRECT = `${window.location.origin}/oauth-callback.html`;

export const PLATFORMS: PlatformDef[] = [
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: 'message-circle',
    supportsOAuth: true,
    supportsToken: true,
    needsAppRegistration: true,
    docUrl: 'https://developer.twitter.com/en/portal/dashboard',
    oauth: {
      platformId: 'twitter',
      authUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
      revokeUrl: 'https://api.twitter.com/2/oauth2/revoke',
      scopes: 'tweet.read tweet.write users.read offline.access',
      redirectUri: REDIRECT,
      clientId: '',
    },
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'camera',
    supportsOAuth: true,
    supportsToken: true,
    needsAppRegistration: true,
    docUrl: 'https://developers.facebook.com/docs/instagram-basic-display-api/getting-started',
    oauth: {
      platformId: 'instagram',
      authUrl: 'https://www.instagram.com/oauth/authorize',
      tokenUrl: 'https://api.instagram.com/oauth/access_token',
      scopes: 'instagram_basic instagram_content_publish',
      redirectUri: REDIRECT,
      clientId: '',
    },
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'thumbs-up',
    supportsOAuth: true,
    supportsToken: true,
    needsAppRegistration: true,
    docUrl: 'https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow',
    oauth: {
      platformId: 'facebook',
      authUrl: 'https://www.facebook.com/v22.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v22.0/oauth/access_token',
      scopes: 'pages_manage_posts pages_read_engagement',
      redirectUri: REDIRECT,
      clientId: '',
    },
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: 'briefcase',
    supportsOAuth: true,
    supportsToken: true,
    needsAppRegistration: true,
    docUrl: 'https://developer.linkedin.com/docs/oauth2',
    oauth: {
      platformId: 'linkedin',
      authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      scopes: 'w_member_social email openid profile',
      redirectUri: REDIRECT,
      clientId: '',
    },
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'music',
    supportsOAuth: true,
    supportsToken: true,
    needsAppRegistration: true,
    docUrl: 'https://developers.tiktok.com/documentation/login-kit-web/manual-flow',
    oauth: {
      platformId: 'tiktok',
      authUrl: 'https://www.tiktok.com/v2/auth/authorize',
      tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token',
      scopes: 'user.info.basic video.publish',
      redirectUri: REDIRECT,
      clientId: '',
    },
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: 'send',
    supportsOAuth: false,
    supportsToken: true,
    needsAppRegistration: false,
    docUrl: 'https://core.telegram.org/bots/tutorial',
    oauth: null,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: 'message-circle',
    supportsOAuth: false,
    supportsToken: true,
    needsAppRegistration: true,
    docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    oauth: null,
  },
];

export function getPlatformDef(id: string): PlatformDef | undefined {
  return PLATFORMS.find(p => p.id === id);
}
