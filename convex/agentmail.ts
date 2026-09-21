import { v } from "convex/values";
import { action, env } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

const API_BASE = "https://api.agentmail.to/v0";

function requireApiKey(): string {
  if (!env.AGENTMAIL_API_KEY) {
    throw new Error("AGENTMAIL_API_KEY is not set. Run `npx convex env set AGENTMAIL_API_KEY <key>`.");
  }
  return env.AGENTMAIL_API_KEY;
}

// Gives a listing its own AgentMail inbox and registers a webhook, scoped
// to that inbox, pointed back at this deployment. One-time per listing —
// the host clicks "Set up email" once from the dashboard.
export const provisionInbox = action({
  args: { listingId: v.id("listings") },
  returns: v.object({ address: v.string() }),
  handler: async (ctx, args): Promise<{ address: string }> => {
    const apiKey = requireApiKey();

    const existing: Doc<"agentmailInboxes"> | null = await ctx.runQuery(
      internal.agentmailInboxes.getByListingInternal,
      { listingId: args.listingId },
    );
    if (existing) return { address: existing.address };

    const inboxRes = await fetch(`${API_BASE}/inboxes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ client_id: `housefile-${args.listingId}` }),
    });
    if (!inboxRes.ok) {
      throw new Error(`AgentMail inbox creation failed (${inboxRes.status}): ${await inboxRes.text()}`);
    }
    const inbox = (await inboxRes.json()) as { inbox_id: string; email: string };

    const webhookRes = await fetch(`${API_BASE}/webhooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        url: `${env.CONVEX_SITE_URL}/agentmail/webhook`,
        event_types: ["message.received"],
        inbox_ids: [inbox.inbox_id],
        client_id: `housefile-webhook-${args.listingId}`,
      }),
    });
    let webhookId: string | undefined;
    let webhookSecret: string | undefined;
    if (webhookRes.ok) {
      const webhook = (await webhookRes.json()) as { webhook_id: string; secret: string };
      webhookId = webhook.webhook_id;
      webhookSecret = webhook.secret;
    }
    // A failed webhook registration still leaves a usable inbox — the
    // host can send from it, they just won't get inbound auto-drafts
    // until the webhook is retried.

    await ctx.runMutation(internal.agentmailInboxes.create, {
      listingId: args.listingId,
      inboxId: inbox.inbox_id,
      address: inbox.email,
      webhookId,
      webhookSecret,
    });

    return { address: inbox.email };
  },
});

// The host approves (or edits) a flagged/drafted reply that came in by
// email: actually send it back through AgentMail, threaded to the
// original message, then record it as approved.
export const sendApprovedReply = action({
  args: {
    draftId: v.id("drafts"),
    editedReply: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const apiKey = requireApiKey();

    const draft: Doc<"drafts"> | null = await ctx.runQuery(internal.drafts.getInternal, {
      draftId: args.draftId,
    });
    if (!draft) throw new Error("Draft not found");
    if (draft.channel !== "email" || !draft.sourceMessageId) {
      throw new Error("This draft didn't come from an email — nothing to send.");
    }

    const inbox: Doc<"agentmailInboxes"> | null = await ctx.runQuery(
      internal.agentmailInboxes.getByListingInternal,
      { listingId: draft.listingId },
    );
    if (!inbox) throw new Error("This listing has no AgentMail inbox set up.");

    const finalReply = args.editedReply ?? draft.reply;
    const res = await fetch(
      `${API_BASE}/inboxes/${inbox.inboxId}/messages/${draft.sourceMessageId}/reply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ text: finalReply }),
      },
    );
    if (!res.ok) {
      throw new Error(`AgentMail reply send failed (${res.status}): ${await res.text()}`);
    }
    const sent = (await res.json()) as { message_id: string };

    await ctx.runMutation(api.drafts.approve, {
      draftId: args.draftId,
      editedReply: args.editedReply,
    });
    await ctx.runMutation(internal.opsMessages.logOutbound, {
      listingId: draft.listingId,
      stayId: draft.stayId,
      agentmailId: sent.message_id,
      from: inbox.address,
      text: finalReply,
    });
    return null;
  },
});
