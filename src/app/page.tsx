import { Suspense } from "react";
import { getTesseraTokens } from "@/lib/tessera";
import { TokenPriceGrid } from "@/components/TokenPriceGrid";
import { NavLink } from "@/components/NavLink";
import { badgeClass, buttonClass, cardClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="flex flex-col gap-20">
      <section className="relative flex flex-col gap-6 overflow-hidden pt-6 text-center sm:pt-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 -z-10 mx-auto h-72 w-[36rem] rounded-full bg-accent-soft opacity-60 blur-3xl"
        />
        <p className={`animate-fade-up mx-auto ${badgeClass("accent")}`}>
          Tessera &quot;Private Equities for Everyone&quot; hackathon
        </p>
        <h1
          className="animate-fade-up mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ animationDelay: "80ms" }}
        >
          Pool a few dollars each. Buy in one shot.
        </h1>
        <p
          className="animate-fade-up mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground"
          style={{ animationDelay: "140ms" }}
        >
          Tessera Clubs aggregate small buyers into a single on-chain position, giving anyone
          access to efficient recurring exposure to pre-IPO T-Tokens.
        </p>
        <div
          className="animate-fade-up flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "200ms" }}
        >
          <NavLink href="/clubs/new" className={buttonClass("primary", "lg")}>
            Create a club
          </NavLink>
          <NavLink href="/clubs/join" className={buttonClass("secondary", "lg")}>
            Join with an invite code
          </NavLink>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Live T-Token prices, from Tessera&apos;s public token-details API
        </h2>
        {/* The hero above and its buttons render and hydrate immediately;
            only this section waits on Tessera's (occasionally slow/flaky)
            API, so a slow token-price fetch can no longer delay the whole
            page -- including making the nav buttons feel unresponsive. */}
        <Suspense fallback={<TokenGridSkeleton />}>
          <TokenPriceSection />
        </Suspense>
      </section>

      <section className="grid gap-5 sm:grid-cols-4">
        {[
          ["1", "Create or join a club", "Pool $5-$20 each toward one T-Token."],
          ["2", "Watch the pool fill up", "Everyone's contribution and share is on-chain and transparent."],
          ["3", "One batched buy", "The club executes a single swap for the full pooled amount."],
          ["4", "See the real savings", "Compare it to buying solo, using live quote data -- not a guess."],
        ].map(([n, title, body]) => (
          <div key={n} className={cardClass()}>
            <div className="mb-2 text-2xl font-semibold text-accent">{n}</div>
            <div className="mb-1 font-semibold">{title}</div>
            <div className="text-sm text-muted-foreground">{body}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

async function TokenPriceSection() {
  let tokens: Awaited<ReturnType<typeof getTesseraTokens>> = [];
  let fetchError: string | null = null;
  try {
    tokens = await getTesseraTokens();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Could not reach Tessera's API";
  }
  return <TokenPriceGrid initialTokens={tokens} initialError={fetchError} />;
}

function TokenGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-border bg-surface-muted" />
      ))}
    </div>
  );
}
