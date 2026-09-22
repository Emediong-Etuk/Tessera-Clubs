import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";

// Lists every club a wallet is a member of (creator or joiner -- there's
// no separate "creator" flag in the schema; a membership counts as the
// creator's if it's the earliest membership on that club). Deliberately
// DB-only: no live RPC/chain reads, so this stays fast regardless of how
// many clubs someone's in. Live balances are one click away on each
// club's own dashboard.
export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet query param is required" }, { status: 400 });
  try {
    new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "wallet is not a valid Solana address" }, { status: 400 });
  }

  const memberships = await prisma.membership.findMany({
    where: { walletAddress: wallet },
    include: {
      exits: true,
      club: {
        include: {
          contributions: true,
          executions: true,
          memberships: { orderBy: { joinedAt: "asc" }, take: 1 },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const clubs = memberships.map((m) => {
    const pendingPoolUsdc = m.club.contributions
      .filter((c) => c.executionId === null && !c.refundedAt)
      .reduce((sum, c) => sum + c.amountUsdc, 0);
    const myContributedUsdc = m.club.contributions
      .filter((c) => c.membershipId === m.id && !c.refundedAt)
      .reduce((sum, c) => sum + c.amountUsdc, 0);
    const isCreator = m.club.memberships[0]?.id === m.id;
    // Whether this member has any contribution that's already gone through
    // a batched buy -- i.e. whether they hold a real (nonzero) share of the
    // club's T-Token position that "leaving" would mean giving up.
    const hasExecutedPosition = m.club.contributions.some(
      (c) => c.membershipId === m.id && c.executionId !== null
    );
    const refundedUsdc = m.club.contributions
      .filter((c) => c.membershipId === m.id && c.refundedAt)
      .reduce((sum, c) => sum + c.amountUsdc, 0);
    const exit = m.exits[0] ?? null;

    return {
      inviteCode: m.club.inviteCode,
      name: m.club.name,
      status: m.club.status,
      targetTokenSymbol: m.club.targetTokenSymbol,
      fundingGoalUsd: m.club.fundingGoalUsd,
      createdAt: m.club.createdAt,
      joinedAt: m.joinedAt,
      isCreator,
      pendingPoolUsdc,
      myContributedUsdc,
      hasExited: exit !== null || Boolean(m.leftAt),
      hasExecutedPosition,
      executionCount: m.club.executions.length,
      // Populated only for clubs the member has left -- how they left, and
      // with what, for the clubs/history page.
      leftAt: m.leftAt,
      refundedUsdc,
      exit: exit
        ? {
            payoutType: exit.payoutType,
            payoutAmount: exit.payoutAmount,
            txSignature: exit.txSignature,
            exitedAt: exit.exitedAt,
          }
        : null,
    };
  });

  return NextResponse.json({ clubs });
}
