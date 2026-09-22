"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { BackLink } from "@/components/BackLink";
import { NavLink } from "@/components/NavLink";
import { badgeClass, cardClass } from "@/lib/ui";
import { explorerUrl, formatToken, formatUsd } from "@/lib/format";
import type { MyClub } from "@/lib/myClub";

export default function ClubHistoryPage() {
  const { publicKey, connected } = useWallet();
  const [clubs, setClubs] = useState<MyClub[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!publicKey) return;
    setError(null);
    try {
      const res = await fetch(`/api/clubs/mine?wallet=${publicKey.toBase58()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load your club history");
      setClubs(data.clubs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your club history");
    }
  }, [publicKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount/wallet-connect, not a render-loop hazard
    load();
  }, [load]);

  const leftClubs =
    clubs
      ?.filter((c) => c.hasExited)
      .sort((a, b) => {
        const aAt = a.exit?.exitedAt ?? a.leftAt ?? a.joinedAt;
        const bAt = b.exit?.exitedAt ?? b.leftAt ?? b.joinedAt;
        return new Date(bAt).getTime() - new Date(aAt).getTime();
      }) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/clubs/mine" label="Your clubs" />
        <h1 className="text-2xl font-semibold tracking-tight">Clubs you&apos;ve left</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A record of every club your connected wallet is no longer an active member of.
        </p>
      </div>

      {!connected && (
        <div className="rounded-2xl border border-warn/30 bg-warn-soft p-4 text-sm text-warn">
          Connect your wallet (top right) to see its history.
        </div>
      )}

      {connected && error && <p className="text-sm text-danger">{error}</p>}

      {connected && !error && leftClubs === null && (
        <p className="text-sm text-muted-foreground">Loading history...</p>
      )}

      {connected && leftClubs !== null && leftClubs.length === 0 && (
        <div className={cardClass("text-center")}>
          <p className="text-sm text-muted-foreground">
            This wallet hasn&apos;t left any clubs yet.
          </p>
        </div>
      )}

      {connected && leftClubs !== null && leftClubs.length > 0 && (
        <div className="flex flex-col gap-4">
          {leftClubs.map((club) => (
            <NavLink
              key={club.inviteCode}
              href={`/clubs/${club.inviteCode}`}
              className={cardClass("block transition-transform hover:-translate-y-0.5")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{club.name}</span>
                    {club.isCreator && <span className={badgeClass("accent")}>Creator</span>}
                    <span className={badgeClass(club.exit ? "warn" : "neutral")}>
                      {club.exit ? "Exited with payout" : "Left before any buy"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Target: {club.targetTokenSymbol} &middot; Invite code: {club.inviteCode}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {new Date(club.exit?.exitedAt ?? club.leftAt ?? club.joinedAt).toLocaleDateString()}
                </div>
              </div>

              <div className="mt-3 border-t border-border pt-3 text-sm">
                {club.exit ? (
                  <p>
                    Cashed out{" "}
                    <span className="font-semibold">
                      {club.exit.payoutType === "USDC"
                        ? formatUsd(club.exit.payoutAmount)
                        : `${formatToken(club.exit.payoutAmount)} ${club.targetTokenSymbol}`}
                    </span>{" "}
                    for your share of the club&apos;s position.{" "}
                    <a
                      className="underline underline-offset-2 hover:text-accent"
                      href={explorerUrl(club.exit.txSignature)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View transaction
                    </a>
                  </p>
                ) : club.refundedUsdc > 0 ? (
                  <p>
                    No batched buy had happened yet, so your pending{" "}
                    <span className="font-semibold">{formatUsd(club.refundedUsdc)}</span> contribution was
                    refunded back to your wallet when you left.
                  </p>
                ) : (
                  <p>You left before contributing anything, so nothing was owed back.</p>
                )}
              </div>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
