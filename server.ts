import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  generateAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  refreshAccessToken,
  getGoogleOAuthConfig,
  getRedirectUri,
  getCloudProjectId,
} from './lib/auth/google';
import {
  getSessionFromRequest,
  setSessionCookie,
  clearSessionCookie,
} from './lib/auth/session';
import { fetchAntigravityQuota } from './lib/antigravity/quota';
import { discoverLocalAntigravityServer, queryLocalUserStatus } from './lib/antigravity/localServer';
import { fallbackStore, getConvexClient, type StoredAccount } from './lib/db/convex';
import type { AuthSession, QuotaDataResponse, AccountSummary, AccountsListResponse } from './src/types';

export function createApiApp() {
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
      suggestedRedirectUris: [
        config.redirectUri,
        ...(process.env.APP_URL ? [`${process.env.APP_URL.replace(/\/+$/, '')}/api/auth/callback`] : []),
        'http://localhost:3000/api/auth/callback',
      ],
    });
  });

  // Get OAuth URL (supports mode=login or mode=link)
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

      const mode = req.query.mode === 'link' ? 'link' : 'login';
      const session = getSessionFromRequest(req);
      const linkEmail = mode === 'link' ? session?.user?.email : undefined;

      const statePayload = JSON.stringify({
        nonce: Math.random().toString(36).substring(2, 15),
        mode,
        linkEmail,
      });
      const state = Buffer.from(statePayload).toString('base64url');

      const url = generateAuthUrl(req, state);
      res.json({ url, redirectUri: config.redirectUri });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });


  // Handle OAuth callback (supports both /api/auth/callback and /auth/callback)
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
              button { margin-top: 1rem; background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Google Authorization Failed</h1>
              <p>${String(msg)}</p>
              <button onclick="window.close()">Close Window</button>
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

      // Decode state to get mode and target link user
      let mode = 'login';
      let linkWithEmail: string | undefined = undefined;
      const stateParam = req.query.state;
      if (typeof stateParam === 'string') {
        try {
          const parsedState = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8'));
          mode = parsedState.mode || 'login';
          linkWithEmail = parsedState.linkEmail;
        } catch {
          // Legacy state format
        }
      }

      setSessionCookie(res, session, req);

      // Persist to Convex database: ONLY link workspace if mode === 'link' and linkWithEmail is provided
      if (tokens.refresh_token) {
        try {
          const accountId = await fallbackStore.upsertAccount({
            email: user.email,
            name: user.name,
            picture: user.picture,
            refreshToken: tokens.refresh_token,
            accessToken: tokens.access_token,
            tokenExpiry: tokens.expiry_date,
            linkWithEmail: mode === 'link' ? linkWithEmail : undefined,
          });

          // Fetch initial quotas and save snapshot to Convex
          fetchAntigravityQuota(tokens.access_token).then(async (res) => {
            if (res.success && res.models.length > 0) {
              await fallbackStore.saveQuota(accountId, user.email, res.models, res.tierInfo, res.groups);
            }
          }).catch(console.error);
        } catch (storeErr) {
          console.error('Failed to store account in Convex:', storeErr);
        }
      }



      // Return small HTML snippet that communicates with opener or redirects
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

  // Relay code endpoint: exchange code or auth callback URL from remote/mobile devices seamlessly
  app.post('/api/auth/relay-code', async (req, res) => {
    try {
      let { code, state, url } = req.body || {};
      if (url && !code) {
        try {
          const parsed = new URL(url);
          code = parsed.searchParams.get('code');
          if (!state) state = parsed.searchParams.get('state');
        } catch {
          // If plain query string was passed
          const match = url.match(/[?&]code=([^&]+)/);
          if (match) code = decodeURIComponent(match[1]);
          const stateMatch = url.match(/[?&]state=([^&]+)/);
          if (stateMatch) state = decodeURIComponent(stateMatch[1]);
        }
      }

      if (!code) {
        return res.status(400).json({ success: false, error: 'Authorization code is required' });
      }

      code = code.trim();
      if (code.startsWith('code=')) {
        code = code.slice(5);
      }
      code = decodeURIComponent(code);

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

      let mode = 'login';
      let linkWithEmail: string | undefined = undefined;
      if (typeof state === 'string') {
        try {
          const parsedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
          mode = parsedState.mode || 'login';
          linkWithEmail = parsedState.linkEmail;
        } catch {}
      }

      setSessionCookie(res, session, req);

      if (tokens.refresh_token) {
        try {
          const accountId = await fallbackStore.upsertAccount({
            email: user.email,
            name: user.name,
            picture: user.picture,
            refreshToken: tokens.refresh_token,
            accessToken: tokens.access_token,
            tokenExpiry: tokens.expiry_date,
            linkWithEmail: mode === 'link' ? linkWithEmail : undefined,
          });

          fetchAntigravityQuota(tokens.access_token).then(async (qRes) => {
            if (qRes.success && qRes.models.length > 0) {
              await fallbackStore.saveQuota(accountId, user.email, qRes.models, qRes.tierInfo, qRes.groups);
            }
          }).catch(console.error);
        } catch (storeErr) {
          console.error('Failed to store account in Convex:', storeErr);
        }
      }

      return res.json({
        success: true,
        user: {
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Relay code exchange failed:', errorMsg);
      return res.status(500).json({ success: false, error: errorMsg });
    }
  });

  // Get current user session status
  app.get('/api/auth/me', async (req, res) => {
    const config = getGoogleOAuthConfig(req);
    const session = getSessionFromRequest(req);

    if (session) {
      return res.json({
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
        providerMode: 'cloudcode_api',
        localServerDetected: false,
      });
    }

    res.json({
      authenticated: false,
      hasConfig: config.isConfigured,
      missingVars: config.missing,
      clientId: config.clientId,
      projectId: config.projectId,
      redirectUri: config.redirectUri,
      providerMode: 'cloudcode_api',
      localServerDetected: false,
    });
  });

  // Logout: only clear session cookie and keep Convex linked cluster intact
  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ success: true, message: 'Signed out successfully' });
  });


  // --- Multi-Account Management Routes ---
  app.get('/api/accounts', async (req, res) => {
    const session = getSessionFromRequest(req);

    // If not authenticated, return empty accounts
    if (!session) {
      return res.json({
        accounts: [],
        activeAccountId: undefined,
        convexConnected: Boolean(process.env.CONVEX_URL),
      });
    }

    const userEmail = session.user?.email;

    // Auto-sync local server account if detected and link with current user
    try {
      const localServer = discoverLocalAntigravityServer();
      if (localServer) {
        const localStatus = await queryLocalUserStatus(localServer);
        if (localStatus.success && localStatus.user?.email) {
          const email = localStatus.user.email;
          const name = localStatus.user.name || 'Antigravity User';
          const tier = localStatus.user.tierName || 'Google AI Pro';
          const existingList = await fallbackStore.listAccounts(userEmail);
          const existing = existingList.find((a) => a.email === email);

          const accId = await fallbackStore.upsertAccount({
            email,
            name,
            refreshToken: existing?.refreshToken || '',
            tier,
            plan: 'Pro',
            linkWithEmail: userEmail,
          });

          if (localStatus.models && localStatus.models.length > 0) {
            await fallbackStore.saveQuota(
              accId,
              email,
              localStatus.models,
              {
                currentTier: tier,
                plan: 'Pro',
              },
              localStatus.groups
            );
          }
        }
      }
    } catch (e) {
      console.warn('Could not auto-sync local server account:', e);
    }

    // Retrieve accounts linked in this user's cluster graph
    const list = await fallbackStore.listAccounts(userEmail);
    const activeAcc = await fallbackStore.getActiveAccount(userEmail);
    const accounts: AccountSummary[] = list.map((a) => {
      const quotaModels = a.quota?.models || [];
      const healthyCount = quotaModels.filter((m: any) => m.status === 'healthy').length;
      const warningCount = quotaModels.filter((m: any) => m.status === 'warning').length;
      const exhaustedCount = quotaModels.filter((m: any) => m.status === 'exhausted').length;

      return {
        _id: a._id,
        email: a.email,
        name: a.name,
        picture: a.picture,
        tier: a.tier || a.quota?.tierInfo?.currentTier || 'Google AI Pro',
        isActive: a.isActive,
        lastSyncedAt: a.lastSyncedAt,
        syncStatus: a.syncStatus,
        modelsCount: quotaModels.length,
        healthyCount,
        warningCount,
        exhaustedCount,
        quota: a.quota,
      };
    });

    const response: AccountsListResponse = {
      accounts,
      activeAccountId: activeAcc?._id,
      convexConnected: Boolean(process.env.CONVEX_URL),
    };
    res.json(response);
  });

  app.post('/api/accounts/switch', async (req, res) => {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }
    const success = await fallbackStore.setActive(accountId);
    if (!success) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const sessionUser = getSessionFromRequest(req);
    const active = await fallbackStore.getActiveAccount(sessionUser?.user?.email);
    if (active) {
      // Set session cookie for newly active account
      const session: AuthSession = {
        user: {
          id: active._id,
          email: active.email,
          name: active.name,
          picture: active.picture,
        },
        tokens: {
          access_token: active.accessToken || '',
          refresh_token: active.refreshToken,
          expiry_date: active.tokenExpiry,
        },
        createdAt: Date.now(),
      };
      setSessionCookie(res, session, req);
    }
    res.json({ success: true, activeAccountId: accountId });
  });

  // Delete account completely
  app.delete('/api/accounts/:id', async (req, res) => {
    const { id } = req.params;
    const success = await fallbackStore.deleteAccount(id);
    res.json({ success });
  });

  // Detach account from current workspace into its own independent solo workspace
  app.post('/api/accounts/unlink', async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    const success = await fallbackStore.unlinkAccount(email);
    res.json({ success });
  });

  // Merge two workspaces together when authorized
  app.post('/api/workspaces/merge', async (req, res) => {
    const { sourceEmail, targetEmail } = req.body;
    if (!sourceEmail || !targetEmail) {
      return res.status(400).json({ error: 'sourceEmail and targetEmail are required' });
    }
    const success = await fallbackStore.mergeWorkspaces(sourceEmail, targetEmail);
    res.json({ success });
  });


  app.post('/api/accounts/sync', async (req, res) => {
    const session = getSessionFromRequest(req);
    const userEmail = session?.user?.email;
    const { accountId } = req.body;
    const list = await fallbackStore.listAccounts(userEmail);
    const targets = accountId ? list.filter((a) => a._id === accountId) : list;

    const results = await Promise.all(
      targets.map(async (acc) => {
        try {
          // If local Antigravity account without refresh token, fetch from local language server
          if (!acc.refreshToken) {
            const localServer = discoverLocalAntigravityServer();
            if (localServer) {
              const localStatus = await queryLocalUserStatus(localServer);
              if (localStatus.success && localStatus.models.length > 0) {
                const tier = localStatus.user?.tierName || 'Google AI Pro';
                await fallbackStore.saveQuota(
                  acc._id,
                  acc.email,
                  localStatus.models,
                  {
                    currentTier: tier,
                  },
                  localStatus.groups
                );
                return { email: acc.email, success: true, count: localStatus.models.length };
              }
            }
          }

          if (!acc.refreshToken) {
            return { email: acc.email, success: false, error: 'Account has no refresh token' };
          }

          let accessToken = acc.accessToken;
          const now = Date.now();
          // Proactive refresh: if token missing or expires in less than 5 minutes (300s), refresh now!
          if (!accessToken || !acc.tokenExpiry || acc.tokenExpiry - now < 300000) {
            try {
              const fresh = await refreshAccessToken(acc.refreshToken);
              accessToken = fresh.access_token;
              await fallbackStore.updateAccountTokens(
                acc._id,
                fresh.access_token,
                fresh.expiry_date || (now + fresh.expires_in * 1000),
                fresh.refresh_token
              );
            } catch (refreshErr) {
              console.warn(`[Sync] Token refresh failed for ${acc.email}:`, refreshErr);
            }
          }

          const quota = await fetchAntigravityQuota(accessToken);
          if (quota.success && quota.models.length > 0) {
            await fallbackStore.saveQuota(acc._id, acc.email, quota.models, quota.tierInfo, quota.groups);
            return { email: acc.email, success: true, count: quota.models.length };
          }
          return { email: acc.email, success: false, error: quota.error };
        } catch (e: any) {
          return { email: acc.email, success: false, error: e.message };
        }
      })
    );

    res.json({ success: true, results });
  });


  // Quota retrieval handler
  const quotaHandler = async (req: express.Request, res: express.Response) => {
    let session = getSessionFromRequest(req);

    if (session) {
      let accessToken = session.tokens.access_token;
      const now = Date.now();
      const expiry = session.tokens.expiry_date;

      // Auto-refresh token if expired or within 60s of expiring
      if (expiry && expiry - now < 60000 && session.tokens.refresh_token) {
        try {
          const freshTokens = await refreshAccessToken(session.tokens.refresh_token);
          session.tokens.access_token = freshTokens.access_token;
          if (freshTokens.expiry_date) {
            session.tokens.expiry_date = freshTokens.expiry_date;
          }
          accessToken = freshTokens.access_token;
          setSessionCookie(res, session);

          // Update tokens in Convex if account exists
          if (session.user?.email) {
            const accList = await fallbackStore.listAccounts(session.user.email);
            const matching = accList.find((a) => a.email === session.user.email);
            if (matching) {
              await fallbackStore.updateAccountTokens(
                matching._id,
                freshTokens.access_token,
                freshTokens.expiry_date || (now + freshTokens.expires_in * 1000),
                freshTokens.refresh_token
              );
            }
          }
        } catch (refreshErr) {
          console.warn('Failed to proactively refresh token:', refreshErr);
        }
      }

      // Call isolated Antigravity remote quota service
      let quotaResult = await fetchAntigravityQuota(accessToken);

      // If API returned TOKEN_EXPIRED and we have refresh_token, try refresh once
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

          if (session.user?.email) {
            const accList = await fallbackStore.listAccounts(session.user.email);
            const matching = accList.find((a) => a.email === session.user.email);
            if (matching) {
              await fallbackStore.updateAccountTokens(
                matching._id,
                freshTokens.access_token,
                freshTokens.expiry_date || (now + freshTokens.expires_in * 1000),
                freshTokens.refresh_token
              );
            }
          }

          // Retry fetch
          quotaResult = await fetchAntigravityQuota(accessToken);
        } catch (retryErr) {
          console.error('Failed to refresh token after 401:', retryErr);
        }
      }

      if (quotaResult.success && quotaResult.models.length > 0) {
        // Also save latest snapshot to Convex
        if (session.user?.email) {
          const accList = await fallbackStore.listAccounts(session.user.email);
          const matching = accList.find((a) => a.email === session.user.email);
          if (matching) {
            await fallbackStore.saveQuota(
              matching._id,
              session.user.email,
              quotaResult.models,
              quotaResult.tierInfo,
              quotaResult.groups
            );
          }
        }

        const responsePayload: QuotaDataResponse = {
          success: true,
          account: {
            email: session.user.email,
            name: session.user.name,
            picture: session.user.picture,
          },
          lastUpdated: new Date().toISOString(),
          models: quotaResult.models,
          groups: quotaResult.groups,
          tierInfo: quotaResult.tierInfo,
          diagnostics: quotaResult.diagnostics,
        };
        return res.json(responsePayload);
      }
    }


    // Fallback: Check local Antigravity Language Server if remote session is not available or returned no models
    const localServer = discoverLocalAntigravityServer();
    if (localServer) {
      const quotaResult = await fetchAntigravityQuota();
      if (quotaResult.success && quotaResult.models.length > 0) {
        const email = session?.user.email || (quotaResult.raw as any)?.userStatus?.email || 'local@antigravity';
        const name = session?.user.name || (quotaResult.raw as any)?.userStatus?.name || 'Antigravity Local User';

        const responsePayload: QuotaDataResponse = {
          success: true,
          account: {
            email,
            name,
            picture: session?.user.picture,
          },
          lastUpdated: new Date().toISOString(),
          models: quotaResult.models,
          tierInfo: quotaResult.tierInfo,
          diagnostics: quotaResult.diagnostics,
        };
        return res.json(responsePayload);
      }
    }

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated. Antigravity IDE is not running locally and no Google OAuth session was found.',
        errorCode: 'UNAUTHENTICATED',
      });
    }

    let accessToken = session.tokens.access_token;
    const now = Date.now();
    const expiry = session.tokens.expiry_date;

    // Auto-refresh token if expired or within 60s of expiring
    if (expiry && expiry - now < 60000 && session.tokens.refresh_token) {
      try {
        const freshTokens = await refreshAccessToken(session.tokens.refresh_token);
        session.tokens.access_token = freshTokens.access_token;
        if (freshTokens.expiry_date) {
          session.tokens.expiry_date = freshTokens.expiry_date;
        }
        accessToken = freshTokens.access_token;
        setSessionCookie(res, session);
      } catch (refreshErr) {
        console.warn('Failed to proactively refresh token:', refreshErr);
      }
    }

    // Call isolated Antigravity quota service
    let quotaResult = await fetchAntigravityQuota(accessToken);

    // If API returned TOKEN_EXPIRED and we have refresh_token, try refresh once
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

        // Retry fetch
        quotaResult = await fetchAntigravityQuota(accessToken);
      } catch (retryErr) {
        console.error('Failed to refresh token after 401:', retryErr);
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
      groups: quotaResult.groups,
      tierInfo: quotaResult.tierInfo,
      diagnostics: quotaResult.diagnostics,
      error: quotaResult.error,
      errorCode: quotaResult.errorCode,
      details: quotaResult.details,
    };

    if (!quotaResult.success) {
      return res.status(200).json(responsePayload);
    }

    res.json(responsePayload);
  };

  app.get('/api/quota', quotaHandler);
  app.post('/api/quota/refresh', quotaHandler);

  // Global error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[API Error]:', err);
    res.status(500).json({ error: err?.message || 'Internal Server Error', stack: err?.stack });
  });

  return app;
}

const app = createApiApp();

// If executed directly (CLI/dev mode) and not imported in a serverless environment
const isDirectRun = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.cjs')) &&
  !process.env.VERCEL &&
  !process.env.AWS_LAMBDA_FUNCTION_NAME
);

if (isDirectRun) {
  const PORT = Number(process.env.PORT) || 3001;

  async function startServer() {
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          watch: {
            ignored: [
              '**/.accounts_store.json',
              '**/.accounts_store.json*',
              '**/lib/**',
              '**/dist/**',
              '**/.git/**',
              '**/.gemini/**',
              '**/*.log',
            ],
          },
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Antigravity Quota Watcher server running on port ${PORT}`);
    });
  }

  startServer().catch((err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
  });
}

export default app;
