// Client for Jupiter's public aggregator API. This is the actual source
// of "quote data" for this product: Tessera has no bonding-curve/quote
// endpoint of its own (confirmed against their docs), so both the
// batched-buy execution and the solo-vs-club savings comparison are
// backed by real, live Jupiter quotes against the venues T-Tokens
// actually trade on (Meteora DLMM etc, routed by Jupiter).
//
// Base URL defaults to the free "lite" tier (no API key, rate-limited but
// sufficient for a hackathon demo). Set JUPITER_API_BASE / JUPITER_API_KEY
// to move to the paid tier.

export { USDC_MINT, WSOL_MINT } from "./constants";
import { USDC_MINT, WSOL_MINT } from "./constants";

const BASE_URL = process.env.JUPITER_API_BASE ?? "https://lite-api.jup.ag";
const API_KEY = process.env.JUPITER_API_KEY || undefined;

function headers(): Record<string, string> {
  return API_KEY ? { "x-api-key": API_KEY } : {};
}

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: "ExactIn" | "ExactOut";
  slippageBps: number;
  priceImpactPct: string;
  swapUsdValue?: string;
  routePlan: Array<{
    swapInfo: { label: string; ammKey: string };
    percent: number;
  }>;
}

/**
 * Fetch a live quote for swapping `amount` base units of `inputMint` into
 * `outputMint`. This never executes anything on-chain -- it's a read-only
 * price lookup.
 */
export async function getQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: number; // integer base units (e.g. USDC has 6 decimals)
  slippageBps?: number;
}): Promise<JupiterQuote> {
  const { inputMint, outputMint, amount, slippageBps = 50 } = params;
  const url = new URL(`${BASE_URL}/swap/v1/quote`);
  url.searchParams.set("inputMint", inputMint);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", Math.max(1, Math.round(amount)).toString());
  url.searchParams.set("slippageBps", slippageBps.toString());
  url.searchParams.set("swapMode", "ExactIn");

  const res = await fetch(url.toString(), { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jupiter quote failed (${res.status}): ${body}`);
  }
  return (await res.json()) as JupiterQuote;
}

/**
 * Build a ready-to-sign swap transaction (base64-encoded v0 transaction)
 * for a previously-fetched quote.
 */
/** Live SOL/USDC price, derived from a real 1 SOL -> USDC quote (used to convert lamport fees into dollars for the savings screen). */
export async function getSolPriceUsd(): Promise<number> {
  const quote = await getQuote({
    inputMint: WSOL_MINT,
    outputMint: USDC_MINT,
    amount: 1_000_000_000, // 1 SOL, 9 decimals
  });
  return Number(quote.outAmount) / 1_000_000; // USDC has 6 decimals
}

export async function getSwapTransaction(params: {
  quote: JupiterQuote;
  userPublicKey: string;
  priorityFeeLamports?: number;
}): Promise<{ swapTransaction: string; lastValidBlockHeight: number }> {
  const { quote, userPublicKey, priorityFeeLamports } = params;
  const res = await fetch(`${BASE_URL}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers() },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: priorityFeeLamports ?? "auto",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jupiter swap-transaction build failed (${res.status}): ${body}`);
  }
  return (await res.json()) as { swapTransaction: string; lastValidBlockHeight: number };
}
