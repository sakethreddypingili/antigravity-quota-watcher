import React, { useState } from 'react';
import {
  Lock,
  Sparkles,
  AlertCircle,
  User,
  KeyRound,
  ArrowRight,
  Shield,
  HelpCircle,
} from 'lucide-react';

interface LoginViewProps {
  onLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onRegister: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onOpenGuide: () => void;
  loading: boolean;
  error?: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  onRegister,
  onOpenGuide,
  loading,
  error,
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setLocalError('Please enter a username.');
      return;
    }
    if (cleanUsername.length < 3) {
      setLocalError('Username must be at least 3 characters.');
      return;
    }
    if (!password) {
      setLocalError('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register') {
      const res = await onRegister(cleanUsername, password);
      if (!res.success && res.error) {
        setLocalError(res.error);
      }
    } else {
      const res = await onLogin(cleanUsername, password);
      if (!res.success && res.error) {
        setLocalError(res.error);
      }
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        {/* Minimal Distraction-Free Card */}
        <div className="bg-[#0C0E12] border border-white/[0.08] rounded-3xl p-7 sm:p-9 shadow-[0_25px_60px_rgba(0,0,0,0.65)] relative overflow-hidden">
          {/* Subtle Ambient Backlight */}
          <div className="absolute top-0 right-1/2 translate-x-1/2 -mt-16 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header & Brand */}
          <div className="relative z-10 text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#14181F] border border-white/[0.08] shadow-inner mb-4">
              <Sparkles className="w-6 h-6 text-[#3B82F6]" />
            </div>
            <h1 className="text-xl sm:text-2xl font-[650] tracking-tight text-[#F5F5F7]">
              Antigravity Quota
            </h1>
            <p className="text-xs text-[#9CA3AF] mt-1.5 leading-relaxed">
              Real-time monitoring for Google Cloud Code Assist &amp; Antigravity model quotas.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="relative z-10 grid grid-cols-2 p-1 bg-[#14181F] rounded-xl border border-white/[0.06] mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setLocalError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-[#1E232B] text-[#F5F5F7] shadow-sm'
                  : 'text-[#9CA3AF] hover:text-[#F5F5F7]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setLocalError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#1E232B] text-[#F5F5F7] shadow-sm'
                  : 'text-[#9CA3AF] hover:text-[#F5F5F7]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Message */}
          {displayError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-left relative z-10">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold text-rose-300">
                    {mode === 'register' ? 'Registration Failed' : 'Sign-In Failed'}
                  </div>
                  <p className="text-rose-200/90 leading-snug">{displayError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <div>
              <label className="block text-[11.5px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-username"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  disabled={loading}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#14181F] border border-white/[0.08] focus:border-[#3B82F6] rounded-xl text-sm text-[#F5F5F7] placeholder-[#4B5563] outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11.5px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#14181F] border border-white/[0.08] focus:border-[#3B82F6] rounded-xl text-sm text-[#F5F5F7] placeholder-[#4B5563] outline-none transition-all"
                />
              </div>
            </div>

            <button
              id="btn-auth-submit"
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-b from-[#3B82F6] to-[#2563EB] hover:from-[#428CFF] hover:to-[#2B6DFA] text-white font-semibold text-sm shadow-[0_4px_16px_rgba(37,99,235,0.35)] active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Processing...' : mode === 'register' ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Footer note */}
          <div className="flex items-center justify-between pt-6 text-[11px] text-[#6B7280] relative z-10 border-t border-white/[0.05] mt-6">
            <span className="inline-flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-[#4B5563]" />
              End-to-end encrypted session
            </span>
            <button
              type="button"
              onClick={onOpenGuide}
              className="hover:text-[#9CA3AF] transition cursor-pointer"
            >
              Setup Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
