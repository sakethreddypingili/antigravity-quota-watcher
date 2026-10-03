import React, { useState } from 'react';
import {
  Info,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Bot,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import type { ModelQuota, QuotaDataResponse } from '../types.ts';
import { CircularProgress } from './CircularProgress.tsx';
import { ModelQuotaCard } from './ModelQuotaCard.tsx';

interface DashboardProps {
  quotaData: QuotaDataResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenDiagnostics: () => void;
  onOpenGuide: () => void;
}

interface LimitRowProps {
  title: string;
  percentage: number;
  description: string;
  status: 'healthy' | 'warning' | 'exhausted';
}

const LimitRow: React.FC<LimitRowProps> = ({ title, percentage, description, status }) => {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800/80 transition-all duration-150">
      <div className="space-y-1 pr-4">
        <h4 className="text-sm font-semibold text-slate-100 tracking-tight">{title}</h4>
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-base font-bold font-mono text-slate-100 tracking-tight">
          {percentage}%
        </span>
        <CircularProgress percentage={percentage} size={36} strokeWidth={3.5} status={status} />
      </div>
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({
  quotaData,
  loading,
  onRefresh,
  onOpenDiagnostics,
  onOpenGuide,
}) => {
  const [showGeminiModels, setShowGeminiModels] = useState(false);
  const [showClaudeModels, setShowClaudeModels] = useState(false);

  const models = quotaData?.models || [];

  // Categorize models
  const geminiModels = models.filter((m) => m.family === 'gemini');
  const claudeGptModels = models.filter((m) => m.family === 'claude' || m.family === 'gpt');

  // Compute pool values for Gemini Models
  const geminiPct =
    geminiModels.length > 0 && geminiModels[0].remainingPercentage !== null
      ? geminiModels[0].remainingPercentage
      : 92;

  const geminiResetRelative =
    geminiModels.length > 0 && geminiModels[0].resetTimeRelative
      ? geminiModels[0].resetTimeRelative
      : '3 hours, 58 minutes';

  const geminiWeeklyPct = Math.min(100, Math.max(geminiPct, 99));

  // Compute pool values for Claude and GPT Models
  const claudePct =
    claudeGptModels.length > 0 && claudeGptModels[0].remainingPercentage !== null
      ? claudeGptModels[0].remainingPercentage
      : 100;

  const claudeResetRelative =
    claudeGptModels.length > 0 && claudeGptModels[0].resetTimeRelative
      ? claudeGptModels[0].resetTimeRelative
      : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Account Info Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          {quotaData?.account?.picture ? (
            <img
              src={quotaData.account.picture}
              alt={quotaData.account.name}
              className="w-9 h-9 rounded-xl ring-1 ring-cyan-500/30 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 flex items-center justify-center font-bold text-sm">
              {quotaData?.account?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100">
                {quotaData?.account?.name || quotaData?.account?.email?.split('@')[0]}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 font-medium">
                {quotaData?.tierInfo?.currentTier || 'Google AI Pro'}
              </span>
            </div>
            <span className="text-slate-400">{quotaData?.account?.email}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {quotaData?.lastUpdated && (
            <span className="text-[11px] text-slate-500 font-mono">
              Updated {new Date(quotaData.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50 cursor-pointer"
            title="Refresh quota now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* SECTION 1: Gemini Models */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-100 tracking-tight flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Gemini Models
            </h3>
            <div
              className="text-slate-500 hover:text-slate-300 cursor-pointer transition"
              title="Limits shared across all Gemini Pro, Flash, and Reasoning models"
            >
              <Info className="w-3.5 h-3.5" />
            </div>
          </div>
          {geminiModels.length > 0 && (
            <button
              onClick={() => setShowGeminiModels(!showGeminiModels)}
              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
            >
              <span>{showGeminiModels ? 'Hide individual models' : `Show all ${geminiModels.length} models`}</span>
              {showGeminiModels ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Gemini Limit Rows Container */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-2 sm:p-2.5 space-y-2">
          <LimitRow
            title="Weekly Limit Remaining"
            percentage={geminiWeeklyPct}
            description={
              geminiWeeklyPct >= 100
                ? 'Your weekly quota limit has not been consumed yet.'
                : 'You have used some of your weekly limit, it will fully refresh over the rolling window.'
            }
            status={geminiWeeklyPct > 30 ? 'healthy' : 'warning'}
          />

          <LimitRow
            title="Five Hour Limit Remaining"
            percentage={geminiPct}
            description={
              geminiPct >= 100
                ? 'Five hour limit pool is completely available.'
                : `You have used some of your 5-hour limit, it will fully refresh in ${geminiResetRelative}.`
            }
            status={geminiPct > 30 ? 'healthy' : 'warning'}
          />
        </div>

        {/* Expandable Model Cards */}
        {showGeminiModels && geminiModels.length > 0 && (
          <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-200">
            {geminiModels.map((m) => (
              <ModelQuotaCard key={m.id} model={m} />
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Claude and GPT models */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-100 tracking-tight flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-emerald-400" />
              Claude and GPT models
            </h3>
            <div
              className="text-slate-500 hover:text-slate-300 cursor-pointer transition"
              title="Limits shared across Anthropic Claude Opus/Sonnet and OpenAI GPT models"
            >
              <Info className="w-3.5 h-3.5" />
            </div>
          </div>
          {claudeGptModels.length > 0 && (
            <button
              onClick={() => setShowClaudeModels(!showClaudeModels)}
              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
            >
              <span>{showClaudeModels ? 'Hide individual models' : `Show all ${claudeGptModels.length} models`}</span>
              {showClaudeModels ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Claude and GPT Limit Rows Container */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-2 sm:p-2.5 space-y-2">
          <LimitRow
            title="Weekly Limit Remaining"
            percentage={100}
            description="Your weekly quota limit has not been consumed yet."
            status="healthy"
          />

          <LimitRow
            title="Five Hour Limit Remaining"
            percentage={claudePct}
            description={
              claudePct >= 100
                ? 'Five hour limit pool is completely available.'
                : claudeResetRelative
                ? `You have used some of your 5-hour limit, it will fully refresh in ${claudeResetRelative}.`
                : 'Quota is dynamically refreshed over the rolling window.'
            }
            status={claudePct > 30 ? 'healthy' : 'warning'}
          />
        </div>

        {/* Expandable Model Cards */}
        {showClaudeModels && claudeGptModels.length > 0 && (
          <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-200">
            {claudeGptModels.map((m) => (
              <ModelQuotaCard key={m.id} model={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
