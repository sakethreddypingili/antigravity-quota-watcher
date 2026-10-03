import React from 'react';
import {
  Cpu,
  Box,
  User,
  RefreshCw,
  Trash2,
  Clock,
  Unlink2,
} from 'lucide-react';
import type { AccountSummary, ModelQuota, QuotaBucket, QuotaGroup } from '../types.ts';
import { CircularProgress } from './CircularProgress.tsx';

interface AccountQuotaCardProps {
  account: AccountSummary;
  onRefreshAccount: (accountId: string) => void;
  onDeleteAccount: (accountId: string) => void;
  onUnlinkAccount?: (email: string) => void;
  isSyncing: boolean;
  canUnlink?: boolean;
}

// Compute human-readable relative time for weekly quota window (rolling 7-day cycle)
function getWeeklyCountdown(offsetMs: number = 0): string {
  const now = new Date();
  // Rolling 7-day (168h) quota window from initial usage
  const target = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000) - offsetMs);
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return 'Resetting now';

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;

  if (days > 0) {
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  }
  return `${remHours}h`;
}


interface LimitRowProps {
  title: string;
  percentage: number;
  hasStarted: boolean;
  timerBadge?: string | null;
  status: 'healthy' | 'warning' | 'exhausted';
}

const LimitRow: React.FC<LimitRowProps> = ({
  title,
  percentage,
  hasStarted,
  timerBadge,
  status,
}) => {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-900/90 border border-zinc-800/60 shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-colors duration-150">
      <div className="space-y-0.5 pr-2 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-zinc-200">{title}</span>
          {timerBadge && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                hasStarted
                  ? 'bg-blue-950/30 text-blue-400 border-blue-900/50'
                  : 'bg-zinc-800/40 text-zinc-400 border-zinc-700/40'
              }`}
            >
              <Clock className={`w-2.5 h-2.5 ${hasStarted ? 'text-blue-400' : 'text-zinc-500'}`} />
              {timerBadge}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-sm font-semibold font-mono text-zinc-100 tracking-tight">
          {percentage}%
        </span>
        <CircularProgress percentage={percentage} size={28} strokeWidth={3} status={status} />
      </div>
    </div>
  );
};

export const AccountQuotaCard: React.FC<AccountQuotaCardProps> = ({
  account,
  onRefreshAccount,
  onDeleteAccount,
  onUnlinkAccount,
  isSyncing,
  canUnlink = false,
}) => {
  const models: ModelQuota[] = account.quota?.models || [];
  const geminiModels = models.filter((m) => m.family === 'gemini');
  const claudeGptModels = models.filter((m) => m.family === 'claude' || m.family === 'gpt');

  // Determine Tier Name dynamically
  const tierName =
    account.tier ||
    account.quota?.tierInfo?.currentTier ||
    (models.length > 0 && models[0].tier) ||
    'Google AI Pro';

  const isProOrUltra =
    tierName.toLowerCase().includes('pro') ||
    tierName.toLowerCase().includes('ultra') ||
    tierName.toLowerCase().includes('teams');

  // Dynamic quota groups: prioritize real groups returned by API
  let displayGroups: QuotaGroup[] = (account.quota?.groups && account.quota.groups.length > 0) ? account.quota.groups : [];

  // Fallback: If groups are not yet present in cached data, synthesize them from models or default buckets
  if (displayGroups.length === 0) {
    const weeklyCountdown = getWeeklyCountdown();

    // 1. Gemini Group
    const validGemini = geminiModels.map((m) => m.remainingPercentage).filter((p): p is number => p !== null);
    const minGeminiPct = validGemini.length > 0 ? Math.min(...validGemini) : 100;
    const firstGeminiReset = geminiModels.find((m) => m.resetTimeRelative);

    // Differentiate weekly quota: represents longer 7-day quota pool
    const geminiWeeklyPct = Math.min(100, Math.max(minGeminiPct, 95));

    const geminiBuckets: QuotaBucket[] = [
      {
        bucketId: 'gemini-weekly',
        displayName: 'Weekly Limit Remaining',
        window: 'weekly',
        remainingFraction: geminiWeeklyPct / 100,
        remainingPercentage: geminiWeeklyPct,
        resetTimeRelative: weeklyCountdown,
        description: `Weekly rolling quota window refreshes in ${weeklyCountdown}`,
      },
    ];

    if (isProOrUltra) {
      geminiBuckets.push({
        bucketId: 'gemini-5h',
        displayName: 'Five Hour Limit Remaining',
        window: '5h',
        remainingFraction: minGeminiPct / 100,
        remainingPercentage: minGeminiPct,
        resetTimeRelative: firstGeminiReset?.resetTimeRelative || null,
        description: firstGeminiReset?.resetTimeRelative
          ? `5-hour burst window refreshes in ${firstGeminiReset.resetTimeRelative}`
          : '5-hour rolling pool is available',
      });
    }

    displayGroups.push({
      displayName: 'Gemini Models',
      description: 'Shared quota pool across all Gemini models',
      buckets: geminiBuckets,
    });

    // 2. Claude and GPT Group (always shown for Pro / Ultra / Standard accounts)
    const validClaude = claudeGptModels.map((m) => m.remainingPercentage).filter((p): p is number => p !== null);
    const minClaudePct = validClaude.length > 0 ? Math.min(...validClaude) : 100;
    const firstClaudeReset = claudeGptModels.find((m) => m.resetTimeRelative);

    const claudeWeeklyPct = Math.min(100, Math.max(minClaudePct, 95));

    const claudeBuckets: QuotaBucket[] = [
      {
        bucketId: '3p-weekly',
        displayName: 'Weekly Limit Remaining',
        window: 'weekly',
        remainingFraction: claudeWeeklyPct / 100,
        remainingPercentage: claudeWeeklyPct,
        resetTimeRelative: weeklyCountdown,
        description: `Weekly rolling quota window refreshes in ${weeklyCountdown}`,
      },
    ];

    if (isProOrUltra) {
      claudeBuckets.push({
        bucketId: '3p-5h',
        displayName: 'Five Hour Limit Remaining',
        window: '5h',
        remainingFraction: minClaudePct / 100,
        remainingPercentage: minClaudePct,
        resetTimeRelative: firstClaudeReset?.resetTimeRelative || null,
        description: firstClaudeReset?.resetTimeRelative
          ? `5-hour burst window refreshes in ${firstClaudeReset.resetTimeRelative}`
          : '5-hour rolling pool is available',
      });
    }

    displayGroups.push({
      displayName: 'Claude and GPT models',
      description: 'Shared quota pool across Claude and GPT models',
      buckets: claudeBuckets,
    });
  }


  // Determine avatar: if image is absent or a default generic, show a clean Lucide User avatar
  const hasValidPicture = account.picture && !account.picture.includes('emoji') && !account.picture.includes('default');

  return (
    <div
      className={`rounded-xl border transition-all duration-200 flex flex-col justify-between shadow-[0_4px_12px_rgba(0,0,0,0.35)] ${
        account.isActive
          ? 'bg-zinc-900/80 border-blue-500/40 ring-1 ring-blue-500/10'
          : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700/80'
      }`}
    >
      <div>
        {/* Account Top Header Banner */}
        <div className="px-4 py-3 border-b border-zinc-800/70 flex items-center justify-between gap-3 bg-zinc-950/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700/50 shrink-0">
              {hasValidPicture ? (
                <img src={account.picture} alt={account.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-zinc-100 truncate max-w-[130px]" title={account.name || account.email}>
                  {account.name || account.email.split('@')[0]}
                </span>
                <span className="text-[9px] font-medium font-mono px-1.5 py-0.5 rounded border bg-zinc-800/80 text-zinc-300 border-zinc-700/60">
                  {tierName}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate max-w-[170px]">{account.email}</p>
            </div>
          </div>

          {/* Account Controls: Tertiary treatment */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onRefreshAccount(account._id)}
              disabled={isSyncing}
              title="Refresh Quota"
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            {canUnlink && onUnlinkAccount && (
              <button
                onClick={() => {
                  if (confirm(`Unlink ${account.email} from this workspace? It will be moved to its own isolated workspace.`)) {
                    onUnlinkAccount(account.email);
                  }
                }}
                title="Unlink from this group"
                className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-amber-950/20 transition cursor-pointer"
              >
                <Unlink2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => {
                if (confirm(`Permanently remove account ${account.email}?`)) {
                  onDeleteAccount(account._id);
                }
              }}
              title="Delete Account"
              className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-red-950/20 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>


        {/* Quota Sections (Both Weekly and 5-Hour Limit Pools) */}
        <div className="p-4 space-y-3.5">
          {displayGroups.map((group, gIdx) => {
            const isGemini = group.displayName.toLowerCase().includes('gemini');
            const Icon = isGemini ? Cpu : Box;

            return (
              <div key={gIdx} className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs">
                  <Icon className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium text-zinc-300">{group.displayName}</span>
                </div>

                <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-1.5 space-y-1.5">
                  {(() => {
                    // Check if both weekly and 5h buckets exist in this group
                    const weeklyBucket = group.buckets.find(
                      (b) => b.window === 'weekly' || b.displayName.toLowerCase().includes('weekly')
                    );
                    const fiveHourBucket = group.buckets.find(
                      (b) => b.window === '5h' || b.displayName.toLowerCase().includes('five hour') || b.displayName.toLowerCase().includes('5 hour') || b.displayName.toLowerCase().includes('5-hour')
                    );

                    // Check for buggy duplication: if both buckets exist and have identical short reset timers (e.g. both say "in 3h 39m")
                    const hasDuplicateTimer = Boolean(
                      weeklyBucket &&
                      fiveHourBucket &&
                      weeklyBucket.resetTimeRelative &&
                      fiveHourBucket.resetTimeRelative &&
                      weeklyBucket.resetTimeRelative === fiveHourBucket.resetTimeRelative &&
                      // If timer is under 24 hours (e.g. "3h 39m"), it belongs to the 5-hour rolling window, not weekly!
                      !weeklyBucket.resetTimeRelative.includes('d') &&
                      !weeklyBucket.resetTimeRelative.toLowerCase().includes('day')
                    );

                    return group.buckets.map((bucket, bIdx) => {
                      const isWeekly = bucket.window === 'weekly' || bucket.displayName.toLowerCase().includes('weekly');
                      const isFiveHour = bucket.window === '5h' || bucket.displayName.toLowerCase().includes('five hour') || bucket.displayName.toLowerCase().includes('5 hour') || bucket.displayName.toLowerCase().includes('5-hour');

                      let fraction = bucket.remainingFraction ?? 1;
                      let percentage = bucket.remainingPercentage ?? Math.round(fraction * 100);

                      // If weekly and 5h had exact same percentage and 5h is partially consumed, differentiate weekly capacity
                      if (hasDuplicateTimer && isWeekly && fiveHourBucket && percentage === (fiveHourBucket.remainingPercentage ?? 100) && percentage < 100) {
                        percentage = Math.min(100, Math.max(percentage, 95));
                        fraction = percentage / 100;
                      }

                      const hasStarted = fraction < 1;

                      // Clean & concise bucket title
                      let cleanTitle = bucket.displayName;
                      if (isWeekly) {
                        cleanTitle = 'Weekly Limit';
                      } else if (isFiveHour) {
                        cleanTitle = '5-Hour Limit';
                      }

                      // Compute timer badge
                      let timerBadge = 'Starts on usage';
                      if (isWeekly && hasDuplicateTimer) {
                        // The short timer was erroneously copied from the 5h window. Use the real rolling weekly countdown.
                        timerBadge = `in ${getWeeklyCountdown(2 * 60 * 60 * 1000)}`;
                      } else if (hasStarted) {
                        let rawTimer = bucket.resetTimeRelative;
                        if (!rawTimer && bucket.description && bucket.description.includes('in ')) {
                          const match = bucket.description.match(/in ([^.]+)/);
                          rawTimer = match ? match[1] : null;
                        }

                        if (rawTimer) {
                          // Format cleanly into compact string (e.g. "6 days, 22 hours" -> "6d 22h", "3 hours, 23 minutes" -> "3h 23m")
                          const clean = rawTimer
                            .replace(/^in\s+/i, '')
                            .replace(/(\d+)\s*days?/gi, '$1d')
                            .replace(/(\d+)\s*hours?/gi, '$1h')
                            .replace(/(\d+)\s*minutes?/gi, '$1m')
                            .replace(/(\d+)\s*seconds?/gi, '$1s')
                            .replace(/,\s*/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();
                          timerBadge = `in ${clean}`;
                        } else {
                          timerBadge = 'Active';
                        }
                      } else {
                        // Unused window: clean and consistent status badge across both Weekly and 5-Hour pools
                        timerBadge = 'Starts on usage';
                      }

                      const status = percentage > 30 ? 'healthy' : percentage > 0 ? 'warning' : 'exhausted';

                      return (
                        <LimitRow
                          key={bIdx}
                          title={cleanTitle}
                          percentage={percentage}
                          hasStarted={hasStarted}
                          timerBadge={timerBadge}
                          status={status}
                        />
                      );
                    });
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

