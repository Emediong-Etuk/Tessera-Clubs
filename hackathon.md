# Hackathon log

- **Project:** Housefile
- **Event:** Convex All Gas Hackathon
- **What it does:** Gives a short-term-rental property a memory — imports a listing, lets the host add the private facts guests actually ask about, and answers guest questions from that property file, only citing what it truly knows and learning from the host's corrections.
- **Live app:** not deployed (Convex backend is live at https://nautical-oyster-722.convex.site; frontend not deployed there yet)
- **Repo:** https://github.com/Emediong-Etuk/Tessera-Clubs
- **Frontend:** Convex static hosting
- **Convex deployment:** https://nautical-oyster-722.convex.cloud (dev)
- **Components:** none
- **Convex features:** schema (listings, faqs, stays, drafts, opsMessages, agentmailInboxes) with indexes, queries, mutations, actions, an HTTP action webhook (`convex/http.ts`), scheduled functions (`ctx.scheduler.runAfter`), typed env vars (`convex/convex.config.ts`), realtime `useQuery` on the frontend
- **Auth:** none
- **AI models:** gpt-4o-mini (default, configurable via `OPENAI_MODEL`; called directly via the OpenAI API, not yet exercised live — `OPENAI_API_KEY`/`FIRECRAWL_API_KEY` not set)
- **Started:** 2026-09-19T18:49:14Z
- **Last updated:** 2026-09-21T17:45:41Z

## Log

### 2026-09-19 - 4a9dc06
Repository initialized (Next.js/TypeScript scaffold).

### 2026-09-19 - f8c46ad
Built the Tessera Clubs MVP: club creation/join flow, a club dashboard, and a
savings comparison page for pooled vs. solo T-Token buys. Added the Solana
wallet provider wiring, Jupiter quote helpers, and the pooled-buy savings math
with its own test suite (`src/lib/savings.ts`, `src/lib/jupiter.ts`,
`src/lib/solana.ts`, `src/app/clubs/[code]/page.tsx`,
`src/lib/__tests__/savings.test.ts`).

### 2026-09-19 - 3f3e512
Added a public, read-only club page so a club's status can be shared without
requiring the viewer to connect a wallet, and verified the full flow in a
real browser (`src/app/clubs/[code]/public/page.tsx`).

### 2026-09-19 - c9f02a8
Switched the database from the initial setup to Postgres and deployed the app
live to Render (new Prisma migration, `package.json`, `.npmrc`,
`prisma/schema.prisma`).

### 2026-09-19 - 83246d9
Surfaced the club's on-chain wallet SOL balance on the club dashboard
(`src/lib/solana.ts`, `src/app/clubs/[code]/page.tsx`).

### 2026-09-19 - 3e8241a
Added a live T-Token price grid to the landing page with automatic retry on
failed price fetches (`src/components/TokenPriceGrid.tsx`).

### 2026-09-19 - 1aacebf
Fixed slow-feeling navigation and added a back link on every page for
smoother browsing (`src/components/BackLink.tsx`,
`src/components/NavLink.tsx`, `src/components/SiteHeader.tsx`).

### 2026-09-21 - working tree
Repurposed this repo for the Convex All Gas Hackathon as **Housefile**, a
property-knowledge layer for solo short-term-rental hosts: a listing is
imported (Firecrawl + OpenAI) into a per-property file, guest questions are
answered only from facts the file actually contains (grounded, cited, no
invented door codes or policies), and a host's answer to a flagged question
teaches the file for next time. Scope for the hackathon build is Import →
Complete → Create stay → Ask → Learn, with AgentMail as the operations
inbox and analytics (coverage %, question debt) reduced to a demo-only
stub. The prior Tessera Clubs (Solana T-Token club-buying) code and its
Render deployment remain in the repo but are no longer the active build.

### 2026-09-21 - working tree
Installed the `convex` package and added `convex/schema.ts` defining the
four core tables: `listings` (the property file: seed facts, private
facts, learned FAQs, readiness), `stays` (per-guest stay with door-code/
parking/wifi overrides and a shareable slug), `drafts` (a guest question,
its grounded reply with citations, confidence, and flag/approve status),
and `opsMessages` (AgentMail inbound/outbound log). Indexed by host,
listing, stay, slug, and status for every read path the app will need.
Type-checks cleanly (`tsc --noEmit`). Not yet linked to a live Convex
deployment — `npx convex dev` needs an interactive browser login this
session can't complete.

### 2026-09-21 - working tree
Moved `faqs` out of `listings` into its own table with a `by_listing`
index (an unbounded array field on a document is a Convex anti-pattern),
added typed env vars for `OPENAI_API_KEY`/`OPENAI_MODEL`/
`FIRECRAWL_API_KEY` (`convex/convex.config.ts`), and started a local
anonymous Convex dev deployment (`CONVEX_AGENT_MODE=anonymous`) so the
schema could actually push and codegen, since a real login still needs
the host. Wrote and pushed the full Import → Complete → Create stay →
Ask → Learn backend:
- `convex/listings.ts` — create from import, per-host list, private-facts
  completion with live readiness tracking, apply a learned fact.
- `convex/faqs.ts`, `convex/stays.ts` — FAQ storage; stay creation with a
  unique shareable slug and per-stay door-code/parking/wifi overrides.
- `convex/importListing.ts` (action) — Firecrawl scrape → OpenAI
  extraction → `listings.createFromImport`.
- `convex/answerQuestion.ts` (action) — grounds a guest question in the
  listing's seed/private facts/stay overrides/learned FAQs; enforces
  "no source, no sendable answer" by flagging instead of guessing.
- `convex/learn.ts` (action) + `drafts.approveLearnedPatch` — turns a
  host's freeform answer to a flagged question into a proposed fact, and
  on approval writes it into the listing and logs it as a learned FAQ.

Verified against the local dev backend end-to-end with `npx convex run`
(bypassing the two AI calls, which need `OPENAI_API_KEY`/
`FIRECRAWL_API_KEY` the host hasn't supplied yet): created a listing,
completed its private facts and watched readiness flip to ready, created
a stay with a working slug lookup, filed a flagged question, proposed and
approved a learned patch, and confirmed the fact landed in both the
listing and the FAQ log. Whole project type-checks clean.

### 2026-09-21 - working tree
Built the frontend: `/host` (paste-a-listing import form + property
list), `/host/[listingId]` (complete the required private facts with
live readiness, create stays with per-stay door-code/parking/wifi
overrides and a copyable link, an inbox to paste a guest question and
approve/edit/discard the grounded draft, and a "teach Housefile" flow for
flagged questions), and the public `/stays/[slug]` guest page. Gave
Housefile its own chrome (`AppChrome`) separate from the existing Tessera
Clubs wallet UI so the two products don't bleed into each other in the
same Next.js app, and wired a `ConvexClientProvider` at the root. No
accounts yet — a random id in `localStorage` (`src/lib/hostId.ts`) scopes
a browser to its own properties until real auth is added.

Verified in a real headless-Chromium session against the running dev
servers, not just `tsc`: `/host`'s import form submitted a URL and
surfaced the expected `FIRECRAWL_API_KEY is not set` error cleanly
instead of crashing; `/stays/oak-street-apartment-maya` rendered the
guest page end to end from real Convex data — stay-specific door code
and parking override, listing wifi, the quirk, and the "hair dryer"
fact and FAQ entry from the earlier learn-loop test — with nothing
invented for facts that weren't set. Whole project still type-checks
clean.

### 2026-09-21 - working tree
Added the thin AgentMail path: `convex/agentmail.ts` (`provisionInbox`
creates a dedicated inbox per listing plus a webhook scoped to it;
`sendApprovedReply` sends an approved draft back through AgentMail,
threaded to the original message), `convex/http.ts` (the webhook
receiver, verified against real AgentMail API docs pulled live —
`docs.agentmail.to/llms.txt` and the API reference pages — rather than
guessed from memory; the reference pages caught a real mistake, the
`/v0` path prefix the quickstart snippet omits), and
`convex/lib/svix.ts` (hand-rolled Svix signature verification via Web
Crypto, since the runtime is V8 not Node — no `svix` package). New
`agentmailInboxes` table keeps the webhook secret out of any public
query; a public `getAddressByListing` exposes only the address. Added
`convex/opsMessages.ts` (inbound/outbound log) and a best-effort
stay-by-guest-email match so an inbound email can ground a reply in
that guest's stay overrides. Frontend: an "Email inbox" section on
`/host/[listingId]` to provision the address, and drafts with
`channel: "email"` now show "Approve & send" (calls
`agentmail.sendApprovedReply`) instead of the plain approve mutation.

Verified what's verifiable without a real API key or a public URL:
`tsc` clean project-wide (this surfaced and fixed several
Convex-generated-API circularity errors — same-file type annotations
weren't enough once `http.ts` closed a reference cycle through
`_generated/api`); `provisionInbox` fails with the intended clear
`AGENTMAIL_API_KEY is not set` error rather than crashing, confirmed
both via `npx convex run` and live in the browser on
`/host/[listingId]`; `env.CONVEX_SITE_URL` confirmed populated (so the
webhook URL `provisionInbox` registers will resolve correctly once
deployed); and the Svix verification logic itself independently
tested against 5 cases (valid signature, tampered body, wrong secret,
expired timestamp, multi-signature header) — all passed against the
actual shipped `svix.ts`, not a copy. What's *not* verified: an actual
signed webhook delivery from AgentMail, since that needs a real API
key and a public HTTPS URL neither of which this environment has.

Deliberately not built (see PRD's own "Nice-to-Have"/"Explicitly Out of
Scope" sections): coverage-% and question-debt analytics, cleaner
workflows, and anything needing Airbnb/Vrbo OAuth or auto-send. The
Import → Complete → Create stay → Ask → Learn loop plus a real (if
untested-live) AgentMail path is the full built scope for this
hackathon window.

### 2026-09-21 - working tree
Logged into Convex for real (device-code flow — no local browser
needed) and provisioned an actual cloud project and dev deployment:
`emedionggregory12:housefile:dev`, live at
`https://nautical-oyster-722.convex.cloud` /
`https://nautical-oyster-722.convex.site`. Pushed the full schema and
every function to it — this repo is no longer running on the throwaway
local anonymous backend. Removed the disposable local `.convex/`
backend state and its stale `.env.local` once the real one replaced it.
`OPENAI_API_KEY`, `FIRECRAWL_API_KEY`, and `AGENTMAIL_API_KEY` are still
unset on this deployment — that, deploying the frontend to
`convex.site`, and a live end-to-end test are what's left before
submission.
