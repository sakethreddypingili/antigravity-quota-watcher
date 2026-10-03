/**
 * Type definitions for Antigravity Quota Watcher
 */

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verified_email?: boolean;
}

export interface AuthSession {
  user: GoogleUser;
  tokens: {
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
    token_type?: string;
    scope?: string;
  };
  createdAt: number;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user?: {
    email: string;
    name: string;
    picture?: string;
  };
  expiresAt?: number;
  hasConfig: boolean;
  missingVars?: string[];
  redirectUri: string;
  clientId?: string;
  projectId?: string;
  providerMode?: 'local_language_server' | 'cloudcode_api';
  localServerDetected?: boolean;
}

export type QuotaStatusLevel = 'healthy' | 'warning' | 'exhausted' | 'unknown';

export interface ModelQuota {
  id: string;
  displayName: string;
  family: 'gemini' | 'claude' | 'gpt' | 'other';
  remainingFraction: number | null;
  remainingPercentage: number | null;
  usedPercentage: number | null;
  status: QuotaStatusLevel;
  resetTime: string | null;
  resetTimeFormatted: string | null;
  resetTimeRelative: string | null;
  limitInfo?: {
    requests?: number;
    tokens?: number;
    window?: string;
  };
  tier?: string;
  supportedGenerations?: string[];
}

export interface AntigravityDiagnostics {
  endpointUsed: string;
  httpStatus: number;
  latencyMs: number;
  timestamp: string;
  modelsCount: number;
  hasRawQuotaInfo: boolean;
  tierDetected?: string;
  companionProject?: string;
  providerMode?: 'local_language_server' | 'cloudcode_api';
}

export interface QuotaBucket {
  bucketId: string;
  displayName: string;
  window?: string;
  resetTime?: string | null;
  resetTimeFormatted?: string | null;
  resetTimeRelative?: string | null;
  description?: string | null;
  remainingFraction: number | null;
  remainingPercentage?: number | null;
}

export interface QuotaGroup {
  displayName: string;
  description?: string;
  buckets: QuotaBucket[];
}

export interface QuotaDataResponse {
  success: boolean;
  account: {
    email: string;
    name: string;
    picture?: string;
  };
  lastUpdated: string;
  models: ModelQuota[];
  groups?: QuotaGroup[];
  tierInfo?: {
    currentTier?: string;
    cloudaicompanionProject?: string;
    plan?: string;
  };
  diagnostics: AntigravityDiagnostics;
  error?: string;
  errorCode?: string;
  details?: string;
}

export interface AccountSummary {
  _id: string;
  email: string;
  name: string;
  picture?: string;
  tier?: string;
  isActive: boolean;
  lastSyncedAt?: number;
  syncStatus?: string;
  modelsCount?: number;
  healthyCount?: number;
  warningCount?: number;
  exhaustedCount?: number;
  quota?: {
    models: ModelQuota[];
    groups?: QuotaGroup[];
    tierInfo?: any;
    timestamp: number;
  };
}

export interface AccountsListResponse {
  accounts: AccountSummary[];
  activeAccountId?: string;
  convexConnected: boolean;
}

