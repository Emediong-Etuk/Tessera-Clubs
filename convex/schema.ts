import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // One document per rental property. This is the "property file" —
  // the source of truth that both the guest stay page and the AI
  // drafting layer read from.
  listings: defineTable({
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

    // Public facts pulled by Firecrawl + OpenAI from the listing.
    // The listing is a seed, never the source of truth.
    seed: v.optional(v.record(v.string(), v.any())),

    // Private facts only the host knows (wifi, access, parking, quirks, ...).
    privateFacts: v.optional(v.record(v.string(), v.any())),

    readinessMissing: v.array(v.string()),
    readinessReady: v.boolean(),

    lastScrapedAt: v.optional(v.number()),
    lastLearnedAt: v.optional(v.number()),
  })
    .index("by_host", ["hostId"])
    .index("by_readiness", ["readinessReady"]),

  // One row per known question/answer for a listing. Kept as its own
  // table (not an array on `listings`) because it grows without bound
  // as guests ask questions and the host teaches the property.
  faqs: defineTable({
    listingId: v.id("listings"),
    q: v.string(),
    a: v.string(),
    source: v.union(
      v.literal("seed"),
      v.literal("host"),
      v.literal("learned"),
    ),
    uses: v.number(),
  }).index("by_listing", ["listingId"]),

  // A single guest's stay at a listing. Carries stay-specific overrides
  // (door code, parking stall, wifi override) on top of the permanent
  // listing knowledge, and is what the public stay page is generated from.
  stays: defineTable({
    listingId: v.id("listings"),
    guestFirstName: v.string(),
    guestEmail: v.optional(v.string()),

    checkIn: v.number(),
    checkOut: v.number(),

    slug: v.string(),

    overrides: v.object({
      accessCode: v.optional(v.string()),
      parking: v.optional(v.string()),
      wifi: v.optional(v.string()),
    }),

    status: v.union(
      v.literal("upcoming"),
      v.literal("in_stay"),
      v.literal("checked_out"),
    ),
  })
    .index("by_listing", ["listingId"])
    .index("by_slug", ["slug"])
    .index("by_listing_and_status", ["listingId", "status"]),

  // A guest question and its grounded (or flagged) answer. Every sendable
  // reply must cite the listing/stay fields it was built from — no
  // citation, no send.
  drafts: defineTable({
    listingId: v.id("listings"),
    stayId: v.optional(v.id("stays")),

    channel: v.union(v.literal("paste"), v.literal("email")),

    inboundText: v.string(),
    reply: v.string(),

    citations: v.array(
      v.object({
        field: v.string(),
        quote: v.string(),
      }),
    ),

    confidence: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    decision: v.union(v.literal("ready_for_approve"), v.literal("flag")),
    flagReason: v.optional(v.string()),

    // What the host's answer to a flagged question would teach the
    // listing, proposed by OpenAI and applied only on host approval.
    proposedPatch: v.optional(
      v.object({
        field: v.string(),
        value: v.string(),
        rationale: v.string(),
      }),
    ),

    status: v.union(
      v.literal("pending"),
      v.literal("flagged"),
      v.literal("approved"),
      v.literal("edited"),
      v.literal("discarded"),
    ),

    // Set when channel is "email" — the AgentMail message this draft
    // answers, so approving it can send an actual threaded reply.
    sourceMessageId: v.optional(v.string()),
  })
    .index("by_listing", ["listingId"])
    .index("by_stay", ["stayId"])
    .index("by_listing_and_status", ["listingId", "status"]),

  // Inbound/outbound AgentMail traffic for a listing's operations inbox.
  opsMessages: defineTable({
    listingId: v.id("listings"),
    stayId: v.optional(v.id("stays")),

    direction: v.union(v.literal("in"), v.literal("out")),
    agentmailId: v.optional(v.string()),

    from: v.string(),
    subject: v.optional(v.string()),
    text: v.string(),
  })
    .index("by_listing", ["listingId"])
    .index("by_stay", ["stayId"]),

  // Private per-listing AgentMail configuration. Never exposed through a
  // public query — the webhook secret lives here, not on `listings`.
  agentmailInboxes: defineTable({
    listingId: v.id("listings"),
    inboxId: v.string(),
    address: v.string(),
    webhookId: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
  })
    .index("by_listing", ["listingId"])
    .index("by_inbox_id", ["inboxId"]),
});
