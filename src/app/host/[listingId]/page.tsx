"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

const REQUIRED_FACT_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "wifiName", label: "Wi-Fi name", placeholder: "OakHouse" },
  { key: "wifiPassword", label: "Wi-Fi password", placeholder: "oak2026" },
  { key: "accessMethod", label: "How guests get in", placeholder: "Lockbox by the front door" },
  { key: "parkingInstructions", label: "Parking", placeholder: "Spot B3 behind the building" },
  { key: "quirk", label: "One quirk guests should know", placeholder: "Water takes a minute to heat up" },
];

export default function ListingPage() {
  const params = useParams<{ listingId: string }>();
  const listingId = params.listingId as Id<"listings">;

  const listing = useQuery(api.listings.get, { listingId });
  const faqs = useQuery(api.faqs.listByListing, { listingId });
  const stays = useQuery(api.stays.listByListing, { listingId });
  const drafts = useQuery(api.drafts.listByListing, { listingId });

  if (listing === undefined) return <PageShell>Loading…</PageShell>;
  if (listing === null) return <PageShell>Listing not found.</PageShell>;

  return (
    <PageShell>
      <ListingHeader listing={listing} />
      <CompleteFactsForm listingId={listingId} listing={listing} />
      <EmailInboxSection listingId={listingId} />
      <StaysSection listingId={listingId} stays={stays} />
      <InboxSection listingId={listingId} stays={stays} drafts={drafts} faqCount={faqs?.length ?? 0} />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-full max-w-2xl space-y-10 px-4 py-10 text-zinc-900 dark:text-zinc-50">
      {children}
    </div>
  );
}

function ListingHeader({ listing }: { listing: Doc<"listings"> }) {
  return (
    <div>
      <a href="/host" className="text-sm text-zinc-500 hover:underline">
        ← All properties
      </a>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{listing.name}</h1>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            listing.readinessReady
              ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          }`}
        >
          {listing.readinessReady ? "Guest ready" : `${listing.readinessMissing.length} facts missing`}
        </span>
      </div>
      {listing.locationText && <p className="mt-1 text-sm text-zinc-500">{listing.locationText}</p>}
      <p className="mt-1 text-xs text-zinc-400">Imported from {listing.sourceUrl}</p>
    </div>
  );
}

function CompleteFactsForm({
  listingId,
  listing,
}: {
  listingId: Id<"listings">;
  listing: Doc<"listings">;
}) {
  const updatePrivateFacts = useMutation(api.listings.updatePrivateFacts);
  const facts = listing.privateFacts ?? {};
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(REQUIRED_FACT_FIELDS.map((f) => [f.key, String(facts[f.key] ?? "")])),
  );
  const [saving, setSaving] = useState(false);
  const [extraLabel, setExtraLabel] = useState("");
  const [extraValue, setExtraValue] = useState("");

  async function save(patch: Record<string, string>) {
    setSaving(true);
    try {
      await updatePrivateFacts({ listingId, patch });
    } finally {
      setSaving(false);
    }
  }

  const extraFacts = Object.entries(facts).filter(
    (entry) => !REQUIRED_FACT_FIELDS.some((f) => f.key === entry[0]),
  );

  return (
    <section>
      <h2 className="text-lg font-semibold">Complete your property</h2>
      <p className="mt-1 text-sm text-zinc-500">
        The listing can&apos;t know these — only you can.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(values);
        }}
        className="mt-4 space-y-3"
      >
        {REQUIRED_FACT_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-medium text-zinc-500">{f.label}</label>
            <input
              value={values[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>

      {extraFacts.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {extraFacts.map(([key, value]) => (
            <li key={key} className="text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{key}:</span>{" "}
              {String(value)}
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!extraLabel || !extraValue) return;
          const key = extraLabel
            .trim()
            .split(/[^a-zA-Z0-9]+/)
            .filter(Boolean)
            .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
            .join("");
          void save({ [key]: extraValue }).then(() => {
            setExtraLabel("");
            setExtraValue("");
          });
        }}
        className="mt-4 flex gap-2"
      >
        <input
          placeholder="Another fact (e.g. hair dryer location)"
          value={extraLabel}
          onChange={(e) => setExtraLabel(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          placeholder="Answer"
          value={extraValue}
          onChange={(e) => setExtraValue(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        >
          Add
        </button>
      </form>
    </section>
  );
}

function EmailInboxSection({ listingId }: { listingId: Id<"listings"> }) {
  const inbox = useQuery(api.agentmailInboxes.getAddressByListing, { listingId });
  const provisionInbox = useAction(api.agentmail.provisionInbox);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section>
      <h2 className="text-lg font-semibold">Email inbox</h2>
      {inbox === undefined && <p className="mt-1 text-sm text-zinc-500">Loading…</p>}
      {inbox === null && (
        <div className="mt-2">
          <p className="text-sm text-zinc-500">
            Give guests a dedicated address that drafts answers automatically.
          </p>
          <button
            disabled={provisioning}
            onClick={async () => {
              setProvisioning(true);
              setError(null);
              try {
                await provisionInbox({ listingId });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't set up the inbox.");
              } finally {
                setProvisioning(false);
              }
            }}
            className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {provisioning ? "Setting up…" : "Set up email inbox"}
          </button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
      {inbox && (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Guests can email <span className="font-mono">{inbox.address}</span> — replies you
          approve below are sent from there automatically.
        </p>
      )}
    </section>
  );
}

function StaysSection({
  listingId,
  stays,
}: {
  listingId: Id<"listings">;
  stays: Doc<"stays">[] | undefined;
}) {
  const createStay = useMutation(api.stays.create);
  const [guestFirstName, setGuestFirstName] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [parking, setParking] = useState("");
  const [creating, setCreating] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!guestFirstName || !checkIn || !checkOut) return;
    setCreating(true);
    try {
      const { slug } = await createStay({
        listingId,
        guestFirstName,
        checkIn: new Date(checkIn).getTime(),
        checkOut: new Date(checkOut).getTime(),
        overrides: {
          accessCode: accessCode || undefined,
          parking: parking || undefined,
        },
      });
      setLastLink(`${window.location.origin}/stays/${slug}`);
      setGuestFirstName("");
      setCheckIn("");
      setCheckOut("");
      setAccessCode("");
      setParking("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">Stays</h2>
      <form onSubmit={handleCreate} className="mt-4 grid grid-cols-2 gap-2">
        <input
          placeholder="Guest first name"
          value={guestFirstName}
          onChange={(e) => setGuestFirstName(e.target.value)}
          className="col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="date"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="date"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          placeholder="Door code for this stay (optional)"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          placeholder="Parking spot for this stay (optional)"
          value={parking}
          onChange={(e) => setParking(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={creating}
          className="col-span-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {creating ? "Creating…" : "Create stay page"}
        </button>
      </form>
      {lastLink && (
        <p className="mt-2 break-all text-sm text-green-700 dark:text-green-400">
          Stay page ready: <a className="underline" href={lastLink}>{lastLink}</a>
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {stays?.map((stay) => (
          <li
            key={stay._id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
          >
            <span>
              {stay.guestFirstName} · {new Date(stay.checkIn).toLocaleDateString()}–
              {new Date(stay.checkOut).toLocaleDateString()}
            </span>
            <a href={`/stays/${stay.slug}`} className="text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100">
              View page
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InboxSection({
  listingId,
  stays,
  drafts,
  faqCount,
}: {
  listingId: Id<"listings">;
  stays: Doc<"stays">[] | undefined;
  drafts: Doc<"drafts">[] | undefined;
  faqCount: number;
}) {
  const askQuestion = useAction(api.answerQuestion.run);
  const [question, setQuestion] = useState("");
  const [stayId, setStayId] = useState<string>("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question) return;
    setAsking(true);
    setError(null);
    try {
      await askQuestion({
        listingId,
        stayId: stayId ? (stayId as Id<"stays">) : undefined,
        inboundText: question,
        channel: "paste",
      });
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't draft an answer.");
    } finally {
      setAsking(false);
    }
  }

  const openDrafts = drafts?.filter((d) => d.status === "pending" || d.status === "flagged") ?? [];
  const resolvedDrafts = drafts?.filter((d) => d.status === "approved" || d.status === "edited") ?? [];

  return (
    <section>
      <h2 className="text-lg font-semibold">Inbox</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {resolvedDrafts.length} answered · {faqCount} things Housefile knows
      </p>

      <form onSubmit={handleAsk} className="mt-4 space-y-2">
        <textarea
          placeholder="What did the guest ask?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="flex gap-2">
          <select
            value={stayId}
            onChange={(e) => setStayId(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">No specific stay</option>
            {stays?.map((s) => (
              <option key={s._id} value={s._id}>
                {s.guestFirstName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={asking}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {asking ? "Drafting…" : "Draft answer"}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 space-y-3">
        {openDrafts.map((draft) => (
          <DraftCard key={draft._id} draft={draft} />
        ))}
      </div>
    </section>
  );
}

function DraftCard({ draft }: { draft: Doc<"drafts"> }) {
  const approve = useMutation(api.drafts.approve);
  const sendApprovedReply = useAction(api.agentmail.sendApprovedReply);
  const discard = useMutation(api.drafts.discard);
  const proposePatch = useAction(api.learn.proposePatch);
  const approveLearnedPatch = useMutation(api.drafts.approveLearnedPatch);

  const [editedReply, setEditedReply] = useState(draft.reply);
  const [hostAnswer, setHostAnswer] = useState("");
  const [teaching, setTeaching] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const isFlagged = draft.status === "flagged";
  const isEmail = draft.channel === "email";

  async function handleApprove() {
    if (!isEmail) {
      await approve({ draftId: draft._id, editedReply });
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await sendApprovedReply({ draftId: draft._id, editedReply });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Couldn't send the reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm font-medium">&ldquo;{draft.inboundText}&rdquo;</p>

      {!isFlagged && (
        <>
          <textarea
            value={editedReply}
            onChange={(e) => setEditedReply(e.target.value)}
            rows={2}
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          {draft.citations.length > 0 && (
            <p className="mt-1 text-xs text-zinc-400">
              Grounded by: {draft.citations.map((c) => c.field).join(", ")}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              disabled={sending}
              onClick={() => void handleApprove()}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
            >
              {isEmail ? (sending ? "Sending…" : "Approve & send") : "Approve"}
            </button>
            <button
              onClick={() => void discard({ draftId: draft._id })}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700"
            >
              Discard
            </button>
          </div>
          {sendError && <p className="mt-1 text-xs text-red-600">{sendError}</p>}
        </>
      )}

      {isFlagged && !draft.proposedPatch && (
        <div className="mt-2">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            ⚠ Housefile doesn&apos;t know this yet — {draft.flagReason}
          </p>
          <textarea
            placeholder="Answer it here — Housefile will remember it next time."
            value={hostAnswer}
            onChange={(e) => setHostAnswer(e.target.value)}
            rows={2}
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            disabled={!hostAnswer || teaching}
            onClick={async () => {
              setTeaching(true);
              try {
                await proposePatch({ draftId: draft._id, hostAnswer });
              } finally {
                setTeaching(false);
              }
            }}
            className="mt-2 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {teaching ? "Teaching…" : "Teach Housefile"}
          </button>
        </div>
      )}

      {isFlagged && draft.proposedPatch && (
        <div className="mt-2 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
          <p className="font-medium">New property knowledge</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {draft.proposedPatch.field} → {draft.proposedPatch.value}
          </p>
          <button
            onClick={() => void approveLearnedPatch({ draftId: draft._id })}
            className="mt-2 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            Save to Housefile
          </button>
        </div>
      )}
    </div>
  );
}
