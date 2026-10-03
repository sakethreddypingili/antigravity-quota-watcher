import React, { useState, useEffect, useCallback } from 'react';
import type {
  AuthStatusResponse,
  QuotaDataResponse,
  AccountSummary,
} from './types.ts';
import { Header } from './components/Header.tsx';
import { AccountQuotaCard } from './components/AccountQuotaCard.tsx';
import { LoginView } from './components/LoginView.tsx';
import { DiagnosticsModal } from './components/DiagnosticsModal.tsx';
import { SetupGuideModal } from './components/SetupGuideModal.tsx';
import { Users, UserPlus, Sparkles, RefreshCw } from 'lucide-react';

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse>({
    authenticated: false,
    hasConfig: true,
    redirectUri: '',
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Multi-account states
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Active quota data for diagnostics
  const [activeQuotaData, setActiveQuotaData] = useState<QuotaDataResponse | null>(null);

  // Modals
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Load multi-accounts list
  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error('Failed to load accounts list:', err);
    }
  }, []);

  // Check auth session without flipping top-level loading screen
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AuthStatusResponse = await res.json();
      setAuthStatus(data);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to check auth status:', msg);
      return null;
    }
  }, []);

  // Sync / Refresh single account
  const handleRefreshSingleAccount = async (accountId: string) => {
    try {
      setSyncingAccountId(accountId);
      // Switch active and fetch fresh
      await fetch('/api/accounts/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const quotaRes = await fetch('/api/quota');
      if (quotaRes.ok) {
        const qData = await quotaRes.json();
        setActiveQuotaData(qData);
      }
      await loadAccounts();
    } catch (err) {
      console.error('Failed to refresh single account:', err);
    } finally {
      setSyncingAccountId(null);
    }
  };

  // Sync all accounts
  const handleSyncAll = async () => {
    try {
      setIsSyncingAll(true);
      await fetch('/api/accounts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const quotaRes = await fetch('/api/quota');
      if (quotaRes.ok) {
        const qData = await quotaRes.json();
        setActiveQuotaData(qData);
      }
      await loadAccounts();
    } catch (err) {
      console.error('Failed to sync all accounts:', err);
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
      if (res.ok) {
        await loadAccounts();
        await checkAuth();
      }
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  // Unlink account from current workspace
  const handleUnlinkAccount = async (email: string) => {
    try {
      const res = await fetch('/api/accounts/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        await loadAccounts();
        await checkAuth();
      }
    } catch (err) {
      console.error('Failed to unlink account:', err);
    }
  };

  // Initial bootstrap: parallel load session & accounts once without layout shifts
  useEffect(() => {
    let mounted = true;
    Promise.allSettled([checkAuth(), loadAccounts()]).finally(() => {
      if (mounted) {
        setIsInitialLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [checkAuth, loadAccounts]);

  // Username & Password Authentication
  const handleUsernameLogin = async (username: string, password: string) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sign in.');
      }
      await checkAuth();
      await loadAccounts();
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to sign in.';
      setLoginError(msg);
      return { success: false, error: msg };
    } finally {
      setLoginLoading(false);
    }
  };

  const handleUsernameRegister = async (username: string, password: string) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to register account.');
      }
      await checkAuth();
      await loadAccounts();
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to register account.';
      setLoginError(msg);
      return { success: false, error: msg };
    } finally {
      setLoginLoading(false);
    }
  };

  // Google OAuth login to connect or link an account
  const handleConnectAccount = async (mode: 'login' | 'link' = authStatus.authenticated ? 'link' : 'login') => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch(`/api/auth/url?mode=${mode}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.error || `HTTP ${res.status}: Failed to get OAuth authorization URL`
        );
      }
      const { url } = await res.json();
      if (!url) throw new Error('Authorization URL was empty.');

      const width = 540;
      const height = 660;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        url,
        'google_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.location.href = url;
        return;
      }

      let completed = false;

      const finishLogin = async () => {
        if (completed) return;
        completed = true;
        setLoginLoading(false);
        try {
          await checkAuth();
          await fetch('/api/accounts/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
          await loadAccounts();
        } catch (e) {
          console.error('Error refreshing post-login:', e);
        }
      };

      const messageListener = async (event: MessageEvent) => {
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
          window.removeEventListener('message', messageListener);
          await finishLogin();
        }
      };
      window.addEventListener('message', messageListener);

      const checkPopupInterval = window.setInterval(async () => {
        // Step A: In-memory detection if popup reached callback before closing
        try {
          if (popup && !popup.closed && popup.location) {
            const href = popup.location.href;
            if (href && (href.includes('code=') || href.includes('localhost:3001') || href.includes('/api/auth/callback'))) {
              window.clearInterval(checkPopupInterval);
              window.removeEventListener('message', messageListener);
              try { popup.close(); } catch {}
              await handleRelayAuth(href);
              return;
            }
          }
        } catch {
          // Cross-origin restriction before redirect to loopback is expected
        }

        if (popup.closed) {
          window.clearInterval(checkPopupInterval);
          window.removeEventListener('message', messageListener);
          await finishLogin();
        }
      }, 400);
    } catch (err) {
      setLoginLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      setLoginError(msg);
    }
  };

  // Relay auth callback URL / code directly into production server
  const handleRelayAuth = async (input: string) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/relay-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: input }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to exchange authentication code');
      }
      await checkAuth();
      await fetch('/api/accounts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      await loadAccounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  // Step B: Seamless Background Autodetect when mobile user resumes/switches back to tab
  useEffect(() => {
    let lastChecked = '';
    const inspectForRedirectAuth = async () => {
      // 1. Check if the current window URL itself contains ?code= (e.g. if redirected directly)
      const currentUrl = window.location.href;
      if (currentUrl.includes('code=') && !currentUrl.includes('/api/auth/callback')) {
        const urlObj = new URL(currentUrl);
        const code = urlObj.searchParams.get('code');
        if (code && code !== lastChecked) {
          lastChecked = code;
          window.history.replaceState({}, document.title, window.location.pathname);
          await handleRelayAuth(code);
          return;
        }
      }

      // 2. Check clipboard in background if user copied or browser captured the redirect URL
      if (document.hasFocus() && navigator.clipboard && navigator.clipboard.readText) {
        try {
          const text = await navigator.clipboard.readText();
          if (text && text !== lastChecked && (text.includes('code=') || text.includes('localhost:3001') || text.startsWith('4/0A'))) {
            lastChecked = text;
            await handleRelayAuth(text);
          }
        } catch {
          // Clipboard access without explicit gesture may be restricted on some platforms
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        inspectForRedirectAuth();
      }
    };

    window.addEventListener('focus', inspectForRedirectAuth);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', inspectForRedirectAuth);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);


  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout request failed:', err);
    }
    setAuthStatus((prev) => ({ ...prev, authenticated: false, user: undefined }));
    setAccounts([]);
    setActiveQuotaData(null);
  };

  const proAccounts = accounts.filter((acc) => {
    const tier = (
      acc.tier ||
      acc.quota?.tierInfo?.currentTier ||
      (acc.quota?.models && acc.quota.models[0]?.tier) ||
      ''
    ).toLowerCase();
    return tier.includes('pro') || tier.includes('ultra') || tier.includes('teams');
  });

  const standardAccounts = accounts.filter((acc) => {
    const tier = (
      acc.tier ||
      acc.quota?.tierInfo?.currentTier ||
      (acc.quota?.models && acc.quota.models[0]?.tier) ||
      ''
    ).toLowerCase();
    return !(tier.includes('pro') || tier.includes('ultra') || tier.includes('teams'));
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-sky-500/30 selection:text-sky-200">
      <Header
        user={authStatus.user ? { ...authStatus.user, id: '', authenticated: authStatus.authenticated } : null}
        loading={isSyncingAll}
        onRefreshAll={handleSyncAll}
        onAddAccount={() => handleConnectAccount()}
        onLogout={handleLogout}
        onOpenDiagnostics={() => setDiagnosticsOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
        accountsCount={accounts.length}
      />

      <main className="max-w-[1680px] mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8">
        {isInitialLoading && accounts.length === 0 ? (
          <div className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
            <span className="text-xs text-zinc-400 font-medium tracking-wide">
              Loading Google Accounts &amp; Quotas...
            </span>
          </div>
        ) : accounts.length > 0 ? (
          <div className="space-y-5 sm:space-y-6">
            {/* 3-Part Layout: 2 parts for Google AI Pro, 1 part for Starter */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-start w-full">
              {/* Left Section: Google AI Pro (2/3 of screen) */}
              <div className="lg:col-span-2 space-y-3 min-w-0">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2 h-2 rounded-full bg-[#D6B98A] shadow-[0_0_8px_rgba(214,185,138,0.6)]" />
                  <h3 className="text-[12px] font-[600] uppercase tracking-[0.09em] text-[#F5F5F7]/90">
                    Google AI Pro
                  </h3>
                </div>

                {proAccounts.length > 0 ? (
                  /* Fit 2 cards side-by-side under Google AI Pro */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    {proAccounts.map((acc) => (
                      <AccountQuotaCard
                        key={acc._id}
                        account={acc}
                        onRefreshAccount={handleRefreshSingleAccount}
                        onDeleteAccount={handleDeleteAccount}
                        onUnlinkAccount={handleUnlinkAccount}
                        canUnlink={accounts.length > 1}
                        isSyncing={syncingAccountId === acc._id || isSyncingAll}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="p-8 rounded-[18px] border border-white/[0.07] satin-card text-center text-xs text-[#6B7280]">
                    No Google AI Pro accounts connected.
                  </div>
                )}
              </div>

              {/* Right Section: Starter (1/3 of screen) */}
              <div className="lg:col-span-1 space-y-3 min-w-0">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2 h-2 rounded-full bg-[#6B7280]" />
                  <h3 className="text-[12px] font-[600] uppercase tracking-[0.09em] text-[#9CA3AF]">
                    Starter
                  </h3>
                </div>

                {standardAccounts.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {standardAccounts.map((acc) => (
                      <AccountQuotaCard
                        key={acc._id}
                        account={acc}
                        onRefreshAccount={handleRefreshSingleAccount}
                        onDeleteAccount={handleDeleteAccount}
                        onUnlinkAccount={handleUnlinkAccount}
                        canUnlink={accounts.length > 1}
                        isSyncing={syncingAccountId === acc._id || isSyncingAll}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="p-7 rounded-[18px] border border-white/[0.07] satin-card text-center flex flex-col items-center justify-center gap-2.5 relative overflow-hidden group">
                    <div className="w-8 h-8 rounded-[10px] bg-[#16191E] border border-white/[0.08] flex items-center justify-center text-[#9CA3AF] text-xs shadow-sm">
                      ◇
                    </div>
                    <div className="space-y-1">
                      <div className="text-[13.5px] font-[550] text-[#F5F5F7]">Starter Accounts</div>
                      <p className="text-[11.5px] text-[#9CA3AF] max-w-[220px] leading-relaxed">
                        No standard tier accounts linked to this workspace.
                      </p>
                    </div>
                    <button
                      onClick={() => handleConnectAccount('link')}
                      className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[11.5px] font-[500] text-[#F5F5F7] bg-[#16191E] hover:bg-[#1E232B] border border-white/[0.08] hover:border-white/[0.16] shadow-[0_2px_8px_rgba(0,0,0,0.3)] active:scale-95 transition-all cursor-pointer"
                    >
                      <span>+ Add Starter Account</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <LoginView
            onLogin={handleUsernameLogin}
            onRegister={handleUsernameRegister}
            onOpenGuide={() => setGuideOpen(true)}
            loading={loginLoading}
            error={loginError}
          />
        )}
      </main>

      <DiagnosticsModal
        isOpen={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        diagnostics={activeQuotaData?.diagnostics || null}
        quotaData={activeQuotaData}
      />

      <SetupGuideModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        redirectUri={authStatus.redirectUri}
      />
    </div>
  );
}