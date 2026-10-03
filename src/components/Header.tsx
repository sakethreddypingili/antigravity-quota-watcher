import React from 'react';
import {
  Sparkles,
  RefreshCw,
  LogOut,
  HelpCircle,
  Terminal,
  UserPlus,
  Users,
} from 'lucide-react';
import type { GoogleUser, AccountSummary } from '../types.ts';

export interface HeaderProps {
  user: (GoogleUser & { authenticated?: boolean }) | null;
  loading: boolean;
  onRefreshAll: () => void;
  onAddAccount: () => void;
  onLogout: () => void;
  onOpenDiagnostics: () => void;
  onOpenGuide: () => void;
  accountsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  loading,
  onRefreshAll,
  onAddAccount,
  onLogout,
  onOpenDiagnostics,
  onOpenGuide,
  accountsCount,
}) => {
  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 text-zinc-100 px-4 sm:px-6 lg:px-10 pt-4 pb-4 sm:pt-5 sm:pb-5 shadow-sm"
    >
      <div className="max-w-[1680px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Minimal Clean Brand Header */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
            Antigravity Quota
          </h1>
        </div>

        {/* Header Controls: Clean Guest Mode vs Authenticated Mode */}
        {user ? (
          <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
            {/* Primary Action: Refresh */}
            <button
              id="btn-refresh-all"
              onClick={onRefreshAll}
              disabled={loading}
              title="Refresh quotas"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-950/50 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {/* Secondary Action: Add Account */}
            <button
              id="btn-add-account"
              onClick={onAddAccount}
              title="Add Google Account"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-zinc-400" />
              <span className="hidden sm:inline">Add Account</span>
            </button>

            {/* Tertiary Action: Diagnostics */}
            <button
              id="btn-diagnostics"
              onClick={onOpenDiagnostics}
              title="API diagnostics & inspect payloads"
              className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition cursor-pointer"
            >
              <Terminal className="w-4 h-4" />
              <span className="hidden md:inline">Diagnostics</span>
            </button>

            {/* Tertiary Action: Help Guide */}
            <button
              id="btn-setup-guide"
              onClick={onOpenGuide}
              title="Setup Guide"
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {/* Tertiary Action: Sign Out */}
            <button
              id="btn-logout"
              onClick={onLogout}
              title="Sign out"
              className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Guest Action: Setup Guide */}
            <button
              id="btn-guest-guide"
              onClick={onOpenGuide}
              title="Setup Guide"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Setup Guide</span>
            </button>

            {/* Guest Action: Prominent Sign in */}
            <button
              id="btn-guest-login"
              onClick={onAddAccount}
              disabled={loading}
              title="Sign in with Google"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-950/50 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
