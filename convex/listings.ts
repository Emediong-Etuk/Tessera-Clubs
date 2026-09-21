import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import schema from "./schema";

// Facts a listing must have before it is "guest ready" — the private
// information a public listing can never reliably provide.
export const REQUIRED_FACTS = [
  "wifiName",
  "wifiPassword",
  "accessMethod",
  "parkingInstructions",
  "quirk",
] as const;

function computeReadiness(privateFacts: Record<string, unknown>) {
  const missing = REQUIRED_FACTS.filter((key) => {
    const value = privateFacts[key];
    return value === undefined || value === null || value === "";
  });
  return { missing, ready: missing.length === 0 };
}

export const get = query({
  args: { listingId: v.id("listings") },
  returns: v.union(schema.doc("listings"), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("listings", args.listingId);
  },
});

export const listByHost = query({
  args: { hostId: v.string() },
  returns: v.array(schema.doc("listings")),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("listings")
      .withIndex("by_host", (q) => q.eq("hostId", args.hostId))
      .order("desc")
      .take(50);
  },
});

// Called by the import action once Firecrawl + OpenAI have turned a
// listing URL into a seed. The listing starts with no private facts and
// is never ready until the host completes them.
export const createFromImport = internalMutation({
  args: {
    hostId: v.string(),
    sourceUrl: v.string(),
    sourcePlatform: v.union(
      v.literal("airbnb"),
      v.literal("vrbo"),
      v.literal("other"),
    ),
    name: v.string(),
    locationText: v.optional(v.string()),
    coverPhotoUrl: v.optional(v.string()),
    seed: v.record(v.string(), v.any()),
  },
  returns: v.id("listings"),
  handler: async (ctx, args) => {
    const { missing, ready } = computeReadiness({});
    return await ctx.db.insert("listings", {
      hostId: args.hostId,
      sourceUrl: args.sourceUrl,
      sourcePlatform: args.sourcePlatform,
      name: args.name,
      locationText: args.locationText,
      coverPhotoUrl: args.coverPhotoUrl,
      seed: args.seed,
      privateFacts: {},
      readinessMissing: [...missing],
      readinessReady: ready,
      lastScrapedAt: Date.now(),
    });
  },
});

// The host filling in the required private facts (wifi, access, parking,
// quirk, ...). Merges into whatever is already there.
export const updatePrivateFacts = mutation({
  args: {
    listingId: v.id("listings"),
    patch: v.record(v.string(), v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get("listings", args.listingId);
    if (!listing) throw new Error("Listing not found");
    const privateFacts = { ...(listing.privateFacts ?? {}), ...args.patch };
    const { missing, ready } = computeReadiness(privateFacts);
    await ctx.db.patch("listings", args.listingId, {
      privateFacts,
      readinessMissing: [...missing],
      readinessReady: ready,
    });
    return null;
  },
});

// Applied once a host approves a proposed patch from a flagged draft —
// this is the "Learn" step: a guest question the property couldn't
// answer becomes a permanent fact.
export const applyLearnedFact = internalMutation({
  args: {
    listingId: v.id("listings"),
    field: v.string(),
    value: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get("listings", args.listingId);
    if (!listing) throw new Error("Listing not found");
    const privateFacts = {
      ...(listing.privateFacts ?? {}),
      [args.field]: args.value,
    };
    const { missing, ready } = computeReadiness(privateFacts);
    await ctx.db.patch("listings", args.listingId, {
      privateFacts,
      readinessMissing: [...missing],
      readinessReady: ready,
      lastLearnedAt: Date.now(),
    });
    return null;
  },
});
