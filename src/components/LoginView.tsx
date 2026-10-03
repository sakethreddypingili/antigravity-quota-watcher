import React, { useState } from 'react';
import {
  Shield,
  KeyRound,
  ExternalLink,
  Lock,
  Sparkles,
  Server,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';

interface LoginViewProps {
  onLogin: () => void;
  onOpenGuide: () => void;
  loading: boolean;
  hasConfig: boolean;
  missingVars?: string[];
  redirectUri: string;
  clientId?: string;
  projectId?: string;
  error?: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  onOpenGuide,
  loading,
  hasConfig,
  missingVars,
  redirectUri,
  clientId,
  projectId,
  error,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyUri = () => {
    if (redirectUri) {
      navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isMismatchError = error && (
    error.toLowerCase().includes('redirect_uri_mismatch') ||
    error.toLowerCase().includes('mismatch') ||
    error.toLowerCase().includes('redirect')
  );

  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg">
        {/* Minimal Distraction-Free Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 sm:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.6)] relative overflow-hidden text-center">
          {/* Subtle Ambient Backlight */}
          <div className="absolute top-0 right-1/2 translate-x-1/2 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Brand Icon */}
          <div className="relative z-10 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 shadow-lg mb-5">
            <Sparkles className="w-7 h-7 text-blue-400" />
          </div>

          {/* Heading & Tagline */}
          <div className="relative z-10 mb-8 space-y-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Antigravity Quota
            </h1>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Real-time monitoring for Google Cloud Code Assist &amp; Antigravity model quotas and rolling reset timers.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-left relative z-10">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-semibold text-rose-300">Sign-In Failed</div>
                  <p className="text-rose-200/90">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Missing Config Alert */}
          {!hasConfig && (
            <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-200 text-left relative z-10">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-semibold text-amber-300">Setup Required</div>
                  <p className="text-amber-200/90">
                    Missing credentials: {missingVars?.join(', ') || 'GOOGLE_CLIENT_ID'}.
                  </p>
                  <button
                    onClick={onOpenGuide}
                    className="underline hover:text-white pt-0.5 inline-block cursor-pointer font-medium"
                  >
                    View Setup Guide &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Primary Call to Action */}
          <div className="space-y-4 relative z-10">
            <button
              id="btn-google-login"
              onClick={onLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
            >
              {/* Google G logo */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Connecting to Google...' : 'Sign in with Google'}</span>
            </button>

            {/* Quiet Footer Links */}
            <div className="flex items-center justify-center gap-4 pt-2 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-zinc-500" />
                Secure OAuth 2.0
              </span>
              <span>&bull;</span>
              <button
                onClick={onOpenGuide}
                className="text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              >
                Setup Guide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
