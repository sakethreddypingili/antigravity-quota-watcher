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
    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-[11px] bg-[#17191A] hover:bg-[#1C1F20] border border-[#25292A] shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-all duration-150 group">
      {/* Metric title + Subtitle context underneath */}
      <div className="space-y-0.5 pr-2.5 flex-1 min-w-0">
        <div className="text-[12.5px] font-[500] text-[#F1F0EC] tracking-tight">{title}</div>
        {timerBadge && (
          <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-[#A7A49D]">
            <Clock className={`w-3 h-3 ${hasStarted ? 'text-[#3B82F6]' : 'text-[#6F6C66]'}`} />
            <span>{hasStarted ? `Resets ${timerBadge}` : timerBadge}</span>
          </div>
        )}
      </div>

      {/* Numerical percentage + optically centered CircularProgress */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-[15px] font-[650] font-mono text-[#F1F0EC] tracking-tight">
          {percentage}%
        </span>
        <CircularProgress percentage={percentage} size={28} strokeWidth={3.5} status={status} />
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
      className={`rounded-[20px] border transition-all duration-200 flex flex-col justify-between relative group ${
        account.isActive
          ? 'bg-[#0D0F10] border-white/[0.08] shadow-[0_12px_32px_rgba(0,0,0,0.35),0_0_0_1px_rgba(59,130,246,0.18)]'
          : 'bg-[#0D0F10] border-white/[0.065] hover:border-white/[0.12] shadow-[0_12px_32px_rgba(0,0,0,0.24),0_2px_8px_rgba(0,0,0,0.18)]'
      }`}
    >
      <div>
        {/* Account Hero Module Header */}
        <div className="p-4 border-b border-[#25292A]/80 flex flex-col gap-3 bg-gradient-to-b from-[#121415]/70 to-[#0D0F10]/50 rounded-t-[18px]">
          {/* Top row: Avatar + Identity */}
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[10px] bg-[#17191A] flex items-center justify-center overflow-hidden border border-[#25292A] shrink-0 shadow-sm">
                {hasValidPicture ? (
                  <img src={account.picture} alt={account.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-[#A7A49D]" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-[550] text-[#F1F0EC] tracking-tight truncate max-w-[170px]" title={account.name || account.email}>
                  {account.name || account.email.split('@')[0]}
                </div>
                <div className="text-[11.5px] font-[400] text-[#A7A49D] truncate max-w-[190px]">{account.email}</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
              <button
                onClick={() => onRefreshAccount(account._id)}
                disabled={isSyncing}
                title="Refresh Quota"
                className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[#6F6C66] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#3B82F6]' : ''}`} />
              </button>

              {canUnlink && onUnlinkAccount && (
                <button
                  onClick={() => {
                    if (confirm(`Unlink ${account.email} from this workspace? It will be moved to its own isolated workspace.`)) {
                      onUnlinkAccount(account.email);
                    }
                  }}
                  title="Unlink from this group"
                  className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[#6F6C66] hover:text-[#D6A85A] hover:bg-[#D6A85A]/10 transition cursor-pointer"
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
                className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[#6F6C66] hover:text-[#D86666] hover:bg-[#D86666]/10 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Bottom row: Material Tier Tag */}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[11px] font-[500] font-mono bg-[#17191A] text-[#D6B98A] border border-[#D6B98A]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D6B98A]" />
              {tierName}
            </span>
          </div>
        </div>


        {/* Quota Sections (Both Weekly and 5-Hour Limit Pools) */}
        <div className="p-4 space-y-3.5">
          {displayGroups.map((group, gIdx) => {
            const isGemini = group.displayName.toLowerCase().includes('gemini');
            const Icon = isGemini ? Cpu : Box;

            return (
              <div key={gIdx} className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs px-0.5">
                  <Icon className="w-3.5 h-3.5 text-[#A7A49D]" />
                  <span className="font-[500] text-[#A7A49D] text-[11.5px] tracking-tight">{group.displayName}</span>
                </div>

                <div className="space-y-1.5">
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

