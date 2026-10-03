import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';

export interface StoredAccount {
  _id: string;
  email: string;
  name: string;
  picture?: string;
  refreshToken: string;
  accessToken?: string;
  tokenExpiry?: number;
  tier?: string;
  plan?: string;
  isActive: boolean;
  lastSyncedAt?: number;
  syncStatus?: string;
  errorMessage?: string;
  quota?: any;
}

export function getConvexClient(): ConvexHttpClient | null {
  const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
  if (!convexUrl) return null;
  return new ConvexHttpClient(convexUrl);
}

/**
 * ConvexDatabaseService
 * Uses Convex Cloud as the persistent single source of truth for accounts,
 * links, and quotas.
 */
class ConvexDatabaseService {
  private client: ConvexHttpClient | null = null;

  private getClient(): ConvexHttpClient {
    if (!this.client) {
      const c = getConvexClient();
      if (!c) {
        throw new Error('CONVEX_URL is not set in environment.');
      }
      this.client = c;
    }
    return this.client;
  }

  async listAccounts(userEmail?: string): Promise<StoredAccount[]> {
    try {
      const client = this.getClient();
      const accounts = await client.query(api.accounts.listAccounts, { userEmail });
      return accounts as StoredAccount[];
    } catch (err) {
      console.error('[Convex DB] Error listing accounts:', err);
      return [];
    }
  }

  async getActiveAccount(userEmail?: string): Promise<StoredAccount | null> {
    try {
      const client = this.getClient();
      const account = await client.query(api.accounts.getActiveAccount, { userEmail });
      return (account as StoredAccount) || null;
    } catch (err) {
      console.error('[Convex DB] Error getting active account:', err);
      return null;
    }
  }

  async upsertAccount(args: {
    email: string;
    name: string;
    picture?: string;
    refreshToken: string;
    accessToken?: string;
    tokenExpiry?: number;
    tier?: string;
    plan?: string;
    linkWithEmail?: string;
  }): Promise<string> {
    const client = this.getClient();
    const id = await client.mutation(api.accounts.upsertAccount, args);
    return String(id);
  }

  async linkAccounts(accountA: string, accountB: string): Promise<boolean> {
    const client = this.getClient();
    await client.mutation(api.accounts.mergeWorkspaces, { sourceEmail: accountB, targetEmail: accountA });
    return true;
  }

  async unlinkAccount(accountEmail: string): Promise<boolean> {
    const client = this.getClient();
    await client.mutation(api.accounts.unlinkAndDetachAccount, { accountEmail });
    return true;
  }

  async mergeWorkspaces(sourceEmail: string, targetEmail: string): Promise<boolean> {
    const client = this.getClient();
    await client.mutation(api.accounts.mergeWorkspaces, { sourceEmail, targetEmail });
    return true;
  }


  async updateAccountTokens(
    accountId: any,
    accessToken: string,
    tokenExpiry: number,
    refreshToken?: string
  ): Promise<boolean> {
    const client = this.getClient();
    await client.mutation(api.accounts.updateAccountTokens, {
      accountId,
      accessToken,
      tokenExpiry,
      refreshToken,
    });
    return true;
  }

  async setActive(id: any): Promise<boolean> {
    const client = this.getClient();
    await client.mutation(api.accounts.setActiveAccount, { accountId: id });
    return true;
  }

  async deleteAccount(id: any): Promise<boolean> {
    const client = this.getClient();
    await client.mutation(api.accounts.deleteAccount, { accountId: id });
    return true;
  }

  async saveQuota(
    accountId: any,
    email: string,
    models: any[],
    tierInfo?: any,
    groups?: any[]
  ): Promise<void> {
    try {
      const client = this.getClient();
      await client.mutation(api.accounts.saveQuotaSnapshot, {
        accountId,
        email,
        models,
        tierInfo,
        groups,
      });
    } catch (err) {
      console.error('[Convex DB] Error saving quota:', err);
    }
  }
}

export const dbService = new ConvexDatabaseService();
export const fallbackStore = dbService; // Alias for smooth compatibility

