"use client";

import { useState } from "react";
import { buttonClass } from "@/lib/ui";

export function DisclaimerBanner() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border bg-warn-soft text-warn">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2 text-sm">
        <p>
          <strong className="font-semibold">Hackathon MVP:</strong> club funds are pooled in a
          server-controlled (custodial) wallet, not a trustless on-chain vault.{" "}
          <button
            onClick={() => setOpen(true)}
            className="underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            What does that mean?
          </button>
        </p>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-fade-up max-w-lg rounded-2xl border border-border bg-surface p-6 text-foreground shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-semibold">About this demo&apos;s custody model</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Tessera Clubs is a hackathon MVP. Each club gets a server-generated Solana
              wallet. Members send USDC to that wallet, and the backend tracks each
              member&apos;s contribution and computes proportional ownership off-chain in a
              database &mdash; it is <em>not</em> a per-member on-chain token balance.
            </p>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              The batched buy and exit payouts are signed by the club&apos;s server-held key.
              This means members are trusting the operator to hold and distribute funds
              correctly, the same way they would trust a centralized exchange.
            </p>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
              A production version would replace this with an on-chain escrow/vault program
              or synthetic share tokens for trustless custody. That is real engineering work
              this MVP intentionally scoped out to ship in days, not weeks.
            </p>
            <button onClick={() => setOpen(false)} className={buttonClass("primary")}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
