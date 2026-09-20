import { NextResponse } from "next/server";
import {
  Transaction,
  PublicKey,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { prisma } from "@/lib/prisma";
import { getClubByCodeOrId, getClubTTokenBalance, getMemberEntitlementPct } from "@/lib/club";
import {
  getAssociatedTokenAddressForOwner,
  getConnection,
  getMintDecimals,
  getProgramIdForMint,
  loadClubKeypair,
} from "@/lib/solana";
import { USDC_MINT, getQuote, getSwapTransaction } from "@/lib/jupiter";
import { humanizeChainError } from "@/lib/chainErrors";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const club = await getClubByCodeOrId(code);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const walletAddress: string | undefined = body?.walletAddress;
  const payoutType: "USDC" | "TTOKEN" = body?.payoutType === "USDC" ? "USDC" : "TTOKEN";

  if (!walletAddress) return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });

  const membership = club.memberships.find((m) => m.walletAddress === walletAddress);
  if (!membership) return NextResponse.json({ error: "Wallet is not a member of this club" }, { status: 404 });
  if (club.exits.some((e) => e.membershipId === membership.id)) {
    return NextResponse.json({ error: "This member has already exited" }, { status: 409 });
  }

  const entitlementPct = getMemberEntitlementPct(club).get(membership.id) ?? 0;
  if (entitlementPct <= 0) {
    return NextResponse.json({ error: "This member has no executed position to exit yet" }, { status: 400 });
  }

  const conn = getConnection();
  const clubKeypair = loadClubKeypair(club.clubWalletPrivateKeyEncrypted);
  const clubBalance = await getClubTTokenBalance(club);
  const tTokenPayoutAmount = entitlementPct * clubBalance;
  if (tTokenPayoutAmount <= 0) {
    return NextResponse.json({ error: "Computed payout is zero" }, { status: 400 });
  }

  try {
    if (payoutType === "TTOKEN") {
      const signature = await payoutTToken({
        clubKeypair,
        mint: club.targetTokenMint,
        toWallet: walletAddress,
        amountUi: tTokenPayoutAmount,
      });
      const exit = await recordExit({
        clubId: club.id,
        membershipId: membership.id,
        proportionShare: entitlementPct,
        payoutType: "TTOKEN",
        payoutAmount: tTokenPayoutAmount,
        txSignature: signature,
      });
      return NextResponse.json(toExitResponse(exit));
    }

    // USDC payout: swap the member's T-Token share to USDC from the club
    // wallet (real Jupiter swap), then forward the actual USDC received.
    const quote = await getQuote({
      inputMint: club.targetTokenMint,
      outputMint: USDC_MINT,
      amount: Math.round(tTokenPayoutAmount * 10 ** (await getMintDecimals(club.targetTokenMint))),
    });
    const { swapTransaction, lastValidBlockHeight } = await getSwapTransaction({
      quote,
      userPublicKey: club.clubWalletAddress,
    });
    const swapTx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
    swapTx.sign([clubKeypair]);
    const swapSig = await conn.sendRawTransaction(swapTx.serialize(), { skipPreflight: false });
    await conn.confirmTransaction(
      { signature: swapSig, blockhash: swapTx.message.recentBlockhash, lastValidBlockHeight },
      "confirmed"
    );

    const usdcReceived = Number(quote.outAmount) / 1_000_000;
    const signature = await payoutTToken({
      clubKeypair,
      mint: USDC_MINT,
      toWallet: walletAddress,
      amountUi: usdcReceived,
    });

    const exit = await recordExit({
      clubId: club.id,
      membershipId: membership.id,
      proportionShare: entitlementPct,
      payoutType: "USDC",
      payoutAmount: usdcReceived,
      txSignature: signature,
    });
    return NextResponse.json(toExitResponse(exit));
  } catch (err) {
    console.error("Exit payout failed for club", club.id, "membership", membership.id, err);
    return NextResponse.json({ error: humanizeChainError(err) }, { status: 502 });
  }
}

async function payoutTToken(params: {
  clubKeypair: import("@solana/web3.js").Keypair;
  mint: string;
  toWallet: string;
  amountUi: number;
}): Promise<string> {
  const { clubKeypair, mint, toWallet, amountUi } = params;
  const conn = getConnection();
  const decimals = await getMintDecimals(mint);
  const mintPubkey = new PublicKey(mint);
  const toPubkey = new PublicKey(toWallet);

  const programId = getProgramIdForMint(mint);
  const fromAta = getAssociatedTokenAddressForOwner(mint, clubKeypair.publicKey.toBase58());
  const toAta = getAssociatedTokenAddressForOwner(mint, toWallet);

  const tx = new Transaction();
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      clubKeypair.publicKey,
      toAta,
      toPubkey,
      mintPubkey,
      programId
    )
  );
  const amountBaseUnits = BigInt(Math.round(amountUi * 10 ** decimals));
  tx.add(
    createTransferCheckedInstruction(
      fromAta,
      mintPubkey,
      toAta,
      clubKeypair.publicKey,
      amountBaseUnits,
      decimals,
      [],
      programId
    )
  );

  return sendAndConfirmTransaction(conn, tx, [clubKeypair], { commitment: "confirmed" });
}

async function recordExit(data: {
  clubId: string;
  membershipId: string;
  proportionShare: number;
  payoutType: "USDC" | "TTOKEN";
  payoutAmount: number;
  txSignature: string;
}) {
  return prisma.exit.create({ data });
}

function toExitResponse(exit: Awaited<ReturnType<typeof recordExit>>) {
  return {
    exitId: exit.id,
    payoutType: exit.payoutType,
    payoutAmount: exit.payoutAmount,
    proportionShare: exit.proportionShare,
    txSignature: exit.txSignature,
    explorerUrl: `https://explorer.solana.com/tx/${exit.txSignature}`,
  };
}
