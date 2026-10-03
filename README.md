# Antigravity Quota Watcher

A multi-account web dashboard engineered to track and manage Google Antigravity and Cloud Code Assist quota limits, rolling consumption windows, tier statuses, and model availability.

Powered by Convex Cloud for real-time workspace isolation, multi-tenant persistence, and proactive background token refreshes.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│               Browser Client (React + Vite)            │
│               - Lucide icon telemetry & charts         │
│               - Real-time auto-refresh                 │
└──────────────────────────┬─────────────────────────────┘
                           │ (Session Cookie / OAuth flow)
┌──────────────────────────▼─────────────────────────────┐
│             Express API Gateway (server.ts)            │
│             - Workspace session enforcement            │
│             - Proactive token renewal (5-min threshold)│
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
┌──────────────▼───────────┐ ┌────────────▼──────────────┐
│  Google OAuth 2.0 API    │ │      Convex Cloud DB      │
│  - Antigravity Client    │ │  - Workspaces & Accounts  │
│  - Token grant & refresh │ │  - Quota snapshot cache   │
└──────────────┬───────────┘ └───────────────────────────┘
               │ (Authorized access_token)
┌──────────────▼─────────────────────────────────────────┐
│  Cloud Code Assist Internal Service                     │
│  Endpoint: cloudcode-pa.googleapis.com/v1internal       │
│  - loadCodeAssist                                      │
│  - retrieveUserQuota & retrieveUserQuotaSummary        │
│  - fetchAvailableModels                                │
└────────────────────────────────────────────────────────┘
```

### Technical Workflow & Data Isolation

1. **OAuth 2.0 Authorization:** The application initiates authentication via Google OAuth 2.0 with Antigravity-specific scopes (`aicode`, `cclog`, `experimentsandconfigs`).
2. **Workspace Isolation:** Every Google account signs in to its own isolated workspace tenant by default. Accounts are linked to a shared dashboard only through explicit in-app authorization.
3. **Automated Token Maintenance:** Background workers inspect token expiry before querying upstream endpoints. Tokens within 5 minutes of expiration are automatically refreshed using stored refresh tokens.
4. **Upstream Quota Fetching:** The backend queries Google Cloud Code Assist internal endpoints to extract quota percentages, rolling reset windows, and model classifications (Claude 3.5 Sonnet, Gemini 1.5 Pro, Flash, etc.).

---

## Technical References

This project builds upon the reverse-engineered integration patterns and credentials established by community tools:

- [wusimpl/AntigravityQuotaWatcher](https://github.com/wusimpl/AntigravityQuotaWatcher)
- [devtint/AntigravityQuotaManager](https://github.com/devtint/AntigravityQuotaManager)
- [ThePeppy/kiro-api-client](https://github.com/ThePeppy/kiro-api-client)
- [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api)
- [usamashehab/antigravity-proxy](https://github.com/usamashehab/antigravity-proxy)

---

## Environment Configuration & Credentials

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

### Official Antigravity Credentials Reference

To interface with the private Cloud Code Assist endpoints (`cloudcode-pa.googleapis.com/v1internal`), this application uses the client credentials registered for the official Google Antigravity desktop environment:

```env
# Official Google Antigravity OAuth Client Credentials
GOOGLE_CLIENT_ID="1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="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"
GOOGLE_REDIRECT_URI="http://localhost:3001/api/auth/callback"
```

### Complete Configuration Reference

| Environment Variable | Description | Requirement | Value / Default |
| :--- | :--- | :--- | :--- |
| `CONVEX_URL` | Production URL for Convex Cloud database | Required | `https://opulent-fennec-678.convex.cloud` |
| `VITE_CONVEX_URL` | Frontend URL for Convex Cloud client | Required | `https://opulent-fennec-678.convex.cloud` |
| `CONVEX_DEPLOY_KEY` | Convex deployment key for schema sync | Required for deploy | `prod:your-deployment\|...` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID for Antigravity access | Required | `1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret for Antigravity | Required | `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` |
| `GOOGLE_REDIRECT_URI` | Authorized callback endpoint | Optional | `http://localhost:3001/api/auth/callback` |
| `PORT` | Local server listening port | Optional | `3001` |
| `SESSION_SECRET` | 32+ character key for session cookie encryption | Required | `antigravity_quota_watcher_production_super_secret_key_2026_xyz` |
| `GOOGLE_CLOUD_PROJECT` | Optional GCP Project ID for quota requests | Optional | `my-gcp-project` |

---

## Getting Started

### 1. Prerequisites

- Node.js 18 or later
- npm or pnpm
- A Convex account ([convex.dev](https://convex.dev))

### 2. Installation

```bash
git clone https://github.com/sakethreddypingili/antigravity-quota-watcher.git
cd antigravity-quota-watcher
npm install
```

### 3. Database Initialization (Convex)

Deploy the Convex schema and database functions:

```bash
CONVEX_DEPLOY_KEY="<YOUR_DEPLOY_KEY>" npx convex deploy
```

Or run in local development mode:

```bash
npx convex dev
```

### 4. Running the Development Server

Start both the backend server and Vite frontend:

```bash
npm run dev
```

Open the dashboard in your browser:

```
http://localhost:3001
```

---

## Application Features

- **Multi-Account Dashboards:** Switch between multiple Google accounts in real time or monitor them side by side in a unified workspace.
- **Quota Tracking:** Real-time visual meters for Gemini Pro, Gemini Flash, Claude 3.5 Sonnet, and other supported models.
- **Tier Detection:** Automatically identifies and categorizes accounts into Free / Starter Quotas or Google AI Pro plans.
- **Proactive Refresh:** Automatically refreshes expiring Google OAuth access tokens without requiring user re-authentication.
- **Safe Isolation:** Upstream endpoints are accessed entirely server-side; client credentials never reach the browser.

---

## Production Deployment

### Deploying on Vercel

1. Push your repository to GitHub or GitLab.
2. In Vercel, import the project.
3. Add the required environment variables in the Project Settings:
   - `CONVEX_URL`
   - `VITE_CONVEX_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `SESSION_SECRET`
4. Deploy. The project contains a pre-configured `vercel.json` routing frontend builds to `dist/` and backend API endpoints through `api/index.ts`.
