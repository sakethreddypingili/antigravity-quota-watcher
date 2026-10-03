# Antigravity Quota Watcher

A multi-account web dashboard engineered to track and manage Google Antigravity and Cloud Code Assist quota limits, rolling consumption windows, and model availability.

Backed by Convex Cloud for multi-tenant workspace persistence, proactive token refreshes, and real-time synchronization.

---

## Architecture Overview

```
Browser Client (React + Vite)
       │
       ▼ (Session Cookie / OAuth flow)
Express Server API (server.ts / Node.js)
       │
       ├─────────────────────────────────┬─────────────────────────────────┐
       ▼                                 ▼                                 ▼
Google OAuth 2.0 Endpoint        Convex Cloud DB                   Cloud Code Assist API
(Token grant & refresh)          (Workspaces, Accounts, Quotas)    (Private internal quota endpoints)
```

### Data & Isolation Flow

1. **Authentication:** Initiated via Google OAuth 2.0 with Antigravity-specific scopes (`aicode`, `cclog`, `experimentsandconfigs`).
2. **Workspace Isolation:** Every Google account signs in to its own isolated workspace by default. Accounts are linked into a shared workspace only via explicit authorization.
3. **Storage Security:** Tokens and metadata persist in Convex Cloud. Sensitive credentials (`refresh_token`, `client_secret`) never reach the client browser.
4. **Upstream Quota Calls:** Server proxies requests to `https://cloudcode-pa.googleapis.com/v1internal` endpoints to retrieve model quotas and tier details.

---

## Technical References

This project builds upon reverse-engineered integration patterns documented across community projects:

- [wusimpl/AntigravityQuotaWatcher](https://github.com/wusimpl/AntigravityQuotaWatcher)
- [devtint/AntigravityQuotaManager](https://github.com/devtint/AntigravityQuotaManager)
- [ThePeppy/kiro-api-client](https://github.com/ThePeppy/kiro-api-client)
- [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api)
- [usamashehab/antigravity-proxy](https://github.com/usamashehab/antigravity-proxy)

---

## Key Features

- **Multi-Account Workspaces:** Link multiple Google accounts into a unified workspace, or unlink them into separate workspaces.
- **Proactive Token Refresh:** Automatic background refreshes triggered when tokens are within 5 minutes of expiration.
- **Dual Tier Support:** Normalized support for both Starter and Google AI Pro tiers with model breakdown.
- **Convex Cloud Persistence:** Zero local state dependencies; serverless database storage for all account metadata and snapshots.
- **Private API Isolation:** All calls to `cloudcode-pa.googleapis.com` are encapsulated in server-side handlers.

---

## Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `CONVEX_URL` | Convex Cloud deployment URL | Yes | `https://your-deployment.convex.cloud` |
| `VITE_CONVEX_URL` | Frontend Convex Cloud deployment URL | Yes | `https://your-deployment.convex.cloud` |
| `CONVEX_DEPLOY_KEY` | Deploy key for schema and function sync | Yes (for deployment) | `prod:your-deployment\|...` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID | Yes | `1071006060591-...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret | Yes | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | Authorized OAuth callback redirect URL | Optional | `http://localhost:3001/api/auth/callback` |
| `PORT` | Local server port | Optional (Default: `3001`) | `3001` |
| `SESSION_SECRET` | Encryption key for session cookies | Yes | `32_character_random_string` |
| `GOOGLE_CLOUD_PROJECT` | Associated GCP project identifier | No | `my-project-id` |

---

## Getting Started

### 1. Prerequisites

- Node.js 18+
- npm or pnpm
- A Convex account ([convex.dev](https://convex.dev))

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/sakethreddypingili/antigravity-quota-watcher.git
cd antigravity-quota-watcher
npm install
```

### 3. Convex Setup

Initialize or link your Convex project:

```bash
npx convex dev
```

Or deploy directly if using production keys:

```bash
CONVEX_DEPLOY_KEY="<YOUR_DEPLOY_KEY>" npx convex deploy
```

### 4. Running the Development Server

Start both the Express API and Vite frontend:

```bash
npm run dev
```

Access the dashboard at:

```
http://localhost:3001
```

---

## Deployment

### Vercel Deployment

1. Import the repository into your Vercel team or personal account.
2. In the Project Settings under **Environment Variables**, define:
   - `CONVEX_URL`
   - `VITE_CONVEX_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `SESSION_SECRET`
3. Deploy using default build settings. The Vite client compiles to `dist/` and server routes are handled via `api/index.ts`.

---

## Security Model

- **Zero Client Secret Exposure:** The frontend receives only rendered quota telemetry; credentials and tokens remain strictly server-bound.
- **Scoped Tenant Boundaries:** Account operations require authentication and are scoped to the active workspace session.
- **Sanitized Diagnostics:** Network inspectors report HTTP statuses and latency metrics without outputting authorization headers or raw tokens.
