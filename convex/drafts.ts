import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import schema from "./schema";

const citationValidator = v.object({
  field: v.string(),
  quote: v.string(),
});

const proposedPatchValidator = v.object({
  field: v.string(),
  value: v.string(),
  rationale: v.string(),
});

// Called by the answer action once OpenAI has produced a grounded reply
// or decided it must flag the question instead.
export const create = internalMutation({
  args: {
    listingId: v.id("listings"),
    stayId: v.optional(v.id("stays")),
    channel: v.union(v.literal("paste"), v.literal("email")),
    inboundText: v.string(),
    reply: v.string(),
    citations: v.array(citationValidator),
    confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    decision: v.union(v.literal("ready_for_approve"), v.literal("flag")),
    flagReason: v.optional(v.string()),
    sourceMessageId: v.optional(v.string()),
  },
  returns: v.id("drafts"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("drafts", {
      listingId: args.listingId,
      stayId: args.stayId,
      channel: args.channel,
      inboundText: args.inboundText,
      reply: args.reply,
      citations: args.citations,
      confidence: args.confidence,
      decision: args.decision,
      flagReason: args.flagReason,
      sourceMessageId: args.sourceMessageId,
      status: args.decision === "flag" ? "flagged" : "pending",
    });
  },
});

export const listByListing = query({
  args: { listingId: v.id("listings") },
  returns: v.array(schema.doc("drafts")),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("drafts")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(100);
  },
});

// Used by the "teach the property" action to load the flagged question
// it's proposing a patch for.
export const getInternal = internalQuery({
  args: { draftId: v.id("drafts") },
  returns: v.union(schema.doc("drafts"), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("drafts", args.draftId);
  },
});

export const listByListingAndStatus = query({
  args: {
    listingId: v.id("listings"),
    status: v.union(
      v.literal("pending"),
      v.literal("flagged"),
      v.literal("approved"),
      v.literal("edited"),
      v.literal("discarded"),
    ),
  },
  returns: v.array(schema.doc("drafts")),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("drafts")
      .withIndex("by_listing_and_status", (q) =>
        q.eq("listingId", args.listingId).eq("status", args.status),
      )
      .order("desc")
      .take(100);
  },
});

// Host approves a ready draft, optionally editing the reply text first.
export const approve = mutation({
  args: {
    draftId: v.id("drafts"),
    editedReply: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get("drafts", args.draftId);
    if (!draft) throw new Error("Draft not found");
    const edited = args.editedReply !== undefined && args.editedReply !== draft.reply;
    await ctx.db.patch("drafts", args.draftId, {
      reply: args.editedReply ?? draft.reply,
      status: edited ? "edited" : "approved",
    });
    return null;
  },
});

export const discard = mutation({
  args: { draftId: v.id("drafts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("drafts", args.draftId, { status: "discarded" });
    return null;
  },
});

// Called by the "teach the property" action once OpenAI has turned the
// host's freeform answer into a proposed property-file patch.
export const setProposedPatch = internalMutation({
  args: {
    draftId: v.id("drafts"),
    patch: proposedPatchValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("drafts", args.draftId, { proposedPatch: args.patch });
    return null;
  },
});

// The host approves the proposed patch: the fact becomes permanent
// property knowledge and this question is answerable from now on.
export const approveLearnedPatch = mutation({
  args: { draftId: v.id("drafts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get("drafts", args.draftId);
    if (!draft) throw new Error("Draft not found");
    const patch = draft.proposedPatch;
    if (!patch) throw new Error("Draft has no proposed patch to approve");

    await ctx.runMutation(internal.listings.applyLearnedFact, {
      listingId: draft.listingId,
      field: patch.field,
      value: patch.value,
    });
    await ctx.runMutation(internal.faqs.add, {
      listingId: draft.listingId,
      q: draft.inboundText,
      a: patch.value,
      source: "learned",
    });
    await ctx.db.patch("drafts", args.draftId, {
      reply: patch.value,
      citations: [{ field: patch.field, quote: patch.value }],
      decision: "ready_for_approve",
      flagReason: undefined,
      status: "approved",
    });
    return null;
  },
});
