// Pure math for the two things that must never be wrong on stage:
// 1. Proportional share allocation (contribution % -> payout %)
// 2. The solo-vs-club savings comparison
//
// Both take already-fetched numbers as input (no network calls here) so
// they're cheap to unit test exhaustively. Callers (API routes) are
// responsible for sourcing those numbers from live Jupiter quotes / RPC
// calls -- see lib/jupiter.ts and lib/solana.ts.

import { SOLANA_BASE_FEE_LAMPORTS_PER_SIGNATURE } from "./solana";

export interface MemberContribution {
  membershipId: string;
  amountUsdc: number;
}

export interface ProportionalShare {
  membershipId: string;
  sharePct: number;
  tTokenAmount: number;
}

/**
 * Splits `totalTTokenAmount` across contributors in proportion to how
 * much USDC each put in. The last contributor absorbs the floating-point
 * remainder so the shares always sum to exactly `totalTTokenAmount`
 * (never more, never less) -- important because this runs against a real
 * on-chain balance that must be fully accounted for.
 */
export function calculateProportionalShares(
  contributions: MemberContribution[],
  totalTTokenAmount: number
): ProportionalShare[] {
  if (contributions.length === 0) return [];

  const totalUsdc = contributions.reduce((sum, c) => sum + c.amountUsdc, 0);
  if (totalUsdc <= 0) {
    return contributions.map((c) => ({ membershipId: c.membershipId, sharePct: 0, tTokenAmount: 0 }));
  }

  let allocated = 0;
  return contributions.map((c, i) => {
    const sharePct = c.amountUsdc / totalUsdc;
    const isLast = i === contributions.length - 1;
    const tTokenAmount = isLast
      ? Math.max(0, totalTTokenAmount - allocated)
      : roundToPrecision(sharePct * totalTTokenAmount, 9);
    if (!isLast) allocated += tTokenAmount;
    return { membershipId: c.membershipId, sharePct, tTokenAmount };
  });
}

function roundToPrecision(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// --- Solo vs. club savings comparison -----------------------------------

export interface QuoteLike {
  outAmount: string; // base units, as returned by Jupiter
  priceImpactPct: string; // decimal fraction string, e.g. "0.00198" = 0.198%
  swapUsdValue?: string;
}

export interface SavingsComparisonInput {
  /** One real Jupiter quote per member, each sized to that member's own contribution. */
  individualQuotes: QuoteLike[];
  /** One real Jupiter quote sized to the full pooled contribution total. */
  pooledQuote: QuoteLike;
  tTokenDecimals: number;
  /** Live SOL/USDC price so lamport costs can be shown in dollars. */
  solPriceUsd: number;
  /** Live rent-exempt minimum for a Token-2022 account of the target mint (lamports). */
  rentLamportsPerAccount: number;
  /** How many of the individual members would need to create a fresh token account to hold this T-Token on their own. */
  membersNeedingNewAta: number;
  /** Whether the club wallet itself needs a fresh token account (almost always true for a new club). */
  clubNeedsNewAta: boolean;
}

export interface SavingsComparisonResult {
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

function baseUnitsToAmount(baseUnits: string, decimals: number): number {
  return Number(BigInt(baseUnits)) / 10 ** decimals;
}

export function computeSavingsComparison(input: SavingsComparisonInput): SavingsComparisonResult {
  const {
    individualQuotes,
    pooledQuote,
    tTokenDecimals,
    solPriceUsd,
    rentLamportsPerAccount,
    membersNeedingNewAta,
    clubNeedsNewAta,
  } = input;

  const individualTotalTTokens = individualQuotes.reduce(
    (sum, q) => sum + baseUnitsToAmount(q.outAmount, tTokenDecimals),
    0
  );
  const pooledTTokens = baseUnitsToAmount(pooledQuote.outAmount, tTokenDecimals);

  const individualAvgPriceImpactPct =
    individualQuotes.length > 0
      ? (individualQuotes.reduce((sum, q) => sum + parseFloat(q.priceImpactPct), 0) /
          individualQuotes.length) *
        100
      : 0;
  const pooledPriceImpactPct = parseFloat(pooledQuote.priceImpactPct) * 100;

  const individualValueUsd = individualQuotes.reduce(
    (sum, q) => sum + parseFloat(q.swapUsdValue ?? "0"),
    0
  );
  const pooledValueUsd = parseFloat(pooledQuote.swapUsdValue ?? "0");

  const solLamportToUsd = (lamports: number) => (lamports / 1e9) * solPriceUsd;
  const baseFeeUsd = solLamportToUsd(SOLANA_BASE_FEE_LAMPORTS_PER_SIGNATURE);
  const rentUsd = solLamportToUsd(rentLamportsPerAccount);

  const numTransactionsIndividual = individualQuotes.length;
  const numTransactionsClub = 1;

  const executionCostIndividualUsd =
    numTransactionsIndividual * baseFeeUsd + membersNeedingNewAta * rentUsd;
  const executionCostClubUsd = numTransactionsClub * baseFeeUsd + (clubNeedsNewAta ? rentUsd : 0);

  const executionCostSavingsUsd = executionCostIndividualUsd - executionCostClubUsd;
  const tokenValueDeltaUsd = pooledValueUsd - individualValueUsd;

  return {
    individualTotalTTokens,
    pooledTTokens,
    tTokenDeltaFromPooling: pooledTTokens - individualTotalTTokens,
    individualAvgPriceImpactPct,
    pooledPriceImpactPct,
    priceImpactDeltaPct: individualAvgPriceImpactPct - pooledPriceImpactPct,
    individualValueUsd,
    pooledValueUsd,
    tokenValueDeltaUsd,
    executionCostIndividualUsd,
    executionCostClubUsd,
    executionCostSavingsUsd,
    totalSavingsUsd: executionCostSavingsUsd + tokenValueDeltaUsd,
    numTransactionsIndividual,
    numTransactionsClub,
  };
}
