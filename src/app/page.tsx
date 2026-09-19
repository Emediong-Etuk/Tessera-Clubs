import Link from "next/link";
import { getTesseraTokens, KNOWN_TESSERA_TOKENS } from "@/lib/tessera";
import { formatUsd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  let tokens: Awaited<ReturnType<typeof getTesseraTokens>> = [];
  let fetchError: string | null = null;
  try {
    tokens = await getTesseraTokens();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Could not reach Tessera's API";
  }

  return (
    <div className="flex flex-col gap-16">
      <section className="flex flex-col gap-6 pt-6 text-center sm:pt-12">
        <p className="mx-auto inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Tessera &quot;Private Equities for Everyone&quot; hackathon
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Pool a few dollars each. Buy in one shot.
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Tessera Clubs aggregate small buyers into a single on-chain position, giving anyone
          access to efficient recurring exposure to pre-IPO T-Tokens.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/clubs/new"
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
          >
            Create a club
          </Link>
          <Link
            href="/clubs/join"
            className="rounded-lg border border-zinc-300 px-6 py-3 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Join with an invite code
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Live T-Token prices, from Tessera&apos;s public token-details API
        </h2>
        {fetchError && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            Couldn&apos;t reach Tessera&apos;s API right now ({fetchError}). Known mints:{" "}
            {Object.entries(KNOWN_TESSERA_TOKENS)
              .map(([sym, mint]) => `${sym} (${mint.slice(0, 6)}...)`)
              .join(", ")}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          {tokens.map((t) => (
            <div
              key={t.mint}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {t.sector}
              </div>
              <div className="mb-3 text-lg font-semibold">{t.name}</div>
              <div className="text-2xl font-bold">{formatUsd(t.markPrice)}</div>
              <div className="mt-1 text-xs text-zinc-500">{t.holders.toLocaleString()} holders</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-4">
        {[
          ["1", "Create or join a club", "Pool $5-$20 each toward one T-Token."],
          ["2", "Watch the pool fill up", "Everyone's contribution and share is on-chain and transparent."],
          ["3", "One batched buy", "The club executes a single swap for the full pooled amount."],
          ["4", "See the real savings", "Compare it to buying solo, using live quote data -- not a guess."],
        ].map(([n, title, body]) => (
          <div key={n} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <div className="mb-2 text-2xl font-bold text-zinc-400">{n}</div>
            <div className="mb-1 font-semibold">{title}</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">{body}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
