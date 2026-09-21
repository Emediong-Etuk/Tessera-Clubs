import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";
import schema from "./schema";

export const listByListing = query({
  args: { listingId: v.id("listings") },
  returns: v.array(schema.doc("faqs")),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("faqs")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(200);
  },
});

export const listByListingInternal = internalQuery({
  args: { listingId: v.id("listings") },
  returns: v.array(schema.doc("faqs")),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("faqs")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(200);
  },
});

export const add = internalMutation({
  args: {
    listingId: v.id("listings"),
    q: v.string(),
    a: v.string(),
    source: v.union(v.literal("seed"), v.literal("host"), v.literal("learned")),
  },
  returns: v.id("faqs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("faqs", {
      listingId: args.listingId,
      q: args.q,
      a: args.a,
      source: args.source,
      uses: 0,
    });
  },
});

export const recordUse = internalMutation({
  args: { faqId: v.id("faqs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const faq = await ctx.db.get("faqs", args.faqId);
    if (!faq) return null;
    await ctx.db.patch("faqs", args.faqId, { uses: faq.uses + 1 });
    return null;
  },
});
