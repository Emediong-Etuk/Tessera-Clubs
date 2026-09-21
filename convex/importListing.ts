import { v } from "convex/values";
import { action, env } from "./_generated/server";
import { internal } from "./_generated/api";

function classifyPlatform(url: string): "airbnb" | "vrbo" | "other" {
  if (url.includes("airbnb.")) return "airbnb";
  if (url.includes("vrbo.")) return "vrbo";
  return "other";
}

async function scrapeListing(url: string, apiKey: string) {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });
  if (!res.ok) {
    throw new Error(`Firecrawl scrape failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as {
    data?: { markdown?: string; metadata?: { title?: string; ogImage?: string } };
  };
  const markdown = json.data?.markdown ?? "";
  if (!markdown) {
    throw new Error("Firecrawl returned no page content for this listing URL.");
  }
  return { markdown, metadata: json.data?.metadata ?? {} };
}

async function extractSeed(markdown: string, apiKey: string, model: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract structured facts about a short-term-rental listing from its scraped page text. Only use facts stated in the text — never invent amenities, prices, or policies. Respond with a single JSON object and nothing else.",
        },
        {
          role: "user",
          content:
            'Extract these fields as JSON: { "name": string, "locationText": string|null, "propertyType": string|null, "bedrooms": number|null, "bathrooms": number|null, "maxGuests": number|null, "amenities": string[], "houseRules": string[], "advertisedCheckIn": string|null, "advertisedCheckOut": string|null, "parkingText": string|null, "selfCheckInText": string|null, "neighborhoodText": string|null }.\n\nListing page content:\n\n' +
            markdown.slice(0, 12000),
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI extraction failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const content = json.choices[0]?.message.content ?? "{}";
  return JSON.parse(content) as Record<string, unknown>;
}

// Import → the first step of the core loop. Scrapes a public listing URL
// with Firecrawl, has OpenAI turn it into a structured seed, and creates
// the listing. The listing is a seed, never the source of truth — the
// host still has to complete the private facts before it's guest ready.
export const run = action({
  args: {
    hostId: v.string(),
    sourceUrl: v.string(),
  },
  returns: v.id("listings"),
  handler: async (ctx, args) => {
    if (!env.FIRECRAWL_API_KEY) {
      throw new Error(
        "FIRECRAWL_API_KEY is not set. Run `npx convex env set FIRECRAWL_API_KEY <key>`.",
      );
    }
    if (!env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY is not set. Run `npx convex env set OPENAI_API_KEY <key>`.",
      );
    }

    const { markdown, metadata } = await scrapeListing(
      args.sourceUrl,
      env.FIRECRAWL_API_KEY,
    );
    const seed = await extractSeed(
      markdown,
      env.OPENAI_API_KEY,
      env.OPENAI_MODEL ?? "gpt-4o-mini",
    );

    const name =
      (typeof seed.name === "string" && seed.name) || metadata.title || "Untitled listing";
    const locationText =
      typeof seed.locationText === "string" ? seed.locationText : undefined;

    const listingId: import("./_generated/dataModel").Id<"listings"> =
      await ctx.runMutation(internal.listings.createFromImport, {
        hostId: args.hostId,
        sourceUrl: args.sourceUrl,
        sourcePlatform: classifyPlatform(args.sourceUrl),
        name,
        locationText,
        coverPhotoUrl: metadata.ogImage,
        seed,
      });
    return listingId;
  },
});
