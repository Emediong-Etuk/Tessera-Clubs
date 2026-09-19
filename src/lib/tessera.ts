// Client for Tessera's public token-details API.
//
// Tessera does not run its own DEX or bonding-curve pricing engine: per
// https://docs.tessera.pe/features/trade, T-Tokens are plain SPL
// Token-2022 mints on Solana mainnet-beta that trade on third-party AMMs
// (Meteora, Jupiter-routed venues). This endpoint gives us the current
// mark price / valuation Tessera itself displays; real tradeable quotes
// come from Jupiter (see lib/jupiter.ts).

const TOKEN_DETAILS_URL = "https://rest-api.tessera.pe/v1/public/token-details";

export interface TesseraToken {
  id: string;
  name: string;
  symbol: string;
  code: string;
  sector: string;
  mint: string;
  markPrice: number;
  holders: number;
  markValuation: number;
}

// Known-good mints confirmed against
// https://docs.tessera.pe/technicals/on-chain-programs, used as a
// fallback if the public API is briefly unavailable so the demo doesn't
// hard-fail on a flaky network call.
export const KNOWN_TESSERA_TOKENS: Record<string, string> = {
  "T-OpenAI": "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ",
  "T-Kalshi": "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ",
  "T-SpaceX": "TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v",
};

let cache: { data: TesseraToken[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getTesseraTokens(): Promise<TesseraToken[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }
  const res = await fetch(TOKEN_DETAILS_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Tessera token-details API returned ${res.status}`);
  }
  const data = (await res.json()) as TesseraToken[];
  cache = { data, fetchedAt: Date.now() };
  return data;
}

export async function getTesseraTokenByMint(mint: string): Promise<TesseraToken | undefined> {
  const tokens = await getTesseraTokens();
  return tokens.find((t) => t.mint === mint);
}
