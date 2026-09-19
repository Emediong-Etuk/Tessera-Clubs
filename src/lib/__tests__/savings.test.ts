import { describe, expect, it } from "vitest";
import {
  calculateProportionalShares,
  computeSavingsComparison,
  type MemberContribution,
} from "../savings";

describe("calculateProportionalShares", () => {
  it("splits exactly in proportion to contribution for even splits", () => {
    const contributions: MemberContribution[] = [
      { membershipId: "a", amountUsdc: 10 },
      { membershipId: "b", amountUsdc: 10 },
    ];
    const shares = calculateProportionalShares(contributions, 20);
    expect(shares[0].sharePct).toBeCloseTo(0.5);
    expect(shares[1].sharePct).toBeCloseTo(0.5);
    expect(shares[0].tTokenAmount).toBeCloseTo(10);
    expect(shares[1].tTokenAmount).toBeCloseTo(10);
  });

  it("splits proportionally for uneven contributions ($5/$15/$20 -> 40 total)", () => {
    const contributions: MemberContribution[] = [
      { membershipId: "a", amountUsdc: 5 },
      { membershipId: "b", amountUsdc: 15 },
      { membershipId: "c", amountUsdc: 20 },
    ];
    const shares = calculateProportionalShares(contributions, 40);
    expect(shares[0].sharePct).toBeCloseTo(0.125);
    expect(shares[1].sharePct).toBeCloseTo(0.375);
    expect(shares[2].sharePct).toBeCloseTo(0.5);
    expect(shares[0].tTokenAmount).toBeCloseTo(5);
    expect(shares[1].tTokenAmount).toBeCloseTo(15);
    expect(shares[2].tTokenAmount).toBeCloseTo(20);
  });

  it("always sums to exactly the total received, never over- or under-allocating", () => {
    const contributions: MemberContribution[] = [
      { membershipId: "a", amountUsdc: 7.13 },
      { membershipId: "b", amountUsdc: 3.91 },
      { membershipId: "c", amountUsdc: 11.02 },
      { membershipId: "d", amountUsdc: 0.94 },
    ];
    const totalReceived = 123.456789;
    const shares = calculateProportionalShares(contributions, totalReceived);
    const sum = shares.reduce((s, x) => s + x.tTokenAmount, 0);
    expect(sum).toBeCloseTo(totalReceived, 9);
  });

  it("handles a single contributor by giving them the entire amount", () => {
    const shares = calculateProportionalShares(
      [{ membershipId: "solo", amountUsdc: 20 }],
      42.5
    );
    expect(shares).toHaveLength(1);
    expect(shares[0].sharePct).toBe(1);
    expect(shares[0].tTokenAmount).toBeCloseTo(42.5);
  });

  it("returns an empty array for no contributions", () => {
    expect(calculateProportionalShares([], 100)).toEqual([]);
  });

  it("returns zero shares (not NaN/Infinity) when total contributed is zero", () => {
    const shares = calculateProportionalShares(
      [
        { membershipId: "a", amountUsdc: 0 },
        { membershipId: "b", amountUsdc: 0 },
      ],
      0
    );
    expect(shares.every((s) => s.sharePct === 0 && s.tTokenAmount === 0)).toBe(true);
  });

  it("never allocates a negative amount even with floating point drift", () => {
    const contributions: MemberContribution[] = Array.from({ length: 7 }, (_, i) => ({
      membershipId: `m${i}`,
      amountUsdc: 1 / 3,
    }));
    const shares = calculateProportionalShares(contributions, 1);
    expect(shares.every((s) => s.tTokenAmount >= 0)).toBe(true);
  });
});

describe("computeSavingsComparison", () => {
  it("shows execution-cost savings dominate when AMM price impact is flat (the real Tessera/Jupiter case for tOpenAI)", () => {
    // Real quotes pulled live from Jupiter for tOpenAI: $10 and $40 both
    // show ~0.1977% price impact -- i.e. pooling doesn't meaningfully
    // change AMM execution price at these sizes. The honest savings
    // driver is fixed per-transaction cost (base fee + ATA rent).
    const result = computeSavingsComparison({
      individualQuotes: [
        { outAmount: "10139303", priceImpactPct: "0.0019768504658067129503262938", swapUsdValue: "9.997350164297880" },
        { outAmount: "10139303", priceImpactPct: "0.0019768504658067129503262938", swapUsdValue: "9.997350164297880" },
        { outAmount: "10139303", priceImpactPct: "0.0019768504658067129503262938", swapUsdValue: "9.997350164297880" },
        { outAmount: "10139303", priceImpactPct: "0.0019768504658067129503262938", swapUsdValue: "9.997350164297880" },
      ],
      pooledQuote: {
        outAmount: "40557218",
        priceImpactPct: "0.0019767028190972397952257336",
        swapUsdValue: "39.989400657191520",
      },
      tTokenDecimals: 6,
      solPriceUsd: 150,
      rentLamportsPerAccount: 2_039_280, // ~0.00203928 SOL, standard token account rent-exemption
      membersNeedingNewAta: 4,
      clubNeedsNewAta: true,
    });

    // Price impact is essentially identical either way (real data, not manufactured).
    expect(result.priceImpactDeltaPct).toBeCloseTo(0, 3);

    // But avoiding 3 extra token-account creations + transactions is real, positive USD savings.
    expect(result.executionCostIndividualUsd).toBeGreaterThan(result.executionCostClubUsd);
    expect(result.executionCostSavingsUsd).toBeGreaterThan(0);
    expect(result.numTransactionsIndividual).toBe(4);
    expect(result.numTransactionsClub).toBe(1);
    expect(result.totalSavingsUsd).toBeGreaterThan(0);
  });

  it("computes execution cost savings purely from tx count and ATA count deltas", () => {
    const flatQuote = { outAmount: "1000000", priceImpactPct: "0.001", swapUsdValue: "1" };
    const result = computeSavingsComparison({
      individualQuotes: [flatQuote, flatQuote],
      pooledQuote: { outAmount: "2000000", priceImpactPct: "0.001", swapUsdValue: "2" },
      tTokenDecimals: 6,
      solPriceUsd: 100,
      rentLamportsPerAccount: 2_000_000,
      membersNeedingNewAta: 2,
      clubNeedsNewAta: true,
    });

    const solToUsd = (lamports: number) => (lamports / 1e9) * 100;
    const baseFee = solToUsd(5000);
    const rent = solToUsd(2_000_000);
    const expectedIndividual = 2 * baseFee + 2 * rent;
    const expectedClub = 1 * baseFee + 1 * rent;

    expect(result.executionCostIndividualUsd).toBeCloseTo(expectedIndividual, 6);
    expect(result.executionCostClubUsd).toBeCloseTo(expectedClub, 6);
    expect(result.executionCostSavingsUsd).toBeCloseTo(expectedIndividual - expectedClub, 6);
  });

  it("does not fabricate token-value savings when the pooled trade actually receives fewer tokens", () => {
    const result = computeSavingsComparison({
      individualQuotes: [
        { outAmount: "5000000", priceImpactPct: "0.0001", swapUsdValue: "5" },
        { outAmount: "5000000", priceImpactPct: "0.0001", swapUsdValue: "5" },
      ],
      pooledQuote: { outAmount: "9990000", priceImpactPct: "0.002", swapUsdValue: "9.99" },
      tTokenDecimals: 6,
      solPriceUsd: 100,
      rentLamportsPerAccount: 2_000_000,
      membersNeedingNewAta: 0,
      clubNeedsNewAta: false,
    });
    // Pooled trade got slightly worse token value -- this must show as negative, not be hidden.
    expect(result.tokenValueDeltaUsd).toBeLessThan(0);
  });
});
