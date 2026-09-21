"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

const KNOWN_KEYS = ["wifiName", "wifiPassword", "accessMethod", "parkingInstructions", "quirk"];

export default function StayPage() {
  const { slug } = useParams<{ slug: string }>();
  const stay = useQuery(api.stays.getBySlug, { slug });
  const listing = useQuery(api.listings.get, stay ? { listingId: stay.listingId } : "skip");
  const faqs = useQuery(api.faqs.listByListing, stay ? { listingId: stay.listingId } : "skip");

  if (stay === undefined || listing === undefined) {
    return <Shell>Loading…</Shell>;
  }
  if (stay === null || listing === null) {
    return <Shell>We couldn&apos;t find this stay page.</Shell>;
  }

  const facts = (listing.privateFacts ?? {}) as Record<string, string>;
  const wifiName = facts.wifiName;
  const wifiPassword = stay.overrides.wifi || facts.wifiPassword;
  const accessMethod = facts.accessMethod;
  const accessCode = stay.overrides.accessCode;
  const parking = stay.overrides.parking || facts.parkingInstructions;
  const quirk = facts.quirk;
  const extraFacts = Object.entries(facts).filter(([key]) => !KNOWN_KEYS.includes(key));

  return (
    <Shell>
      <div className="text-center">
        <p className="text-sm text-zinc-500">Welcome,</p>
        <h1 className="text-2xl font-semibold">{stay.guestFirstName}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {listing.name} · {new Date(stay.checkIn).toLocaleDateString()} –{" "}
          {new Date(stay.checkOut).toLocaleDateString()}
        </p>
      </div>

      <Section title="Getting in">
        {accessMethod && <p>{accessMethod}</p>}
        {accessCode && (
          <p className="mt-1">
            Door code: <span className="font-mono font-semibold">{accessCode}</span>
          </p>
        )}
        {!accessMethod && !accessCode && <Unknown />}
      </Section>

      <Section title="Wi-Fi">
        {wifiName || wifiPassword ? (
          <>
            {wifiName && <p>Network: {wifiName}</p>}
            {wifiPassword && (
              <p>
                Password: <span className="font-mono">{wifiPassword}</span>
              </p>
            )}
          </>
        ) : (
          <Unknown />
        )}
      </Section>

      <Section title="Parking">{parking ? <p>{parking}</p> : <Unknown />}</Section>

      <Section title="The house">
        {!quirk && extraFacts.length === 0 && (faqs?.length ?? 0) === 0 && <Unknown />}
        {quirk && <p>{quirk}</p>}
        {extraFacts.map(([key, value]) => (
          <p key={key} className="mt-1">
            {String(value)}
          </p>
        ))}
        {faqs?.map((faq) => (
          <p key={faq._id} className="mt-2">
            <span className="font-medium">{faq.q}</span> — {faq.a}
          </p>
        ))}
      </Section>

      <Section title="Need something else?">
        <p className="text-zinc-500">Message your host on Airbnb.</p>
      </Section>
    </Shell>
  );
}

function Unknown() {
  return <p className="text-zinc-400">Not set yet — message your host.</p>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-zinc-200 py-5 dark:border-zinc-800">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      <div className="mt-2 text-base text-zinc-800 dark:text-zinc-100">{children}</div>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-full max-w-md px-4 py-10 text-zinc-900 dark:bg-black dark:text-zinc-50">
      {children}
    </div>
  );
}
