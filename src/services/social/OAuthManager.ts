export interface OAuthConfig {
  platformId: string;
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes: string;
  redirectUri: string;
  clientId: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => chars[b % chars.length]).join('');
}

class OAuthManager {
  private pendingVerifier: string | null = null;
  private pendingState: string | null = null;

  getRedirectUri(): string {
    const origin = window.location.origin;
    return `${origin}/oauth-callback.html`;
  }

  async startFlow(config: OAuthConfig): Promise<OAuthTokens> {
    const codeVerifier = generateRandomString(64);
    const state = generateRandomString(32);

    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
    const codeChallenge = base64UrlEncode(hash);

    this.pendingVerifier = codeVerifier;
    this.pendingState = state;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri || this.getRedirectUri(),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      scope: config.scopes,
    });

    const authUrl = `${config.authUrl}?${params.toString()}`;

    const tokens = await new Promise<OAuthTokens>((resolve, reject) => {
      const popup = window.open(authUrl, 'oauth-popup', 'width=600,height=700,scrollbars=yes');

      if (!popup) {
        reject(new Error('Popup blocked. Allow popups for this site and try again.'));
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== 'oauth-callback') return;

        window.removeEventListener('message', handleMessage);
        clearInterval(pollTimer);

        if (event.data.error) {
          reject(new Error(`OAuth error: ${event.data.error}`));
          return;
        }

        if (event.data.state !== state) {
          reject(new Error('State mismatch — possible CSRF attack'));
          return;
        }

        this.pendingState = null;

        const code = event.data.code;
        if (!code) {
          reject(new Error('No authorization code received'));
          return;
        }

        this.exchangeCode(config, code, codeVerifier).then(resolve).catch(reject);
      };

      window.addEventListener('message', handleMessage);

      const pollTimer = setInterval(() => {
        if (popup.closed) {
          window.removeEventListener('message', handleMessage);
          clearInterval(pollTimer);
          reject(new Error('OAuth popup was closed before completing login.'));
        }
      }, 500);
    });

    this.pendingVerifier = null;
    return tokens;
  }

  private async exchangeCode(
    config: OAuthConfig,
    code: string,
    codeVerifier: string,
  ): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri || this.getRedirectUri(),
      client_id: config.clientId,
      code_verifier: codeVerifier,
    });

    const res = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.error || 'Token exchange failed');

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      scope: data.scope,
    };
  }

  async refreshToken(config: OAuthConfig, refreshToken: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
    });

    const res = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.error || 'Token refresh failed');

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      scope: data.scope,
    };
  }

  async revokeToken(config: OAuthConfig, token: string): Promise<void> {
    if (!config.revokeUrl) return;
    const body = new URLSearchParams({ token, client_id: config.clientId });
    await fetch(config.revokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }
}

export default new OAuthManager();
