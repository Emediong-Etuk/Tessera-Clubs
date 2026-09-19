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
      setActionMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Contribution failed. Make sure your wallet holds USDC and has SOL for fees.",
      });
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
    return <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>;
  }
  if (!club) {
    return <p className="text-sm text-zinc-500">Loading club...</p>;
  }

  const goalPct = club.fundingGoalUsd
    ? Math.min(100, (club.pendingPoolUsdc / club.fundingGoalUsd) * 100)
    : null;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <BackLink href="/" label="Home" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{club.name}</h1>
          <button
            onClick={copyInviteLink}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Copy invite link ({club.inviteCode})
          </button>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Target: {club.targetTokenSymbol} &middot; Club wallet:{" "}
          <a
            className="underline underline-offset-2"
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
            <span className="ml-2 text-amber-700 dark:text-amber-400">
              &mdash; too low. The club wallet pays its own network fees for the batched buy and every
              exit payout, but it only ever receives USDC from contributions. Send it ~0.02-0.05 SOL
              directly (to the address above) before clicking &quot;Buy&quot; or a member tries to leave,
              or those transactions will fail.
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-4">
          <NavLink href={`/clubs/${club.inviteCode}/savings`} className="text-sm font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
            View the solo-vs-club savings comparison &rarr;
          </NavLink>
          <NavLink href={`/clubs/${club.inviteCode}/public`} className="text-sm font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300">
            Share a read-only view &rarr;
          </NavLink>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">Pending pool (not yet bought)</div>
            <div className="text-3xl font-bold">{formatUsd(club.pendingPoolUsdc)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {club.targetTokenSymbol} held by club
            </div>
            <div className="text-xl font-semibold">{formatToken(club.tTokenBalance)}</div>
          </div>
        </div>
        {goalPct !== null && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div className="h-full bg-emerald-500" style={{ width: `${goalPct}%` }} />
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {formatUsd(club.pendingPoolUsdc)} of {formatUsd(club.fundingGoalUsd!)} goal
            </div>
          </div>
        )}
        <button
          onClick={handleExecute}
          disabled={busy !== null || club.pendingPoolUsdc <= 0}
          className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy === "execute" ? "Executing swap..." : `Buy ${club.targetTokenSymbol} with pooled funds`}
        </button>
      </section>

      {actionMessage && (
        <p
          className={`text-sm ${actionMessage.kind === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        >
          {actionMessage.text}
        </p>
      )}

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-3 font-semibold">Your membership</h2>
        {!publicKey && <p className="text-sm text-zinc-500">Connect your wallet to join or contribute.</p>}
        {publicKey && !isMember && (
          <button
            onClick={handleJoin}
            disabled={busy !== null}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {busy === "join" ? "Joining..." : "Join this club"}
          </button>
        )}
        {publicKey && isMember && !myMembership?.hasExited && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Contribute USDC
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-32 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <button
                onClick={handleContribute}
                disabled={busy !== null}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
              >
                {busy === "contribute" ? "Sending USDC..." : "Send contribution"}
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Exit payout as
                <select
                  value={payoutType}
                  onChange={(e) => setPayoutType(e.target.value as "USDC" | "TTOKEN")}
                  className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="USDC">USDC</option>
                  <option value="TTOKEN">{club.targetTokenSymbol}</option>
                </select>
              </label>
              <button
                onClick={handleExit}
                disabled={busy !== null || (myMembership?.entitlementPct ?? 0) <= 0}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                {busy === "exit" ? "Exiting..." : "Leave club"}
              </button>
            </div>
          </div>
        )}
        {myMembership?.hasExited && <p className="text-sm text-zinc-500">You have already exited this club.</p>}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Members ({club.members.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Wallet</th>
                <th className="px-4 py-2">Contributed</th>
                <th className="px-4 py-2">Pending</th>
                <th className="px-4 py-2">Share</th>
                <th className="px-4 py-2">Est. {club.targetTokenSymbol}</th>
              </tr>
            </thead>
            <tbody>
              {club.members.map((m) => (
                <tr key={m.membershipId} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    <a
                      className="underline underline-offset-2"
                      href={explorerUrl(m.walletAddress, "address")}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {truncateAddress(m.walletAddress)}
                    </a>
                    {m.hasExited && <span className="ml-2 text-xs text-zinc-400">(exited)</span>}
                  </td>
                  <td className="px-4 py-2">{formatUsd(m.totalContributedUsdc)}</td>
                  <td className="px-4 py-2">{formatUsd(m.pendingContributionUsdc)}</td>
                  <td className="px-4 py-2">{(m.entitlementPct * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2">{formatToken(m.estimatedTTokenAmount)}</td>
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
            className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 dark:border-zinc-800"
          >
            <span className="capitalize">{e.type}</span>
            <span className="text-zinc-500">{new Date(e.at).toLocaleString()}</span>
            <a className="underline underline-offset-2" href={e.explorerUrl} target="_blank" rel="noreferrer">
              View on Explorer
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
