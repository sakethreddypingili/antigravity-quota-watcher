import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Layers,
  CheckCircle2,
  Server,
  Cloud,
  Terminal,
} from 'lucide-react';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectUri: string;
}

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({
  isOpen,
  onClose,
  redirectUri,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore
    }
  };

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentCallback = redirectUri || `${appOrigin}/api/auth/callback`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-[0_25px_60px_rgba(0,0,0,0.7)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-950/60 text-blue-400 border border-blue-800/40">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Google OAuth &amp; Vercel Deployment Guide
              </h2>
              <p className="text-xs text-zinc-400">
                Setup credentials, authorized redirect URIs, and environment variables
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-zinc-300">
          {/* Section 1: Google Cloud Console Setup */}
          <div className="bg-zinc-950/60 p-5 rounded-2xl border border-zinc-800 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <span className="w-6 h-6 rounded-full bg-sky-600/30 text-sky-400 text-xs flex items-center justify-center font-bold">
                1
              </span>
              <span>Create Google Cloud OAuth Credentials</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Google Antigravity &amp; Cloud Code Assist quotas require a Google Cloud OAuth 2.0 Web
              Client ID with access to your profile and the Cloud Platform API.
            </p>

            <ol className="space-y-2.5 text-xs text-zinc-300 pl-4 list-decimal marker:text-sky-400">
              <li>
                Open the{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  Google Cloud Console &rarr; APIs &amp; Services &rarr; Credentials
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Click <strong>Create Credentials</strong> &rarr; <strong>OAuth client ID</strong>.</li>
              <li>Select Application type: <strong>Web application</strong>.</li>
              <li>
                In <strong>Authorized redirect URIs</strong>, add the following URIs:
              </li>
            </ol>

            {/* Copyable Redirect URIs */}
            <div className="space-y-2 pt-1">
              <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] text-sky-400 font-semibold mb-0.5">
                    Current AI Studio &amp; Development Preview URL:
                  </div>
                  <code className="text-xs font-mono text-zinc-200 break-all">
                    {currentCallback}
                  </code>
                </div>
                <button
                  onClick={() => handleCopy(currentCallback, 'current')}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                >
                  {copiedKey === 'current' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'current' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] text-indigo-400 font-semibold mb-0.5">
                    Vercel Production Domain Template:
                  </div>
                  <code className="text-xs font-mono text-zinc-200 break-all">
                    https://&lt;your-app&gt;.vercel.app/api/auth/callback
                  </code>
                </div>
                <button
                  onClick={() =>
                    handleCopy('https://your-app.vercel.app/api/auth/callback', 'vercel')
                  }
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                >
                  {copiedKey === 'vercel' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'vercel' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] text-zinc-400 font-semibold mb-0.5">
                    Localhost Development URI:
                  </div>
                  <code className="text-xs font-mono text-zinc-200 break-all">
                    http://localhost:3000/api/auth/callback
                  </code>
                </div>
                <button
                  onClick={() =>
                    handleCopy('http://localhost:3000/api/auth/callback', 'localhost')
                  }
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                >
                  {copiedKey === 'localhost' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'localhost' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Environment Variables */}
          <div className="bg-zinc-950/60 p-5 rounded-2xl border border-zinc-800 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <span className="w-6 h-6 rounded-full bg-sky-600/30 text-sky-400 text-xs flex items-center justify-center font-bold">
                2
              </span>
              <span>Environment Variables Configuration</span>
            </div>
            <p className="text-xs text-zinc-400">
              Provide these in the AI Studio Settings menu, your <code>.env.local</code> file, or
              Vercel Project Settings &rarr; Environment Variables:
            </p>

            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 font-mono text-xs text-zinc-300 space-y-2">
              <div className="flex items-center justify-between">
                <span># Google OAuth Credentials</span>
                <button
                  onClick={() =>
                    handleCopy(
                      `GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com\nGOOGLE_CLIENT_SECRET=your_client_secret\nGOOGLE_REDIRECT_URI=${currentCallback}\nSESSION_SECRET=super_secret_session_encryption_key_32_chars`,
                      'envblock'
                    )
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                >
                  {copiedKey === 'envblock' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'envblock' ? 'Copied' : 'Copy All'}</span>
                </button>
              </div>
              <div className="text-sky-300">GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com</div>
              <div className="text-sky-300">GOOGLE_CLIENT_SECRET=your_client_secret</div>
              <div className="text-sky-300">GOOGLE_REDIRECT_URI={currentCallback}</div>
              <div className="text-indigo-300">SESSION_SECRET=your_random_32_character_string</div>
              <div className="text-zinc-500"># Optional: GOOGLE_CLOUD_PROJECT=your-gcp-project-id</div>
            </div>
          </div>

          {/* Section 3: Deploying to Vercel */}
          <div className="bg-zinc-950/60 p-5 rounded-2xl border border-zinc-800 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <span className="w-6 h-6 rounded-full bg-emerald-600/30 text-emerald-400 text-xs flex items-center justify-center font-bold">
                3
              </span>
              <span>Deploy to Vercel in 1 Click</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This repository includes a pre-configured <code>vercel.json</code> and serverless
              entry point (<code>api/index.ts</code>) that automatically compiles frontend assets and routes
              OAuth / Quota requests:
            </p>

            <ol className="space-y-1.5 text-xs text-zinc-300 pl-4 list-decimal marker:text-emerald-400">
              <li>Export or push this repository to GitHub.</li>
              <li>Import the project into your Vercel Dashboard.</li>
              <li>
                Add the 4 environment variables (<code>GOOGLE_CLIENT_ID</code>,{' '}
                <code>GOOGLE_CLIENT_SECRET</code>, <code>GOOGLE_REDIRECT_URI</code>,{' '}
                <code>SESSION_SECRET</code>).
              </li>
              <li>Click <strong>Deploy</strong>. Vercel will build the frontend with Vite and mount the API handlers!</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-zinc-800 bg-zinc-900/90">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
};
