import { v } from "convex/values";
import { action, env } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

const SYSTEM_PROMPT = `You answer guest questions for a short-term rental using ONLY the
"known facts" JSON you are given. Every claim in your reply must be
traceable to one of those facts by its exact field key.

Rules:
- No source, no sendable answer. If the question needs a fact that is not
  in the known facts, do not guess, estimate, or use general knowledge
  (this applies most of all to door codes, fees, refunds, safety
  instructions, and policies).
- If you can answer fully from the known facts, set decision to
  "ready_for_approve", write the reply, and cite every fact you used.
- If any part of the question cannot be answered from the known facts,
  set decision to "flag", leave reply as an empty string, leave citations
  empty, and explain what's missing in flagReason.
- Never partially answer with an invented middle ground — flag the whole
  question if any required fact is missing.

Respond with a single JSON object of this exact shape:
{
  "reply": string,
  "citations": [{ "field": string, "quote": string }],
  "confidence": "high" | "medium" | "low",
  "decision": "ready_for_approve" | "flag",
  "flagReason": string | null
}`;

function flattenFacts(prefix: string, obj: Record<string, unknown> | undefined) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    out[`${prefix}.${key}`] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}

type GroundedResponse = {
  reply: string;
  citations: { field: string; quote: string }[];
  confidence: "high" | "medium" | "low";
  decision: "ready_for_approve" | "flag";
  flagReason: string | null;
};

function parseGroundedResponse(content: string): GroundedResponse {
  const parsed = JSON.parse(content) as Partial<GroundedResponse>;
  const decision = parsed.decision === "ready_for_approve" ? "ready_for_approve" : "flag";
  const confidence =
    parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
      ? parsed.confidence
      : "low";
  return {
    reply: decision === "ready_for_approve" && typeof parsed.reply === "string" ? parsed.reply : "",
    citations: decision === "ready_for_approve" && Array.isArray(parsed.citations) ? parsed.citations : [],
    confidence,
    decision,
    flagReason:
      decision === "flag"
        ? typeof parsed.flagReason === "string" && parsed.flagReason
          ? parsed.flagReason
          : "The model did not explain what's missing."
        : null,
  };
}

// Answer → a guest question comes in (pasted by the host, or later via
// AgentMail) and is answered strictly from the property file. Anything
// the file doesn't know is flagged instead of guessed.
export const run = action({
  args: {
    listingId: v.id("listings"),
    stayId: v.optional(v.id("stays")),
    inboundText: v.string(),
    channel: v.union(v.literal("paste"), v.literal("email")),
    sourceMessageId: v.optional(v.string()),
  },
  returns: v.id("drafts"),
  handler: async (ctx, args) => {
    if (!env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY is not set. Run `npx convex env set OPENAI_API_KEY <key>`.",
      );
    }

    const listing = await ctx.runQuery(api.listings.get, { listingId: args.listingId });
    if (!listing) throw new Error("Listing not found");

    const stay: { overrides: { accessCode?: string; parking?: string; wifi?: string } } | null =
      args.stayId
        ? await ctx.runQuery(internal.stays.getInternal, { stayId: args.stayId as Id<"stays"> })
        : null;

    const faqs: Doc<"faqs">[] = await ctx.runQuery(internal.faqs.listByListingInternal, {
      listingId: args.listingId,
    });

    const knownFacts: Record<string, string> = {
      ...flattenFacts("seed", listing.seed),
      ...flattenFacts("privateFacts", listing.privateFacts),
    };
    if (stay?.overrides.accessCode) knownFacts["stay.accessCode"] = stay.overrides.accessCode;
    if (stay?.overrides.parking) knownFacts["stay.parking"] = stay.overrides.parking;
    if (stay?.overrides.wifi) knownFacts["stay.wifi"] = stay.overrides.wifi;

    const learnedFaqs = faqs.map((f) => ({ field: `faq.${f._id}`, question: f.q, answer: f.a }));

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL ?? "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              knownFacts,
              previouslyAnsweredQuestions: learnedFaqs,
              guestQuestion: args.inboundText,
            }),
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI grounded-answer call failed (${res.status}): ${await res.text()}`);
    }
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const grounded = parseGroundedResponse(json.choices[0]?.message.content ?? "{}");

    const draftId: Id<"drafts"> = await ctx.runMutation(internal.drafts.create, {
      listingId: args.listingId,
      stayId: args.stayId,
      channel: args.channel,
      inboundText: args.inboundText,
      reply: grounded.reply,
      citations: grounded.citations,
      confidence: grounded.confidence,
      decision: grounded.decision,
      flagReason: grounded.flagReason ?? undefined,
      sourceMessageId: args.sourceMessageId,
    });
    return draftId;
  },
});
