import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import schema from "./schema";

export const listByListing = query({
  args: { listingId: v.id("listings") },
  returns: v.array(schema.doc("opsMessages")),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("opsMessages")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(100);
  },
});

export const logInbound = internalMutation({
  args: {
    listingId: v.id("listings"),
    stayId: v.optional(v.id("stays")),
    agentmailId: v.optional(v.string()),
    from: v.string(),
    subject: v.optional(v.string()),
    text: v.string(),
  },
  returns: v.id("opsMessages"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("opsMessages", { ...args, direction: "in" });
  },
});

export const logOutbound = internalMutation({
  args: {
    listingId: v.id("listings"),
    stayId: v.optional(v.id("stays")),
    agentmailId: v.optional(v.string()),
    from: v.string(),
    subject: v.optional(v.string()),
    text: v.string(),
  },
  returns: v.id("opsMessages"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("opsMessages", { ...args, direction: "out" });
  },
});
