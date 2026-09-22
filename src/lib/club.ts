import { prisma } from "./prisma";
import { calculateProportionalShares, computeSavingsComparison, type SavingsComparisonResult } from "./savings";
import {
  getMintDecimals,
  getTokenAccountRentLamports,
  getTokenBalance,
  tokenAccountExists,
} from "./solana";
import { USDC_MINT, getQuote, getSolPriceUsd, type JupiterQuote } from "./jupiter";

export async function getClubByCodeOrId(codeOrId: string) {
  return prisma.club.findFirst({
    where: { OR: [{ inviteCode: codeOrId.toUpperCase() }, { id: codeOrId }] },
    include: {
      memberships: { include: { exits: true } },
      contributions: true,
      executions: { orderBy: { executedAt: "desc" } },
      exits: true,
    },
  });
}

export type ClubWithRelations = NonNullable<Awaited<ReturnType<typeof getClubByCodeOrId>>>;

/** USDC contributed this round that hasn't been swept into a batched buy (or refunded to a member who left) yet. */
export function getPendingPoolTotal(club: ClubWithRelations): number {
  return club.contributions
    .filter((c) => c.executionId === null && !c.refundedAt)
    .reduce((sum, c) => sum + c.amountUsdc, 0);
}

export function getActiveMemberships(club: ClubWithRelations) {
  const exitedMembershipIds = new Set(club.exits.map((e) => e.membershipId));
  return club.memberships.filter((m) => !exitedMembershipIds.has(m.id) && !m.leftAt);
}

/**
 * Each active member's percentage of all USDC that has ever gone through a
 * batched buy for this club (i.e. their share of the club's cumulative
 * T-Token position), used both for the dashboard and for exit payouts.
 */
export function getMemberEntitlementPct(club: ClubWithRelations): Map<string, number> {
  const executed = club.contributions.filter((c) => c.executionId !== null);
  const activeIds = new Set(getActiveMemberships(club).map((m) => m.id));
  const totalExecuted = executed
    .filter((c) => activeIds.has(c.membershipId))
    .reduce((sum, c) => sum + c.amountUsdc, 0);

  const byMembership = new Map<string, number>();
  if (totalExecuted <= 0) return byMembership;

  for (const c of executed) {
    if (!activeIds.has(c.membershipId)) continue;
    byMembership.set(c.membershipId, (byMembership.get(c.membershipId) ?? 0) + c.amountUsdc);
  }
  for (const [id, amount] of byMembership) {
    byMembership.set(id, amount / totalExecuted);
  }
  return byMembership;
}

/** Live current T-Token balance held by the club wallet. */
export async function getClubTTokenBalance(club: ClubWithRelations): Promise<number> {
  return getTokenBalance(club.targetTokenMint, club.clubWalletAddress);
}

export interface MemberPosition {
  membershipId: string;
  walletAddress: string;
  totalContributedUsdc: number;
  pendingContributionUsdc: number;
  entitlementPct: number;
  estimatedTTokenAmount: number;
  hasExited: boolean;
}

export async function getMemberPositions(club: ClubWithRelations): Promise<MemberPosition[]> {
  const entitlementPct = getMemberEntitlementPct(club);
  const exitedIds = new Set(club.exits.map((e) => e.membershipId));
  const clubBalance = await getClubTTokenBalance(club);

  const sharesFromBalance = calculateProportionalShares(
    Array.from(entitlementPct.entries()).map(([membershipId, pct]) => ({
      membershipId,
      amountUsdc: pct,
    })),
    clubBalance
  );
  const estByMembership = new Map(sharesFromBalance.map((s) => [s.membershipId, s.tTokenAmount]));

  return club.memberships.map((m) => {
    const contributions = club.contributions.filter((c) => c.membershipId === m.id);
    return {
      membershipId: m.id,
      walletAddress: m.walletAddress,
      totalContributedUsdc: contributions
        .filter((c) => c.executionId !== null)
        .reduce((s, c) => s + c.amountUsdc, 0),
      pendingContributionUsdc: contributions
        .filter((c) => c.executionId === null && !c.refundedAt)
        .reduce((s, c) => s + c.amountUsdc, 0),
      entitlementPct: entitlementPct.get(m.id) ?? 0,
      estimatedTTokenAmount: estByMembership.get(m.id) ?? 0,
      hasExited: exitedIds.has(m.id) || Boolean(m.leftAt),
    };
  });
}

// --- Live savings preview -----------------------------------------------
//
// Shared by GET /api/clubs/[code]/savings (a live "what would we save"
// preview while the pool is still open) and POST /api/clubs/[code]/execute
// (which locks the same real numbers into the Execution record at the
// moment of the actual batched buy).

export interface SavingsPreview {
  memberCount: number;
  totalPendingUsdc: number;
  pooledQuote: JupiterQuote;
  individualQuotes: JupiterQuote[];
  comparison: SavingsComparisonResult;
}

export async function buildSavingsPreview(club: ClubWithRelations): Promise<SavingsPreview | null> {
  const pending = club.contributions.filter((c) => c.executionId === null && !c.refundedAt);
  if (pending.length === 0) return null;

  const byMembership = new Map<string, number>();
  for (const c of pending) {
    byMembership.set(c.membershipId, (byMembership.get(c.membershipId) ?? 0) + c.amountUsdc);
  }
  const memberEntries = Array.from(byMembership.entries());
  const totalPendingUsdc = memberEntries.reduce((s, [, amt]) => s + amt, 0);
  if (totalPendingUsdc <= 0) return null;

  const [individualQuotes, pooledQuote, solPriceUsd, tTokenDecimals, rentLamportsPerAccount, clubHasAta] =
    await Promise.all([
      Promise.all(
        memberEntries.map(([, amount]) =>
          getQuote({ inputMint: USDC_MINT, outputMint: club.targetTokenMint, amount: Math.round(amount * 1e6) })
        )
      ),
      getQuote({
        inputMint: USDC_MINT,
        outputMint: club.targetTokenMint,
        amount: Math.round(totalPendingUsdc * 1e6),
      }),
      getSolPriceUsd(),
      getMintDecimals(club.targetTokenMint),
      getTokenAccountRentLamports(club.targetTokenMint),
      tokenAccountExists(club.targetTokenMint, club.clubWalletAddress),
    ]);

  const memberAtaFlags = await Promise.all(
    memberEntries.map(async ([membershipId]) => {
      const membership = club.memberships.find((m) => m.id === membershipId);
      if (!membership) return false;
      const exists = await tokenAccountExists(club.targetTokenMint, membership.walletAddress);
      return !exists;
    })
  );
  const membersNeedingNewAta = memberAtaFlags.filter(Boolean).length;

  const comparison = computeSavingsComparison({
    individualQuotes,
    pooledQuote,
    tTokenDecimals,
    solPriceUsd,
    rentLamportsPerAccount,
    membersNeedingNewAta,
    clubNeedsNewAta: !clubHasAta,
  });

  return {
    memberCount: memberEntries.length,
    totalPendingUsdc,
    pooledQuote,
    individualQuotes,
    comparison,
  };
}
