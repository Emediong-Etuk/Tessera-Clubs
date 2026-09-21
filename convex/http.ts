import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { verifySvixSignature } from "./lib/svix";

const http = httpRouter();

http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.text();
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    let payload: {
      event_type?: string;
      message?: {
        inbox_id?: string;
        message_id?: string;
        thread_id?: string;
        from_?: string[];
        subject?: string;
        text?: string;
      };
    };
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    const inboxId = payload.message?.inbox_id;
    if (!inboxId) return new Response(null, { status: 200 });

    const inbox = await ctx.runQuery(internal.agentmailInboxes.getByInboxIdInternal, {
      inboxId,
    });
    if (!inbox) return new Response(null, { status: 200 });

    if (!inbox.webhookSecret || !svixId || !svixTimestamp || !svixSignature) {
      return new Response("unverified", { status: 401 });
    }
    const valid = await verifySvixSignature({
      secret: inbox.webhookSecret,
      svixId,
      svixTimestamp,
      svixSignature,
      body,
    });
    if (!valid) return new Response("invalid signature", { status: 401 });

    if (payload.event_type !== "message.received") {
      return new Response(null, { status: 200 });
    }

    const message = payload.message;
    const fromAddress = message?.from_?.[0] ?? "unknown";
    const text = message?.text ?? "";
    const messageId = message?.message_id;
    if (!text || !messageId) return new Response(null, { status: 200 });

    const stay = await ctx.runQuery(internal.stays.findByListingAndGuestEmailInternal, {
      listingId: inbox.listingId,
      guestEmail: fromAddress,
    });

    await ctx.runMutation(internal.opsMessages.logInbound, {
      listingId: inbox.listingId,
      stayId: stay?._id,
      agentmailId: messageId,
      from: fromAddress,
      subject: message?.subject,
      text,
    });

    // Return fast; draft the grounded answer in the background.
    await ctx.scheduler.runAfter(0, api.answerQuestion.run, {
      listingId: inbox.listingId,
      stayId: stay?._id,
      inboundText: text,
      channel: "email",
      sourceMessageId: messageId,
    });

    return new Response(null, { status: 200 });
  }),
});

export default http;
