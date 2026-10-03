# Antigravity Quota Watcher

A cloud-native observability and quota management platform designed to monitor, forecast, and optimize AI developer tool utilization across multiple Google Cloud Code Assist and Google Antigravity developer seats.

Built with React, Vite, Node.js, Express, and Convex Cloud, this system provides engineering teams with real-time visibility into quota consumption, automated multi-account lifecycle orchestration, and uninterrupted access to frontier AI coding models.

---

## The Engineering Problem

Modern software development increasingly relies on frontier AI models such as Claude 3.5 Sonnet, Gemini 1.5 Pro, and Gemini 1.5 Flash embedded directly inside the code editor. Engineering teams face several operational challenges when working with these tools at scale:

1. **The Black Box Quota Dilemma:** Code completion and chat models operate under rolling rate-limit windows. In typical editor environments, developers receive no warning that their quota is depleting until a request fails mid-task, breaking deep engineering focus.
2. **Multi-Account Fragmentation:** Senior developers and cross-functional teams frequently hold multiple accounts (e.g., personal development, company organization, and specific project sandboxes). Toggling between them manually to find available quota is inefficient and disruptive.
3. **Session Lifecycle Drops:** Developer authentication tokens expire periodically. When background refresh routines are missing, requests fail with cryptic authorization errors, requiring manual re-login flows that slow down sprint velocity.
4. **State Fragility in Single-User Tools:** Early prototypes often rely on local JSON files or browser local storage, which cannot synchronize across machines, lack transactional integrity, and fail in team or cloud-hosted settings.

---

## The Solution: A Centralized Observability & Quota Gateway

**Antigravity Quota Watcher** functions as a dedicated observability hub and account orchestration layer. Instead of leaving quota limits to guesswork, it polls and normalizes internal telemetry streams from Google Cloud Code Assist into an intuitive, real-time dashboard.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             The Observability Pipeline                           │
│                                                                                  │
│   Developer Accounts      Unified Gateway         Cloud Database      Dashboard  │
│   ┌────────────────┐     ┌───────────────┐       ┌───────────────┐   ┌─────────┐ │
│   │ Google Org A   ├────►│               │       │               │   │ Claude  │ │
│   ├────────────────┤     │ API Gateway   ├──────►│ Convex Cloud  ├──►│ Gemini  │ │
│   │ Google Org B   ├────►│ & Token Engine│       │ Storage Layer │   │ Pro/Free│ │
│   ├────────────────┤     │               │       │               │   │ Reset   │ │
│   │ Personal Dev   ├────►│               │       │               │   │ Timers  │ │
│   └────────────────┘     └───────────────┘       └───────────────┘   └─────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

The system acts as a reliable intermediary: it securely holds developer session grants, monitors rolling consumption ceilings, automatically refreshes expiring tokens in the background, and gives engineers complete foresight into when each model's quota resets.

---

## Core Engineering Innovations

### 1. Multi-Tenant Workspace Model
The system enforces strict multi-tenancy. When an engineer signs in with a Google account, they are assigned to an isolated workspace tenant. If the developer chooses to pool multiple accounts (e.g., work and experimental sandboxes), they can explicitly link them into a shared workspace. Unlinking safely detaches an account back to its own private tenant without destroying historical data or credentials.

### 2. Proactive (Predictive) Token Refresh Engine
Traditional applications use reactive authentication: they attempt an API request, catch a 401 Unauthorized error when the token has expired, and only then attempt a token refresh. This introduces latency spikes and failure risks.

Antigravity Quota Watcher implements a proactive token lifecycle algorithm:
- Every background poll and user query evaluates the access token's `expiry_date`.
- If a token is within 5 minutes (300 seconds) of expiration, the gateway executes an asynchronous OAuth token renewal before dispatching the upstream request.
- The freshly minted access token is atomically updated in Convex Cloud, guaranteeing zero 401 errors and unbroken availability.

### 3. Telemetry Ingestion & Normalization
Upstream Google Cloud Code Assist services expose granular internal endpoints (`loadCodeAssist`, `retrieveUserQuota`, `fetchAvailableModels`) that report complex usage histograms. The gateway normalizes these varied payloads into an intuitive, consistent schema:
- **Capacity Saturation:** Real-time percentage of remaining quota per model family.
- **Replenishment Clocks:** Precise countdown timers indicating when the rolling usage window will reset.
- **Tier Classification:** Automatic detection of subscription levels (e.g., Starter vs. Google AI Pro).

### 4. Distributed Cloud Persistence via Convex
To eliminate fragile local file storage (`.accounts_store.json`), all application state is persisted in Convex Cloud:
- **Atomic Operations:** Account updates, workspace merges, and quota snapshots execute in isolated, ACID-compliant database mutations.
- **Real-Time Subscriptions:** Dashboard views reflect state changes immediately across all connected browser tabs without manual page reloads.
- **Multi-Device Sync:** Developers can monitor their quotas from any machine or mobile browser seamlessly.

### 5. Zero-Trust Credential Isolation
Security is designed into the data flow:
- `client_secret` and `refresh_token` credentials never touch client-side JavaScript.
- All upstream Google API requests are executed exclusively by the server-side gateway.
- Browser communication is authenticated via cryptographically signed HTTP-only cookies (AES-256-GCM), protecting against XSS and token exfiltration.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       Presentation Layer (React 18 + Vite)                      │
│                       - Real-Time Quota Gauges & Model Meters                   │
│                       - Rolling Reset Countdown Clocks                          │
│                       - Lucide UI Engineering Visuals (Clean Dark Palette)      │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         │ Secure HTTP-only Cookie (AES-256-GCM)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     API Gateway & Business Logic (Node.js/Express)              │
│                     - Workspace Authorization & Tenant Validation               │
│                     - Proactive Token Lifecycle Scheduler                       │
│                     - Quota Telemetry Aggregator & Normalizer                   │
└──────────────────┬─────────────────────┬─────────────────────┬──────────────────┘
                   │                     │                     │
                   ▼                     ▼                     ▼
┌──────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│ Google Identity      │      │ Convex Cloud DB      │      │ Cloud Code Assist   │
│ Services             │      │                      │      │ Telemetry Service   │
│ - OAuth 2.0 Auth     │      │ - workspaces         │      │                     │
│ - Scoped Permission  │      │ - accounts           │      │ - loadCodeAssist    │
│ - Background Refresh │      │ - quotas             │      │ - retrieveUserQuota │
│   Exchange           │      │                      │      │ - modelCatalog      │
└──────────────────────┘      └──────────────────────┘      └─────────────────────┘
```

---

## Database Architecture (Convex Cloud)

The database schema is organized around three primary collections:

```
┌─────────────────────────┐       ┌─────────────────────────────────────────┐
│       workspaces        │       │                accounts                 │
├─────────────────────────┤       ├─────────────────────────────────────────┤
│ _id: Id<"workspaces">   │◄──────┤ workspaceId: Id<"workspaces">           │
│ name: string            │   1:N │ email: string (indexed)                 │
│ createdAt: number       │       │ name: string                            │
└─────────────────────────┘       │ picture: string                         │
                                  │ accessToken: string                     │
                                  │ refreshToken: string                    │
                                  │ tokenExpiry: number                     │
                                  │ isActive: boolean                       │
                                  └────────────────────┬────────────────────┘
                                                       │ 1:N
                                                       ▼
                                  ┌─────────────────────────────────────────┐
                                  │                 quotas                  │
                                  ├─────────────────────────────────────────┤
                                  │ accountId: Id<"accounts">               │
                                  │ workspaceId: Id<"workspaces">           │
                                  │ tier: string (Starter / Pro)            │
                                  │ models: Array<ModelQuota>               │
                                  │ lastUpdated: number                     │
                                  └─────────────────────────────────────────┘
```

### Schema Indexes
- `accounts.by_email`: Enables instant credential lookup during login and link flows.
- `accounts.by_workspace`: Fetches all developer accounts belonging to a workspace in a single indexed query.
- `accounts.by_active`: Efficiently tracks the primary active account for quota prioritization.
- `quotas.by_account`: Quickly retrieves cached quota telemetry without hitting upstream rate limits unnecessarily.

---

## Environment Configuration

Configuration is managed through environment variables. Copy the example configuration to begin:

```bash
cp .env.example .env
```

### Official Antigravity Client Credentials

To query the private Google Cloud Code Assist service endpoints (`cloudcode-pa.googleapis.com/v1internal`), this platform utilizes the official OAuth client identity registered for the Google Antigravity developer environment:

```env
# Official Google Antigravity Developer Client Identity
GOOGLE_CLIENT_ID="1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="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"
GOOGLE_REDIRECT_URI="http://localhost:3001/api/auth/callback"
```

### Complete Environment Specification

| Parameter | Type | Required | Description | Value / Example |
| :--- | :--- | :--- | :--- | :--- |
| `CONVEX_URL` | String | Yes | Convex Cloud database deployment endpoint | `https://opulent-fennec-678.convex.cloud` |
| `VITE_CONVEX_URL` | String | Yes | Frontend Convex Cloud WebSocket endpoint | `https://opulent-fennec-678.convex.cloud` |
| `CONVEX_DEPLOY_KEY` | String | Yes | Deployment key for syncing schema and backend functions | `prod:opulent-fennec-678\|...` |
| `GOOGLE_CLIENT_ID` | String | Yes | OAuth 2.0 Client ID for Antigravity developer tools | `1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | String | Yes | OAuth 2.0 Client Secret for Antigravity developer tools | `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` |
| `GOOGLE_REDIRECT_URI` | String | Optional | Callback URL registered for the OAuth handshake | `http://localhost:3001/api/auth/callback` |
| `PORT` | Number | Optional | Local listening port for the Express API gateway | `3001` |
| `SESSION_SECRET` | String | Yes | Encryption secret used to secure session cookies | `antigravity_quota_watcher_production_super_secret_key_2026_xyz` |
| `GOOGLE_CLOUD_PROJECT` | String | Optional | GCP project ID associated with Cloud Code Assist requests | `my-gcp-project` |

---

## Step-by-Step Installation & Local Setup

### 1. Environment Verification
Verify that your machine has Node.js (version 18 or higher) and npm installed:

```bash
node --version
npm --version
```

### 2. Repository Setup
Clone the codebase and install dependencies:

```bash
git clone https://github.com/sakethreddypingili/antigravity-quota-watcher.git
cd antigravity-quota-watcher
npm install
```

### 3. Database Deployment
Deploy the schema definitions and serverless functions to your Convex Cloud deployment:

```bash
CONVEX_DEPLOY_KEY="<YOUR_DEPLOY_KEY>" npx convex deploy
```

Alternatively, to run Convex in live watch mode for local development:

```bash
npx convex dev
```

### 4. Start the Application
Start the unified full-stack development server:

```bash
npm run dev
```

The server initializes the Express API gateway on port 3001 and serves the Vite frontend. Navigate to:

```
http://localhost:3001
```

---

## Production Deployment

### Automated Deployment with Vercel

The application is structured for instant serverless deployment on Vercel:

1. Connect this repository to your Vercel account.
2. In the Vercel Project Settings under **Environment Variables**, configure:
   - `CONVEX_URL`
   - `VITE_CONVEX_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` (set to `https://<your-vercel-domain>/api/auth/callback`)
   - `SESSION_SECRET`
3. Trigger deployment. The included `vercel.json` automatically builds the static frontend to `dist/` and maps API calls to the serverless entrypoint in `api/index.ts`.

---

## Technical Attribution & Community References

This platform synthesizes and refines architectural patterns documented across open-source tools in the developer AI ecosystem:

- [wusimpl/AntigravityQuotaWatcher](https://github.com/wusimpl/AntigravityQuotaWatcher)
- [devtint/AntigravityQuotaManager](https://github.com/devtint/AntigravityQuotaManager)
- [ThePeppy/kiro-api-client](https://github.com/ThePeppy/kiro-api-client)
- [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api)
- [usamashehab/antigravity-proxy](https://github.com/usamashehab/antigravity-proxy)
