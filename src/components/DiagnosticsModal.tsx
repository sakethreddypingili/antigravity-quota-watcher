import React, { useState } from 'react';
import {
  X,
  Terminal,
  Copy,
  Check,
  Server,
  Activity,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import type { AntigravityDiagnostics, QuotaDataResponse } from '../types.ts';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: AntigravityDiagnostics | null;
  quotaData: QuotaDataResponse | null;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  diagnostics,
  quotaData,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const payload = {
    diagnostics: diagnostics || quotaData?.diagnostics,
    account: quotaData?.account,
    tierInfo: quotaData?.tierInfo,
    lastUpdated: quotaData?.lastUpdated,
    modelsDetected: quotaData?.models.length || 0,
    errorCode: quotaData?.errorCode,
    error: quotaData?.error,
    details: quotaData?.details,
    modelsSummary: quotaData?.models.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      family: m.family,
      remainingPercentage: m.remainingPercentage,
      status: m.status,
      resetTime: m.resetTime,
    })),
  };

  const jsonString = JSON.stringify(payload, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-950/40 text-sky-400 border border-sky-800/40">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Diagnostics Inspector</h2>
              <p className="text-xs text-zinc-400">
                Google Cloud Code Assist endpoint payload
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
              <div className="text-[11px] text-zinc-400">HTTP Status</div>
              <div className="text-base font-semibold text-zinc-100 mt-0.5">
                {diagnostics?.httpStatus ?? quotaData?.diagnostics.httpStatus ?? 'N/A'}
              </div>
            </div>

            <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
              <div className="text-[11px] text-zinc-400">Response Latency</div>
              <div className="text-base font-semibold text-sky-400 mt-0.5">
                {diagnostics?.latencyMs ?? quotaData?.diagnostics.latencyMs ?? 0} ms
              </div>
            </div>

            <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
              <div className="text-[11px] text-zinc-400">Models Found</div>
              <div className="text-base font-semibold text-emerald-400 mt-0.5">
                {quotaData?.models.length ?? 0}
              </div>
            </div>

            <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
              <div className="text-[11px] text-zinc-400">Tier Detected</div>
              <div className="text-base font-semibold text-indigo-300 mt-0.5 truncate">
                {quotaData?.tierInfo?.currentTier || 'Standard'}
              </div>
            </div>
          </div>

          {/* Endpoint Details */}
          <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">Active Provider</span>
              <span className={`text-[11px] px-2 py-0.5 rounded font-mono ${
                diagnostics?.providerMode === 'local_language_server'
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                  : 'bg-sky-950/60 text-sky-300 border border-sky-800/50'
              }`}>
                {diagnostics?.providerMode === 'local_language_server'
                  ? 'Local Antigravity Engine'
                  : 'Cloud Code Assist API'}
              </span>
            </div>
            <div className="font-mono text-xs text-sky-300 break-all bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800">
              {diagnostics?.endpointUsed ||
                'Local Antigravity Language Server / cloudcode-pa'}
            </div>
          </div>

          {/* Raw JSON View */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-300">
                Payload
              </span>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800/80 font-mono text-xs text-zinc-300 overflow-x-auto max-h-64 leading-relaxed">
              {jsonString}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-800 bg-zinc-900/90 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Strict privacy: Sensitive credentials are never logged.</span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
