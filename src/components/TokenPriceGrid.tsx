"use client";

import { useEffect, useRef, useState } from "react";
import type { TesseraToken } from "@/lib/tessera";
import { KNOWN_TESSERA_TOKENS } from "@/lib/tessera";
import { formatUsd } from "@/lib/format";

// Tessera's public API is occasionally flaky (a transient 500, observed
// live during this project) -- when the initial server-rendered fetch
// hits that, retry client-side on a backoff instead of leaving the
// visitor stuck on an error message until they manually reload.
const RETRY_DELAYS_MS = [3000, 6000, 10000, 15000, 20000, 30000];

export function TokenPriceGrid({
  initialTokens,
  initialError,
}: {
  initialTokens: TesseraToken[];
  initialError: string | null;
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [error, setError] = useState(initialError);
  const [retrying, setRetrying] = useState(false);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!error) return;

    let cancelled = false;
    const delay = RETRY_DELAYS_MS[Math.min(attemptRef.current, RETRY_DELAYS_MS.length - 1)];

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setRetrying(true);
      try {
        const res = await fetch("/api/tokens", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.tokens) {
          setTokens(data.tokens);
          setError(null);
          attemptRef.current = 0;
        } else {
          attemptRef.current += 1;
          setError(data.error ?? "Tessera's API is still unavailable");
        }
      } catch {
        if (!cancelled) {
          attemptRef.current += 1;
          setError("Tessera's API is still unavailable");
        }
      } finally {
        if (!cancelled) setRetrying(false);
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Re-runs each time `error` changes (including staying an error, since
    // this effect re-sets it on failure), which is what drives the retry loop.
  }, [error]);

  async function retryNow() {
    setRetrying(true);
    try {
      const res = await fetch("/api/tokens", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.tokens) {
        setTokens(data.tokens);
        setError(null);
        attemptRef.current = 0;
      } else {
        setError(data.error ?? "Tessera's API is still unavailable");
      }
    } catch {
      setError("Tessera's API is still unavailable");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p>
            Couldn&apos;t reach Tessera&apos;s API right now ({error}). Known mints:{" "}
            {Object.entries(KNOWN_TESSERA_TOKENS)
              .map(([sym, mint]) => `${sym} (${mint.slice(0, 6)}...)`)
              .join(", ")}
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            {retrying ? "Retrying..." : "Will retry automatically."}
            <button onClick={retryNow} disabled={retrying} className="underline underline-offset-2 disabled:opacity-50">
              Retry now
            </button>
          </p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {tokens.map((t) => (
          <div
            key={t.mint}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{t.sector}</div>
            <div className="mb-3 text-lg font-semibold">{t.name}</div>
            <div className="text-2xl font-bold">{formatUsd(t.markPrice)}</div>
            <div className="mt-1 text-xs text-zinc-500">{t.holders.toLocaleString()} holders</div>
          </div>
        ))}
      </div>
    </div>
  );
}
