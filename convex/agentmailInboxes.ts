import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";
import schema from "./schema";

// Public: safe to show a host or, in principle, a guest — just the
// address, never the webhook secret.
export const getAddressByListing = query({
  args: { listingId: v.id("listings") },
  returns: v.union(v.object({ address: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("agentmailInboxes")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .unique();
    return row ? { address: row.address } : null;
  },
});

export const getByListingInternal = internalQuery({
  args: { listingId: v.id("listings") },
  returns: v.union(schema.doc("agentmailInboxes"), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentmailInboxes")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .unique();
  },
});

export const getByInboxIdInternal = internalQuery({
  args: { inboxId: v.string() },
  returns: v.union(
    v.object({
      listingId: v.id("listings"),
      webhookSecret: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("agentmailInboxes")
      .withIndex("by_inbox_id", (q) => q.eq("inboxId", args.inboxId))
      .unique();
    return row ? { listingId: row.listingId, webhookSecret: row.webhookSecret } : null;
  },
});

export const create = internalMutation({
  args: {
    listingId: v.id("listings"),
    inboxId: v.string(),
    address: v.string(),
    webhookId: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
  },
  returns: v.id("agentmailInboxes"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentmailInboxes", args);
  },
});
