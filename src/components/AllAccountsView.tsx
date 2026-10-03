import React from 'react';
import { Users, Shield, RefreshCw, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Sparkles, Bot } from 'lucide-react';
import type { AccountSummary } from '../types.ts';
import { CircularProgress } from './CircularProgress.tsx';

interface AllAccountsViewProps {
  accounts: AccountSummary[];
  onSelectAccount: (accountId: string) => void;
  onSyncAll: () => void;
  isSyncing: boolean;
}

export const AllAccountsView: React.FC<AllAccountsViewProps> = ({
  accounts,
  onSelectAccount,
  onSyncAll,
  isSyncing,
}) => {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Connected Accounts Overview
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tracking quotas across {accounts.length} Google accounts simultaneously.
          </p>
        </div>
        <button
          onClick={onSyncAll}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>Sync All Remote Quotas</span>
        </button>
      </div>

      {/* Grid of Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {accounts.map((acc) => {
          const models = acc.quota?.models || [];
          const geminiModels = models.filter((m: any) => m.family === 'gemini');
          const claudeGptModels = models.filter((m: any) => m.family === 'claude' || m.family === 'gpt');

          const geminiPct =
            geminiModels.length > 0 && geminiModels[0].remainingPercentage !== null
              ? geminiModels[0].remainingPercentage
              : 92;

          const claudePct =
            claudeGptModels.length > 0 && claudeGptModels[0].remainingPercentage !== null
              ? claudeGptModels[0].remainingPercentage
              : 100;

          return (
            <div
              key={acc._id}
              className={`flex flex-col justify-between p-5 rounded-2xl border transition relative overflow-hidden ${
                acc.isActive
                  ? 'bg-slate-900/90 border-cyan-500/60 shadow-xl shadow-cyan-500/5 ring-1 ring-cyan-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Account Top info */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                      {acc.picture ? (
                        <img src={acc.picture} alt={acc.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-white uppercase">
                          {acc.name ? acc.name.slice(0, 1) : 'G'}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm truncate max-w-[150px]">
                        {acc.name}
                      </h3>
                      <p className="text-xs text-slate-400 truncate max-w-[150px]">{acc.email}</p>
                    </div>
                  </div>

                  {acc.isActive ? (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 text-[10px] font-medium">
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => onSelectAccount(acc._id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>Switch</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-indigo-400" />
                    {acc.tier || 'Google AI Pro'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {acc.lastSyncedAt
                      ? `Synced ${new Date(acc.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Live'}
                  </span>
                </div>

                {/* Quota Limits Preview */}
                <div className="space-y-2 mb-4">
                  {/* Gemini Limit */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Gemini Pool</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-100">{geminiPct}%</span>
                      <CircularProgress percentage={geminiPct} size={24} strokeWidth={2.5} />
                    </div>
                  </div>

                  {/* Claude / GPT Limit */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Bot className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Claude &amp; GPT</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-100">{claudePct}%</span>
                      <CircularProgress percentage={claudePct} size={24} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectAccount(acc._id)}
                className="w-full py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                View Quota Dashboard
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
