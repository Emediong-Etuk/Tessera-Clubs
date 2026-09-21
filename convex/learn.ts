import { v } from "convex/values";
import { action, env } from "./_generated/server";
import { api, internal } from "./_generated/api";

const FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

function slugifyFieldKey(text: string): string {
  const camel = text
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word, i) => (i === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase()))
    .join("");
  return FIELD_KEY_PATTERN.test(camel) ? camel : `fact${Date.now()}`;
}

// Learn → the host answers a question the property couldn't. OpenAI turns
// that freeform answer into a proposed property-file patch (reusing an
// existing fact key when the host is correcting one, or naming a short
// new one). The host still has to approve it (drafts.approveLearnedPatch)
// before it becomes permanent — this only proposes.
export const proposePatch = action({
  args: {
    draftId: v.id("drafts"),
    hostAnswer: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY is not set. Run `npx convex env set OPENAI_API_KEY <key>`.",
      );
    }

    const draft = await ctx.runQuery(internal.drafts.getInternal, { draftId: args.draftId });
    if (!draft) throw new Error("Draft not found");

    const listing = await ctx.runQuery(api.listings.get, { listingId: draft.listingId });
    if (!listing) throw new Error("Listing not found");

    const existingKeys = Object.keys(listing.privateFacts ?? {});

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
          {
            role: "system",
            content:
              'A guest asked a short-term-rental host a question the property file could not answer. The host has now answered it in their own words. Turn that into one new permanent fact.\n\n' +
              'Reuse one of the existing fact keys if the host is correcting or restating it; otherwise invent a short new camelCase key with no spaces or dots (e.g. "hairDryerLocation", not "hidden_items.hair_dryer").\n\n' +
              'Write "value" as a short, guest-facing fact in the host\'s own words — do not add anything the host did not say.\n\n' +
              'Respond with a single JSON object: { "field": string, "value": string, "rationale": string }.',
          },
          {
            role: "user",
            content: JSON.stringify({
              existingFactKeys: existingKeys,
              guestQuestion: draft.inboundText,
              hostAnswer: args.hostAnswer,
            }),
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI patch proposal failed (${res.status}): ${await res.text()}`);
    }
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const parsed = JSON.parse(json.choices[0]?.message.content ?? "{}") as {
      field?: string;
      value?: string;
      rationale?: string;
    };

    const field = parsed.field ? slugifyFieldKey(parsed.field) : slugifyFieldKey(draft.inboundText);
    const value = typeof parsed.value === "string" && parsed.value ? parsed.value : args.hostAnswer;
    const rationale =
      typeof parsed.rationale === "string" && parsed.rationale
        ? parsed.rationale
        : "Derived from the host's answer to a flagged guest question.";

    await ctx.runMutation(internal.drafts.setProposedPatch, {
      draftId: args.draftId,
      patch: { field, value, rationale },
    });
    return null;
  },
});
