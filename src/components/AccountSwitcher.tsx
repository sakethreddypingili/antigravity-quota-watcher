import React, { useState } from 'react';
import { Users, UserPlus, Check, ChevronDown, Trash2, RefreshCw, Sparkles, Shield } from 'lucide-react';
import type { AccountSummary } from '../types.ts';

interface AccountSwitcherProps {
  accounts: AccountSummary[];
  activeAccountId?: string;
  onSwitchAccount: (accountId: string) => void;
  onAddAccount: () => void;
  onDeleteAccount: (accountId: string) => void;
  onSyncAccount: (accountId?: string) => void;
  isSyncing?: boolean;
}

export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({
  accounts,
  activeAccountId,
  onSwitchAccount,
  onAddAccount,
  onDeleteAccount,
  onSyncAccount,
  isSyncing = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeAccount = accounts.find((a) => a._id === activeAccountId || a.isActive) || accounts[0];

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium transition shadow-sm hover:border-slate-600"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center overflow-hidden border border-cyan-400/40">
          {activeAccount?.picture ? (
            <img src={activeAccount.picture} alt={activeAccount.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] font-bold text-white uppercase">
              {activeAccount?.name ? activeAccount.name.slice(0, 1) : 'G'}
            </span>
          )}
        </div>
        <div className="flex flex-col text-left">
          <span className="font-semibold text-white truncate max-w-[120px]">
            {activeAccount?.name || 'My Google Account'}
          </span>
          <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
            {activeAccount?.email || 'Connected'}
          </span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
          {accounts.length} {accounts.length === 1 ? 'acct' : 'accts'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden text-slate-100 p-2 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Switch Google Account</span>
              </div>
              <button
                onClick={() => {
                  onSyncAccount();
                }}
                disabled={isSyncing}
                title="Refresh all accounts"
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>

            {/* Account List */}
            <div className="max-h-60 overflow-y-auto py-1 space-y-1">
              {accounts.map((acc) => {
                const isActive = acc._id === activeAccount?._id || acc.isActive;
                return (
                  <div
                    key={acc._id}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer ${
                      isActive ? 'bg-cyan-950/40 border border-cyan-800/50' : 'hover:bg-slate-800/60'
                    }`}
                    onClick={() => {
                      onSwitchAccount(acc._id);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-700">
                        {acc.picture ? (
                          <img src={acc.picture} alt={acc.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-slate-300 uppercase">
                            {acc.name.slice(0, 1)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white truncate">{acc.name}</span>
                          {acc.tier && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                              {acc.tier.includes('Pro') ? 'Pro' : 'Free'}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 truncate">{acc.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isActive && <Check className="w-4 h-4 text-cyan-400 mr-1" />}
                      {accounts.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Remove account ${acc.email}?`)) {
                              onDeleteAccount(acc._id);
                            }
                          }}
                          className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                          title="Disconnect account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Account Action */}
            <div className="pt-2 mt-1 border-t border-slate-800">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onAddAccount();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 hover:from-cyan-600/30 hover:to-blue-600/30 border border-cyan-500/30 text-cyan-300 text-xs font-medium transition"
              >
                <UserPlus className="w-4 h-4" />
                <span>Connect Another Google Account</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
