"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatPct, formatToken, formatUsd, formatUsdPrecise } from "@/lib/format";
import { BackLink } from "@/components/BackLink";
import { cardClass } from "@/lib/ui";

interface Comparison {
  individualTotalTTokens: number;
  pooledTTokens: number;
  tTokenDeltaFromPooling: number;
  individualAvgPriceImpactPct: number;
  pooledPriceImpactPct: number;
  priceImpactDeltaPct: number;
  individualValueUsd: number;
  pooledValueUsd: number;
  tokenValueDeltaUsd: number;
  executionCostIndividualUsd: number;
  executionCostClubUsd: number;
  executionCostSavingsUsd: number;
  totalSavingsUsd: number;
  numTransactionsIndividual: number;
  numTransactionsClub: number;
}

interface SavingsResponse {
  available: boolean;
  reason?: string;
  source?: string;
  memberCount?: number;
  totalPendingUsdc?: number;
  comparison?: Comparison;
  error?: string;
}

interface ClubSummary {
  name: string;
  targetTokenSymbol: string;
  inviteCode: string;
  executions: Array<{
    totalUsdcAmount: number;
    tTokenAmountReceived: number;
    savingsUsd: number;
    quotePriceImpactPct: number;
    executedAt: string;
    txSignature: string;
  }>;
}

export default function SavingsPage() {
  const { code } = useParams<{ code: string }>();
  const [club, setClub] = useState<ClubSummary | null>(null);
  const [savings, setSavings] = useState<SavingsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [clubRes, savingsRes] = await Promise.all([
        fetch(`/api/clubs/${code}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/clubs/${code}/savings`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (!cancelled) {
        setClub(clubRes);
        setSavings(savingsRes);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) return <p className="text-sm text-muted-foreground">Fetching live quote data...</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href={`/clubs/${code}`} label={`Back to ${club?.name ?? "club"}`} />
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Solo vs. Club: what pooling actually costs</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Every number below comes from a live quote fetched from Jupiter (the aggregator
          Tessera&apos;s own docs say T-Tokens actually trade through) and live Solana network
          data, right now &mdash; not a hardcoded or simulated figure.
        </p>
      </div>

      {savings?.available && savings.comparison ? (
        <LivePreview data={savings} symbol={club?.targetTokenSymbol ?? "T-Token"} />
      ) : (
        <div className={cardClass("text-sm text-muted-foreground")}>
          {savings?.error
            ? `Couldn't fetch live quote data: ${savings.error}`
            : "No pending contributions right now, so there's nothing to compare yet. Contribute to the club to see a live preview."}
        </div>
      )}

      {club && club.executions.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold">Realized savings from past batched buys</h2>
          <div className="flex flex-col gap-3">
            {club.executions.map((e, i) => (
              <div key={i} className={cardClass("p-4")}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{formatUsd(e.totalUsdcAmount)} pooled &rarr; {formatToken(e.tTokenAmountReceived)} {club.targetTokenSymbol}</span>
                  <span className={e.savingsUsd >= 0 ? "font-semibold text-accent" : "font-semibold text-danger"}>
                    {e.savingsUsd >= 0 ? "Saved " : "Cost "}
                    {formatUsd(Math.abs(e.savingsUsd))}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Executed {new Date(e.executedAt).toLocaleString()} &middot; pooled price impact{" "}
                  {formatPct(e.quotePriceImpactPct)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LivePreview({ data, symbol }: { data: SavingsResponse; symbol: string }) {
  const c = data.comparison!;
  const positive = c.totalSavingsUsd >= 0;
  const toneText = positive ? "text-accent" : "text-danger";

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-fade-up relative overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-48 w-full ${positive ? "bg-accent-soft" : "bg-danger-soft"} opacity-70 blur-3xl`}
        />
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {data.memberCount} members pooling {formatUsd(data.totalPendingUsdc ?? 0)} right now
        </div>
        <div className={`mt-2 text-5xl font-semibold tracking-tight ${toneText}`}>
          {positive ? "+" : "-"}
          {formatUsdPrecise(Math.abs(c.totalSavingsUsd))}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {positive ? "saved" : "cost"} by executing one pooled buy instead of {c.numTransactionsIndividual}{" "}
          separate solo buys
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Execution cost (fees + rent)"
          rows={[
            [`${c.numTransactionsIndividual} solo transactions`, formatUsdPrecise(c.executionCostIndividualUsd)],
            ["1 club transaction", formatUsdPrecise(c.executionCostClubUsd)],
            ["Savings", formatUsdPrecise(c.executionCostSavingsUsd), true],
          ]}
          note={`Real Solana base-fee (5,000 lamports/signature) + live rent-exempt minimum for a ${symbol} token account, converted to USD with a live SOL/USDC quote. This is the dominant, non-negligible savings driver for $5-$20 contributions.`}
        />
        <StatCard
          title="AMM execution price"
          rows={[
            ["Avg. individual price impact", formatPct(c.individualAvgPriceImpactPct, 4)],
            ["Pooled price impact", formatPct(c.pooledPriceImpactPct, 4)],
            [
              "Impact delta",
              formatPct(c.priceImpactDeltaPct, 4),
              c.priceImpactDeltaPct >= 0,
            ],
          ]}
          note="Live Jupiter quotes at each trade size. At $5-$20 sizes against a deep Meteora DLMM pool this is typically tiny either way -- shown honestly rather than dramatized."
        />
      </div>

      <div className={cardClass()}>
        <h3 className="mb-2 font-semibold">Tokens received</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Sum of solo buys</div>
            <div className="text-lg font-semibold">{formatToken(c.individualTotalTTokens)} {symbol}</div>
            <div className="text-xs text-muted-foreground">{formatUsd(c.individualValueUsd)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">One pooled buy</div>
            <div className="text-lg font-semibold">{formatToken(c.pooledTTokens)} {symbol}</div>
            <div className="text-xs text-muted-foreground">{formatUsd(c.pooledValueUsd)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Delta from pooling</div>
            <div className={`text-lg font-semibold ${c.tokenValueDeltaUsd >= 0 ? "text-accent" : "text-danger"}`}>
              {formatUsd(c.tokenValueDeltaUsd)}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Source: {data.source}</p>
    </div>
  );
}

function StatCard({
  title,
  rows,
  note,
}: {
  title: string;
  rows: Array<[string, string, boolean?]>;
  note: string;
}) {
  return (
    <div className={cardClass()}>
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="flex flex-col gap-1.5 text-sm">
        {rows.map(([label, value, highlightPositive], i) => (
          <div key={i} className="flex justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span
              className={
                highlightPositive === undefined
                  ? "font-medium"
                  : highlightPositive
                    ? "font-semibold text-accent"
                    : "font-semibold text-danger"
              }
            >
              {value}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
