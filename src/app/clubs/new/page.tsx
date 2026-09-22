"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { KNOWN_TESSERA_TOKENS } from "@/lib/tessera";
import type { TokenOverview } from "@/lib/tokenOverview";
import { BackLink } from "@/components/BackLink";
import { buttonClass, cardClass, inputClass } from "@/lib/ui";

export default function NewClubPage() {
  const { publicKey, connected } = useWallet();
  const router = useRouter();

  const [tokens, setTokens] = useState<TokenOverview[]>([]);
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
          targetTokenSymbol: selected?.name ?? "T-OpenAI",
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
      <BackLink href="/" label="Home" />
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Create a club</h1>
      <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
        You&apos;ll get a shareable invite code. Anyone with the link can join and
        contribute -- the club wallet pools everyone&apos;s USDC until you trigger the batched
        buy.
      </p>

      {!connected && (
        <div className="mb-4 rounded-2xl border border-warn/30 bg-warn-soft p-3 text-sm text-warn">
          Connect your wallet (top right) to create a club -- you become its first member.
        </div>
      )}

      <form onSubmit={handleSubmit} className={cardClass("flex flex-col gap-5")}>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Club name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="OpenAI Builders Club"
            className={inputClass()}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Target token
          <select value={targetTokenMint} onChange={(e) => setTargetTokenMint(e.target.value)} className={inputClass()}>
            {tokens.length > 0
              ? tokens.map((t) => (
                  <option key={t.mint} value={t.mint}>
                    {t.name} (${t.symbol})
                  </option>
                ))
              : Object.entries(KNOWN_TESSERA_TOKENS).map(([sym, mint]) => (
                  <option key={mint} value={mint}>
                    {sym}
                  </option>
                ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Funding goal (USD, optional)
          <input
            type="number"
            min="0"
            step="1"
            value={fundingGoalUsd}
            onChange={(e) => setFundingGoalUsd(e.target.value)}
            placeholder="e.g. 100"
            className={inputClass()}
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button type="submit" disabled={submitting || !connected} className={buttonClass("primary", "lg", "mt-1")}>
          {submitting ? "Creating..." : "Create club"}
        </button>
      </form>
    </div>
  );
}
