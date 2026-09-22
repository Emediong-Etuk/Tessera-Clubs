export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export function formatUsdPrecise(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
}

export function formatPct(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

export function formatToken(value: number, digits = 4): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/**
 * Tessera's own naming convention prefixes every T-Token's ticker with a
 * lowercase "t" (tOpenAI, tKalshi, tSpaceX -- confirmed in both their own
 * API and Jupiter's). That's a meaningful signal (this is Tessera's
 * tokenized *exposure* to the company, not the company's own token) so
 * it's kept in the full name shown as a subtitle, but for the big ticker
 * display a plain, conventional-looking ticker reads better: SPACEX
 * rather than tSpaceX.
 */
export function formatTicker(symbol: string): string {
  return symbol.replace(/^t(?=[A-Z])/, "").toUpperCase();
}

export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function explorerUrl(signatureOrAddress: string, kind: "tx" | "address" = "tx"): string {
  return `https://explorer.solana.com/${kind}/${signatureOrAddress}`;
}
