import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    ownerEmail: v.string(),
    createdAt: v.number(),
  }).index('by_owner', ['ownerEmail']),

  accounts: defineTable({
    workspaceId: v.optional(v.id('workspaces')),
    email: v.string(),
    name: v.string(),
    picture: v.optional(v.string()),
    refreshToken: v.string(),
    accessToken: v.optional(v.string()),
    tokenExpiry: v.optional(v.number()),
    tier: v.optional(v.string()),
    plan: v.optional(v.string()),
    isActive: v.boolean(),
    lastSyncedAt: v.optional(v.number()),
    syncStatus: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  })
    .index('by_email', ['email'])
    .index('by_workspace', ['workspaceId'])
    .index('by_active', ['isActive']),

  quotas: defineTable({
    accountId: v.id('accounts'),
    workspaceId: v.optional(v.id('workspaces')),
    email: v.string(),
    timestamp: v.number(),
    models: v.array(v.any()),
    groups: v.optional(v.array(v.any())),
    tierInfo: v.optional(v.any()),
  })
    .index('by_accountId', ['accountId'])
    .index('by_workspace', ['workspaceId']),
});


