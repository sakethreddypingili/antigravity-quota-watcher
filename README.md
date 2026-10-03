# Google Antigravity Quota Watcher

A production-ready web application designed to monitor your Google Antigravity and Cloud Code Assist quota limits, rolling usage windows, and model availability from a modern browser dashboard.

Deployed seamlessly to **Vercel** or container runtimes with zero frontend secrets exposure.

---

## 🏗️ Architecture

```
User signs in via Google OAuth
           ↓
Tokens stored in secure HTTP-only cookie (server-side only)
           ↓
Server calls Cloud Code Assist / Antigravity Quota endpoint:
POST https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels
           ↓
Quota & usage data safely parsed and normalized
           ↓
Clean, high-contrast web dashboard with real-time auto-refresh
```

### Technical References
This implementation uses the reverse-engineered integration patterns established by active open-source projects:
1. [wusimpl/AntigravityQuotaWatcher](https://github.com/wusimpl/AntigravityQuotaWatcher)
2. [devtint/AntigravityQuotaManager](https://github.com/devtint/AntigravityQuotaManager)
3. [lomeliDev/antigravity-bridge](https://github.com/lomeliDev/antigravity-bridge)
4. [usamashehab/antigravity-proxy](https://github.com/usamashehab/antigravity-proxy)

---

## 🔒 Service Isolation & API Nature

> **Important**: The endpoints queried by this application (e.g. `https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels` and `v1internal:loadCodeAssist`) are **internal Google Cloud Code Assist service endpoints** used by the Antigravity extension ecosystem. They are not officially published as public developer APIs.

To adhere strictly to production isolation principles:
- All upstream endpoint interactions are isolated in **`lib/antigravity/quota.ts`**.
- The frontend never communicates directly with `cloudcode-pa.googleapis.com`.
- If upstream schema or headers change, only `lib/antigravity/quota.ts` needs updating.

---

## ⚙️ Environment Variables

Create a `.env` or `.env.local` file (or set these in your Vercel Project Settings):

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Web Client ID from Google Cloud Console | **Yes** | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret | **Yes** | `GOCSPX-xxxxxxxxxxxxxxxx` |
| `GOOGLE_REDIRECT_URI` | Full callback URL | Optional (auto-detected) | `https://your-app.vercel.app/api/auth/callback` |
| `SESSION_SECRET` | 32+ character random encryption key for session cookies | **Yes** | `8f9c1a3b4e6d2f5a7c0e8b1d3f4a6c8e` |
| `GOOGLE_CLOUD_PROJECT` | Optional GCP Project ID to associate with Code Assist calls | No | `my-gcp-project` |

---

## 🚀 Google Cloud Console Setup

1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Click **Create Credentials** &rarr; **OAuth client ID**.
3. Select **Web application**.
4. Under **Authorized JavaScript origins**, add your app domain:
   - For Vercel: `https://your-app.vercel.app`
   - For local testing: `http://localhost:3000`
5. Under **Authorized redirect URIs**, add:
   - `https://your-app.vercel.app/api/auth/callback`
   - `http://localhost:3000/api/auth/callback`
6. Click **Save** and copy your **Client ID** and **Client Secret**.
7. In the [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent):
   - Add the scopes:
     - `openid`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/cloud-platform`

---

## 📦 Vercel Deployment

This project includes pre-configured **`vercel.json`** and **`api/index.ts`** handlers for turnkey serverless deployment.

### Method 1: Git Integration (Recommended)
1. Push this repository to GitHub or GitLab.
2. In Vercel, click **Add New...** &rarr; **Project** and import the repository.
3. Configure the environment variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `SESSION_SECRET`).
4. Click **Deploy**. Vercel will build the Vite frontend to `dist/` and route `/api/*` to the serverless handler.

### Method 2: Vercel CLI
```bash
npm install -g vercel
vercel
```

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure .env
cp .env.example .env

# 3. Start development server (port 3000)
npm run dev

# 4. Open in browser
http://localhost:3000
```

---

## 🛡️ Security Features

- **No Secrets in Browser**: Neither `GOOGLE_CLIENT_SECRET`, `refresh_token`, nor `access_token` are ever sent to client-side code.
- **Encrypted Session Cookies**: Sessions are encrypted using AES-256-GCM and stored in HTTP-only, SameSite=None, Secure cookies.
- **Automatic Token Refresh**: The server monitors token expiration dates and refreshes Google OAuth tokens automatically before calling the Antigravity backend.
- **Diagnostics Sanitization**: The API inspector in the UI provides visibility into endpoints, HTTP status codes, and latency without leaking authorization tokens.
