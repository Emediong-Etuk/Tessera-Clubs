import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubByCodeOrId } from "@/lib/club";
import { getConnection } from "@/lib/solana";
import { USDC_MINT } from "@/lib/jupiter";
import { PublicKey } from "@solana/web3.js";

// Contribution flow: the member signs and sends a USDC transfer straight
// to the club wallet from their own browser wallet (wallet-adapter), then
// hands us the resulting signature. We verify it on-chain here rather
// than trusting the client-reported amount -- we check the real
// pre/post SPL token balance deltas for the USDC mint, which works
// whether the transfer instruction used the classic Token program or
// Token-2022.
async function verifyUsdcTransfer(
  signature: string,
  fromWallet: string,
  toWallet: string
): Promise<{ ok: true; amountUsdc: number } | { ok: false; reason: string }> {
  const conn = getConnection();
  const tx = await conn.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx) return { ok: false, reason: "Transaction not found or not yet confirmed" };
  if (tx.meta?.err) return { ok: false, reason: "Transaction failed on-chain" };

  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];

  const deltaFor = (owner: string): number => {
    const preEntry = pre.find((b) => b.owner === owner && b.mint === USDC_MINT);
    const postEntry = post.find((b) => b.owner === owner && b.mint === USDC_MINT);
    const preAmt = preEntry?.uiTokenAmount.uiAmount ?? 0;
    const postAmt = postEntry?.uiTokenAmount.uiAmount ?? 0;
    return postAmt - preAmt;
  };

  const receiverDelta = deltaFor(toWallet);
  const senderDelta = deltaFor(fromWallet);

  if (receiverDelta <= 0) {
    return { ok: false, reason: "Transaction did not deposit USDC into the club wallet" };
  }
  if (senderDelta >= 0) {
    return { ok: false, reason: "Transaction was not funded from the claimed wallet" };
  }

  return { ok: true, amountUsdc: receiverDelta };
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const club = await getClubByCodeOrId(code);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const walletAddress: string | undefined = body?.walletAddress;
  const txSignature: string | undefined = body?.txSignature;

  if (!walletAddress || !txSignature) {
    return NextResponse.json({ error: "walletAddress and txSignature are required" }, { status: 400 });
  }
  try {
    new PublicKey(walletAddress);
  } catch {
    return NextResponse.json({ error: "walletAddress is not a valid Solana address" }, { status: 400 });
  }

  const existing = await prisma.contribution.findUnique({ where: { txSignature } });
  if (existing) {
    return NextResponse.json({ error: "This transaction has already been recorded" }, { status: 409 });
  }

  const verification = await verifyUsdcTransfer(txSignature, walletAddress, club.clubWalletAddress);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.reason }, { status: 422 });
  }

  const membership = await prisma.membership.upsert({
    where: { clubId_walletAddress: { clubId: club.id, walletAddress } },
    update: {},
    create: { clubId: club.id, walletAddress },
  });

  const contribution = await prisma.contribution.create({
    data: {
      clubId: club.id,
      membershipId: membership.id,
      amountUsdc: verification.amountUsdc,
      txSignature,
    },
  });

  return NextResponse.json({
    contributionId: contribution.id,
    amountUsdc: contribution.amountUsdc,
    txSignature: contribution.txSignature,
  });
}
