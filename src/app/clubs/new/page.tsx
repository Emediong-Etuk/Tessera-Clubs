"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import type { TesseraToken } from "@/lib/tessera";
import { KNOWN_TESSERA_TOKENS } from "@/lib/tessera";

export default function NewClubPage() {
  const { publicKey, connected } = useWallet();
  const router = useRouter();

  const [tokens, setTokens] = useState<TesseraToken[]>([]);
  const [name, setName] = useState("");
  const [targetTokenMint, setTargetTokenMint] = useState("");
  const [fundingGoalUsd, setFundingGoalUsd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tokens")
      .then((r) => r.json())
      .then((data) => {
        if (data.tokens) {
          setTokens(data.tokens);
          if (data.tokens.length > 0) setTargetTokenMint(data.tokens[0].mint);
        } else {
          setTargetTokenMint(KNOWN_TESSERA_TOKENS["T-OpenAI"]);
        }
      })
      .catch(() => setTargetTokenMint(KNOWN_TESSERA_TOKENS["T-OpenAI"]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey) {
      setError("Connect a wallet first -- you'll be the club's first member.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const selected = tokens.find((t) => t.mint === targetTokenMint);
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          targetTokenMint,
          targetTokenSymbol: selected?.symbol ?? "T-OpenAI",
          fundingGoalUsd: fundingGoalUsd ? Number(fundingGoalUsd) : undefined,
          creatorWalletAddress: publicKey.toBase58(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create club");
      router.push(`/clubs/${data.inviteCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-bold">Create a club</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        You&apos;ll get a shareable invite code. Anyone with the link can join and
        contribute -- the club wallet pools everyone&apos;s USDC until you trigger the batched
        buy.
      </p>

      {!connected && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Connect your wallet (top right) to create a club -- you become its first member.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Club name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="OpenAI Builders Club"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Target T-Token
          <select
            value={targetTokenMint}
            onChange={(e) => setTargetTokenMint(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          >
            {tokens.length > 0
              ? tokens.map((t) => (
                  <option key={t.mint} value={t.mint}>
                    {t.name} ({t.symbol})
                  </option>
                ))
              : Object.entries(KNOWN_TESSERA_TOKENS).map(([sym, mint]) => (
                  <option key={mint} value={mint}>
                    {sym}
                  </option>
                ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Funding goal (USD, optional)
          <input
            type="number"
            min="0"
            step="1"
            value={fundingGoalUsd}
            onChange={(e) => setFundingGoalUsd(e.target.value)}
            placeholder="e.g. 100"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !connected}
          className="mt-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {submitting ? "Creating..." : "Create club"}
        </button>
      </form>
    </div>
  );
}
