"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { USDC_MINT } from "@/lib/constants";
import { explorerUrl, formatToken, formatUsd, truncateAddress } from "@/lib/format";
import { BackLink } from "@/components/BackLink";
import { NavLink } from "@/components/NavLink";
import { badgeClass, buttonClass, cardClass, inputClass } from "@/lib/ui";

interface Member {
  membershipId: string;
  walletAddress: string;
  totalContributedUsdc: number;
  pendingContributionUsdc: number;
  entitlementPct: number;
  estimatedTTokenAmount: number;
  hasExited: boolean;
}

interface ClubData {
  id: string;
  name: string;
  inviteCode: string;
  status: string;
  targetTokenMint: string;
  targetTokenSymbol: string;
  clubWalletAddress: string;
  fundingGoalUsd: number | null;
  pendingPoolUsdc: number;
  tTokenBalance: number;
  clubWalletSolBalance: number;
  members: Member[];
  executions: Array<{
    id: string;
    totalUsdcAmount: number;
    tTokenAmountReceived: number;
    txSignature: string;
    executedAt: string;
    quotePriceImpactPct: number;
    savingsUsd: number;
  }>;
}

export default function ClubDashboardPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [club, setClub] = useState<ClubData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [amount, setAmount] = useState("10");
  const [payoutType, setPayoutType] = useState<"USDC" | "TTOKEN">("USDC");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${code}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Club not found");
      setClub(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load club");
    }
  }, [code]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount, not a render-loop hazard
    refresh();
  }, [refresh]);

  const myWallet = publicKey?.toBase58();
  const myMembership = club?.members.find((m) => m.walletAddress === myWallet);
  const isMember = Boolean(myMembership);

  async function handleJoin() {
    if (!myWallet) return;
    setBusy("join");
    try {
      const res = await fetch(`/api/clubs/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: myWallet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMessage({ kind: "ok", text: "Joined the club." });
      await refresh();
    } catch (err) {
      setActionMessage({ kind: "error", text: err instanceof Error ? err.message : "Failed to join" });
    } finally {
      setBusy(null);
    }
  }

  async function handleContribute() {
    if (!publicKey || !club) return;
    const amountUsdc = Number(amount);
    if (!(amountUsdc > 0)) {
      setActionMessage({ kind: "error", text: "Enter a contribution amount greater than zero." });
      return;
    }
    setBusy("contribute");
    setActionMessage(null);
    try {
      const usdcMint = new PublicKey(USDC_MINT);
      const clubWallet = new PublicKey(club.clubWalletAddress);
      const fromAta = await getAssociatedTokenAddress(usdcMint, publicKey, false, TOKEN_PROGRAM_ID);
      const toAta = await getAssociatedTokenAddress(usdcMint, clubWallet, false, TOKEN_PROGRAM_ID);

      // Check the sender actually holds enough USDC before building a
      // transaction -- transferChecked from a wallet with no USDC account
      // at all fails on-chain with a cryptic "InvalidAccountData" that's
      // much less clear than catching it here first.
      let usdcBalance = 0;
      try {
        const bal = await connection.getTokenAccountBalance(fromAta);
        usdcBalance = bal.value.uiAmount ?? 0;
      } catch {
        usdcBalance = 0; // account doesn't exist -- this wallet has never held USDC
      }
      if (usdcBalance < amountUsdc) {
        throw new Error(
          usdcBalance === 0
            ? "This wallet doesn't hold any USDC yet. Get some real USDC into it first (e.g. swap SOL for USDC in your wallet), then try again."
            : `This wallet only holds ${formatUsd(usdcBalance)} USDC, less than the ${formatUsd(amountUsdc)} you're trying to send.`
        );
      }

      const tx = new Transaction();
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(publicKey, toAta, clubWallet, usdcMint, TOKEN_PROGRAM_ID)
      );
      tx.add(
        createTransferCheckedInstruction(
          fromAta,
          usdcMint,
          toAta,
          publicKey,
          BigInt(Math.round(amountUsdc * 1_000_000)),
          6,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

      const res = await fetch(`/api/clubs/${code}/contribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: publicKey.toBase58(), txSignature: signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActionMessage({ kind: "ok", text: `Contributed ${formatUsd(amountUsdc)}. Tx: ${signature.slice(0, 12)}...` });
      await refresh();
    } catch (err) {
      console.error("Contribution failed:", err);
      let message = err instanceof Error ? err.message : "Contribution failed. Make sure your wallet holds USDC and has SOL for fees.";
      if (message.length > 200) {
        message = message.slice(0, 180) + "... (full details logged to the browser console)";
      }
      setActionMessage({ kind: "error", text: message });
    } finally {
      setBusy(null);
    }
  }

  async function handleExecute() {
    setBusy("execute");
    setActionMessage(null);
    try {
      const res = await fetch(`/api/clubs/${code}/execute`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMessage({
        kind: "ok",
        text: `Batched buy executed: received ${formatToken(data.tTokenAmountReceived)} ${club?.targetTokenSymbol}.`,
      });
      await refresh();
    } catch (err) {
      setActionMessage({ kind: "error", text: err instanceof Error ? err.message : "Execution failed" });
    } finally {
      setBusy(null);
    }
  }

  async function handleExit() {
    if (!myWallet) return;
    setBusy("exit");
    setActionMessage(null);
    try {
      const res = await fetch(`/api/clubs/${code}/exit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: myWallet, payoutType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMessage({
        kind: "ok",
        text: `Exited with ${formatToken(data.payoutAmount)} ${data.payoutType === "USDC" ? "USDC" : club?.targetTokenSymbol}.`,
      });
      await refresh();
    } catch (err) {
      setActionMessage({ kind: "error", text: err instanceof Error ? err.message : "Exit failed" });
    } finally {
      setBusy(null);
    }
  }

  function copyInviteLink() {
    if (typeof window === "undefined" || !club) return;
    navigator.clipboard.writeText(`${window.location.origin}/clubs/${club.inviteCode}`);
    setActionMessage({ kind: "ok", text: "Invite link copied." });
  }

  if (loadError) {
    return <p className="text-sm text-danger">{loadError}</p>;
  }
  if (!club) {
    return <p className="text-sm text-muted-foreground">Loading club...</p>;
  }

  const goalPct = club.fundingGoalUsd
    ? Math.min(100, (club.pendingPoolUsdc / club.fundingGoalUsd) * 100)
    : null;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <BackLink href="/" label="Home" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{club.name}</h1>
          <button onClick={copyInviteLink} className={buttonClass("secondary", "sm")}>
            Copy invite link ({club.inviteCode})
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Target: {club.targetTokenSymbol} &middot; Club wallet:{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href={explorerUrl(club.clubWalletAddress, "address")}
            target="_blank"
            rel="noreferrer"
          >
            {truncateAddress(club.clubWalletAddress)}
          </a>
        </p>
        <p className="text-sm">
          Club wallet SOL balance: <span className="font-medium">{club.clubWalletSolBalance.toFixed(4)} SOL</span>
          {club.clubWalletSolBalance < 0.01 && (
            <span className="ml-2 text-warn">
              &mdash; too low. The club wallet pays its own network fees for the batched buy and every
              exit payout, but it only ever receives USDC from contributions. Send it ~0.02-0.05 SOL
              directly (to the address above) before clicking &quot;Buy&quot; or a member tries to leave,
              or those transactions will fail.
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-4">
          <NavLink href={`/clubs/${club.inviteCode}/savings`} className="text-sm font-semibold text-accent underline underline-offset-2">
            View the solo-vs-club savings comparison &rarr;
          </NavLink>
          <NavLink href={`/clubs/${club.inviteCode}/public`} className="text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Share a read-only view &rarr;
          </NavLink>
        </div>
      </section>

      <section className={cardClass()}>
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Pending pool (not yet bought)</div>
            <div className="text-3xl font-semibold tracking-tight">{formatUsd(club.pendingPoolUsdc)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {club.targetTokenSymbol} held by club
            </div>
            <div className="text-xl font-semibold">{formatToken(club.tTokenBalance)}</div>
          </div>
        </div>
        {goalPct !== null && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${goalPct}%` }} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatUsd(club.pendingPoolUsdc)} of {formatUsd(club.fundingGoalUsd!)} goal
            </div>
          </div>
        )}
        <button
          onClick={handleExecute}
          disabled={busy !== null || club.pendingPoolUsdc <= 0}
          className={buttonClass("primary", "lg", "mt-4 w-full")}
        >
          {busy === "execute" ? "Executing swap..." : `Buy ${club.targetTokenSymbol} with pooled funds`}
        </button>
      </section>

      {actionMessage && (
        <p className={`text-sm ${actionMessage.kind === "ok" ? "text-accent" : "text-danger"}`}>
          {actionMessage.text}
        </p>
      )}

      <section className={cardClass()}>
        <h2 className="mb-3 font-semibold">Your membership</h2>
        {!publicKey && <p className="text-sm text-muted-foreground">Connect your wallet to join or contribute.</p>}
        {publicKey && !isMember && (
          <button onClick={handleJoin} disabled={busy !== null} className={buttonClass("primary")}>
            {busy === "join" ? "Joining..." : "Join this club"}
          </button>
        )}
        {publicKey && isMember && !myMembership?.hasExited && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Contribute USDC
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputClass("w-32")}
                />
              </label>
              <button onClick={handleContribute} disabled={busy !== null} className={buttonClass("primary")}>
                {busy === "contribute" ? "Sending USDC..." : "Send contribution"}
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Exit payout as
                <select
                  value={payoutType}
                  onChange={(e) => setPayoutType(e.target.value as "USDC" | "TTOKEN")}
                  className={inputClass()}
                >
                  <option value="USDC">USDC</option>
                  <option value="TTOKEN">{club.targetTokenSymbol}</option>
                </select>
              </label>
              <button
                onClick={handleExit}
                disabled={busy !== null || (myMembership?.entitlementPct ?? 0) <= 0}
                className={buttonClass("danger")}
              >
                {busy === "exit" ? "Exiting..." : "Leave club"}
              </button>
            </div>
          </div>
        )}
        {myMembership?.hasExited && <p className="text-sm text-muted-foreground">You have already exited this club.</p>}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Members ({club.members.length})</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Wallet</th>
                <th className="px-4 py-2.5">Contributed</th>
                <th className="px-4 py-2.5">Pending</th>
                <th className="px-4 py-2.5">Share</th>
                <th className="px-4 py-2.5">Est. {club.targetTokenSymbol}</th>
              </tr>
            </thead>
            <tbody>
              {club.members.map((m) => (
                <tr key={m.membershipId} className="border-t border-border transition-colors hover:bg-surface-muted/60">
                  <td className="px-4 py-2.5">
                    <a
                      className="underline underline-offset-2 hover:text-accent"
                      href={explorerUrl(m.walletAddress, "address")}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {truncateAddress(m.walletAddress)}
                    </a>
                    {m.hasExited && <span className={badgeClass("neutral", "ml-2")}>exited</span>}
                  </td>
                  <td className="px-4 py-2.5">{formatUsd(m.totalContributedUsdc)}</td>
                  <td className="px-4 py-2.5">{formatUsd(m.pendingContributionUsdc)}</td>
                  <td className="px-4 py-2.5">{(m.entitlementPct * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2.5">{formatToken(m.estimatedTTokenAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <TxHistory code={code} />
    </div>
  );
}

function TxHistory({ code }: { code: string }) {
  const [events, setEvents] = useState<
    Array<{ type: string; at: string; txSignature: string; explorerUrl: string; [k: string]: unknown }>
  >([]);

  useEffect(() => {
    fetch(`/api/clubs/${code}/history`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]));
  }, [code]);

  if (events.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 font-semibold">Transaction history</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {events.map((e, i) => (
          <li
            key={i}
            className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-2.5 transition-shadow hover:shadow-sm"
          >
            <span className="capitalize">{e.type}</span>
            <span className="text-muted-foreground">{new Date(e.at).toLocaleString()}</span>
            <a className="underline underline-offset-2 hover:text-accent" href={e.explorerUrl} target="_blank" rel="noreferrer">
              View on Explorer
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
