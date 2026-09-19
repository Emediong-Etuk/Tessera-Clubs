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

export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function explorerUrl(signatureOrAddress: string, kind: "tx" | "address" = "tx"): string {
  return `https://explorer.solana.com/${kind}/${signatureOrAddress}`;
}
