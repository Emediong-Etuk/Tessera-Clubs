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

```bash
npm install
cp .env.local.example .env.local
# Generate an encryption key and paste it into .env.local:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Also copy DATABASE_URL into a plain `.env` file for the Prisma CLI:
echo 'DATABASE_URL="file:./dev.db"' > .env

npx prisma migrate dev --name init
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

Built to the Tier 1 "must have" list: wallet connect, token discovery,
create/join clubs via invite link, on-chain-verified contributions, a club
dashboard with pooled totals and member shares, a manual batched-buy
trigger, proportional position calculation, the live solo-vs-club savings
screen, an exit flow with USDC-or-T-Token payout choice, and transaction
history with Solana Explorer links.

Explicitly cut (per the original scope): a Tessera-side bonding-curve
market feature, public club discovery/marketplace, leaderboards, chat,
governance, NFT badges, yield strategies, and scheduled/automatic batch
buys (the buy button is manually triggered by design).

## Deployment

The spec's default target was Vercel, with an explicit instruction to
verify that works before committing to it. It doesn't, as-is: Vercel's
serverless functions run on ephemeral, non-shared filesystems, so a
file-based SQLite database (via Prisma) will not reliably persist
contributions between requests -- different invocations can land on
different containers with no shared disk. Signing with the decrypted club
keypair itself is fine on Vercel (it's done per-request, not from a kept-
warm process), but the database is the blocker.

Two ways to actually ship this:
1. **Keep Vercel, swap the database.** Point `DATABASE_URL` at a hosted
   Postgres (Neon, Supabase, Vercel Postgres) and change the Prisma
   `datasource provider` to `postgresql`. Schema and app code don't
   otherwise change.
2. **Skip Vercel.** Deploy the whole app (Next.js + SQLite file) to a
   single persistent instance -- Render, Fly.io, or a small VPS -- where
   the filesystem actually persists between requests.

For a hackathon demo timeline, option 2 is faster: zero schema changes,
and the SQLite file just needs to live on a persistent disk/volume.

## Testing

```bash
npm run test   # vitest: calculateProportionalShares + computeSavingsComparison
npm run lint
npm run build
```

The math tests include a case built directly from real Jupiter quotes
pulled for T-OpenAI, asserting that execution-cost savings dominate when
AMM price impact is (realistically) flat at small trade sizes.
