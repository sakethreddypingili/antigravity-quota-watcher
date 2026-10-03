/**
 * Google Antigravity & Cloud Code Assist Quota Service Module
 *
 * NOTE: This service module isolates the integration with Google's Cloud Code Assist
 * backend endpoints (e.g. https://cloudcode-pa.googleapis.com/v1internal:*).
 * As established by community implementations (AntigravityQuotaWatcher, CodexBar,
 * AntigravityProxy), these endpoints are part of Google Cloud Code Assist's private /
 * internal API and are not published as a public open API.
 * Isolating this logic here allows rapid updates if upstream endpoints evolve.
 */

import type { AntigravityDiagnostics, ModelQuota, QuotaGroup, QuotaStatusLevel } from '../../src/types.ts';
import { formatModelDisplayName } from './modelNames.ts';

export const CODE_ASSIST_BASE_URL = 'https://cloudcode-pa.googleapis.com';
export const FETCH_MODELS_ENDPOINT = `${CODE_ASSIST_BASE_URL}/v1internal:fetchAvailableModels`;
export const LOAD_CODE_ASSIST_ENDPOINT = `${CODE_ASSIST_BASE_URL}/v1internal:loadCodeAssist`;

export interface FetchQuotaResult {
  success: boolean;
  models: ModelQuota[];
  groups?: QuotaGroup[];
  tierInfo?: {
    currentTier?: string;
    cloudaicompanionProject?: string;
    plan?: string;
  };
  diagnostics: AntigravityDiagnostics;
  error?: string;
  errorCode?: 'TOKEN_EXPIRED' | 'PERMISSION_DENIED' | 'RATE_LIMITED' | 'CAPACITY_EXHAUSTED' | 'SERVICE_UNAVAILABLE' | 'PARSE_ERROR' | 'UNKNOWN';
  details?: string;
  raw?: unknown;
}

/**
 * Format ISO reset timestamp into human-readable relative time string
 */
export function formatResetTime(isoString: string | null | undefined): {
  formatted: string | null;
  relative: string | null;
} {
  if (!isoString) {
    return { formatted: null, relative: null };
  }

  try {
    const targetDate = new Date(isoString);
    if (isNaN(targetDate.getTime())) {
      return { formatted: isoString, relative: null };
    }

    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();

    const formatted = targetDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric',
    });

    if (diffMs <= 0) {
      return { formatted, relative: 'Resetting now' };
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);

    let relative: string;
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

/**
 * Identify the model family from its ID or name
 */
function identifyModelFamily(modelId: string): 'gemini' | 'claude' | 'gpt' | 'other' {
  const lower = modelId.toLowerCase();
  if (lower.includes('claude')) return 'claude';
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('gpt') || lower.includes('openai')) return 'gpt';
  return 'other';
}

/**
 * Compute the quota health status from remaining fraction
 */
function computeQuotaStatus(remainingFraction: number | null | undefined): QuotaStatusLevel {
  if (remainingFraction === null || remainingFraction === undefined) {
    return 'unknown';
  }
  if (remainingFraction <= 0) {
    return 'exhausted';
  }
  if (remainingFraction <= 0.3) {
    return 'warning';
  }
  return 'healthy';
}

/**
 * Fetch available Antigravity / Cloud Code Assist models and quotas
 */
export const RETRIEVE_USER_QUOTA_ENDPOINT = `${CODE_ASSIST_BASE_URL}/v1internal:retrieveUserQuota`;
export const RETRIEVE_USER_QUOTA_SUMMARY_ENDPOINT = `${CODE_ASSIST_BASE_URL}/v1internal:retrieveUserQuotaSummary`;
import { discoverLocalAntigravityServer, queryLocalUserStatus } from './localServer.ts';

export async function fetchAntigravityQuota(
  accessToken?: string
): Promise<FetchQuotaResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log('[Quota Service] ---------- NEW QUOTA FETCH START ----------');

  // 1. PRIMARY STRATEGY: If accessToken is provided, query Google Cloud Code Assist API remotely
  if (accessToken) {
    console.log('[Quota Service] Using remote Cloud Code Assist API with access token');
  } else {
    // 2. FALLBACK STRATEGY: If no access token, try local running Antigravity IDE Language Server
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
            currentTier: localResult.user?.tierName || 'Google AI Pro',
            plan: localResult.user?.planStatus || 'ACTIVE',
          },
          diagnostics: {
            endpointUsed: `https://127.0.0.1:${localServer.port}/exa.language_server_pb.LanguageServerService/GetUserStatus`,
            httpStatus: 200,
            latencyMs: Date.now() - startTime,
            timestamp,
            modelsCount: localResult.models.length,
            hasRawQuotaInfo: true,
            tierDetected: localResult.user?.tierName || 'Google AI Pro',
            providerMode: 'local_language_server',
          },
          raw: localResult.raw,
        };
      } else {
        console.warn('[Quota Service] Local server query failed or returned no models:', localResult.error);
      }
    }
  }

  if (!accessToken) {
    return {
      success: false,
      models: [],
      diagnostics: {
        endpointUsed: 'local_language_server_discovery',
        httpStatus: 0,
        latencyMs: Date.now() - startTime,
        timestamp,
        modelsCount: 0,
        hasRawQuotaInfo: false,
        providerMode: 'local_language_server',
      },
      error: 'Antigravity IDE is not running locally, and no Google OAuth session was provided.',
      errorCode: 'SERVICE_UNAVAILABLE',
      details: 'Start Antigravity IDE on this Mac or sign in with Google to use remote Cloud Code Assist.',
    };
  }

  // 2. SECONDARY STRATEGY: Call loadCodeAssist
  console.log(`[Quota Service] Calling loadCodeAssist endpoint: ${LOAD_CODE_ASSIST_ENDPOINT}`);
  let loadRes: Response;
  try {
    loadRes = await fetch(LOAD_CODE_ASSIST_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'antigravity',
        'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
      },
      body: JSON.stringify({}),
    });
  } catch (networkErr: unknown) {
    const latencyMs = Date.now() - startTime;
    const errMessage = networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error('[Quota Service] loadCodeAssist Network Error:', errMessage);
    return {
      success: false,
      models: [],
      diagnostics: {
        endpointUsed: LOAD_CODE_ASSIST_ENDPOINT,
        httpStatus: 0,
        latencyMs,
        timestamp,
        modelsCount: 0,
        hasRawQuotaInfo: false,
      },
      error: 'Network connection to Cloud Code Assist failed',
      errorCode: 'SERVICE_UNAVAILABLE',
      details: errMessage,
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
        hasRawQuotaInfo: false,
      },
      error: 'Google OAuth session expired or invalid credentials',
      errorCode: 'TOKEN_EXPIRED',
      details: 'HTTP 401 Unauthorized from loadCodeAssist. Token refresh required.',
    };
  }

  let loadBodyText = '';
  try {
    loadBodyText = await loadRes.text();
  } catch (e) {
    console.error('[Quota Service] Failed to read loadCodeAssist response body');
  }

  console.log('[Quota Service] loadCodeAssist response:', loadBodyText);

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
        hasRawQuotaInfo: false,
      },
      error: 'Google account is authenticated, but Cloud Code Assist access was denied',
      errorCode: 'PERMISSION_DENIED',
      details: 'HTTP 403 Forbidden. Response: ' + loadBodyText.slice(0, 300),
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
        hasRawQuotaInfo: false,
      },
      error: `loadCodeAssist failed with HTTP ${loadHttpStatus}`,
      errorCode: loadHttpStatus === 429 ? 'RATE_LIMITED' : loadHttpStatus === 503 ? 'CAPACITY_EXHAUSTED' : 'UNKNOWN',
      details: loadBodyText.slice(0, 500),
    };
  }

  let loadData: Record<string, unknown> = {};
  try {
    loadData = JSON.parse(loadBodyText);
  } catch (e) {
    console.error('[Quota Service] Failed to parse loadCodeAssist response as JSON');
  }

  let companionProject: string | undefined;
  if (typeof loadData.cloudaicompanionProject === 'string') {
    companionProject = loadData.cloudaicompanionProject;
  } else if (loadData.cloudaicompanionProject && typeof loadData.cloudaicompanionProject === 'object') {
    companionProject = (loadData.cloudaicompanionProject as Record<string, string>).id;
  }

  let currentTier = 'Free Tier';
  // Check paidTier first as user has Google AI Pro subscription even if currentTier says free-tier
  if (loadData.paidTier && typeof loadData.paidTier === 'object') {
    const pt = loadData.paidTier as Record<string, string>;
    currentTier = pt.name || pt.id || 'Google AI Pro';
  } else if (typeof loadData.paidTier === 'string' && loadData.paidTier !== '') {
    currentTier = loadData.paidTier;
  } else if (loadData.currentTier && typeof loadData.currentTier === 'object') {
    const ct = loadData.currentTier as Record<string, string>;
    currentTier = ct.name || ct.id || 'Free Tier';
  } else if (typeof loadData.currentTier === 'string') {
    currentTier = loadData.currentTier;
  }

  // Format tier name nicely if it is an ID
  if (currentTier === 'g1-pro-tier') currentTier = 'Google AI Pro';
  if (currentTier === 'free-tier') currentTier = 'Free Tier';
  if (currentTier === 'standard-tier') currentTier = 'Standard';

  const plan = typeof loadData.plan === 'string' ? loadData.plan : undefined;

  console.log(`[Quota Service] discovered cloudaicompanionProject: ${companionProject || 'NONE'}`);
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
        hasRawQuotaInfo: false,
      },
      error: 'Could not discover Cloud Code companion project',
      errorCode: 'UNKNOWN',
      details: 'loadCodeAssist did not return a cloudaicompanionProject. You may need to accept the Cloud Code Assist terms or the API might be disabled for this account. Response: ' + loadBodyText,
    };
  }

  // 2. Query Quota Endpoints with discovered companionProject
  const requestBody = JSON.stringify(companionProject ? { project: companionProject } : {});
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'User-Agent': 'antigravity',
    'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
  };

  // Helper for sub-queries
  const fetchQuotaEndpoint = async (url: string, name: string) => {
    console.log(`[Quota Service] Calling ${name}: ${url}`);
    try {
      const res = await fetch(url, { method: 'POST', headers, body: requestBody });
      const status = res.status;
      console.log(`[Quota Service] ${name} HTTP status: ${status}`);
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
        console.log(`[Quota Service] ${name} sanitized response:`, JSON.stringify(data).slice(0, 300) + '...');
      } catch {
        console.log(`[Quota Service] ${name} response was not JSON:`, text.slice(0, 100));
      }
      return { ok: res.ok, status, data, text };
    } catch (e) {
      console.error(`[Quota Service] ${name} request failed:`, e);
      return { ok: false, status: 0, data: null, text: '' };
    }
  };

  // Run all supported endpoints
  const [quotaRes, summaryRes, modelsRes] = await Promise.all([
    fetchQuotaEndpoint(RETRIEVE_USER_QUOTA_ENDPOINT, 'retrieveUserQuota'),
    fetchQuotaEndpoint(RETRIEVE_USER_QUOTA_SUMMARY_ENDPOINT, 'retrieveUserQuotaSummary'),
    fetchQuotaEndpoint(FETCH_MODELS_ENDPOINT, 'fetchAvailableModels'),
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
        providerMode: 'cloudcode_api',
      },
      error: `All quota endpoints failed. modelsStatus=${modelsRes.status}, quotaStatus=${quotaRes.status}`,
      errorCode: 'SERVICE_UNAVAILABLE',
      details: `Models response: ${modelsRes.text.slice(0, 100)}`,
    };
  }

  // We will merge retrieveUserQuota (which has real-time remainingFraction & resetTime)
  // with fetchAvailableModels (which has model metadata).
  let rawData = quotaRes.data || modelsRes.data || summaryRes.data || {};

  // Normalize models list from different schema variations:
  // Variation A: { models: [ { name, displayName, quotaInfo: { remainingFraction, resetTime } } ] }
  // Variation B: { models: { "model-id": { ... } } }
  // Variation C: Array at root [ { ... } ]
  const rawModelsList: Array<Record<string, unknown>> = [];

  if (Array.isArray(rawData.models)) {
    for (const item of rawData.models) {
      if (item && typeof item === 'object') {
        rawModelsList.push(item as Record<string, unknown>);
      }
    }
  } else if (rawData.models && typeof rawData.models === 'object') {
    for (const [key, val] of Object.entries(rawData.models)) {
      if (val && typeof val === 'object') {
        rawModelsList.push({ id: key, ...(val as Record<string, unknown>) });
      }
    }
  } else if (Array.isArray(rawData)) {
    for (const item of rawData) {
      if (item && typeof item === 'object') {
        rawModelsList.push(item as Record<string, unknown>);
      }
    }
  } else if (Array.isArray(rawData.quotaInfo)) { // handle retrieveUserQuota variant if models not found
    for (const item of rawData.quotaInfo) {
      if (item && typeof item === 'object') {
        rawModelsList.push(item as Record<string, unknown>);
      }
    }
  } else if (Array.isArray(rawData.buckets)) { // handle retrieveUserQuota buckets
    for (const item of rawData.buckets) {
      if (item && typeof item === 'object') {
        const b = item as Record<string, unknown>;
        rawModelsList.push({
          id: b.modelId || b.model,
          name: b.modelId || b.model,
          remainingFraction: b.remainingFraction,
          resetTime: b.resetTime,
          tokenType: b.tokenType,
        });
      }
    }
  }

  let hasRawQuotaInfo = false;

  const parsedModels: ModelQuota[] = rawModelsList.map((m) => {
    const id = String(m.name || m.id || m.model || 'unknown-model');
    const displayName = formatModelDisplayName(id, (m.displayName || m.title) as string);
    const family = identifyModelFamily(id + ' ' + displayName);

    let remainingFraction: number | null = null;
    let resetTime: string | null = null;
    let limitInfo: ModelQuota['limitInfo'] = undefined;

    // Check nested quotaInfo object
    if (m.quotaInfo && typeof m.quotaInfo === 'object') {
      const q = m.quotaInfo as Record<string, unknown>;
      hasRawQuotaInfo = true;

      if (typeof q.remainingFraction === 'number') {
        remainingFraction = Math.max(0, Math.min(1, q.remainingFraction));
      }
      if (typeof q.resetTime === 'string') {
        resetTime = q.resetTime;
      }
      if (q.limit || q.requests || q.window) {
        limitInfo = {
          requests: typeof q.requests === 'number' ? q.requests : undefined,
          tokens: typeof q.tokens === 'number' ? q.tokens : undefined,
          window: typeof q.window === 'string' ? q.window : undefined,
        };
      }
    } else if (typeof m.remainingFraction === 'number') {
      hasRawQuotaInfo = true;
      remainingFraction = Math.max(0, Math.min(1, m.remainingFraction));
      if (typeof m.resetTime === 'string') {
        resetTime = m.resetTime;
      }
    }

    const { formatted: resetTimeFormatted, relative: resetTimeRelative } = formatResetTime(resetTime);
    const status = computeQuotaStatus(remainingFraction);

    const remainingPercentage =
      remainingFraction !== null ? Math.round(remainingFraction * 100) : null;
    const usedPercentage =
      remainingPercentage !== null ? Math.max(0, 100 - remainingPercentage) : null;

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
      tier: typeof m.tier === 'string' ? m.tier : undefined,
      supportedGenerations: Array.isArray(m.supportedGenerations)
        ? (m.supportedGenerations as string[])
        : undefined,
    };
  });

  // Parse dynamic Quota Groups from retrieveUserQuotaSummary
  let parsedGroups: QuotaGroup[] | undefined;
  if (summaryRes.data && Array.isArray(summaryRes.data.groups)) {
    parsedGroups = summaryRes.data.groups.map((g: any) => {
      const buckets = Array.isArray(g.buckets)
        ? g.buckets.map((b: any) => {
            const fraction = typeof b.remainingFraction === 'number' ? b.remainingFraction : null;
            const pct = fraction !== null ? Math.round(fraction * 100) : null;
            const { formatted, relative } = formatResetTime(b.resetTime);
            return {
              bucketId: String(b.bucketId || ''),
              displayName: String(b.displayName || 'Limit Remaining'),
              window: b.window ? String(b.window) : undefined,
              resetTime: b.resetTime ? String(b.resetTime) : null,
              resetTimeFormatted: formatted,
              resetTimeRelative: relative,
              description: b.description ? String(b.description) : null,
              remainingFraction: fraction,
              remainingPercentage: pct,
            };
          })
        : [];
      return {
        displayName: String(g.displayName || 'Models'),
        description: g.description ? String(g.description) : undefined,
        buckets,
      };
    });
  }

  // Sort models: Gemini and Claude first, then alphabetically
  parsedModels.sort((a, b) => {
    const familyWeight = (f: string) => {
      if (f === 'gemini') return 1;
      if (f === 'claude') return 2;
      if (f === 'gpt') return 3;
      return 4;
    };
    const diff = familyWeight(a.family) - familyWeight(b.family);
    if (diff !== 0) return diff;
    return a.displayName.localeCompare(b.displayName);
  });

  console.log('[Quota Service] ---------- QUOTA FETCH COMPLETE ----------');

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
      providerMode: 'cloudcode_api',
    },
  };
}
