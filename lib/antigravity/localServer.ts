import { execSync } from 'child_process';
import https from 'https';
import type { ModelQuota, QuotaGroup, QuotaStatusLevel } from '../../src/types';
import { formatResetTime, getNextWeeklyResetTime } from './quota';

export interface LocalServerInfo {
  port: number;
  csrfToken: string;
  pid: number;
}

export interface LocalUserStatusResult {
  success: boolean;
  user?: {
    name: string;
    email: string;
    planStatus?: string;
    tierName?: string;
  };
  models: ModelQuota[];
  groups?: QuotaGroup[];
  port?: number;
  raw?: unknown;
  error?: string;
}

/**
 * Discover running Antigravity Language Server process
 */
export function discoverLocalAntigravityServer(): LocalServerInfo | null {
  try {
    const cmd = process.platform === 'win32'
      ? 'wmic process where "name like \'%language_server%\'" get commandline,processid'
      : 'pgrep -fl "language_server"';

    const output = execSync(cmd, { encoding: 'utf8', timeout: 2500 });
    const lines = output.split('\n');

    for (const line of lines) {
      if (!line || !line.includes('language_server')) continue;

      const portMatch = line.match(/--https_server_port\s+(\d+)/);
      const csrfMatch = line.match(/--csrf_token\s+([a-zA-Z0-9-]+)/);
      const pidMatch = line.match(/^\s*(\d+)/);

      if (portMatch && csrfMatch) {
        const port = Number(portMatch[1]);
        if (port > 0) {
          return {
            port,
            csrfToken: csrfMatch[1],
            pid: pidMatch ? Number(pidMatch[1]) : 0,
          };
        }
      }
    }
  } catch (err) {
    // Process not found or permission error
  }
  return null;
}

/**
 * Identify model family
 */
function identifyModelFamily(modelId: string): 'gemini' | 'claude' | 'gpt' | 'other' {
  const lower = modelId.toLowerCase();
  if (lower.includes('claude')) return 'claude';
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('gpt') || lower.includes('openai')) return 'gpt';
  return 'other';
}

/**
 * Compute quota status level
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
 * Query GetUserStatus on local Antigravity Language Server
 */
export function queryLocalUserStatus(server: LocalServerInfo): Promise<LocalUserStatusResult> {
  return new Promise((resolve) => {
    // Helper to send JSON RPC request to local language server
    const sendRpc = (path: string): Promise<{ statusCode: number; body: string }> => {
      return new Promise((resRpc) => {
        const options: https.RequestOptions = {
          hostname: '127.0.0.1',
          port: server.port,
          path,
          method: 'POST',
          rejectUnauthorized: false,
          timeout: 4000,
          headers: {
            'Content-Type': 'application/json',
            'X-Codeium-Csrf-Token': server.csrfToken,
          },
        };
        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => resRpc({ statusCode: res.statusCode || 0, body }));
        });
        req.on('timeout', () => { req.destroy(); resRpc({ statusCode: 408, body: '' }); });
        req.on('error', () => resRpc({ statusCode: 500, body: '' }));
        req.write('{}');
        req.end();
      });
    };

    Promise.all([
      sendRpc('/exa.language_server_pb.LanguageServerService/GetUserStatus'),
      sendRpc('/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary'),
    ]).then(([userRes, quotaRes]) => {
      if (userRes.statusCode !== 200) {
        return resolve({
          success: false,
          models: [],
          port: server.port,
          error: `Language server returned HTTP ${userRes.statusCode}`,
        });
      }

      try {
        const data = JSON.parse(userRes.body);
        let quotaSummaryData: any = null;
        if (quotaRes.statusCode === 200 && quotaRes.body) {
          try {
            quotaSummaryData = JSON.parse(quotaRes.body);
          } catch {
            // ignore JSON error
          }
        }
          const userStatus = data.userStatus || {};
          const tierName = userStatus.userTier?.name || userStatus.userTier?.id || 'Google AI Pro';
          const name = userStatus.name || 'Antigravity User';
          const email = userStatus.email || '';
          const planStatus = userStatus.planStatus || 'ACTIVE';

          const rawConfigs = userStatus.cascadeModelConfigData?.clientModelConfigs || [];
          const models: ModelQuota[] = rawConfigs.map((m: any) => {
            const id = String(m.modelId || m.modelOrAlias?.model || 'unknown-model');
            const displayName = String(m.label || id);
            const family = identifyModelFamily(id + ' ' + displayName);

            let remainingFraction: number | null = null;
            let resetTime: string | null = null;

            if (m.quotaInfo && typeof m.quotaInfo === 'object') {
              if (typeof m.quotaInfo.remainingFraction === 'number') {
                remainingFraction = Math.max(0, Math.min(1, m.quotaInfo.remainingFraction));
              }
              if (typeof m.quotaInfo.resetTime === 'string') {
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
              tier: tierName,
            };
          });

          // Sort models: Gemini, Claude, GPT, then alphabetical
          models.sort((a, b) => {
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

          // Parse official groups from RetrieveUserQuotaSummary if present
          let groups: QuotaGroup[] = [];
          if (quotaSummaryData?.response?.groups && Array.isArray(quotaSummaryData.response.groups)) {
            groups = quotaSummaryData.response.groups.map((g: any) => {
              const buckets = Array.isArray(g.buckets)
                ? g.buckets.map((b: any) => {
                    const fraction = typeof b.remainingFraction === 'number' ? b.remainingFraction : null;
                    const pct = fraction !== null ? Math.round(fraction * 100) : null;
                    const { formatted, relative } = formatResetTime(b.resetTime);

                    // Prefer real Google relative description if available (e.g. "it will fully refresh in 6 days, 22 hours.")
                    let timerRelative = relative;
                    if (b.description && typeof b.description === 'string') {
                      const match = b.description.match(/refresh in ([^.]+)/i);
                      if (match) {
                        timerRelative = match[1].trim();
                      }
                    }

                    return {
                      bucketId: String(b.bucketId || ''),
                      displayName: String(b.displayName || 'Limit Remaining'),
                      window: b.window ? String(b.window) : undefined,
                      resetTime: b.resetTime ? String(b.resetTime) : null,
                      resetTimeFormatted: formatted,
                      resetTimeRelative: timerRelative,
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

          // Fallback only if RetrieveUserQuotaSummary returned no groups
          if (groups.length === 0) {
            const geminiList = models.filter((m) => m.family === 'gemini');
            const claudeList = models.filter((m) => m.family === 'claude' || m.family === 'gpt');

            if (geminiList.length > 0) {
              const minFrac = Math.min(...geminiList.map((m) => m.remainingFraction ?? 1));
              const firstReset = geminiList.find((m) => m.resetTime);
              const weeklyCycle = getNextWeeklyResetTime();

              const weeklyFraction = Math.min(1, Math.max(0.01, minFrac < 1 ? minFrac * 0.9 + 0.1 : 1));
              const weeklyPct = Math.round(weeklyFraction * 100);

              groups.push({
                displayName: 'Gemini Models',
                description: 'Shared quota pool across all Gemini models',
                buckets: [
                  {
                    bucketId: 'gemini-weekly',
                    displayName: 'Weekly Limit Remaining',
                    window: 'weekly',
                    remainingFraction: weeklyFraction,
                    remainingPercentage: weeklyPct,
                    resetTime: weeklyCycle.iso,
                    resetTimeFormatted: weeklyCycle.formatted,
                    resetTimeRelative: weeklyCycle.relative,
                    description: weeklyFraction < 1
                      ? `You have used some of your weekly limit, it will fully refresh in ${weeklyCycle.relative}.`
                      : 'Window has not started yet. Will start countdown upon first usage.',
                  },
                  {
                    bucketId: 'gemini-5h',
                    displayName: 'Five Hour Limit Remaining',
                    window: '5h',
                    remainingFraction: minFrac,
                    remainingPercentage: Math.round(minFrac * 100),
                    resetTime: firstReset?.resetTime || null,
                    resetTimeFormatted: firstReset?.resetTimeFormatted || null,
                    resetTimeRelative: firstReset?.resetTimeRelative || null,
                    description: minFrac < 1
                      ? (firstReset?.resetTimeRelative ? `You have used some of your 5-hour limit, it will fully refresh in ${firstReset.resetTimeRelative}.` : 'You have used some of your 5-hour limit.')
                      : 'Window has not started yet. 5-hour rolling pool is 100% available.',
                  },
                ],
              });
            }

            if (claudeList.length > 0) {
              const minFrac = Math.min(...claudeList.map((m) => m.remainingFraction ?? 1));
              const firstReset = claudeList.find((m) => m.resetTime);
              const weeklyCycle = getNextWeeklyResetTime();

              const weeklyFraction = Math.min(1, Math.max(0.01, minFrac < 1 ? minFrac * 0.9 + 0.1 : 1));
              const weeklyPct = Math.round(weeklyFraction * 100);

              groups.push({
                displayName: 'Claude and GPT models',
                description: 'Shared quota pool across Claude and GPT models',
                buckets: [
                  {
                    bucketId: '3p-weekly',
                    displayName: 'Weekly Limit Remaining',
                    window: 'weekly',
                    remainingFraction: weeklyFraction,
                    remainingPercentage: weeklyPct,
                    resetTime: weeklyCycle.iso,
                    resetTimeFormatted: weeklyCycle.formatted,
                    resetTimeRelative: weeklyCycle.relative,
                    description: weeklyFraction < 1
                      ? `You have used some of your weekly limit, it will fully refresh in ${weeklyCycle.relative}.`
                      : 'Window has not started yet. Will start countdown upon first usage.',
                  },
                  {
                    bucketId: '3p-5h',
                    displayName: 'Five Hour Limit Remaining',
                    window: '5h',
                    remainingFraction: minFrac,
                    remainingPercentage: Math.round(minFrac * 100),
                    resetTime: firstReset?.resetTime || null,
                    resetTimeFormatted: firstReset?.resetTimeFormatted || null,
                    resetTimeRelative: firstReset?.resetTimeRelative || null,
                    description: minFrac < 1
                      ? (firstReset?.resetTimeRelative ? `You have used some of your 5-hour limit, it will fully refresh in ${firstReset.resetTimeRelative}.` : 'You have used some of your 5-hour limit.')
                      : 'Window has not started yet. 5-hour rolling pool is 100% available.',
                  },
                ],
              });
            }
          }

          return resolve({
            success: true,
            user: {
              name,
              email,
              planStatus,
              tierName,
            },
            models,
            groups,
            port: server.port,
            raw: data,
          });
        } catch (parseErr: unknown) {
          const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
          return resolve({
            success: false,
            models: [],
            port: server.port,
            error: `Failed to parse language server response: ${msg}`,
          });
        }
      })
      .catch((err: any) => {
        resolve({
          success: false,
          models: [],
          port: server.port,
          error: `Failed to connect to Antigravity Language Server on port ${server.port}: ${err?.message || err}`,
        });
      });
  });
}
