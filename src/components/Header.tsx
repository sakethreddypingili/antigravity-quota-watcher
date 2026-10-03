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
      className="sticky top-0 z-30 bg-[#07080A]/90 backdrop-blur-2xl border-b border-white/[0.065] text-[#F5F5F7] px-3.5 sm:px-6 lg:px-10 py-2.5 sm:py-0 min-h-[58px] sm:h-[72px] flex items-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)]"
    >
      <div className="w-full max-w-[1680px] mx-auto flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-4">
        {/* Minimal Clean Brand Header */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <h1 className="text-[16px] sm:text-[19px] font-[600] tracking-tight text-[#F5F5F7] flex items-center gap-1.5 sm:gap-2">
            <span>Antigravity Quota</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          </h1>
        </div>

        {/* Header Controls: Clean Guest Mode vs Authenticated Mode */}
        {user ? (
          <div className="flex items-center gap-1.5 sm:gap-2.5 ml-auto">
            {/* Primary Action: Refresh */}
            <button
              id="btn-refresh-all"
              onClick={onRefreshAll}
              disabled={loading}
              title="Refresh quotas"
              className="inline-flex items-center gap-1.5 h-[32px] sm:h-[36px] px-2.5 sm:px-3.5 text-[11.5px] sm:text-[12.5px] font-[550] rounded-[9px] sm:rounded-[10px] bg-gradient-to-b from-[#3B82F6] to-[#2563EB] hover:from-[#428CFF] hover:to-[#2B6DFA] active:scale-[0.98] text-white shadow-[0_2px_12px_rgba(37,99,235,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? '...' : 'Refresh'}</span>
            </button>

            {/* Secondary Action: Add Account */}
            <button
              id="btn-add-account"
              onClick={onAddAccount}
              title="Add Google Account"
              className="inline-flex items-center gap-1.5 h-[32px] sm:h-[36px] px-2 sm:px-3 text-[11.5px] sm:text-[12.5px] font-[500] rounded-[9px] sm:rounded-[10px] bg-[#121519] hover:bg-[#181C22] text-[#F5F5F7] border border-white/[0.08] hover:border-white/[0.15] shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.98] transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#9CA3AF]" />
              <span className="hidden md:inline">Add Account</span>
            </button>

            {/* Tertiary Action: Diagnostics */}
            <button
              id="btn-diagnostics"
              onClick={onOpenDiagnostics}
              title="API diagnostics & inspect payloads"
              className="inline-flex items-center gap-1.5 h-[32px] sm:h-[36px] px-2 sm:px-2.5 text-[11.5px] sm:text-[12.5px] font-[450] rounded-[9px] sm:rounded-[10px] text-[#9CA3AF] hover:text-[#F5F5F7] hover:bg-white/[0.04] transition-all cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Diagnostics</span>
            </button>

            {/* Tertiary Action: Help Guide */}
            <button
              id="btn-setup-guide"
              onClick={onOpenGuide}
              title="Setup Guide"
              className="h-[32px] w-[32px] sm:h-[36px] sm:w-[36px] flex items-center justify-center rounded-[9px] sm:rounded-[10px] text-[#9CA3AF] hover:text-[#F5F5F7] hover:bg-white/[0.04] transition-all cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Tertiary Action: Sign Out */}
            <button
              id="btn-logout"
              onClick={onLogout}
              title="Sign out"
              className="h-[32px] w-[32px] sm:h-[36px] sm:w-[36px] flex items-center justify-center rounded-[9px] sm:rounded-[10px] text-[#6B7280] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {/* Guest Action: Setup Guide */}
            <button
              id="btn-guest-guide"
              onClick={onOpenGuide}
              title="Setup Guide"
              className="inline-flex items-center gap-1.5 h-[32px] sm:h-[36px] px-2.5 sm:px-3.5 text-[11.5px] sm:text-[12.5px] font-[450] rounded-[9px] sm:rounded-[10px] text-[#9CA3AF] hover:text-[#F5F5F7] hover:bg-white/[0.04] transition-all cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Setup Guide</span>
            </button>

            {/* Guest Action: Prominent Sign in */}
            <button
              id="btn-guest-login"
              onClick={onAddAccount}
              disabled={loading}
              title="Sign in with Google"
              className="inline-flex items-center gap-1.5 sm:gap-2 h-[32px] sm:h-[36px] px-3 sm:px-4 text-[11.5px] sm:text-[12.5px] font-[550] rounded-[9px] sm:rounded-[10px] bg-gradient-to-b from-[#3B82F6] to-[#2563EB] hover:from-[#428CFF] hover:to-[#2B6DFA] active:scale-[0.98] text-white shadow-[0_2px_12px_rgba(37,99,235,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all disabled:opacity-50 cursor-pointer"
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
