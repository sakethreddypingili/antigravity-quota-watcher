import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Helper: Ensure an account has a valid workspace. If not, create a solo workspace.
async function ensureAccountWorkspace(ctx: any, account: any) {
  if (account.workspaceId) {
    const ws = await ctx.db.get(account.workspaceId);
    if (ws) return account.workspaceId;
  }
  // Create a new solo workspace for this account
  const wsId = await ctx.db.insert('workspaces', {
    name: `${account.name || account.email}'s Workspace`,
    ownerEmail: account.email,
    createdAt: Date.now(),
  });
  await ctx.db.patch(account._id, { workspaceId: wsId });
  return wsId;
}

export const listAccounts = query({
  args: {
    userEmail: v.optional(v.string()),
    workspaceId: v.optional(v.id('workspaces')),
  },
  handler: async (ctx, args) => {
    let accounts: any[] = [];
    if (args.workspaceId) {
      accounts = await ctx.db
        .query('accounts')
        .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId!))
        .collect();
    } else if (args.userEmail) {
      // Find the user's account
      const userAcc = await ctx.db
        .query('accounts')
        .withIndex('by_email', (q) => q.eq('email', args.userEmail!))
        .first();

      if (userAcc && userAcc.workspaceId) {
        // Find all accounts in the same workspace
        accounts = await ctx.db
          .query('accounts')
          .withIndex('by_workspace', (q) => q.eq('workspaceId', userAcc.workspaceId))
          .collect();
      } else if (userAcc) {
        accounts = [userAcc];
      }
    } else {
      accounts = await ctx.db.query('accounts').collect();
    }

    const result = [];
    for (const acc of accounts) {
      const quota = await ctx.db
        .query('quotas')
        .withIndex('by_accountId', (q) => q.eq('accountId', acc._id))
        .order('desc')
        .first();
      result.push({
        ...acc,
        quota: quota || null,
      });
    }
    return result;
  },
});

export const getActiveAccount = query({
  args: {
    userEmail: v.optional(v.string()),
    workspaceId: v.optional(v.id('workspaces')),
  },
  handler: async (ctx, args) => {
    let candidate = null;
    if (args.workspaceId) {
      const inWs = await ctx.db
        .query('accounts')
        .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId!))
        .collect();
      candidate = inWs.find((a) => a.isActive) || inWs[0] || null;
      if (!candidate) return null;
    } else if (args.userEmail) {
      candidate = await ctx.db
        .query('accounts')
        .withIndex('by_email', (q) => q.eq('email', args.userEmail!))
        .first();
    }

    if (!candidate && !args.workspaceId) {
      candidate = await ctx.db
        .query('accounts')
        .withIndex('by_active', (q) => q.eq('isActive', true))
        .first();
    }

    if (!candidate) return null;

    const quota = await ctx.db
      .query('quotas')
      .withIndex('by_accountId', (q) => q.eq('accountId', candidate._id))
      .order('desc')
      .first();

    return {
      ...candidate,
      quota: quota || null,
    };
  },
});

export const upsertAccount = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    picture: v.optional(v.string()),
    refreshToken: v.string(),
    accessToken: v.optional(v.string()),
    tokenExpiry: v.optional(v.number()),
    tier: v.optional(v.string()),
    plan: v.optional(v.string()),
    linkWithEmail: v.optional(v.string()), // Target account whose workspace to join (only if explicitly linking!)
    linkWithWorkspaceId: v.optional(v.id('workspaces')), // Dashboard user's workspace to attach into
  },
  handler: async (ctx, args) => {
    let targetWorkspaceId: any = args.linkWithWorkspaceId;

    // If explicit linking requested, find target user's workspace
    if (!targetWorkspaceId && args.linkWithEmail) {
      const targetUser = await ctx.db
        .query('accounts')
        .withIndex('by_email', (q) => q.eq('email', args.linkWithEmail!))
        .first();

      if (targetUser) {
        targetWorkspaceId = await ensureAccountWorkspace(ctx, targetUser);
      }
    }

    const existing = await ctx.db
      .query('accounts')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    let accountId: any;
    if (existing) {
      let finalWorkspaceId = existing.workspaceId;
      // If explicitly linking to another workspace, transfer into target workspace
      if (targetWorkspaceId) {
        finalWorkspaceId = targetWorkspaceId;
      } else if (!finalWorkspaceId) {
        finalWorkspaceId = await ctx.db.insert('workspaces', {
          name: `${args.name || args.email}'s Workspace`,
          ownerEmail: args.email,
          createdAt: Date.now(),
        });
      }

      await ctx.db.patch(existing._id, {
        name: args.name,
        picture: args.picture ?? existing.picture,
        refreshToken: args.refreshToken,
        accessToken: args.accessToken ?? existing.accessToken,
        tokenExpiry: args.tokenExpiry ?? existing.tokenExpiry,
        tier: args.tier ?? existing.tier,
        plan: args.plan ?? existing.plan,
        isActive: true,
        workspaceId: finalWorkspaceId,
        errorMessage: undefined,
      });
      accountId = existing._id;
    } else {
      // Brand new account
      if (!targetWorkspaceId) {
        targetWorkspaceId = await ctx.db.insert('workspaces', {
          name: `${args.name || args.email}'s Workspace`,
          ownerEmail: args.email,
          createdAt: Date.now(),
        });
      }

      accountId = await ctx.db.insert('accounts', {
        workspaceId: targetWorkspaceId,
        email: args.email,
        name: args.name,
        picture: args.picture,
        refreshToken: args.refreshToken,
        accessToken: args.accessToken,
        tokenExpiry: args.tokenExpiry,
        tier: args.tier || 'Google AI Pro',
        plan: args.plan,
        isActive: true,
        lastSyncedAt: Date.now(),
        syncStatus: 'ok',
      });
    }

    return accountId;
  },
});

export const unlinkAndDetachAccount = mutation({
  args: {
    accountEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db
      .query('accounts')
      .withIndex('by_email', (q) => q.eq('email', args.accountEmail))
      .first();

    if (!target) return false;

    // Detach from current workspace by creating a new independent solo workspace for it
    const newWsId = await ctx.db.insert('workspaces', {
      name: `${target.name || target.email}'s Workspace`,
      ownerEmail: target.email,
      createdAt: Date.now(),
    });

    await ctx.db.patch(target._id, {
      workspaceId: newWsId,
    });

    // Update quota reference if present
    const quotas = await ctx.db
      .query('quotas')
      .withIndex('by_accountId', (q) => q.eq('accountId', target._id))
      .collect();
    for (const q of quotas) {
      await ctx.db.patch(q._id, { workspaceId: newWsId });
    }

    return true;
  },
});

export const mergeWorkspaces = mutation({
  args: {
    sourceEmail: v.string(),
    targetEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const sourceUser = await ctx.db
      .query('accounts')
      .withIndex('by_email', (q) => q.eq('email', args.sourceEmail))
      .first();

    const targetUser = await ctx.db
      .query('accounts')
      .withIndex('by_email', (q) => q.eq('email', args.targetEmail))
      .first();

    if (!sourceUser || !targetUser) return false;

    const targetWsId = await ensureAccountWorkspace(ctx, targetUser);
    const sourceWsId = sourceUser.workspaceId;

    if (sourceWsId && sourceWsId !== targetWsId) {
      // Move all accounts in source workspace to target workspace
      const sourceAccounts = await ctx.db
        .query('accounts')
        .withIndex('by_workspace', (q) => q.eq('workspaceId', sourceWsId))
        .collect();

      for (const acc of sourceAccounts) {
        await ctx.db.patch(acc._id, { workspaceId: targetWsId });
      }

      // Also move quota records
      const sourceQuotas = await ctx.db
        .query('quotas')
        .withIndex('by_workspace', (q) => q.eq('workspaceId', sourceWsId))
        .collect();
      for (const q of sourceQuotas) {
        await ctx.db.patch(q._id, { workspaceId: targetWsId });
      }

      // Delete old workspace
      await ctx.db.delete(sourceWsId);
    } else {
      await ctx.db.patch(sourceUser._id, { workspaceId: targetWsId });
    }

    return true;
  },
});

export const setActiveAccount = mutation({
  args: {
    accountId: v.id('accounts'),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.accountId);
    if (!target || !target.workspaceId) return false;

    const workspaceAccounts = await ctx.db
      .query('accounts')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', target.workspaceId))
      .collect();

    for (const acc of workspaceAccounts) {
      await ctx.db.patch(acc._id, {
        isActive: acc._id === args.accountId,
      });
    }
    return true;
  },
});

export const updateAccountTokens = mutation({
  args: {
    accountId: v.id('accounts'),
    accessToken: v.string(),
    tokenExpiry: v.number(),
    refreshToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patchData: any = {
      accessToken: args.accessToken,
      tokenExpiry: args.tokenExpiry,
    };
    if (args.refreshToken) {
      patchData.refreshToken = args.refreshToken;
    }
    await ctx.db.patch(args.accountId, patchData);
    return true;
  },
});

export const deleteAccount = mutation({
  args: {
    accountId: v.id('accounts'),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.accountId);
    if (!target) return false;

    // Delete associated quotas
    const quotas = await ctx.db
      .query('quotas')
      .withIndex('by_accountId', (q) => q.eq('accountId', args.accountId))
      .collect();
    for (const q of quotas) {
      await ctx.db.delete(q._id);
    }

    await ctx.db.delete(args.accountId);
    return true;
  },
});

export const saveQuotaSnapshot = mutation({
  args: {
    accountId: v.id('accounts'),
    email: v.string(),
    models: v.array(v.any()),
    groups: v.optional(v.array(v.any())),
    tierInfo: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.accountId);

    const existing = await ctx.db
      .query('quotas')
      .withIndex('by_accountId', (q) => q.eq('accountId', args.accountId))
      .collect();
    for (const item of existing) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.insert('quotas', {
      accountId: args.accountId,
      workspaceId: target?.workspaceId,
      email: args.email,
      timestamp: Date.now(),
      models: args.models,
      groups: args.groups,
      tierInfo: args.tierInfo,
    });

    await ctx.db.patch(args.accountId, {
      lastSyncedAt: Date.now(),
      syncStatus: 'ok',
      tier: args.tierInfo?.currentTier || undefined,
      errorMessage: undefined,
    });

    return true;
  },
});


