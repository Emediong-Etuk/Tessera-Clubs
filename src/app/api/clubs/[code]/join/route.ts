import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubByCodeOrId } from "@/lib/club";
import { PublicKey } from "@solana/web3.js";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const club = await getClubByCodeOrId(code);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const walletAddress: string | undefined = body?.walletAddress;
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }
  try {
    new PublicKey(walletAddress);
  } catch {
    return NextResponse.json({ error: "walletAddress is not a valid Solana address" }, { status: 400 });
  }

  // update: clears leftAt so a wallet that previously left a still-open
  // club (before any batched buy) can rejoin, rather than being
  // permanently locked out by its own earlier Membership row.
  const membership = await prisma.membership.upsert({
    where: { clubId_walletAddress: { clubId: club.id, walletAddress } },
    update: { leftAt: null },
    create: { clubId: club.id, walletAddress },
  });

  return NextResponse.json({ membershipId: membership.id, clubId: club.id, inviteCode: club.inviteCode });
}
