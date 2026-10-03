# Antigravity Quota Watcher

A unified multi-account telemetry and quota orchestration platform for developer teams utilizing Google Cloud Code Assist and Google Antigravity developer environments.

Built with React, Vite, Node.js, Express, and Convex Cloud, this system delivers real-time observability into model consumption windows, automated multi-account lifecycle management, and uninterrupted developer productivity.

---

## Executive Summary

Modern AI-assisted engineering workflows depend on high-throughput access to frontier models including Claude 3.5 Sonnet, Gemini 1.5 Pro, and Gemini 1.5 Flash. However, developer IDE environments often operate with rolling rate windows and quota ceilings that interrupt active development sessions without warning.

**Antigravity Quota Watcher** solves this by establishing a centralized telemetry dashboard. It aggregates multiple developer identities into coordinated workspaces, tracks per-model burn rates in real time, and proactively refreshes authentication credentials to eliminate session termination and workflow interruptions.

---

## Core Engineering Highlights

- **Multi-Tenant Workspace Isolation:** Engineered around a multi-tenant tenancy model where individual accounts maintain strict security boundaries while enabling explicit workspace pooling for development teams.
- **Proactive Token Lifespan Management:** Features predictive token renewal algorithms that detect expiring OAuth access tokens and refresh them prior to expiration thresholds, guaranteeing 100% API uptime.
- **Real-Time Telemetry Normalization:** Ingests heterogeneous response streams from Google Cloud Code Assist telemetry services and normalizes them into visual consumption metrics, reset timers, and tier statuses.
- **Serverless Cloud Persistence:** Replaced brittle local client-side state with Convex Cloud database collections, enabling atomic transactions, automatic indexing, and global synchronization across devices.
- **Production Defense-in-Depth:** Zero sensitive credential leakage to client browsers. Access tokens, refresh tokens, and encryption secrets remain strictly enclosed within server-side execution boundaries.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Presentation Layer (React 18 + Vite)              │
│                       - High-Contrast Telemetry Dashboard               │
│                       - Interactive Model Utilization Metrics           │
│                       - Lucide Engineering Visuals & Dark Mode          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     │ Session Cookie (AES-256-GCM)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     API Gateway & Business Logic (Node.js/Express)      │
│                     - Workspace Authorization Engine                    │
│                     - Proactive Token Lifecycle Automation              │
│                     - Quota Telemetry Aggregator                        │
└──────────────────┬──────────────────┬──────────────────┬────────────────┘
                   │                  │                  │
                   ▼                  ▼                  ▼
┌──────────────────────┐   ┌──────────────────────┐   ┌───────────────────┐
│ Google OAuth 2.0     │   │ Convex Cloud Storage │   │ Cloud Code Assist │
│ - Federated Identity │   │ - Workspace Tenants  │   │ - Telemetry API   │
│ - Scoped Auth Grants │   │ - Accounts & Tokens  │   │ - Model Metrics   │
│ - Automatic Refresh  │   │ - Historical Quotas  │   │ - Tier Analytics  │
└──────────────────────┘   └──────────────────────┘   └───────────────────┘
```

### End-to-End Operational Flow

1. **Identity Federation:** When a developer authenticates, the system negotiates an OAuth 2.0 handshake with Google Identity Services requesting developer service scopes (`aicode`, `cclog`, and `experimentsandconfigs`).
2. **Workspace Association:** The server queries Convex Cloud to resolve the developer's workspace membership. By default, developers receive a secure, isolated workspace. Teams can join workspaces through cryptographic link flows.
3. **Automated Token Maintenance:** Before querying upstream services, the background orchestrator inspects the access token's remaining time-to-live (TTL). If the token is within 5 minutes of expiry, the gateway executes a refresh exchange and commits updated credentials atomically to Convex.
4. **Telemetry Ingestion & Processing:** The gateway queries Google Cloud Code Assist internal service endpoints (`loadCodeAssist`, `retrieveUserQuota`, and `fetchAvailableModels`), parsing rolling rate windows, available capacities, and subscription tiers (e.g. Starter Quota vs. Google AI Pro).
5. **Dashboard Presentation:** Processed telemetry is streamed to the React client, rendering categorized cards with countdown timers for quota replenishment.

---

## Technical Architecture & Database Schema

The platform relies on Convex Cloud for serverless database persistence, modeled across three primary relational collections:

### 1. Workspaces (`workspaces`)
- Defines tenant boundaries.
- Tracks workspace identifiers, creation timestamps, and active account associations.

### 2. Accounts (`accounts`)
- Links authenticated Google accounts to specific workspaces.
- Stores identity metadata (name, email, avatar), encrypted token pairs (access and refresh tokens), and expiration timestamps.
- Indexed by `by_email`, `by_workspace`, and `by_active` for fast lookups.

### 3. Quotas (`quotas`)
- Maintains historical snapshots of quota allocations, tier classifications, and rolling consumption metrics.
- Provides real-time and historical analytics per account.

---

## Environment Configuration

Configuration is managed via environment variables. To configure your local environment:

```bash
cp .env.example .env
```

### Configuration Parameters

| Variable | Type | Description | Default / Example |
| :--- | :--- | :--- | :--- |
| `CONVEX_URL` | String | Production endpoint URL for Convex Cloud database | `https://opulent-fennec-678.convex.cloud` |
| `VITE_CONVEX_URL` | String | Client-accessible Convex Cloud deployment URL | `https://opulent-fennec-678.convex.cloud` |
| `CONVEX_DEPLOY_KEY` | String | Authentication key for Convex schema deployments | `prod:opulent-fennec-678\|...` |
| `GOOGLE_CLIENT_ID` | String | OAuth 2.0 Client ID for Antigravity developer services | `1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | String | OAuth 2.0 Client Secret for Antigravity services | `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` |
| `GOOGLE_REDIRECT_URI` | String | Registered redirect URI for the authentication flow | `http://localhost:3001/api/auth/callback` |
| `PORT` | Number | Port on which the API gateway listens | `3001` |
| `SESSION_SECRET` | String | Cryptographic key used to sign HTTP session cookies | `antigravity_quota_watcher_production_super_secret_key_2026_xyz` |
| `GOOGLE_CLOUD_PROJECT` | String | Optional Google Cloud Project ID for enterprise quota grouping | `my-gcp-project` |

---

## Quick Start & Installation

### Prerequisites

- Node.js version 18.0 or higher
- npm (Node Package Manager) or pnpm
- A Convex account ([convex.dev](https://convex.dev))

### Installation Steps

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/sakethreddypingili/antigravity-quota-watcher.git
   cd antigravity-quota-watcher
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Deploy Database Schema:**
   Deploy the Convex functions and schema definitions to your cloud instance:
   ```bash
   CONVEX_DEPLOY_KEY="<YOUR_CONVEX_DEPLOY_KEY>" npx convex deploy
   ```

4. **Launch the Development Server:**
   ```bash
   npm run dev
   ```

5. **Access the Dashboard:**
   Open your browser and navigate to:
   ```
   http://localhost:3001
   ```

---

## Key Platform Capabilities

- **Unified Multi-Account Switching:** Seamlessly toggle active accounts with a single click, or view combined metrics across all linked developer seats.
- **Granular Model Analytics:** Real-time quota gauges for Claude 3.5 Sonnet, Gemini 1.5 Pro, and Gemini 1.5 Flash showing current saturation and time until full replenishment.
- **Account Workspace Pooling:** Support for merging separate Google accounts into a single collaborative workspace or unlinking them into independent tenants.
- **Resilient Upstream Handling:** Intelligent retry logic with exponential backoff and circuit-breaking when querying external developer services.

---

## Security & Compliance Architecture

- **Server-Side Token Isolation:** Refresh tokens and client secrets never leave the server environment. The frontend only receives processed quota metrics.
- **Encrypted Session State:** User sessions are cryptographically signed and stored in HTTP-only, SameSite cookies to protect against cross-site scripting (XSS) and cross-site request forgery (CSRF).
- **Tenant Boundary Enforcement:** Every API request validates workspace membership, preventing unauthorized access across accounts.
- **Sanitized Telemetry:** Internal error codes and network traces are scrubbed to prevent disclosure of authorization headers or sensitive operational data.

---

## Deployment Guide

### Deploying to Vercel

This repository is optimized for deployment on Vercel with zero additional configuration:

1. Connect your repository to Vercel via GitHub.
2. In the Vercel Dashboard under **Settings > Environment Variables**, supply:
   - `CONVEX_URL`
   - `VITE_CONVEX_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `SESSION_SECRET`
3. Click **Deploy**. Vercel will build the frontend assets into `dist/` and route API traffic to the serverless gateway defined in `api/index.ts`.

---

## Technical Attribution

This project is built using integration patterns established by developer tools in the AI development ecosystem:

- [wusimpl/AntigravityQuotaWatcher](https://github.com/wusimpl/AntigravityQuotaWatcher)
- [devtint/AntigravityQuotaManager](https://github.com/devtint/AntigravityQuotaManager)
- [ThePeppy/kiro-api-client](https://github.com/ThePeppy/kiro-api-client)
- [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api)
- [usamashehab/antigravity-proxy](https://github.com/usamashehab/antigravity-proxy)
