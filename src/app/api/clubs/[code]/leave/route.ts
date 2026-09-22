import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubByCodeOrId, getMemberEntitlementPct } from "@/lib/club";
import { loadClubKeypair, sendTokenPayout } from "@/lib/solana";
import { USDC_MINT } from "@/lib/jupiter";
import { humanizeChainError } from "@/lib/chainErrors";

// Leaving before any batched buy has executed for this member: there's no
// T-Token position to redeem, so this just refunds whatever pending (still
// unswept) USDC they've contributed and removes their membership from
// future pools -- no profit-forfeiture warning needed, unlike POST
// /exit, because there's no profit at stake yet.
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const club = await getClubByCodeOrId(code);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const walletAddress: string | undefined = body?.walletAddress;
  if (!walletAddress) return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });

  const membership = club.memberships.find((m) => m.walletAddress === walletAddress);
  if (!membership) return NextResponse.json({ error: "Wallet is not a member of this club" }, { status: 404 });
  if (membership.leftAt || club.exits.some((e) => e.membershipId === membership.id)) {
    return NextResponse.json({ error: "This member has already left the club" }, { status: 409 });
  }

  const entitlementPct = getMemberEntitlementPct(club).get(membership.id) ?? 0;
  if (entitlementPct > 0) {
    return NextResponse.json(
      { error: "This member already holds an executed position -- use the exit flow to redeem it instead." },
      { status: 400 }
    );
  }

  const pendingContributions = club.contributions.filter(
    (c) => c.membershipId === membership.id && c.executionId === null && !c.refundedAt
  );
  const pendingTotalUsdc = pendingContributions.reduce((sum, c) => sum + c.amountUsdc, 0);

  try {
    let signature: string | null = null;
    if (pendingTotalUsdc > 0) {
      const clubKeypair = loadClubKeypair(club.clubWalletPrivateKeyEncrypted);
      signature = await sendTokenPayout({
        clubKeypair,
        mint: USDC_MINT,
        toWallet: walletAddress,
        amountUi: pendingTotalUsdc,
      });
    }

    await prisma.$transaction(async (txDb) => {
      if (pendingContributions.length > 0) {
        await txDb.contribution.updateMany({
          where: { id: { in: pendingContributions.map((c) => c.id) } },
          data: { refundedAt: new Date() },
        });
      }
      await txDb.membership.update({ where: { id: membership.id }, data: { leftAt: new Date() } });
    });

    return NextResponse.json({
      left: true,
      refundedUsdc: pendingTotalUsdc,
      txSignature: signature,
      explorerUrl: signature ? `https://explorer.solana.com/tx/${signature}` : null,
    });
  } catch (err) {
    console.error("Leave (pre-execution) failed for club", club.id, "membership", membership.id, err);
    return NextResponse.json({ error: humanizeChainError(err) }, { status: 502 });
  }
}
