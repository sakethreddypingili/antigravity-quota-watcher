import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const getUserByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', args.username))
      .first();
  },
});

export const registerUser = mutation({
  args: {
    username: v.string(),
    passwordHash: v.string(),
    salt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', args.username))
      .first();
    if (existing) return null;

    const workspaceId = await ctx.db.insert('workspaces', {
      name: `${args.username}'s Workspace`,
      ownerEmail: args.username,
      createdAt: Date.now(),
    });
    const userId = await ctx.db.insert('users', {
      username: args.username,
      passwordHash: args.passwordHash,
      salt: args.salt,
      workspaceId,
      createdAt: Date.now(),
    });
    return { userId, workspaceId };
  },
});
