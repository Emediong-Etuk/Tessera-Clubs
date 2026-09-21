import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import schema from "./schema";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const create = mutation({
  args: {
    listingId: v.id("listings"),
    guestFirstName: v.string(),
    guestEmail: v.optional(v.string()),
    checkIn: v.number(),
    checkOut: v.number(),
    overrides: v.object({
      accessCode: v.optional(v.string()),
      parking: v.optional(v.string()),
      wifi: v.optional(v.string()),
    }),
  },
  returns: v.object({ stayId: v.id("stays"), slug: v.string() }),
  handler: async (ctx, args) => {
    const listing = await ctx.db.get("listings", args.listingId);
    if (!listing) throw new Error("Listing not found");

    const base = `${slugify(listing.name)}-${slugify(args.guestFirstName)}`;
    let slug = base;
    let suffix = 1;
    // Slugs are looked up by index, so collisions are cheap to detect and
    // rare enough in practice not to need a transactional counter.
    while (
      await ctx.db
        .query("stays")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()
    ) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }

    const stayId = await ctx.db.insert("stays", {
      listingId: args.listingId,
      guestFirstName: args.guestFirstName,
      guestEmail: args.guestEmail,
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      slug,
      overrides: args.overrides,
      status: "upcoming",
    });
    return { stayId, slug };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(schema.doc("stays"), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stays")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

// Used by the answer action to load stay overrides for grounding — not
// exposed to clients, which fetch a stay by its public slug instead.
export const getInternal = internalQuery({
  args: { stayId: v.id("stays") },
  returns: v.union(schema.doc("stays"), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("stays", args.stayId);
  },
});

export const listByListing = query({
  args: { listingId: v.id("listings") },
  returns: v.array(schema.doc("stays")),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stays")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(100);
  },
});

// Best-effort match for an inbound AgentMail message to a stay, so a
// door-code override etc. can ground the reply. Not authoritative — just
// the most recent stay for this listing with a matching guest email.
export const findByListingAndGuestEmailInternal = internalQuery({
  args: { listingId: v.id("listings"), guestEmail: v.string() },
  returns: v.union(schema.doc("stays"), v.null()),
  handler: async (ctx, args) => {
    const stays = await ctx.db
      .query("stays")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(100);
    return (
      stays.find(
        (s) => s.guestEmail?.toLowerCase() === args.guestEmail.toLowerCase(),
      ) ?? null
    );
  },
});
