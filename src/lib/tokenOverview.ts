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

// Both upstream APIs are third-party and occasionally blip at the same
// time (Tessera has been observed to 500 intermittently; Jupiter's free
// "lite" tier rate-limits under load) even though neither is down for
// long. Rather than surface that as a hard error to every client mid-poll,
// the last successful merged snapshot is kept in memory for a short
// window so a single bad round-trip degrades to "slightly stale" instead
// of "broken". A genuine, sustained outage still surfaces as an error once
// that window elapses.
const LAST_GOOD_TTL_MS = 5 * 60_000;
let lastGood: { data: TokenOverview[]; fetchedAt: number } | null = null;

/**
 * Merges Jupiter's real-time market data (price, 24h change, logo, holder
 * count -- the numbers that actually move) with Tessera's own
 * token-details (sector -- descriptive metadata Tessera itself tracks but
 * doesn't move). Jupiter is preferred for both price and holder count
 * because they reflect real, live trading activity; Tessera's own
 * `markPrice`/`holders` are slower-moving marks (confirmed static across
 * repeated polling) used only as a fallback if Jupiter is unreachable.
 */
export async function getTokenOverviews(): Promise<TokenOverview[]> {
  const mints = Object.values(KNOWN_TESSERA_TOKENS);
  const [tesseraResult, marketResult] = await Promise.allSettled([getTesseraTokens(), getTokenMarketData(mints)]);

  const tesseraByMint = new Map<string, TesseraToken>();
  if (tesseraResult.status === "fulfilled") {
    for (const t of tesseraResult.value) tesseraByMint.set(t.mint, t);
  }

  if (marketResult.status === "fulfilled" && marketResult.value.length > 0) {
    const data = marketResult.value.map((m) => {
      const tessera = tesseraByMint.get(m.mint);
      return {
        mint: m.mint,
        symbol: m.symbol,
        name: tessera?.name ?? m.name,
        sector: tessera?.sector ?? null,
        icon: m.icon,
        usdPrice: m.usdPrice,
        priceChange24h: m.priceChange24h,
        holders: m.holderCount ?? tessera?.holders ?? null,
        priceSource: "jupiter" as const,
      };
    });
    lastGood = { data, fetchedAt: Date.now() };
    return data;
  }

  if (tesseraResult.status === "fulfilled") {
    const data = tesseraResult.value.map((t) => ({
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      sector: t.sector,
      icon: null,
      usdPrice: t.markPrice,
      priceChange24h: null,
      holders: t.holders,
      priceSource: "tessera" as const,
    }));
    lastGood = { data, fetchedAt: Date.now() };
    return data;
  }

  if (lastGood && Date.now() - lastGood.fetchedAt < LAST_GOOD_TTL_MS) {
    return lastGood.data;
  }

  const jupiterErr = marketResult.status === "rejected" ? marketResult.reason : null;
  const tesseraErr = tesseraResult.status === "rejected" ? tesseraResult.reason : null;
  throw new Error(
    `Both live price sources are unavailable right now (Jupiter: ${jupiterErr instanceof Error ? jupiterErr.message : jupiterErr}; Tessera: ${tesseraErr instanceof Error ? tesseraErr.message : tesseraErr})`
  );
}
