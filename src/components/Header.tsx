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
      className="sticky top-0 z-30 bg-[#080706]/90 backdrop-blur-xl border-b border-[#29231F] text-[#F4EFE7] px-4 sm:px-6 lg:px-10 h-[74px] flex items-center shadow-[0_1px_0_rgba(255,255,255,0.02)]"
    >
      <div className="w-full max-w-[1680px] mx-auto flex items-center justify-between gap-4">
        {/* Minimal Clean Brand Header */}
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] font-[600] tracking-tight text-[#F4EFE7]">
            Antigravity Quota
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
              className="inline-flex items-center gap-2 h-[38px] px-4 text-[13px] font-[550] rounded-[12px] bg-gradient-to-b from-[#4285F4] to-[#326FE0] hover:brightness-105 active:scale-[0.98] text-white shadow-[0_2px_8px_rgba(50,111,224,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {/* Secondary Action: Add Account */}
            <button
              id="btn-add-account"
              onClick={onAddAccount}
              title="Add Google Account"
              className="inline-flex items-center gap-2 h-[38px] px-3.5 text-[13px] font-[500] rounded-[12px] bg-[#151311] hover:bg-[#1A1714] text-[#F4EFE7] border border-[#29231F] hover:border-[#3A3029] shadow-[0_1px_2px_rgba(0,0,0,0.35)] transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#A9A097]" />
              <span className="hidden sm:inline">Add Account</span>
            </button>

            {/* Tertiary Action: Diagnostics */}
            <button
              id="btn-diagnostics"
              onClick={onOpenDiagnostics}
              title="API diagnostics & inspect payloads"
              className="inline-flex items-center gap-2 h-[38px] px-3 text-[13px] font-[450] rounded-[12px] text-[#A9A097] hover:text-[#F4EFE7] hover:bg-[#151311] transition-all cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Diagnostics</span>
            </button>

            {/* Tertiary Action: Help Guide */}
            <button
              id="btn-setup-guide"
              onClick={onOpenGuide}
              title="Setup Guide"
              className="h-[38px] w-[38px] flex items-center justify-center rounded-[12px] text-[#A9A097] hover:text-[#F4EFE7] hover:bg-[#151311] transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Tertiary Action: Sign Out */}
            <button
              id="btn-logout"
              onClick={onLogout}
              title="Sign out"
              className="h-[38px] w-[38px] flex items-center justify-center rounded-[12px] text-[#706861] hover:text-[#D86666] hover:bg-[#D86666]/10 transition-all cursor-pointer"
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
              className="inline-flex items-center gap-1.5 h-[38px] px-3.5 text-[13px] font-[450] rounded-[12px] text-[#A9A097] hover:text-[#F4EFE7] hover:bg-[#151311] transition-all cursor-pointer"
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
              className="inline-flex items-center gap-2 h-[38px] px-4 text-[13px] font-[550] rounded-[12px] bg-gradient-to-b from-[#4285F4] to-[#326FE0] hover:brightness-105 active:scale-[0.98] text-white shadow-[0_2px_8px_rgba(50,111,224,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all disabled:opacity-50 cursor-pointer"
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
