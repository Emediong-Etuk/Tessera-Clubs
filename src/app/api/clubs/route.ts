import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateClubWallet } from "@/lib/solana";
import { generateInviteCode } from "@/lib/inviteCode";
import { PublicKey } from "@solana/web3.js";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { name, targetTokenMint, targetTokenSymbol, fundingGoalUsd, creatorWalletAddress } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Club name is required" }, { status: 400 });
  }
  if (!targetTokenMint || !targetTokenSymbol) {
    return NextResponse.json({ error: "targetTokenMint and targetTokenSymbol are required" }, { status: 400 });
  }
  try {
    new PublicKey(targetTokenMint);
  } catch {
    return NextResponse.json({ error: "targetTokenMint is not a valid Solana address" }, { status: 400 });
  }
  if (!creatorWalletAddress) {
    return NextResponse.json({ error: "creatorWalletAddress is required" }, { status: 400 });
  }
  try {
    new PublicKey(creatorWalletAddress);
  } catch {
    return NextResponse.json({ error: "creatorWalletAddress is not a valid Solana address" }, { status: 400 });
  }

  const wallet = generateClubWallet();

  let inviteCode = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.club.findUnique({ where: { inviteCode } });
    if (!existing) break;
    inviteCode = generateInviteCode();
  }

  const club = await prisma.club.create({
    data: {
      name: name.trim(),
      targetTokenMint,
      targetTokenSymbol,
      clubWalletAddress: wallet.publicKey,
      clubWalletPrivateKeyEncrypted: wallet.encryptedSecretKey,
      fundingGoalUsd: fundingGoalUsd ? Number(fundingGoalUsd) : null,
      inviteCode,
      memberships: {
        create: { walletAddress: creatorWalletAddress },
      },
    },
    include: { memberships: true },
  });

  return NextResponse.json({
    id: club.id,
    inviteCode: club.inviteCode,
    clubWalletAddress: club.clubWalletAddress,
    name: club.name,
  });
}
