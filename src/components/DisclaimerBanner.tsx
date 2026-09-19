"use client";

import { useState } from "react";

export function DisclaimerBanner() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2 text-sm">
        <p>
          <strong>Hackathon MVP:</strong> club funds are pooled in a server-controlled
          (custodial) wallet, not a trustless on-chain vault.{" "}
          <button
            onClick={() => setOpen(true)}
            className="underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-100"
          >
            What does that mean?
          </button>
        </p>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-w-lg rounded-xl bg-white p-6 text-zinc-900 shadow-xl dark:bg-zinc-900 dark:text-zinc-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-semibold">About this demo&apos;s custody model</h2>
            <p className="mb-3 text-sm leading-relaxed">
              Tessera Clubs is a hackathon MVP. Each club gets a server-generated Solana
              wallet. Members send USDC to that wallet, and the backend tracks each
              member&apos;s contribution and computes proportional ownership off-chain in a
              database &mdash; it is <em>not</em> a per-member on-chain token balance.
            </p>
            <p className="mb-3 text-sm leading-relaxed">
              The batched buy and exit payouts are signed by the club&apos;s server-held key.
              This means members are trusting the operator to hold and distribute funds
              correctly, the same way they would trust a centralized exchange.
            </p>
            <p className="mb-4 text-sm leading-relaxed">
              A production version would replace this with an on-chain escrow/vault program
              or synthetic share tokens for trustless custody. That is real engineering work
              this MVP intentionally scoped out to ship in days, not weeks.
            </p>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
