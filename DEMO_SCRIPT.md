# Demo script (~3 minutes)

Positioning line to open with: **"Tessera Clubs aggregate small buyers
into a single on-chain position, giving anyone access to efficient
recurring exposure to pre-IPO T-Tokens."**

Prep beforehand: 2-3 browser wallets (Phantom/Solflare) funded with a
trivial amount of SOL (fees) and USDC ($5-$20 each) on mainnet-beta.

**Also fund the club wallet itself, separately, after creating the club.**
It only ever receives USDC from contributions -- nothing tops up its SOL
automatically, but it's the signer that pays for both the batched-buy
swap and every exit payout. The dashboard shows its live SOL balance
right under the club wallet address and warns in-app when it's too low;
send it ~0.02-0.05 SOL directly (any wallet, right after creating the
club, before clicking "Buy") so that step doesn't stall live.

1. **(0:00-0:20) Create the club.** Connect Wallet A. "I have $20 and I
   want exposure to T-OpenAI, but $20 alone gets crushed by fees relative
   to the position size." Click **Create a club**, name it "OpenAI
   Builders Club", pick T-OpenAI, set a $40 funding goal, submit.

2. **(0:20-0:50) Others join.** Copy the invite link. Switch to Wallet B
   and C (or just narrate switching), open the link, connect, and each
   sends a $10-$15 USDC contribution from the dashboard. Point out: every
   contribution is a real signed transaction, verified on-chain by the
   backend (not just trusted), and the pooled total updates live.

3. **(0:50-1:10) Show the pool.** Back on the dashboard: pooled total,
   funding-goal progress bar, member table with each wallet's contribution
   and live-computed share percentage.

4. **(1:10-1:30) Execute the batched buy.** Click **Buy T-OpenAI with
   pooled funds**. This fires exactly one swap, routed through Jupiter
   against the real Meteora pool T-OpenAI actually trades on. Show the
   resulting transaction on Solana Explorer.

5. **(1:30-1:40) Proportional shares appear.** Refresh the member table:
   each wallet now shows its estimated T-OpenAI holding, computed
   proportionally from contribution size against the real amount the club
   wallet received.

6. **(1:40-2:30) THE KEY SCREEN.** Click through to the savings comparison.
   Walk through it top to bottom:
   - The big number: total dollar savings from pooling into one execution.
   - "Execution cost" card: N solo transactions + N token-account rents,
     vs. 1 of each for the club -- built from a live Solana rent-exemption
     RPC call and a live SOL/USDC quote, not a guess.
   - "AMM execution price" card: say it plainly -- at $10-$40 sizes
     against a deep pool, price impact barely moves, and the screen shows
     that real (small) number instead of pretending it's dramatic. The
     real, defensible win is the fixed-cost savings above.
   - Everything is labeled with its live data source.

7. **(2:30-2:50) Exit flow.** One member clicks **Leave club**, chooses a
   USDC payout, confirms. Show the resulting transaction and the updated
   member table (marked "exited").

8. **(2:50-3:00) Close.** Point at the persistent custodial-model banner:
   "This is a hackathon MVP -- funds sit in a server-held wallet today, not
   a trustless vault. Wiring in an on-chain escrow program is the next
   step, but every price, swap, and savings number you just saw is real
   live data, not a simulation."

## If something breaks live

- **RPC rate limit:** switch `SOLANA_RPC_URL` to a paid provider before
  the demo; the public mainnet-beta endpoint throttles quickly under
  parallel quote calls.
- **Jupiter quote fails for a tiny amount:** raise the demo contribution
  sizes slightly ($15-$20) -- some routes reject dust-sized trades.
- **A wallet lacks SOL for fees:** keep a small SOL buffer (~0.02 SOL) in
  every demo wallet in addition to the USDC contribution amount.
