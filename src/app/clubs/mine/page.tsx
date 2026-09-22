"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { BackLink } from "@/components/BackLink";
import { NavLink } from "@/components/NavLink";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { badgeClass, buttonClass, cardClass } from "@/lib/ui";
import { formatUsd } from "@/lib/format";
import { humanizeChainError } from "@/lib/chainErrors";

interface MyClub {
  inviteCode: string;
  name: string;
  status: "OPEN" | "EXECUTED" | "CLOSED";
  targetTokenSymbol: string;
  fundingGoalUsd: number | null;
  createdAt: string;
  joinedAt: string;
  isCreator: boolean;
  pendingPoolUsdc: number;
  myContributedUsdc: number;
  hasExited: boolean;
  hasExecutedPosition: boolean;
  executionCount: number;
}

export default function MyClubsPage() {
  const { publicKey, connected } = useWallet();
  const [clubs, setClubs] = useState<MyClub[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leavingClub, setLeavingClub] = useState<MyClub | null>(null);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!publicKey) return;
    setError(null);
    try {
      const res = await fetch(`/api/clubs/mine?wallet=${publicKey.toBase58()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load your clubs");
      setClubs(data.clubs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your clubs");
    }
  }, [publicKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount/wallet-connect, not a render-loop hazard
    load();
  }, [load]);

  async function confirmLeave() {
    if (!leavingClub || !publicKey) return;
    setLeaveBusy(true);
    setLeaveError(null);
    try {
      const res = await fetch(`/api/clubs/${leavingClub.inviteCode}/exit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: publicKey.toBase58(), payoutType: "USDC" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to leave the club");
      setLeavingClub(null);
      await load();
    } catch (err) {
      setLeaveError(humanizeChainError(err));
    } finally {
      setLeaveBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/" label="Home" />
        <h1 className="text-2xl font-semibold tracking-tight">Your clubs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every club your connected wallet created or joined.
        </p>
      </div>

      {!connected && (
        <div className="rounded-2xl border border-warn/30 bg-warn-soft p-4 text-sm text-warn">
          Connect your wallet (top right) to see the clubs it&apos;s a part of.
        </div>
      )}

      {connected && error && <p className="text-sm text-danger">{error}</p>}

      {connected && !error && clubs === null && (
        <p className="text-sm text-muted-foreground">Loading your clubs...</p>
      )}

      {connected && clubs !== null && clubs.length === 0 && (
        <div className={cardClass("text-center")}>
          <p className="mb-4 text-sm text-muted-foreground">
            This wallet hasn&apos;t created or joined any clubs yet.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <NavLink href="/clubs/new" className={buttonClass("primary")}>
              Create a club
            </NavLink>
            <NavLink href="/clubs/join" className={buttonClass("secondary")}>
              Join with an invite code
            </NavLink>
          </div>
        </div>
      )}

      {connected && clubs !== null && clubs.length > 0 && (
        <div className="flex flex-col gap-4">
          {clubs.map((club) => {
            const goalPct = club.fundingGoalUsd
              ? Math.min(100, (club.pendingPoolUsdc / club.fundingGoalUsd) * 100)
              : null;
            return (
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
                      <span className={badgeClass(club.status === "OPEN" ? "accent" : "neutral")}>
                        {club.status === "OPEN" ? "Open" : club.status === "EXECUTED" ? "Executed" : "Closed"}
                      </span>
                      {club.hasExited && <span className={badgeClass("warn")}>You exited</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Target: {club.targetTokenSymbol} &middot; Invite code: {club.inviteCode} &middot; You
                      contributed {formatUsd(club.myContributedUsdc)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Pending pool</div>
                    <div className="text-lg font-semibold">{formatUsd(club.pendingPoolUsdc)}</div>
                  </div>
                </div>
                {goalPct !== null && (
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${goalPct}%` }} />
                    </div>
                  </div>
                )}
                {!club.hasExited && (
                  <div className="mt-3 border-t border-border pt-3">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLeaveError(null);
                        setLeavingClub(club);
                      }}
                      disabled={!club.hasExecutedPosition}
                      title={
                        club.hasExecutedPosition
                          ? undefined
                          : "Nothing to leave yet -- this club hasn't executed a batched buy for your contribution."
                      }
                      className={buttonClass("danger", "sm")}
                    >
                      Leave club
                    </button>
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>
      )}

      {leavingClub && (
        <ConfirmDialog
          title={`Leave ${leavingClub.name}?`}
          body="Leaving cashes out your current share as USDC right now, and removes you from this club. You will no longer receive a share of any profit when the other members later decide to take profit -- this can't be undone."
          error={leaveError}
          confirmLabel="Leave club"
          busyLabel="Leaving..."
          busy={leaveBusy}
          onConfirm={confirmLeave}
          onCancel={() => {
            setLeavingClub(null);
            setLeaveError(null);
          }}
        />
      )}
    </div>
  );
}
