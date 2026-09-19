import { NextResponse } from "next/server";
import {
  getClubByCodeOrId,
  getClubTTokenBalance,
  getMemberPositions,
  getPendingPoolTotal,
} from "@/lib/club";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const club = await getClubByCodeOrId(code);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const [members, tTokenBalance] = await Promise.all([
    getMemberPositions(club),
    getClubTTokenBalance(club),
  ]);

  return NextResponse.json({
    id: club.id,
    name: club.name,
    inviteCode: club.inviteCode,
    status: club.status,
    targetTokenMint: club.targetTokenMint,
    targetTokenSymbol: club.targetTokenSymbol,
    clubWalletAddress: club.clubWalletAddress,
    fundingGoalUsd: club.fundingGoalUsd,
    createdAt: club.createdAt,
    pendingPoolUsdc: getPendingPoolTotal(club),
    tTokenBalance,
    members,
    executions: club.executions.map((e) => ({
      id: e.id,
      totalUsdcAmount: e.totalUsdcAmount,
      tTokenAmountReceived: e.tTokenAmountReceived,
      txSignature: e.txSignature,
      executedAt: e.executedAt,
      quotePriceImpactPct: e.quotePriceImpactPct,
      savingsUsd: e.savingsUsd,
    })),
  });
}
