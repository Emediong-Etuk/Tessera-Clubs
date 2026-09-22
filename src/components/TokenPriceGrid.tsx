"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { TokenOverview } from "@/lib/tokenOverview";
import { KNOWN_TESSERA_TOKENS } from "@/lib/tessera";
import { badgeClass, cardClass } from "@/lib/ui";

// Keeps prices genuinely live while the page is open: polls every 30s
// regardless of success/failure, so it self-heals from a transient error
// (Tessera's API has been observed to 500 intermittently) without the
// visitor doing anything, and reflects real, moving Jupiter market data
// rather than a single fetch frozen at page-load time.
const POLL_INTERVAL_MS = 30_000;

export function TokenPriceGrid({
  initialTokens,
  initialError,
}: {
  initialTokens: TokenOverview[];
  initialError: string | null;
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  // Starts null on both server and client (never `new Date()` in the
  // initializer, which would differ between the server-rendered and
  // client-hydrated pass and trigger a hydration mismatch); set for real
  // once mounted.
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!initialError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount-time timestamp, not a render loop
      setLastUpdated(new Date());
    }
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only ever needs to run once, on mount
  }, []);

  useEffect(() => {
    async function poll() {
      if (!mountedRef.current) return;
      setRefreshing(true);
      try {
        const res = await fetch("/api/tokens", { cache: "no-store" });
        const data = await res.json();
        if (!mountedRef.current) return;
        if (res.ok && data.tokens) {
          setTokens(data.tokens);
          setError(null);
          setLastUpdated(new Date());
        } else {
          setError(data.error ?? "Live price sources are currently unavailable");
        }
      } catch {
        if (mountedRef.current) setError("Live price sources are currently unavailable");
      } finally {
        if (mountedRef.current) setRefreshing(false);
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${refreshing ? "animate-pulse bg-accent" : "bg-accent/50"}`} aria-hidden />
        {lastUpdated
          ? `Updated ${lastUpdated.toLocaleTimeString()} · refreshes automatically every 30s`
          : "Waiting for a live price update..."}
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          <p>
            Couldn&apos;t reach live price data right now ({error}). Known mints:{" "}
            {Object.entries(KNOWN_TESSERA_TOKENS)
              .map(([sym, mint]) => `${sym} (${mint.slice(0, 6)}...)`)
              .join(", ")}
          </p>
          <p className="mt-2 text-xs opacity-90">Will keep retrying automatically every 30s.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {tokens.map((t) => (
          <div key={t.mint} className={cardClass("hover:-translate-y-0.5")}>
            <div className="mb-3 flex items-center gap-3">
              {t.icon ? (
                <Image
                  src={t.icon}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 shrink-0 rounded-full bg-surface-muted object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-muted-foreground">
                  {t.symbol.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold">${t.symbol}</div>
                <div className="truncate text-xs text-muted-foreground">{t.name}</div>
              </div>
            </div>

            {t.sector && <span className={badgeClass("neutral", "mb-3")}>{t.sector}</span>}

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight">
                {t.usdPrice.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}
              </span>
              {t.priceChange24h !== null && (
                <span className={`text-xs font-medium ${t.priceChange24h >= 0 ? "text-accent" : "text-danger"}`}>
                  {t.priceChange24h >= 0 ? "+" : ""}
                  {t.priceChange24h.toFixed(2)}% (24h)
                </span>
              )}
            </div>
            {t.holders !== null && (
              <div className="mt-1 text-xs text-muted-foreground">{t.holders.toLocaleString()} holders</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
