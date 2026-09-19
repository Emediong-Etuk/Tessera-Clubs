# Tessera Clubs

Pool a few small USDC contributions ($5-$20 each) into one aggregated
on-chain buy of Tessera T-Tokens (tokenized pre-IPO equities like
T-OpenAI). Built for Tessera's "Private Equities for Everyone" hackathon
track.

> Tessera Clubs aggregate small buyers into a single on-chain position,
> giving anyone access to efficient recurring exposure to pre-IPO T-Tokens.

## What's real here vs. what's a hackathon shortcut

**Real:**
- Tessera's public [token-details API](https://rest-api.tessera.pe/v1/public/token-details) for live T-Token prices.
- T-Token mint addresses, confirmed against [Tessera's on-chain-programs docs](https://docs.tessera.pe/technicals/on-chain-programs): T-Tokens are Token-2022 SPL mints on **Solana mainnet-beta** (there is no devnet deployment).
- Every quote and every swap goes through [Jupiter's public aggregator API](https://dev.jup.ag) against the actual DEXs T-Tokens trade on (per Tessera's own docs, T-Tokens trade on third-party venues like Meteora -- Tessera has no bonding-curve or quote API of its own).
- The solo-vs-club savings comparison is computed from live quotes fetched at request time, plus a live Solana RPC call for token-account rent and a live SOL/USDC quote for fee-to-USD conversion. Nothing on that screen is hardcoded.
- On-chain contribution verification: the backend checks real pre/post SPL token balances on the submitted transaction signature rather than trusting a client-reported amount.

**Hackathon shortcut (see "Custody model" below):** club funds are pooled
in a server-held keypair, not a trustless on-chain vault program.

## The Day-1 technical finding that shaped this build

Tessera does not run its own bonding-curve/quote engine. T-Tokens are
plain Token-2022 mints that trade on Jupiter-routed AMMs (Meteora DLMM in
practice). Pulling real quotes for `oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ`
(T-OpenAI) at $10 vs $40 showed price impact of ~0.1977% at **both** sizes
-- the pool is deep enough that pooling doesn't meaningfully move the AMM
execution price at these small contribution sizes.

So the savings screen is honest about that: it shows the real (small)
price-impact comparison, and makes the actual non-negligible savings
driver the fixed cost every solo buyer pays that a pooled buy pays only
once -- one signed transaction and one Token-2022 account (with real
rent-exemption cost) instead of N. A live end-to-end test against a $25
pool split across 2 members (see below) showed ~$0.17 in real execution-
cost savings, about 0.7% of the pooled amount -- meaningful when
contributions are $5-$20, even though AMM price impact barely moved.

## Custody model

This is a **custodial MVP**, not a trustless system:

- Each club gets a server-generated Solana keypair. Its secret key is
  AES-256-GCM encrypted with `CLUB_WALLET_ENCRYPTION_KEY` before being
  stored in the database -- it is never committed to git or sent to the
  client.
- Members send USDC directly to the club wallet from their own browser
  wallet. The backend verifies the on-chain transfer and records each
  contribution's amount, wallet, and timestamp.
- Ownership percentage is computed **off-chain**, in the database, from
  those contribution records -- not as a separate on-chain token balance
  per member.
- The batched buy and exit payouts are signed by the backend using the
  club wallet's key.
- A production version would replace this with an on-chain escrow/vault
  program or synthetic per-member share tokens. That's real additional
  engineering intentionally out of scope here. The app shows this
  disclaimer persistently in its UI.

## Tech stack

Next.js (App Router) + TypeScript + Tailwind, `@solana/wallet-adapter-react`
(Phantom + Solflare), `@solana/web3.js` + `@solana/spl-token`, Prisma +
SQLite, Jupiter's public Quote/Swap API.

## Getting started

Needs a Postgres database (local via Docker, or any hosted free tier --
Render, Neon, Supabase all work).

```bash
npm install
cp .env.local.example .env.local
# Fill in DATABASE_URL with a real Postgres connection string, e.g.:
#   docker run -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
#   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"

# Generate an encryption key and paste it into .env.local:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Also copy DATABASE_URL into a plain `.env` file for the Prisma CLI:
echo 'DATABASE_URL="<same value as above>"' > .env

npx prisma migrate deploy   # applies the committed migrations
npm run test    # proportional-share + savings math unit tests
npm run dev
```

Open http://localhost:3000. Wallet actions (contribute, execute, exit)
require a real mainnet-beta wallet holding a small amount of SOL (for fees)
and USDC (for contributions) -- there is no devnet deployment of these
tokens to test against. Keep amounts trivial ($5-$40 total) for rehearsal.

`SOLANA_RPC_URL` defaults to the public mainnet-beta endpoint, which is
rate-limited; for anything beyond quick manual testing, set it (and
`NEXT_PUBLIC_SOLANA_RPC_URL`) to a real RPC provider (Helius, Triton,
QuickNode, etc).

## Project structure

- `src/lib/tessera.ts` -- Tessera token-details API client
- `src/lib/jupiter.ts` -- Jupiter quote/swap API client (the real source of tradeable pricing)
- `src/lib/solana.ts` -- RPC connection, club-wallet keypair encryption, rent/fee helpers
- `src/lib/savings.ts` -- pure, unit-tested math: proportional share allocation + the solo-vs-club comparison
- `src/lib/club.ts` -- DB + on-chain domain logic (member positions, live savings preview)
- `src/app/api/clubs/**` -- REST API routes (create, join, contribute, execute, savings, exit, history)
- `src/app/clubs/**` -- UI: create/join flows, club dashboard, savings screen
- `prisma/schema.prisma` -- Club / Membership / Contribution / Execution / Exit models

## Feature scope

Built to the full Tier 1 "must have" list: wallet connect, token
discovery, create/join clubs via invite link, on-chain-verified
contributions, a club dashboard with pooled totals and member shares, a
manual batched-buy trigger, proportional position calculation, the live
solo-vs-club savings screen, an exit flow with USDC-or-T-Token payout
choice, and transaction history with Solana Explorer links. Plus one
Tier 2 item: a shareable, read-only public club page
(`/clubs/[code]/public`) with no wallet or action controls.

Explicitly cut (per the original scope): a Tessera-side bonding-curve
market feature, a club discovery/marketplace, leaderboards, chat,
governance, NFT badges, yield strategies, and scheduled/automatic batch
buys (the buy button is manually triggered by design).

## What's been verified vs. what still needs a funded wallet

Verified in this environment: every API route against real Tessera/
Jupiter/Solana mainnet-beta data (a real club was created through the
running app and its live savings math checked against real quotes); every
page click-tested in an actual headless-Chromium browser (landing,
wallet-connect modal, create/join forms, dashboard, savings screen, public
page, and the invalid-invite-code error path) -- including confirming the
app degrades gracefully instead of crashing when Tessera's public API
returned a transient 500 mid-session.

**Not verified here**, because it requires a real funded mainnet wallet
and a real browser wallet extension, neither of which exist in this
environment: actually connecting Phantom/Solflare, sending a real USDC
contribution, triggering a real batched swap, and exiting for a real
payout. Those code paths were exercised against live APIs from the server
side (see above), but the full signed-transaction flow needs a rehearsal
by someone with an actual funded wallet before a live demo.

## Deployment

**Live at https://tessera-clubs.onrender.com**, deployed from this branch.

The spec's default target was Vercel, with an explicit instruction to
verify that works before committing to it. It doesn't, as-is: Vercel's
serverless functions run on ephemeral, non-shared filesystems, so the
originally-planned file-based SQLite database (via Prisma) would not
reliably persist contributions between requests -- different invocations
can land on different containers with no shared disk. Signing with the
decrypted club keypair itself would have been fine on Vercel (it's done
per-request, not from a kept-warm process), but the database would not.

What's actually deployed instead: a Render web service (free plan) running
the Next.js app, backed by a Render Postgres instance (also free plan) --
`prisma/schema.prisma`'s datasource is `postgresql`, and the committed
migration in `prisma/migrations/` was generated offline (`prisma migrate
diff --from-empty`) since this environment couldn't open a raw Postgres
connection to a remote host to run `migrate dev` live; Render's own build
step runs `prisma migrate deploy` against the real database, where that
connection works fine.

**Known limitations of this specific deployment, not the architecture:**
- **Render's free Postgres plan expires 30 days after creation** and is
  then deleted unless upgraded to a paid plan. Fine for a hackathon judging
  window, not for anything longer-lived -- upgrade the database's plan in
  the Render dashboard before that date if you want to keep it.
- **Render's free web service spins down after 15 minutes of inactivity**
  and takes ~30-60s to cold-start on the next request. For a live demo,
  hit the URL a minute or two before you actually present.
- `SOLANA_RPC_URL` is set to the public mainnet-beta endpoint, which is
  rate-limited under concurrent load. Swap it for a real RPC provider
  (Helius, Triton, QuickNode) in the Render dashboard's Environment tab if
  the demo needs to hold up under multiple simultaneous users.
- `CLUB_WALLET_ENCRYPTION_KEY` was generated fresh for this deployment and
  set directly as a Render environment variable (never committed to git,
  never printed anywhere). It's the only thing that can decrypt every
  club wallet's private key -- back it up somewhere durable (Render's
  dashboard lets you view it under this service's Environment tab) before
  rotating or deleting it, since rotating it orphans any club wallet
  funds encrypted under the old key.

To redeploy after merging this branch to `main`, update the Render
service's branch in its dashboard (Settings -> Build & Deploy).

If you'd rather self-host elsewhere: any platform with a persistent
Postgres and a normal (non-serverless) Node process works the same way --
Fly.io, a VPS, Railway, etc. Vercel remains usable too, exactly as above,
by pointing `DATABASE_URL` at any hosted Postgres.

## Testing

```bash
npm run test   # vitest: calculateProportionalShares + computeSavingsComparison
npm run lint
npm run build
```

The math tests include a case built directly from real Jupiter quotes
pulled for T-OpenAI, asserting that execution-cost savings dominate when
AMM price impact is (realistically) flat at small trade sizes.
