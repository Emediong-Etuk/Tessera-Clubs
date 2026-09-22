import { getTesseraTokens, KNOWN_TESSERA_TOKENS, type TesseraToken } from "./tessera";
import { getTokenMarketData } from "./jupiter";

export interface TokenOverview {
  mint: string;
  /** Conventional ticker (Jupiter's convention, e.g. "tOpenAI" -> displayed as "$tOpenAI"). */
  symbol: string;
  name: string;
  sector: string | null;
  icon: string | null;
  usdPrice: number;
  priceChange24h: number | null;
  holders: number | null;
  /** Which live source produced usdPrice -- shown so the number's provenance is never ambiguous. */
  priceSource: "jupiter" | "tessera";
}

/**
 * Merges Jupiter's real-time market data (price, 24h change, logo -- the
 * numbers that actually move) with Tessera's own token-details (sector,
 * holder count -- descriptive metadata Tessera itself tracks). Jupiter is
 * preferred for price specifically because it reflects real trading
 * activity; Tessera's own `markPrice` is used only as a fallback if
 * Jupiter is unreachable.
 */
export async function getTokenOverviews(): Promise<TokenOverview[]> {
  const mints = Object.values(KNOWN_TESSERA_TOKENS);
  const [tesseraResult, marketResult] = await Promise.allSettled([getTesseraTokens(), getTokenMarketData(mints)]);

  const tesseraByMint = new Map<string, TesseraToken>();
  if (tesseraResult.status === "fulfilled") {
    for (const t of tesseraResult.value) tesseraByMint.set(t.mint, t);
  }

  if (marketResult.status === "fulfilled" && marketResult.value.length > 0) {
    return marketResult.value.map((m) => {
      const tessera = tesseraByMint.get(m.mint);
      return {
        mint: m.mint,
        symbol: m.symbol,
        name: tessera?.name ?? m.name,
        sector: tessera?.sector ?? null,
        icon: m.icon,
        usdPrice: m.usdPrice,
        priceChange24h: m.priceChange24h,
        holders: tessera?.holders ?? m.holderCount,
        priceSource: "jupiter",
      };
    });
  }

  if (tesseraResult.status === "fulfilled") {
    return tesseraResult.value.map((t) => ({
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      sector: t.sector,
      icon: null,
      usdPrice: t.markPrice,
      priceChange24h: null,
      holders: t.holders,
      priceSource: "tessera",
    }));
  }

  const jupiterErr = marketResult.status === "rejected" ? marketResult.reason : null;
  const tesseraErr = tesseraResult.status === "rejected" ? tesseraResult.reason : null;
  throw new Error(
    `Both live price sources are unavailable right now (Jupiter: ${jupiterErr instanceof Error ? jupiterErr.message : jupiterErr}; Tessera: ${tesseraErr instanceof Error ? tesseraErr.message : tesseraErr})`
  );
}
