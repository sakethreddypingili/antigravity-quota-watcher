import type { ModelQuota, QuotaStatusLevel } from '../../src/types.ts';

/**
 * Format model quota percentage for display
 */
export function formatPercentage(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'N/A';
  return `${val}%`;
}

/**
 * Color class mapping based on quota health status
 */
export function getStatusTheme(status: QuotaStatusLevel) {
  switch (status) {
    case 'healthy':
      return {
        badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        progressBar: 'bg-emerald-500',
        dot: 'bg-emerald-500',
        text: 'text-emerald-600 dark:text-emerald-400',
        label: 'Healthy',
      };
    case 'warning':
      return {
        badgeBg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
        progressBar: 'bg-amber-500',
        dot: 'bg-amber-500',
        text: 'text-amber-600 dark:text-amber-400',
        label: 'Low Quota',
      };
    case 'exhausted':
      return {
        badgeBg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
        progressBar: 'bg-rose-500',
        dot: 'bg-rose-500',
        text: 'text-rose-600 dark:text-rose-400',
        label: 'Exhausted',
      };
    case 'unknown':
    default:
      return {
        badgeBg: 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
        progressBar: 'bg-slate-400',
        dot: 'bg-slate-400',
        text: 'text-slate-500 dark:text-slate-400',
        label: 'Active',
      };
  }
}

/**
 * Visual badge for Model Provider / Family
 */
export function getFamilyBadge(family: ModelQuota['family']) {
  switch (family) {
    case 'gemini':
      return {
        label: 'Gemini',
        style: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
      };
    case 'claude':
      return {
        label: 'Claude',
        style: 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-300 border-orange-200 dark:border-orange-800/60',
      };
    case 'gpt':
      return {
        label: 'GPT',
        style: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      };
    default:
      return {
        label: 'Model',
        style: 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800',
      };
  }
}
