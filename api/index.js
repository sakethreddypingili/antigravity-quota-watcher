// server.ts
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { createServer as createViteServer } from "vite";

// lib/auth/google.ts
var GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
var GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
var GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
function getClientId() {
  return (process.env.GOOGLE_CLIENT_ID || "").trim();
}
function getClientSecret() {
  return (process.env.GOOGLE_CLIENT_SECRET || "").trim();
}
function getCloudProjectId() {
  return (process.env.GOOGLE_CLOUD_PROJECT || "").trim();
}
var REQUIRED_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/aicode",
  "https://www.googleapis.com/auth/cclog",
  "https://www.googleapis.com/auth/experimentsandconfigs"
];
function getRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.trim() !== "") {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }
  if (process.env.APP_URL && process.env.APP_URL.trim() !== "") {
    const baseUrl = process.env.APP_URL.trim().replace(/\/+$/, "");
    return `${baseUrl}/api/auth/callback`;
  }
  if (req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${process.env.PORT || "3001"}`;
    return `${proto}://${host}/api/auth/callback`;
  }
  return `http://localhost:${process.env.PORT || "3001"}/api/auth/callback`;
}
function getGoogleOAuthConfig(req) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const projectId = getCloudProjectId();
  const redirectUri = getRedirectUri(req);
  const missing = [];
  if (!clientId) missing.push("GOOGLE_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
  return {
    clientId,
    clientSecret,
    projectId,
    redirectUri,
    isConfigured: missing.length === 0,
    missing
  };
}
function generateAuthUrl(req, state) {
  const { clientId, redirectUri } = getGoogleOAuthConfig(req);
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured in environment variables.");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: REQUIRED_SCOPES.join(" "),
    access_type: "offline",
    // Requests refresh_token
    prompt: "consent",
    // Ensures refresh_token is granted
    include_granted_scopes: "true"
  });
  if (state) {
    params.set("state", state);
  }
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}
function exchangeCodeForTokens(code, redirectUri) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials (GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET) missing.");
  }
  return fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  }).then(async (res) => {
    if (!res.ok) {
      const errorText = await res.text();
      let errorJson = {};
      try {
        errorJson = JSON.parse(errorText);
      } catch {
      }
      throw new Error(
        errorJson.error_description || errorJson.error || `Failed to exchange code: HTTP ${res.status} ${errorText}`
      );
    }
    const data = await res.json();
    if (data.expires_in) {
      data.expiry_date = Date.now() + data.expires_in * 1e3;
    }
    return data;
  });
}
async function refreshAccessToken(refreshToken) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials missing for refresh");
  }
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to refresh token: HTTP ${res.status} ${errorText}`);
  }
  const data = await res.json();
  if (data.expires_in) {
    data.expiry_date = Date.now() + data.expires_in * 1e3;
  }
  return data;
}
function fetchGoogleUserInfo(accessToken) {
  return fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }).then(async (res) => {
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch user profile: HTTP ${res.status} ${errorText}`);
    }
    return await res.json();
  });
}

// lib/auth/session.ts
import crypto from "crypto";
var COOKIE_NAME = "ag_session";
var DEFAULT_SECRET = "antigravity-quota-default-secret-fallback-key-32chars!";
function getSecretKey() {
  const secret = process.env.SESSION_SECRET || DEFAULT_SECRET;
  return crypto.createHash("sha256").update(secret).digest();
}
function encryptSession(session) {
  const key = getSecretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const jsonStr = JSON.stringify(session);
  const encrypted = Buffer.concat([cipher.update(jsonStr, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}
function decryptSession(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [ivStr, tagStr, encryptedStr] = parts;
    const iv = Buffer.from(ivStr, "base64url");
    const authTag = Buffer.from(tagStr, "base64url");
    const encrypted = Buffer.from(encryptedStr, "base64url");
    const key = getSecretKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}
function getSessionFromRequest(req) {
  const cookieVal = req.cookies?.[COOKIE_NAME];
  if (cookieVal) {
    const session = decryptSession(cookieVal);
    if (session) return session;
  }
  return null;
}
function setSessionCookie(res, session, req) {
  const token = encryptSession(session);
  const isHttps = req ? req.secure || req.headers["x-forwarded-proto"] === "https" : false;
  const isProduction = process.env.NODE_ENV === "production" && isHttps;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1e3
  });
}
function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/"
  });
}

// lib/antigravity/modelNames.ts
var MODEL_DISPLAY_NAMES = {
  "gemini-pro-agent": "Gemini 3.1 Pro (High)",
  "gemini-3.1-pro-high": "Gemini 3.1 Pro (High)",
  "gemini-3.1-pro-low": "Gemini 3.1 Pro (Low)",
  "gemini-3-flash-agent": "Gemini 3.5 Flash (High)",
  "gemini-3.5-flash-low": "Gemini 3.5 Flash (Medium)",
  "gemini-3.5-flash-extra-low": "Gemini 3.5 Flash (Low)",
  "gemini-3.6-flash-high": "Gemini 3.6 Flash (High)",
  "gemini-3.6-flash-medium": "Gemini 3.6 Flash (Medium)",
  "gemini-3.6-flash-low": "Gemini 3.6 Flash (Low)",
  "gemini-3.6-flash-tiered": "Gemini 3.6 Flash (Tiered)",
  "gemini-3.7-flash-high": "Gemini 3.7 Flash (High)",
  "gemini-3.7-flash-medium": "Gemini 3.7 Flash (Medium)",
  "gemini-3.7-flash-low": "Gemini 3.7 Flash (Low)",
  "gemini-3.7-flash-tiered": "Gemini 3.7 Flash (Tiered)",
  "claude-sonnet-4-6": "Claude Sonnet 4.6 (Thinking)",
  "claude-opus-4-6-thinking": "Claude Opus 4.6 (Thinking)",
  "gpt-oss-120b-medium": "GPT-OSS 120B (Medium)",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
  "gemini-2.5-flash-thinking": "Gemini 2.5 Flash Thinking",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "gemini-3-flash": "Gemini 3 Flash",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
  "gemini-3.1-flash-image": "Gemini 3.1 Flash Image",
  "chat_20706": "Tab Autocomplete (Fast)",
  "chat_23310": "Tab Autocomplete (Standard)"
};
function formatModelDisplayName(id, originalName) {
  if (MODEL_DISPLAY_NAMES[id]) return MODEL_DISPLAY_NAMES[id];
  if (originalName && originalName !== id) return originalName;
  return id.replace(/^models\//, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// lib/antigravity/localServer.ts
import { execSync } from "child_process";
import https from "https";
function discoverLocalAntigravityServer() {
  try {
    const cmd = process.platform === "win32" ? `wmic process where "name like '%language_server%'" get commandline,processid` : 'pgrep -fl "language_server"';
    const output = execSync(cmd, { encoding: "utf8", timeout: 2500 });
    const lines = output.split("\n");
    for (const line of lines) {
      if (!line || !line.includes("language_server")) continue;
      const portMatch = line.match(/--https_server_port\s+(\d+)/);
      const csrfMatch = line.match(/--csrf_token\s+([a-zA-Z0-9-]+)/);
      const pidMatch = line.match(/^\s*(\d+)/);
      if (portMatch && csrfMatch) {
        const port = Number(portMatch[1]);
        if (port > 0) {
          return {
            port,
            csrfToken: csrfMatch[1],
            pid: pidMatch ? Number(pidMatch[1]) : 0
          };
        }
      }
    }
  } catch (err) {
  }
  return null;
}
function identifyModelFamily(modelId) {
  const lower = modelId.toLowerCase();
  if (lower.includes("claude")) return "claude";
  if (lower.includes("gemini")) return "gemini";
  if (lower.includes("gpt") || lower.includes("openai")) return "gpt";
  return "other";
}
function computeQuotaStatus(remainingFraction) {
  if (remainingFraction === null || remainingFraction === void 0) {
    return "unknown";
  }
  if (remainingFraction <= 0) {
    return "exhausted";
  }
  if (remainingFraction <= 0.3) {
    return "warning";
  }
  return "healthy";
}
function queryLocalUserStatus(server) {
  return new Promise((resolve) => {
    const options = {
      hostname: "127.0.0.1",
      port: server.port,
      path: "/exa.language_server_pb.LanguageServerService/GetUserStatus",
      method: "POST",
      rejectUnauthorized: false,
      timeout: 4e3,
      headers: {
        "Content-Type": "application/json",
        "X-Codeium-Csrf-Token": server.csrfToken
      }
    };
    const req = https.request(options, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return resolve({
            success: false,
            models: [],
            port: server.port,
            error: `Language server returned HTTP ${res.statusCode}`
          });
        }
        try {
          const data = JSON.parse(responseBody);
          const userStatus = data.userStatus || {};
          const tierName = userStatus.userTier?.name || userStatus.userTier?.id || "Google AI Pro";
          const name = userStatus.name || "Antigravity User";
          const email = userStatus.email || "";
          const planStatus = userStatus.planStatus || "ACTIVE";
          const rawConfigs = userStatus.cascadeModelConfigData?.clientModelConfigs || [];
          const models = rawConfigs.map((m) => {
            const id = String(m.modelId || m.modelOrAlias?.model || "unknown-model");
            const displayName = String(m.label || id);
            const family = identifyModelFamily(id + " " + displayName);
            let remainingFraction = null;
            let resetTime = null;
            if (m.quotaInfo && typeof m.quotaInfo === "object") {
              if (typeof m.quotaInfo.remainingFraction === "number") {
                remainingFraction = Math.max(0, Math.min(1, m.quotaInfo.remainingFraction));
              }
              if (typeof m.quotaInfo.resetTime === "string") {
                resetTime = m.quotaInfo.resetTime;
              }
            }
            const { formatted: resetTimeFormatted, relative: resetTimeRelative } = formatResetTime(resetTime);
            const status = computeQuotaStatus(remainingFraction);
            const remainingPercentage = remainingFraction !== null ? Math.round(remainingFraction * 100) : null;
            const usedPercentage = remainingPercentage !== null ? Math.max(0, 100 - remainingPercentage) : null;
            return {
              id,
              displayName,
              family,
              remainingFraction,
              remainingPercentage,
              usedPercentage,
              status,
              resetTime,
              resetTimeFormatted,
              resetTimeRelative,
              tier: tierName
            };
          });
          models.sort((a, b) => {
            const familyWeight = (f) => {
              if (f === "gemini") return 1;
              if (f === "claude") return 2;
              if (f === "gpt") return 3;
              return 4;
            };
            const diff = familyWeight(a.family) - familyWeight(b.family);
            if (diff !== 0) return diff;
            return a.displayName.localeCompare(b.displayName);
          });
          const geminiList = models.filter((m) => m.family === "gemini");
          const claudeList = models.filter((m) => m.family === "claude" || m.family === "gpt");
          const groups = [];
          if (geminiList.length > 0) {
            const minFrac = Math.min(...geminiList.map((m) => m.remainingFraction ?? 1));
            const firstReset = geminiList.find((m) => m.resetTime);
            const weeklyCycle = getNextWeeklyResetTime();
            const weeklyFraction = Math.min(1, Math.max(0.01, minFrac < 1 ? minFrac * 0.9 + 0.1 : 1));
            const weeklyPct = Math.round(weeklyFraction * 100);
            groups.push({
              displayName: "Gemini Models",
              description: "Shared quota pool across all Gemini models",
              buckets: [
                {
                  bucketId: "gemini-weekly",
                  displayName: "Weekly Limit Remaining",
                  window: "weekly",
                  remainingFraction: weeklyFraction,
                  remainingPercentage: weeklyPct,
                  resetTime: weeklyCycle.iso,
                  resetTimeFormatted: weeklyCycle.formatted,
                  resetTimeRelative: weeklyCycle.relative,
                  description: weeklyFraction < 1 ? `You have used some of your weekly limit, it will fully refresh in ${weeklyCycle.relative}.` : "Window has not started yet. Will start countdown upon first usage."
                },
                {
                  bucketId: "gemini-5h",
                  displayName: "Five Hour Limit Remaining",
                  window: "5h",
                  remainingFraction: minFrac,
                  remainingPercentage: Math.round(minFrac * 100),
                  resetTime: firstReset?.resetTime || null,
                  resetTimeFormatted: firstReset?.resetTimeFormatted || null,
                  resetTimeRelative: firstReset?.resetTimeRelative || null,
                  description: minFrac < 1 ? firstReset?.resetTimeRelative ? `You have used some of your 5-hour limit, it will fully refresh in ${firstReset.resetTimeRelative}.` : "You have used some of your 5-hour limit." : "Window has not started yet. 5-hour rolling pool is 100% available."
                }
              ]
            });
          }
          if (claudeList.length > 0) {
            const minFrac = Math.min(...claudeList.map((m) => m.remainingFraction ?? 1));
            const firstReset = claudeList.find((m) => m.resetTime);
            const weeklyCycle = getNextWeeklyResetTime();
            const weeklyFraction = Math.min(1, Math.max(0.01, minFrac < 1 ? minFrac * 0.9 + 0.1 : 1));
            const weeklyPct = Math.round(weeklyFraction * 100);
            groups.push({
              displayName: "Claude and GPT models",
              description: "Shared quota pool across Claude and GPT models",
              buckets: [
                {
                  bucketId: "3p-weekly",
                  displayName: "Weekly Limit Remaining",
                  window: "weekly",
                  remainingFraction: weeklyFraction,
                  remainingPercentage: weeklyPct,
                  resetTime: weeklyCycle.iso,
                  resetTimeFormatted: weeklyCycle.formatted,
                  resetTimeRelative: weeklyCycle.relative,
                  description: weeklyFraction < 1 ? `You have used some of your weekly limit, it will fully refresh in ${weeklyCycle.relative}.` : "Window has not started yet. Will start countdown upon first usage."
                },
                {
                  bucketId: "3p-5h",
                  displayName: "Five Hour Limit Remaining",
                  window: "5h",
                  remainingFraction: minFrac,
                  remainingPercentage: Math.round(minFrac * 100),
                  resetTime: firstReset?.resetTime || null,
                  resetTimeFormatted: firstReset?.resetTimeFormatted || null,
                  resetTimeRelative: firstReset?.resetTimeRelative || null,
                  description: minFrac < 1 ? firstReset?.resetTimeRelative ? `You have used some of your 5-hour limit, it will fully refresh in ${firstReset.resetTimeRelative}.` : "You have used some of your 5-hour limit." : "Window has not started yet. 5-hour rolling pool is 100% available."
                }
              ]
            });
          }
          return resolve({
            success: true,
            user: {
              name,
              email,
              planStatus,
              tierName
            },
            models,
            groups,
            port: server.port,
            raw: data
          });
        } catch (parseErr) {
          const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
          return resolve({
            success: false,
            models: [],
            port: server.port,
            error: `Failed to parse language server response: ${msg}`
          });
        }
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({
        success: false,
        models: [],
        port: server.port,
        error: "Timeout connecting to Antigravity Language Server"
      });
    });
    req.on("error", (err) => {
      resolve({
        success: false,
        models: [],
        port: server.port,
        error: `Failed to connect to Antigravity Language Server on port ${server.port}: ${err.message}`
      });
    });
    req.write("{}");
    req.end();
  });
}

// lib/antigravity/quota.ts
var CODE_ASSIST_BASE_URL = "https://cloudcode-pa.googleapis.com";
var FETCH_MODELS_ENDPOINT = `${CODE_ASSIST_BASE_URL}/v1internal:fetchAvailableModels`;
var LOAD_CODE_ASSIST_ENDPOINT = `${CODE_ASSIST_BASE_URL}/v1internal:loadCodeAssist`;
function formatResetTime(isoString) {
  if (!isoString) {
    return { formatted: null, relative: null };
  }
  try {
    const targetDate = new Date(isoString);
    if (isNaN(targetDate.getTime())) {
      return { formatted: isoString, relative: null };
    }
    const now = /* @__PURE__ */ new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    const formatted = targetDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric"
    });
    if (diffMs <= 0) {
      return { formatted, relative: "Resetting now" };
    }
    const totalMinutes = Math.floor(diffMs / (1e3 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);
    let relative;
    if (days > 0) {
      const remHours = hours % 24;
      relative = `${days}d ${remHours}h`;
    } else if (hours > 0) {
      relative = `${hours}h ${minutes}m`;
    } else {
      relative = `${minutes}m`;
    }
    return { formatted, relative };
  } catch {
    return { formatted: isoString, relative: null };
  }
}
function getNextWeeklyResetTime() {
  const now = /* @__PURE__ */ new Date();
  const target = new Date(now);
  const day = now.getUTCDay();
  const daysUntilSunday = (7 - day) % 7 || 7;
  target.setUTCDate(now.getUTCDate() + daysUntilSunday);
  target.setUTCHours(0, 0, 0, 0);
  const iso = target.toISOString();
  const { formatted, relative } = formatResetTime(iso);
  return {
    iso,
    formatted: formatted || iso,
    relative: relative || "Weekly cycle"
  };
}
function identifyModelFamily2(modelId) {
  const lower = modelId.toLowerCase();
  if (lower.includes("claude")) return "claude";
  if (lower.includes("gemini")) return "gemini";
  if (lower.includes("gpt") || lower.includes("openai")) return "gpt";
  return "other";
}
function computeQuotaStatus2(remainingFraction) {
  if (remainingFraction === null || remainingFraction === void 0) {
    return "unknown";
  }
  if (remainingFraction <= 0) {
    return "exhausted";
  }
  if (remainingFraction <= 0.3) {
    return "warning";
  }
  return "healthy";
}
var RETRIEVE_USER_QUOTA_ENDPOINT = `${CODE_ASSIST_BASE_URL}/v1internal:retrieveUserQuota`;
var RETRIEVE_USER_QUOTA_SUMMARY_ENDPOINT = `${CODE_ASSIST_BASE_URL}/v1internal:retrieveUserQuotaSummary`;
async function fetchAntigravityQuota(accessToken) {
  const startTime = Date.now();
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  console.log("[Quota Service] ---------- NEW QUOTA FETCH START ----------");
  if (accessToken) {
    console.log("[Quota Service] Using remote Cloud Code Assist API with access token");
  } else {
    const localServer = discoverLocalAntigravityServer();
    if (localServer) {
      console.log(`[Quota Service] Found running Antigravity Language Server on port ${localServer.port} (pid ${localServer.pid})`);
      const localResult = await queryLocalUserStatus(localServer);
      if (localResult.success && localResult.models.length > 0) {
        console.log(`[Quota Service] Successfully fetched ${localResult.models.length} models from local Antigravity Language Server`);
        return {
          success: true,
          models: localResult.models,
          tierInfo: {
            currentTier: localResult.user?.tierName || "Google AI Pro",
            plan: localResult.user?.planStatus || "ACTIVE"
          },
          diagnostics: {
            endpointUsed: `https://127.0.0.1:${localServer.port}/exa.language_server_pb.LanguageServerService/GetUserStatus`,
            httpStatus: 200,
            latencyMs: Date.now() - startTime,
            timestamp,
            modelsCount: localResult.models.length,
            hasRawQuotaInfo: true,
            tierDetected: localResult.user?.tierName || "Google AI Pro",
            providerMode: "local_language_server"
          },
          raw: localResult.raw
        };
      } else {
        console.warn("[Quota Service] Local server query failed or returned no models:", localResult.error);
      }
    }
  }
  if (!accessToken) {
    return {
      success: false,
      models: [],
      diagnostics: {
        endpointUsed: "local_language_server_discovery",
        httpStatus: 0,
        latencyMs: Date.now() - startTime,
        timestamp,
        modelsCount: 0,
        hasRawQuotaInfo: false,
        providerMode: "local_language_server"
      },
      error: "Antigravity IDE is not running locally, and no Google OAuth session was provided.",
      errorCode: "SERVICE_UNAVAILABLE",
      details: "Start Antigravity IDE on this Mac or sign in with Google to use remote Cloud Code Assist."
    };
  }
  console.log(`[Quota Service] Calling loadCodeAssist endpoint: ${LOAD_CODE_ASSIST_ENDPOINT}`);
  let loadRes;
  try {
    loadRes = await fetch(LOAD_CODE_ASSIST_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "antigravity",
        "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1"
      },
      body: JSON.stringify({})
    });
  } catch (networkErr) {
    const latencyMs2 = Date.now() - startTime;
    const errMessage = networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error("[Quota Service] loadCodeAssist Network Error:", errMessage);
    return {
      success: false,
      models: [],
      diagnostics: {
        endpointUsed: LOAD_CODE_ASSIST_ENDPOINT,
        httpStatus: 0,
        latencyMs: latencyMs2,
        timestamp,
        modelsCount: 0,
        hasRawQuotaInfo: false
      },
      error: "Network connection to Cloud Code Assist failed",
      errorCode: "SERVICE_UNAVAILABLE",
      details: errMessage
    };
  }
  const loadHttpStatus = loadRes.status;
  console.log(`[Quota Service] loadCodeAssist HTTP status: ${loadHttpStatus}`);
  if (loadHttpStatus === 401) {
    return {
      success: false,
      models: [],
      diagnostics: {
        endpointUsed: LOAD_CODE_ASSIST_ENDPOINT,
        httpStatus: loadHttpStatus,
        latencyMs: Date.now() - startTime,
        timestamp,
        modelsCount: 0,
        hasRawQuotaInfo: false
      },
      error: "Google OAuth session expired or invalid credentials",
      errorCode: "TOKEN_EXPIRED",
      details: "HTTP 401 Unauthorized from loadCodeAssist. Token refresh required."
    };
  }
  let loadBodyText = "";
  try {
    loadBodyText = await loadRes.text();
  } catch (e) {
    console.error("[Quota Service] Failed to read loadCodeAssist response body");
  }
  console.log("[Quota Service] loadCodeAssist response:", loadBodyText);
  if (loadHttpStatus === 403) {
    return {
      success: false,
      models: [],
      diagnostics: {
        endpointUsed: LOAD_CODE_ASSIST_ENDPOINT,
        httpStatus: loadHttpStatus,
        latencyMs: Date.now() - startTime,
        timestamp,
        modelsCount: 0,
        hasRawQuotaInfo: false
      },
      error: "Google account is authenticated, but Cloud Code Assist access was denied",
      errorCode: "PERMISSION_DENIED",
      details: "HTTP 403 Forbidden. Response: " + loadBodyText.slice(0, 300)
    };
  }
  if (!loadRes.ok) {
    return {
      success: false,
      models: [],
      diagnostics: {
        endpointUsed: LOAD_CODE_ASSIST_ENDPOINT,
        httpStatus: loadHttpStatus,
        latencyMs: Date.now() - startTime,
        timestamp,
        modelsCount: 0,
        hasRawQuotaInfo: false
      },
      error: `loadCodeAssist failed with HTTP ${loadHttpStatus}`,
      errorCode: loadHttpStatus === 429 ? "RATE_LIMITED" : loadHttpStatus === 503 ? "CAPACITY_EXHAUSTED" : "UNKNOWN",
      details: loadBodyText.slice(0, 500)
    };
  }
  let loadData = {};
  try {
    loadData = JSON.parse(loadBodyText);
  } catch (e) {
    console.error("[Quota Service] Failed to parse loadCodeAssist response as JSON");
  }
  let companionProject;
  if (typeof loadData.cloudaicompanionProject === "string") {
    companionProject = loadData.cloudaicompanionProject;
  } else if (loadData.cloudaicompanionProject && typeof loadData.cloudaicompanionProject === "object") {
    companionProject = loadData.cloudaicompanionProject.id;
  }
  let currentTier = "Free Tier";
  if (loadData.paidTier && typeof loadData.paidTier === "object") {
    const pt = loadData.paidTier;
    currentTier = pt.name || pt.id || "Google AI Pro";
  } else if (typeof loadData.paidTier === "string" && loadData.paidTier !== "") {
    currentTier = loadData.paidTier;
  } else if (loadData.currentTier && typeof loadData.currentTier === "object") {
    const ct = loadData.currentTier;
    currentTier = ct.name || ct.id || "Free Tier";
  } else if (typeof loadData.currentTier === "string") {
    currentTier = loadData.currentTier;
  }
  if (currentTier === "g1-pro-tier") currentTier = "Google AI Pro";
  if (currentTier === "free-tier") currentTier = "Free Tier";
  if (currentTier === "standard-tier") currentTier = "Standard";
  const plan = typeof loadData.plan === "string" ? loadData.plan : void 0;
  console.log(`[Quota Service] discovered cloudaicompanionProject: ${companionProject || "NONE"}`);
  console.log(`[Quota Service] currentTier/paidTier: ${currentTier}`);
  if (!companionProject) {
    return {
      success: false,
      models: [],
      diagnostics: {
        endpointUsed: LOAD_CODE_ASSIST_ENDPOINT,
        httpStatus: loadHttpStatus,
        latencyMs: Date.now() - startTime,
        timestamp,
        modelsCount: 0,
        hasRawQuotaInfo: false
      },
      error: "Could not discover Cloud Code companion project",
      errorCode: "UNKNOWN",
      details: "loadCodeAssist did not return a cloudaicompanionProject. You may need to accept the Cloud Code Assist terms or the API might be disabled for this account. Response: " + loadBodyText
    };
  }
  const requestBody = JSON.stringify(companionProject ? { project: companionProject } : {});
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "User-Agent": "antigravity",
    "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1"
  };
  const fetchQuotaEndpoint = async (url, name) => {
    console.log(`[Quota Service] Calling ${name}: ${url}`);
    try {
      const res = await fetch(url, { method: "POST", headers, body: requestBody });
      const status = res.status;
      console.log(`[Quota Service] ${name} HTTP status: ${status}`);
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
        console.log(`[Quota Service] ${name} sanitized response:`, JSON.stringify(data).slice(0, 300) + "...");
      } catch {
        console.log(`[Quota Service] ${name} response was not JSON:`, text.slice(0, 100));
      }
      return { ok: res.ok, status, data, text };
    } catch (e) {
      console.error(`[Quota Service] ${name} request failed:`, e);
      return { ok: false, status: 0, data: null, text: "" };
    }
  };
  const [quotaRes, summaryRes, modelsRes] = await Promise.all([
    fetchQuotaEndpoint(RETRIEVE_USER_QUOTA_ENDPOINT, "retrieveUserQuota"),
    fetchQuotaEndpoint(RETRIEVE_USER_QUOTA_SUMMARY_ENDPOINT, "retrieveUserQuotaSummary"),
    fetchQuotaEndpoint(FETCH_MODELS_ENDPOINT, "fetchAvailableModels")
  ]);
  let latencyMs = Date.now() - startTime;
  let finalHttpStatus = modelsRes.status || quotaRes.status || summaryRes.status;
  if (!modelsRes.ok && !quotaRes.ok && !summaryRes.ok) {
    return {
      success: false,
      models: [],
      diagnostics: {
        endpointUsed: FETCH_MODELS_ENDPOINT,
        httpStatus: finalHttpStatus,
        latencyMs,
        timestamp,
        modelsCount: 0,
        hasRawQuotaInfo: false,
        tierDetected: currentTier,
        companionProject,
        providerMode: "cloudcode_api"
      },
      error: `All quota endpoints failed. modelsStatus=${modelsRes.status}, quotaStatus=${quotaRes.status}`,
      errorCode: "SERVICE_UNAVAILABLE",
      details: `Models response: ${modelsRes.text.slice(0, 100)}`
    };
  }
  let rawData = quotaRes.data || modelsRes.data || summaryRes.data || {};
  const rawModelsList = [];
  if (Array.isArray(rawData.models)) {
    for (const item of rawData.models) {
      if (item && typeof item === "object") {
        rawModelsList.push(item);
      }
    }
  } else if (rawData.models && typeof rawData.models === "object") {
    for (const [key, val] of Object.entries(rawData.models)) {
      if (val && typeof val === "object") {
        rawModelsList.push({ id: key, ...val });
      }
    }
  } else if (Array.isArray(rawData)) {
    for (const item of rawData) {
      if (item && typeof item === "object") {
        rawModelsList.push(item);
      }
    }
  } else if (Array.isArray(rawData.quotaInfo)) {
    for (const item of rawData.quotaInfo) {
      if (item && typeof item === "object") {
        rawModelsList.push(item);
      }
    }
  } else if (Array.isArray(rawData.buckets)) {
    for (const item of rawData.buckets) {
      if (item && typeof item === "object") {
        const b = item;
        rawModelsList.push({
          id: b.modelId || b.model,
          name: b.modelId || b.model,
          remainingFraction: b.remainingFraction,
          resetTime: b.resetTime,
          tokenType: b.tokenType
        });
      }
    }
  }
  let hasRawQuotaInfo = false;
  const parsedModels = rawModelsList.map((m) => {
    const id = String(m.name || m.id || m.model || "unknown-model");
    const displayName = formatModelDisplayName(id, m.displayName || m.title);
    const family = identifyModelFamily2(id + " " + displayName);
    let remainingFraction = null;
    let resetTime = null;
    let limitInfo = void 0;
    if (m.quotaInfo && typeof m.quotaInfo === "object") {
      const q = m.quotaInfo;
      hasRawQuotaInfo = true;
      if (typeof q.remainingFraction === "number") {
        remainingFraction = Math.max(0, Math.min(1, q.remainingFraction));
      }
      if (typeof q.resetTime === "string") {
        resetTime = q.resetTime;
      }
      if (q.limit || q.requests || q.window) {
        limitInfo = {
          requests: typeof q.requests === "number" ? q.requests : void 0,
          tokens: typeof q.tokens === "number" ? q.tokens : void 0,
          window: typeof q.window === "string" ? q.window : void 0
        };
      }
    } else if (typeof m.remainingFraction === "number") {
      hasRawQuotaInfo = true;
      remainingFraction = Math.max(0, Math.min(1, m.remainingFraction));
      if (typeof m.resetTime === "string") {
        resetTime = m.resetTime;
      }
    }
    const { formatted: resetTimeFormatted, relative: resetTimeRelative } = formatResetTime(resetTime);
    const status = computeQuotaStatus2(remainingFraction);
    const remainingPercentage = remainingFraction !== null ? Math.round(remainingFraction * 100) : null;
    const usedPercentage = remainingPercentage !== null ? Math.max(0, 100 - remainingPercentage) : null;
    return {
      id,
      displayName,
      family,
      remainingFraction,
      remainingPercentage,
      usedPercentage,
      status,
      resetTime,
      resetTimeFormatted,
      resetTimeRelative,
      limitInfo,
      tier: typeof m.tier === "string" ? m.tier : void 0,
      supportedGenerations: Array.isArray(m.supportedGenerations) ? m.supportedGenerations : void 0
    };
  });
  let parsedGroups;
  if (summaryRes.data && Array.isArray(summaryRes.data.groups)) {
    parsedGroups = summaryRes.data.groups.map((g) => {
      const buckets = Array.isArray(g.buckets) ? g.buckets.map((b) => {
        const fraction = typeof b.remainingFraction === "number" ? b.remainingFraction : null;
        const pct = fraction !== null ? Math.round(fraction * 100) : null;
        const { formatted, relative } = formatResetTime(b.resetTime);
        return {
          bucketId: String(b.bucketId || ""),
          displayName: String(b.displayName || "Limit Remaining"),
          window: b.window ? String(b.window) : void 0,
          resetTime: b.resetTime ? String(b.resetTime) : null,
          resetTimeFormatted: formatted,
          resetTimeRelative: relative,
          description: b.description ? String(b.description) : null,
          remainingFraction: fraction,
          remainingPercentage: pct
        };
      }) : [];
      return {
        displayName: String(g.displayName || "Models"),
        description: g.description ? String(g.description) : void 0,
        buckets
      };
    });
  }
  parsedModels.sort((a, b) => {
    const familyWeight = (f) => {
      if (f === "gemini") return 1;
      if (f === "claude") return 2;
      if (f === "gpt") return 3;
      return 4;
    };
    const diff = familyWeight(a.family) - familyWeight(b.family);
    if (diff !== 0) return diff;
    return a.displayName.localeCompare(b.displayName);
  });
  console.log("[Quota Service] ---------- QUOTA FETCH COMPLETE ----------");
  return {
    success: true,
    models: parsedModels,
    groups: parsedGroups,
    tierInfo: {
      currentTier,
      cloudaicompanionProject: companionProject,
      plan
    },
    diagnostics: {
      endpointUsed: modelsRes.ok ? FETCH_MODELS_ENDPOINT : RETRIEVE_USER_QUOTA_ENDPOINT,
      httpStatus: finalHttpStatus,
      latencyMs,
      timestamp,
      modelsCount: parsedModels.length,
      hasRawQuotaInfo,
      tierDetected: currentTier,
      companionProject,
      providerMode: "cloudcode_api"
    }
  };
}

// lib/db/convex.ts
import { ConvexHttpClient } from "convex/browser";

// convex/_generated/api.js
import { anyApi, componentsGeneric } from "convex/server";
var api = anyApi;
var components = componentsGeneric();

// lib/db/convex.ts
function getConvexClient() {
  const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
  if (!convexUrl) return null;
  return new ConvexHttpClient(convexUrl);
}
var ConvexDatabaseService = class {
  constructor() {
    this.client = null;
  }
  getClient() {
    if (!this.client) {
      const c = getConvexClient();
      if (!c) {
        throw new Error("CONVEX_URL is not set in environment.");
      }
      this.client = c;
    }
    return this.client;
  }
  async listAccounts(userEmail) {
    try {
      const client = this.getClient();
      const accounts = await client.query(api.accounts.listAccounts, { userEmail });
      return accounts;
    } catch (err) {
      console.error("[Convex DB] Error listing accounts:", err);
      return [];
    }
  }
  async getActiveAccount(userEmail) {
    try {
      const client = this.getClient();
      const account = await client.query(api.accounts.getActiveAccount, { userEmail });
      return account || null;
    } catch (err) {
      console.error("[Convex DB] Error getting active account:", err);
      return null;
    }
  }
  async upsertAccount(args) {
    const client = this.getClient();
    const id = await client.mutation(api.accounts.upsertAccount, args);
    return String(id);
  }
  async linkAccounts(accountA, accountB) {
    const client = this.getClient();
    await client.mutation(api.accounts.mergeWorkspaces, { sourceEmail: accountB, targetEmail: accountA });
    return true;
  }
  async unlinkAccount(accountEmail) {
    const client = this.getClient();
    await client.mutation(api.accounts.unlinkAndDetachAccount, { accountEmail });
    return true;
  }
  async mergeWorkspaces(sourceEmail, targetEmail) {
    const client = this.getClient();
    await client.mutation(api.accounts.mergeWorkspaces, { sourceEmail, targetEmail });
    return true;
  }
  async updateAccountTokens(accountId, accessToken, tokenExpiry, refreshToken) {
    const client = this.getClient();
    await client.mutation(api.accounts.updateAccountTokens, {
      accountId,
      accessToken,
      tokenExpiry,
      refreshToken
    });
    return true;
  }
  async setActive(id) {
    const client = this.getClient();
    await client.mutation(api.accounts.setActiveAccount, { accountId: id });
    return true;
  }
  async deleteAccount(id) {
    const client = this.getClient();
    await client.mutation(api.accounts.deleteAccount, { accountId: id });
    return true;
  }
  async saveQuota(accountId, email, models, tierInfo, groups) {
    try {
      const client = this.getClient();
      await client.mutation(api.accounts.saveQuotaSnapshot, {
        accountId,
        email,
        models,
        tierInfo,
        groups
      });
    } catch (err) {
      console.error("[Convex DB] Error saving quota:", err);
    }
  }
};
var dbService = new ConvexDatabaseService();
var fallbackStore = dbService;

// server.ts
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3001;
  app.use(express.json());
  app.use(cookieParser());
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/auth/config", (req, res) => {
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
        ...process.env.APP_URL ? [`${process.env.APP_URL.replace(/\/+$/, "")}/api/auth/callback`] : [],
        "http://localhost:3000/api/auth/callback"
      ]
    });
  });
  app.get("/api/auth/url", (req, res) => {
    try {
      const config = getGoogleOAuthConfig(req);
      if (!config.isConfigured) {
        return res.status(400).json({
          error: "Google OAuth is not configured.",
          missingVars: config.missing,
          redirectUri: config.redirectUri
        });
      }
      const mode = req.query.mode === "link" ? "link" : "login";
      const session = getSessionFromRequest(req);
      const linkEmail = mode === "link" ? session?.user?.email : void 0;
      const statePayload = JSON.stringify({
        nonce: Math.random().toString(36).substring(2, 15),
        mode,
        linkEmail
      });
      const state = Buffer.from(statePayload).toString("base64url");
      const url = generateAuthUrl(req, state);
      res.json({ url, redirectUri: config.redirectUri });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });
  const oauthCallbackHandler = async (req, res) => {
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
    if (!code || typeof code !== "string") {
      return res.status(400).send("Authorization code missing in callback request.");
    }
    try {
      const redirectUri = getRedirectUri(req);
      const tokens = await exchangeCodeForTokens(code, redirectUri);
      const user = await fetchGoogleUserInfo(tokens.access_token);
      const session = {
        user,
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
          token_type: tokens.token_type,
          scope: tokens.scope
        },
        createdAt: Date.now()
      };
      let mode = "login";
      let linkWithEmail = void 0;
      const stateParam = req.query.state;
      if (typeof stateParam === "string") {
        try {
          const parsedState = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf8"));
          mode = parsedState.mode || "login";
          linkWithEmail = parsedState.linkEmail;
        } catch {
        }
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
            linkWithEmail: mode === "link" ? linkWithEmail : void 0
          });
          fetchAntigravityQuota(tokens.access_token).then(async (res2) => {
            if (res2.success && res2.models.length > 0) {
              await fallbackStore.saveQuota(accountId, user.email, res2.models, res2.tierInfo, res2.groups);
            }
          }).catch(console.error);
        } catch (storeErr) {
          console.error("Failed to store account in Convex:", storeErr);
        }
      }
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
    } catch (err) {
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
  app.get("/api/auth/callback", oauthCallbackHandler);
  app.get("/auth/callback", oauthCallbackHandler);
  app.get("/api/auth/me", async (req, res) => {
    const config = getGoogleOAuthConfig(req);
    const session = getSessionFromRequest(req);
    if (session) {
      return res.json({
        authenticated: true,
        user: {
          email: session.user.email,
          name: session.user.name,
          picture: session.user.picture
        },
        expiresAt: session.tokens.expiry_date,
        hasConfig: config.isConfigured,
        clientId: config.clientId,
        projectId: config.projectId,
        redirectUri: config.redirectUri,
        providerMode: "cloudcode_api",
        localServerDetected: false
      });
    }
    res.json({
      authenticated: false,
      hasConfig: config.isConfigured,
      missingVars: config.missing,
      clientId: config.clientId,
      projectId: config.projectId,
      redirectUri: config.redirectUri,
      providerMode: "cloudcode_api",
      localServerDetected: false
    });
  });
  app.post("/api/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ success: true, message: "Signed out successfully" });
  });
  app.get("/api/accounts", async (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.json({
        accounts: [],
        activeAccountId: void 0,
        convexConnected: Boolean(process.env.CONVEX_URL)
      });
    }
    const userEmail = session.user?.email;
    try {
      const localServer = discoverLocalAntigravityServer();
      if (localServer) {
        const localStatus = await queryLocalUserStatus(localServer);
        if (localStatus.success && localStatus.user?.email) {
          const email = localStatus.user.email;
          const name = localStatus.user.name || "Antigravity User";
          const tier = localStatus.user.tierName || "Google AI Pro";
          const existingList = await fallbackStore.listAccounts(userEmail);
          const existing = existingList.find((a) => a.email === email);
          const accId = await fallbackStore.upsertAccount({
            email,
            name,
            refreshToken: existing?.refreshToken || "",
            tier,
            plan: "Pro",
            linkWithEmail: userEmail
          });
          if (localStatus.models && localStatus.models.length > 0) {
            await fallbackStore.saveQuota(
              accId,
              email,
              localStatus.models,
              {
                currentTier: tier,
                plan: "Pro"
              },
              localStatus.groups
            );
          }
        }
      }
    } catch (e) {
      console.warn("Could not auto-sync local server account:", e);
    }
    const list = await fallbackStore.listAccounts(userEmail);
    const activeAcc = await fallbackStore.getActiveAccount(userEmail);
    const accounts = list.map((a) => {
      const quotaModels = a.quota?.models || [];
      const healthyCount = quotaModels.filter((m) => m.status === "healthy").length;
      const warningCount = quotaModels.filter((m) => m.status === "warning").length;
      const exhaustedCount = quotaModels.filter((m) => m.status === "exhausted").length;
      return {
        _id: a._id,
        email: a.email,
        name: a.name,
        picture: a.picture,
        tier: a.tier || a.quota?.tierInfo?.currentTier || "Google AI Pro",
        isActive: a.isActive,
        lastSyncedAt: a.lastSyncedAt,
        syncStatus: a.syncStatus,
        modelsCount: quotaModels.length,
        healthyCount,
        warningCount,
        exhaustedCount,
        quota: a.quota
      };
    });
    const response = {
      accounts,
      activeAccountId: activeAcc?._id,
      convexConnected: Boolean(process.env.CONVEX_URL)
    };
    res.json(response);
  });
  app.post("/api/accounts/switch", async (req, res) => {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ error: "accountId is required" });
    }
    const success = await fallbackStore.setActive(accountId);
    if (!success) {
      return res.status(404).json({ error: "Account not found" });
    }
    const sessionUser = getSessionFromRequest(req);
    const active = await fallbackStore.getActiveAccount(sessionUser?.user?.email);
    if (active) {
      const session = {
        user: {
          id: active._id,
          email: active.email,
          name: active.name,
          picture: active.picture
        },
        tokens: {
          access_token: active.accessToken || "",
          refresh_token: active.refreshToken,
          expiry_date: active.tokenExpiry
        },
        createdAt: Date.now()
      };
      setSessionCookie(res, session, req);
    }
    res.json({ success: true, activeAccountId: accountId });
  });
  app.delete("/api/accounts/:id", async (req, res) => {
    const { id } = req.params;
    const success = await fallbackStore.deleteAccount(id);
    res.json({ success });
  });
  app.post("/api/accounts/unlink", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }
    const success = await fallbackStore.unlinkAccount(email);
    res.json({ success });
  });
  app.post("/api/workspaces/merge", async (req, res) => {
    const { sourceEmail, targetEmail } = req.body;
    if (!sourceEmail || !targetEmail) {
      return res.status(400).json({ error: "sourceEmail and targetEmail are required" });
    }
    const success = await fallbackStore.mergeWorkspaces(sourceEmail, targetEmail);
    res.json({ success });
  });
  app.post("/api/accounts/sync", async (req, res) => {
    const session = getSessionFromRequest(req);
    const userEmail = session?.user?.email;
    const { accountId } = req.body;
    const list = await fallbackStore.listAccounts(userEmail);
    const targets = accountId ? list.filter((a) => a._id === accountId) : list;
    const results = await Promise.all(
      targets.map(async (acc) => {
        try {
          if (!acc.refreshToken) {
            const localServer = discoverLocalAntigravityServer();
            if (localServer) {
              const localStatus = await queryLocalUserStatus(localServer);
              if (localStatus.success && localStatus.models.length > 0) {
                const tier = localStatus.user?.tierName || "Google AI Pro";
                await fallbackStore.saveQuota(
                  acc._id,
                  acc.email,
                  localStatus.models,
                  {
                    currentTier: tier
                  },
                  localStatus.groups
                );
                return { email: acc.email, success: true, count: localStatus.models.length };
              }
            }
          }
          if (!acc.refreshToken) {
            return { email: acc.email, success: false, error: "Account has no refresh token" };
          }
          let accessToken = acc.accessToken;
          const now = Date.now();
          if (!accessToken || !acc.tokenExpiry || acc.tokenExpiry - now < 3e5) {
            try {
              const fresh = await refreshAccessToken(acc.refreshToken);
              accessToken = fresh.access_token;
              await fallbackStore.updateAccountTokens(
                acc._id,
                fresh.access_token,
                fresh.expiry_date || now + fresh.expires_in * 1e3,
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
        } catch (e) {
          return { email: acc.email, success: false, error: e.message };
        }
      })
    );
    res.json({ success: true, results });
  });
  const quotaHandler = async (req, res) => {
    let session = getSessionFromRequest(req);
    if (session) {
      let accessToken2 = session.tokens.access_token;
      const now2 = Date.now();
      const expiry2 = session.tokens.expiry_date;
      if (expiry2 && expiry2 - now2 < 6e4 && session.tokens.refresh_token) {
        try {
          const freshTokens = await refreshAccessToken(session.tokens.refresh_token);
          session.tokens.access_token = freshTokens.access_token;
          if (freshTokens.expiry_date) {
            session.tokens.expiry_date = freshTokens.expiry_date;
          }
          accessToken2 = freshTokens.access_token;
          setSessionCookie(res, session);
          if (session.user?.email) {
            const accList = await fallbackStore.listAccounts(session.user.email);
            const matching = accList.find((a) => a.email === session.user.email);
            if (matching) {
              await fallbackStore.updateAccountTokens(
                matching._id,
                freshTokens.access_token,
                freshTokens.expiry_date || now2 + freshTokens.expires_in * 1e3,
                freshTokens.refresh_token
              );
            }
          }
        } catch (refreshErr) {
          console.warn("Failed to proactively refresh token:", refreshErr);
        }
      }
      let quotaResult2 = await fetchAntigravityQuota(accessToken2);
      if (!quotaResult2.success && quotaResult2.errorCode === "TOKEN_EXPIRED" && session.tokens.refresh_token) {
        try {
          const freshTokens = await refreshAccessToken(session.tokens.refresh_token);
          session.tokens.access_token = freshTokens.access_token;
          if (freshTokens.expiry_date) {
            session.tokens.expiry_date = freshTokens.expiry_date;
          }
          accessToken2 = freshTokens.access_token;
          setSessionCookie(res, session);
          if (session.user?.email) {
            const accList = await fallbackStore.listAccounts(session.user.email);
            const matching = accList.find((a) => a.email === session.user.email);
            if (matching) {
              await fallbackStore.updateAccountTokens(
                matching._id,
                freshTokens.access_token,
                freshTokens.expiry_date || now2 + freshTokens.expires_in * 1e3,
                freshTokens.refresh_token
              );
            }
          }
          quotaResult2 = await fetchAntigravityQuota(accessToken2);
        } catch (retryErr) {
          console.error("Failed to refresh token after 401:", retryErr);
        }
      }
      if (quotaResult2.success && quotaResult2.models.length > 0) {
        if (session.user?.email) {
          const accList = await fallbackStore.listAccounts(session.user.email);
          const matching = accList.find((a) => a.email === session.user.email);
          if (matching) {
            await fallbackStore.saveQuota(
              matching._id,
              session.user.email,
              quotaResult2.models,
              quotaResult2.tierInfo,
              quotaResult2.groups
            );
          }
        }
        const responsePayload2 = {
          success: true,
          account: {
            email: session.user.email,
            name: session.user.name,
            picture: session.user.picture
          },
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
          models: quotaResult2.models,
          groups: quotaResult2.groups,
          tierInfo: quotaResult2.tierInfo,
          diagnostics: quotaResult2.diagnostics
        };
        return res.json(responsePayload2);
      }
    }
    const localServer = discoverLocalAntigravityServer();
    if (localServer) {
      const quotaResult2 = await fetchAntigravityQuota();
      if (quotaResult2.success && quotaResult2.models.length > 0) {
        const email = session?.user.email || quotaResult2.raw?.userStatus?.email || "local@antigravity";
        const name = session?.user.name || quotaResult2.raw?.userStatus?.name || "Antigravity Local User";
        const responsePayload2 = {
          success: true,
          account: {
            email,
            name,
            picture: session?.user.picture
          },
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
          models: quotaResult2.models,
          tierInfo: quotaResult2.tierInfo,
          diagnostics: quotaResult2.diagnostics
        };
        return res.json(responsePayload2);
      }
    }
    if (!session) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated. Antigravity IDE is not running locally and no Google OAuth session was found.",
        errorCode: "UNAUTHENTICATED"
      });
    }
    let accessToken = session.tokens.access_token;
    const now = Date.now();
    const expiry = session.tokens.expiry_date;
    if (expiry && expiry - now < 6e4 && session.tokens.refresh_token) {
      try {
        const freshTokens = await refreshAccessToken(session.tokens.refresh_token);
        session.tokens.access_token = freshTokens.access_token;
        if (freshTokens.expiry_date) {
          session.tokens.expiry_date = freshTokens.expiry_date;
        }
        accessToken = freshTokens.access_token;
        setSessionCookie(res, session);
      } catch (refreshErr) {
        console.warn("Failed to proactively refresh token:", refreshErr);
      }
    }
    let quotaResult = await fetchAntigravityQuota(accessToken);
    if (!quotaResult.success && quotaResult.errorCode === "TOKEN_EXPIRED" && session.tokens.refresh_token) {
      try {
        const freshTokens = await refreshAccessToken(session.tokens.refresh_token);
        session.tokens.access_token = freshTokens.access_token;
        if (freshTokens.expiry_date) {
          session.tokens.expiry_date = freshTokens.expiry_date;
        }
        accessToken = freshTokens.access_token;
        setSessionCookie(res, session);
        quotaResult = await fetchAntigravityQuota(accessToken);
      } catch (retryErr) {
        console.error("Failed to refresh token after 401:", retryErr);
      }
    }
    const responsePayload = {
      success: quotaResult.success,
      account: {
        email: session.user.email,
        name: session.user.name,
        picture: session.user.picture
      },
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
      models: quotaResult.models,
      groups: quotaResult.groups,
      tierInfo: quotaResult.tierInfo,
      diagnostics: quotaResult.diagnostics,
      error: quotaResult.error,
      errorCode: quotaResult.errorCode,
      details: quotaResult.details
    };
    if (!quotaResult.success) {
      return res.status(200).json(responsePayload);
    }
    res.json(responsePayload);
  };
  app.get("/api/quota", quotaHandler);
  app.post("/api/quota/refresh", quotaHandler);
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            "**/.accounts_store.json",
            "**/.accounts_store.json*",
            "**/lib/**",
            "**/dist/**",
            "**/.git/**",
            "**/.gemini/**",
            "**/*.log"
          ]
        }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Antigravity Quota Watcher server running on port ${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
