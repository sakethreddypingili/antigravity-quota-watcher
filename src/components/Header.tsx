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
      className="sticky top-0 z-30 bg-[#07080A]/95 backdrop-blur-2xl border-b border-white/[0.065] text-[#F5F5F7] px-4 sm:px-6 lg:px-10 py-3 sm:py-0 min-h-[60px] sm:h-[72px] flex flex-col sm:flex-row justify-center sm:items-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)]"
    >
      <div className="w-full max-w-[1680px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Brand Row (Top on mobile, Left on desktop) */}
        <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <h1 className="text-[17px] sm:text-[19px] font-[600] tracking-tight text-[#F5F5F7] flex items-center gap-2">
              <span>Antigravity Quota</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            </h1>
          </div>

          {/* Quick icon actions visible on right side of top row on mobile */}
          {user && (
            <div className="flex sm:hidden items-center gap-1">
              <button
                onClick={onOpenDiagnostics}
                title="API diagnostics & inspect payloads"
                className="h-8 w-8 flex items-center justify-center rounded-[8px] text-[#9CA3AF] hover:text-[#F5F5F7] bg-white/[0.03] border border-white/[0.06] transition-all cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenGuide}
                title="Setup Guide"
                className="h-8 w-8 flex items-center justify-center rounded-[8px] text-[#9CA3AF] hover:text-[#F5F5F7] bg-white/[0.03] border border-white/[0.06] transition-all cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onLogout}
                title="Sign out"
                className="h-8 w-8 flex items-center justify-center rounded-[8px] text-[#6B7280] hover:text-[#EF4444] bg-white/[0.03] border border-white/[0.06] transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Action Controls Row */}
        {user ? (
          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            {/* Primary Action: Refresh */}
            <button
              id="btn-refresh-all"
              onClick={onRefreshAll}
              disabled={loading}
              title="Refresh quotas"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-[34px] sm:h-[36px] px-3.5 text-[12px] sm:text-[12.5px] font-[550] rounded-[9px] sm:rounded-[10px] bg-gradient-to-b from-[#3B82F6] to-[#2563EB] hover:from-[#428CFF] hover:to-[#2B6DFA] active:scale-[0.98] text-white shadow-[0_2px_12px_rgba(37,99,235,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh Quotas'}</span>
            </button>

            {/* Secondary Action: Add Account */}
            <button
              id="btn-add-account"
              onClick={onAddAccount}
              title="Add Google Account"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-[34px] sm:h-[36px] px-3 text-[12px] sm:text-[12.5px] font-[500] rounded-[9px] sm:rounded-[10px] bg-[#121519] hover:bg-[#181C22] text-[#F5F5F7] border border-white/[0.08] hover:border-white/[0.15] shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.98] transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#9CA3AF]" />
              <span>Add Account</span>
            </button>

            {/* Desktop-only secondary icons */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[8px] bg-white/[0.04] border border-white/[0.06] text-xs text-[#9CA3AF]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="font-medium text-[#F5F5F7] max-w-[120px] truncate">{user.name || user.email}</span>
              </div>

              <button
                id="btn-diagnostics"
                onClick={onOpenDiagnostics}
                title="API diagnostics & inspect payloads"
                className="inline-flex items-center gap-1.5 h-[36px] px-2.5 text-[12.5px] font-[450] rounded-[10px] text-[#9CA3AF] hover:text-[#F5F5F7] hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Diagnostics</span>
              </button>

              <button
                id="btn-setup-guide"
                onClick={onOpenGuide}
                title="Setup Guide"
                className="h-[36px] w-[36px] flex items-center justify-center rounded-[10px] text-[#9CA3AF] hover:text-[#F5F5F7] hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              <button
                id="btn-logout"
                onClick={onLogout}
                title="Sign out"
                className="h-[36px] w-[36px] flex items-center justify-center rounded-[10px] text-[#6B7280] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* Guest Action: Setup Guide */}
            <button
              id="btn-guest-guide"
              onClick={onOpenGuide}
              title="Setup Guide"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-[34px] sm:h-[36px] px-3 text-[12px] sm:text-[12.5px] font-[450] rounded-[9px] sm:rounded-[10px] text-[#9CA3AF] hover:text-[#F5F5F7] bg-[#121519] border border-white/[0.08] transition-all cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Setup Guide</span>
            </button>

            {/* Guest Action: Prominent Sign in */}
            <button
              id="btn-guest-login"
              onClick={onAddAccount}
              disabled={loading}
              title="Sign in with Google"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-[34px] sm:h-[36px] px-4 text-[12px] sm:text-[12.5px] font-[550] rounded-[9px] sm:rounded-[10px] bg-gradient-to-b from-[#3B82F6] to-[#2563EB] hover:from-[#428CFF] hover:to-[#2B6DFA] active:scale-[0.98] text-white shadow-[0_2px_12px_rgba(37,99,235,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all disabled:opacity-50 cursor-pointer"
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
