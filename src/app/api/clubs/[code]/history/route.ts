import { NextResponse } from "next/server";
import { getClubByCodeOrId } from "@/lib/club";

const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}`;

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const club = await getClubByCodeOrId(code);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const events = [
    ...club.contributions.map((c) => ({
      type: "contribution" as const,
      at: c.contributedAt,
      amountUsdc: c.amountUsdc,
      membershipId: c.membershipId,
      txSignature: c.txSignature,
      explorerUrl: explorer(c.txSignature),
    })),
    ...club.executions.map((e) => ({
      type: "execution" as const,
      at: e.executedAt,
      totalUsdcAmount: e.totalUsdcAmount,
      tTokenAmountReceived: e.tTokenAmountReceived,
      savingsUsd: e.savingsUsd,
      txSignature: e.txSignature,
      explorerUrl: explorer(e.txSignature),
    })),
    ...club.exits.map((e) => ({
      type: "exit" as const,
      at: e.exitedAt,
      payoutType: e.payoutType,
      payoutAmount: e.payoutAmount,
      membershipId: e.membershipId,
      txSignature: e.txSignature,
      explorerUrl: explorer(e.txSignature),
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return NextResponse.json({ events });
}
