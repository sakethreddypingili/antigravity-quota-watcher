import type { Request } from 'express';
import type { GoogleUser } from '../../src/types';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

// OAuth client credentials with access to cloudcode-pa.googleapis.com (Antigravity's client).
// Supply them via GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env; they are intentionally not committed.
export function getClientId(): string {
  return (process.env.GOOGLE_CLIENT_ID || '').trim();
}

export function getClientSecret(): string {
  return (process.env.GOOGLE_CLIENT_SECRET || '').trim();
}


export function getCloudProjectId(): string {
  return (process.env.GOOGLE_CLOUD_PROJECT || '').trim();
}

export const REQUIRED_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/aicode',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
];

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  expiry_date?: number;
  token_type: string;
  scope?: string;
  id_token?: string;
}

export function getRedirectUri(req?: Request): string {
  if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.trim() !== '') {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }

  if (process.env.APP_URL && process.env.APP_URL.trim() !== '') {
    const baseUrl = process.env.APP_URL.trim().replace(/\/+$/, '');
    return `${baseUrl}/api/auth/callback`;
  }

  if (req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${process.env.PORT || '3001'}`;
    return `${proto}://${host}/api/auth/callback`;
  }

  return `http://localhost:${process.env.PORT || '3001'}/api/auth/callback`;
}

export function getGoogleOAuthConfig(req?: Request) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const projectId = getCloudProjectId();
  const redirectUri = getRedirectUri(req);

  const missing: string[] = [];
  if (!clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');

  return {
    clientId,
    clientSecret,
    projectId,
    redirectUri,
    isConfigured: missing.length === 0,
    missing,
  };
}

/**
 * Generate the Google OAuth authorization URL
 */
export function generateAuthUrl(req: Request, state?: string): string {
  const { clientId, redirectUri } = getGoogleOAuthConfig(req);
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured in environment variables.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: REQUIRED_SCOPES.join(' '),
    access_type: 'offline', // Requests refresh_token
    prompt: 'consent', // Ensures refresh_token is granted
    include_granted_scopes: 'true',
  });

  if (state) {
    params.set('state', state);
  }

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchange OAuth authorization code for Google Access & Refresh tokens
 */
export function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokens> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials (GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET) missing.');
  }

  return fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  }).then(async (res) => {
    if (!res.ok) {
      const errorText = await res.text();
      let errorJson: { error_description?: string; error?: string } = {};
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // fallback
      }
      throw new Error(
        errorJson.error_description || errorJson.error || `Failed to exchange code: HTTP ${res.status} ${errorText}`
      );
    }
    const data = (await res.json()) as GoogleTokens;
    if (data.expires_in) {
      data.expiry_date = Date.now() + data.expires_in * 1000;
    }
    return data;
  });
}

/**
 * Refresh an expired access token using the stored refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials missing for refresh');
  }

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to refresh token: HTTP ${res.status} ${errorText}`);
  }

  const data = (await res.json()) as GoogleTokens;
  if (data.expires_in) {
    data.expiry_date = Date.now() + data.expires_in * 1000;
  }
  return data;
}

/**
 * Fetch authenticated Google account user info (email, name, avatar)
 */
export function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUser> {
  return fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).then(async (res) => {
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch user profile: HTTP ${res.status} ${errorText}`);
    }
    return (await res.json()) as GoogleUser;
  });
}
