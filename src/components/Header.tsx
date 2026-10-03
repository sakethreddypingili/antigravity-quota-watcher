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
      className="sticky top-0 z-30 bg-[#07080A]/80 backdrop-blur-2xl border-b border-white/[0.065] text-[#F5F5F7] px-4 sm:px-6 lg:px-10 h-[72px] flex items-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)]"
    >
      <div className="w-full max-w-[1680px] mx-auto flex items-center justify-between gap-4">
        {/* Minimal Clean Brand Header */}
        <div className="flex items-center gap-3">
          <h1 className="text-[19px] font-[600] tracking-tight text-[#F5F5F7] flex items-center gap-2">
            <span>Antigravity Quota</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          </h1>
        </div>

        {/* Header Controls: Clean Guest Mode vs Authenticated Mode */}
        {user ? (
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Primary Action: Refresh */}
            <button
              id="btn-refresh-all"
              onClick={onRefreshAll}
              disabled={loading}
              title="Refresh quotas"
              className="inline-flex items-center gap-2 h-[36px] px-3.5 text-[12.5px] font-[550] rounded-[10px] bg-gradient-to-b from-[#3B82F6] to-[#2563EB] hover:from-[#428CFF] hover:to-[#2B6DFA] active:scale-[0.98] text-white shadow-[0_2px_12px_rgba(37,99,235,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {/* Secondary Action: Add Account */}
            <button
              id="btn-add-account"
              onClick={onAddAccount}
              title="Add Google Account"
              className="inline-flex items-center gap-1.5 h-[36px] px-3 text-[12.5px] font-[500] rounded-[10px] bg-[#121519] hover:bg-[#181C22] text-[#F5F5F7] border border-white/[0.08] hover:border-white/[0.15] shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.98] transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#9CA3AF]" />
              <span className="hidden sm:inline">Add Account</span>
            </button>

            {/* Tertiary Action: Diagnostics */}
            <button
              id="btn-diagnostics"
              onClick={onOpenDiagnostics}
              title="API diagnostics & inspect payloads"
              className="inline-flex items-center gap-1.5 h-[36px] px-2.5 text-[12.5px] font-[450] rounded-[10px] text-[#9CA3AF] hover:text-[#F5F5F7] hover:bg-white/[0.04] transition-all cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Diagnostics</span>
            </button>

            {/* Tertiary Action: Help Guide */}
            <button
              id="btn-setup-guide"
              onClick={onOpenGuide}
              title="Setup Guide"
              className="h-[36px] w-[36px] flex items-center justify-center rounded-[10px] text-[#9CA3AF] hover:text-[#F5F5F7] hover:bg-white/[0.04] transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Tertiary Action: Sign Out */}
            <button
              id="btn-logout"
              onClick={onLogout}
              title="Sign out"
              className="h-[36px] w-[36px] flex items-center justify-center rounded-[10px] text-[#6B7280] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Guest Action: Setup Guide */}
            <button
              id="btn-guest-guide"
              onClick={onOpenGuide}
              title="Setup Guide"
              className="inline-flex items-center gap-1.5 h-[36px] px-3.5 text-[12.5px] font-[450] rounded-[10px] text-[#9CA3AF] hover:text-[#F5F5F7] hover:bg-white/[0.04] transition-all cursor-pointer"
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
              className="inline-flex items-center gap-2 h-[36px] px-4 text-[12.5px] font-[550] rounded-[10px] bg-gradient-to-b from-[#3B82F6] to-[#2563EB] hover:from-[#428CFF] hover:to-[#2B6DFA] active:scale-[0.98] text-white shadow-[0_2px_12px_rgba(37,99,235,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all disabled:opacity-50 cursor-pointer"
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
