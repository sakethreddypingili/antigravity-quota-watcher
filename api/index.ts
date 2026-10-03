import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import {
  generateAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  refreshAccessToken,
  getGoogleOAuthConfig,
  getRedirectUri,
  getCloudProjectId,
} from '../lib/auth/google.ts';
import {
  getSessionFromRequest,
  setSessionCookie,
  clearSessionCookie,
} from '../lib/auth/session.ts';
import { fetchAntigravityQuota } from '../lib/antigravity/quota.ts';
import type { AuthSession, QuotaDataResponse } from '../src/types.ts';

const app = express();

app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Check OAuth configuration status
app.get('/api/auth/config', (req, res) => {
  const config = getGoogleOAuthConfig(req);
  res.json({
    hasConfig: config.isConfigured,
    missingVars: config.missing,
    clientId: config.clientId,
    projectId: config.projectId,
    redirectUri: config.redirectUri,
    appUrl: process.env.APP_URL || null,
  });
});

// Get OAuth URL
app.get('/api/auth/url', (req, res) => {
  try {
    const config = getGoogleOAuthConfig(req);
    if (!config.isConfigured) {
      return res.status(400).json({
        error: 'Google OAuth is not configured.',
        missingVars: config.missing,
        redirectUri: config.redirectUri,
      });
    }

    const state = Math.random().toString(36).substring(2, 15);
    const url = generateAuthUrl(req, state);
    res.json({ url, redirectUri: config.redirectUri });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Handle OAuth callback
const oauthCallbackHandler = async (req: express.Request, res: express.Response) => {
  const { code, error, error_description } = req.query;

  if (error) {
    const msg = error_description || error;
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
            .card { background: #1e293b; padding: 2rem; border-radius: 1rem; max-width: 480px; text-align: center; border: 1px solid #334155; }
            h1 { color: #f87171; font-size: 1.25rem; margin-bottom: 0.5rem; }
            p { color: #94a3b8; font-size: 0.875rem; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Google Authorization Failed</h1>
            <p>${String(msg)}</p>
            <button onclick="window.close()" style="margin-top:1rem;background:#3b82f6;color:#fff;border:none;padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;">Close Window</button>
          </div>
        </body>
      </html>
    `);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Authorization code missing in callback request.');
  }

  try {
    const redirectUri = getRedirectUri(req);
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const user = await fetchGoogleUserInfo(tokens.access_token);

    const session: AuthSession = {
      user,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        token_type: tokens.token_type,
        scope: tokens.scope,
      },
      createdAt: Date.now(),
    };

    setSessionCookie(res, session);

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
            .card { background: #1e293b; padding: 2rem; border-radius: 1rem; max-width: 420px; text-align: center; border: 1px solid #334155; }
            h1 { color: #34d399; font-size: 1.25rem; margin-bottom: 0.5rem; }
            p { color: #94a3b8; font-size: 0.875rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Signed in as ${user.email}</h1>
            <p>Authentication complete. Returning to your dashboard...</p>
          </div>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', email: ${JSON.stringify(user.email)} }, '*');
                setTimeout(() => window.close(), 600);
              } else {
                window.location.href = '/';
              }
            } catch (e) {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Token Exchange Failed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
            .card { background: #1e293b; padding: 2rem; border-radius: 1rem; max-width: 480px; text-align: center; border: 1px solid #334155; }
            h1 { color: #f87171; font-size: 1.25rem; margin-bottom: 0.5rem; }
            p { color: #94a3b8; font-size: 0.875rem; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Authentication Error</h1>
            <p>${errorMsg}</p>
            <button onclick="window.close()" style="margin-top:1rem;background:#3b82f6;color:#fff;border:none;padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;">Close</button>
          </div>
        </body>
      </html>
    `);
  }
};

app.get('/api/auth/callback', oauthCallbackHandler);
app.get('/auth/callback', oauthCallbackHandler);

// Get current user session status
app.get('/api/auth/me', (req, res) => {
  const config = getGoogleOAuthConfig(req);
  const session = getSessionFromRequest(req);

  if (!session) {
    return res.json({
      authenticated: false,
      hasConfig: config.isConfigured,
      missingVars: config.missing,
      clientId: config.clientId,
      projectId: config.projectId,
      redirectUri: config.redirectUri,
    });
  }

  res.json({
    authenticated: true,
    user: {
      email: session.user.email,
      name: session.user.name,
      picture: session.user.picture,
    },
    expiresAt: session.tokens.expiry_date,
    hasConfig: config.isConfigured,
    clientId: config.clientId,
    projectId: config.projectId,
    redirectUri: config.redirectUri,
  });
});

// Logout
app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true, message: 'Signed out successfully' });
});

// Quota endpoint
const quotaHandler = async (req: express.Request, res: express.Response) => {
  const session = getSessionFromRequest(req);

  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated. Please sign in with your Google account.',
      errorCode: 'UNAUTHENTICATED',
    });
  }

  let accessToken = session.tokens.access_token;
  const now = Date.now();
  const expiry = session.tokens.expiry_date;

  if (expiry && expiry - now < 60000 && session.tokens.refresh_token) {
    try {
      const freshTokens = await refreshAccessToken(session.tokens.refresh_token);
      session.tokens.access_token = freshTokens.access_token;
      if (freshTokens.expiry_date) {
        session.tokens.expiry_date = freshTokens.expiry_date;
      }
      accessToken = freshTokens.access_token;
      setSessionCookie(res, session);
    } catch {
      // ignore
    }
  }

  let quotaResult = await fetchAntigravityQuota(accessToken);

  if (
    !quotaResult.success &&
    quotaResult.errorCode === 'TOKEN_EXPIRED' &&
    session.tokens.refresh_token
  ) {
    try {
      const freshTokens = await refreshAccessToken(session.tokens.refresh_token);
      session.tokens.access_token = freshTokens.access_token;
      if (freshTokens.expiry_date) {
        session.tokens.expiry_date = freshTokens.expiry_date;
      }
      accessToken = freshTokens.access_token;
      setSessionCookie(res, session);

      quotaResult = await fetchAntigravityQuota(accessToken);
    } catch {
      // ignore
    }
  }

  const responsePayload: QuotaDataResponse = {
    success: quotaResult.success,
    account: {
      email: session.user.email,
      name: session.user.name,
      picture: session.user.picture,
    },
    lastUpdated: new Date().toISOString(),
    models: quotaResult.models,
    tierInfo: quotaResult.tierInfo,
    diagnostics: quotaResult.diagnostics,
    error: quotaResult.error,
    errorCode: quotaResult.errorCode,
    details: quotaResult.details,
  };

  res.json(responsePayload);
};

app.get('/api/quota', quotaHandler);
app.post('/api/quota/refresh', quotaHandler);

export default app;
