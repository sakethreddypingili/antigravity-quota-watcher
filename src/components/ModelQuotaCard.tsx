import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { ModelQuota } from '../types.ts';
import { getStatusTheme, getFamilyBadge } from '../utils/format.ts';

interface ModelQuotaCardProps {
  model: ModelQuota;
}

export const ModelQuotaCard: React.FC<ModelQuotaCardProps> = ({ model }) => {
  const theme = getStatusTheme(model.status);
  const familyBadge = getFamilyBadge(model.family);
  const [expanded, setExpanded] = useState(false);

  const hasRemaining = model.remainingPercentage !== null;
  const remainingPct = model.remainingPercentage ?? 0;

  return (
    <div
      id={`model-card-${model.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
      className="group relative bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-left w-full focus:outline-none"
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${familyBadge.style}`}>
                {familyBadge.label}
              </span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${theme.badgeBg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                {theme.label}
              </span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight group-hover:text-cyan-300 transition-colors truncate">
              {model.displayName}
            </h3>
          </div>
        </div>

        {/* Quota summary only */}
        <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Remaining Quota</span>
            <span className={`text-2xl font-extrabold tracking-tight ${theme.text}`}>
              {hasRemaining ? `${remainingPct}%` : 'N/A'}
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${theme.progressBar}`}
              style={{ width: `${Math.max(3, Math.min(100, remainingPct))}%` }}
            />
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="pt-4 mt-3 border-t border-slate-800/80 space-y-3 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex justify-between text-slate-300">
            <span>Used:</span>
            <strong className="text-slate-200">{model.usedPercentage ?? 0}%</strong>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Remaining Fraction:</span>
            <span className="font-mono">{model.remainingFraction?.toFixed(2) ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Reset Window:</span>
            </div>
            <span className="font-medium text-slate-200">{model.resetTimeRelative || 'Dynamic Rolling'}</span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 pt-1">
            <span>Source:</span>
            <span className="font-mono text-slate-400">cloudcode-pa / v1internal</span>
          </div>
        </div>
      )}
    </div>
  );
};
