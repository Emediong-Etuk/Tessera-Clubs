import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSavingsPreview, getClubByCodeOrId } from "@/lib/club";
import { getConnection, loadClubKeypair, sendJupiterSwapWithRetry } from "@/lib/solana";
import { getSwapTransaction } from "@/lib/jupiter";
import { humanizeChainError } from "@/lib/chainErrors";

// Triggers the ONE batched swap for the club's entire pending USDC pool.
// This is a real mainnet transaction signed by the custodial club wallet
// keypair -- see README's custody-model disclosure for what "custodial"
// means here.
export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const club = await getClubByCodeOrId(code);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  let preview;
  try {
    preview = await buildSavingsPreview(club);
  } catch (err) {
    console.error("Failed to build savings preview before execute for club", club.id, err);
    return NextResponse.json({ error: humanizeChainError(err) }, { status: 502 });
  }
  if (!preview) {
    return NextResponse.json({ error: "No pending contributions to execute" }, { status: 400 });
  }

  const conn = getConnection();
  const clubKeypair = loadClubKeypair(club.clubWalletPrivateKeyEncrypted);

  let signature: string;
  try {
    signature = await sendJupiterSwapWithRetry({
      conn,
      signer: clubKeypair,
      buildSwapTransaction: () =>
        getSwapTransaction({ quote: preview.pooledQuote, userPublicKey: club.clubWalletAddress }),
    });
  } catch (err) {
    console.error("Batched buy failed for club", club.id, err);
    return NextResponse.json({ error: humanizeChainError(err) }, { status: 502 });
  }

  // Read back the real balance change rather than trusting the quote --
  // actual output can differ slightly due to slippage tolerance. Default
  // to 0 rather than guessing decimals if the balance read below fails.
  let tTokenAmountReceived = 0;
  try {
    const confirmedTx = await conn.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    const pre = confirmedTx?.meta?.preTokenBalances ?? [];
    const post = confirmedTx?.meta?.postTokenBalances ?? [];
    const preAmt =
      pre.find((b) => b.owner === club.clubWalletAddress && b.mint === club.targetTokenMint)?.uiTokenAmount
        .uiAmount ?? 0;
    const postAmt =
      post.find((b) => b.owner === club.clubWalletAddress && b.mint === club.targetTokenMint)?.uiTokenAmount
        .uiAmount ?? 0;
    if (postAmt - preAmt > 0) tTokenAmountReceived = postAmt - preAmt;
  } catch {
    // fall back to the pre-swap quote estimate computed above
  }

  const { comparison } = preview;
  const individualEstimatedCostUsd =
    preview.totalPendingUsdc - comparison.individualValueUsd + comparison.executionCostIndividualUsd;
  const clubActualCostUsd =
    preview.totalPendingUsdc - comparison.pooledValueUsd + comparison.executionCostClubUsd;

  const pendingContributions = club.contributions.filter((c) => c.executionId === null && !c.refundedAt);

  const execution = await prisma.$transaction(async (txDb) => {
    const created = await txDb.execution.create({
      data: {
        clubId: club.id,
        totalUsdcAmount: preview.totalPendingUsdc,
        tTokenAmountReceived,
        txSignature: signature,
        quotePriceImpactPct: comparison.pooledPriceImpactPct,
        individualEstimatedCostUsd,
        clubActualCostUsd,
        savingsUsd: comparison.totalSavingsUsd,
      },
    });
    await txDb.contribution.updateMany({
      where: { id: { in: pendingContributions.map((c) => c.id) } },
      data: { executionId: created.id },
    });
    await txDb.club.update({ where: { id: club.id }, data: { status: "EXECUTED" } });
    return created;
  });

  return NextResponse.json({
    executionId: execution.id,
    txSignature: execution.txSignature,
    totalUsdcAmount: execution.totalUsdcAmount,
    tTokenAmountReceived: execution.tTokenAmountReceived,
    savingsUsd: execution.savingsUsd,
    quotePriceImpactPct: execution.quotePriceImpactPct,
    explorerUrl: `https://explorer.solana.com/tx/${execution.txSignature}`,
  });
}
