// Solana/Jupiter/SPL errors are written for someone reading transaction
// logs, not for a club member watching a demo. This translates the raw
// error text (from a caught exception, wherever it's thrown) into a
// short, plain-language reason and what to do about it -- built directly
// from the actual raw errors this project hit live:
//
//   "Attempt to debit an account but found no record of a prior credit"
//   "invalid account data for instruction" (transferChecked, empty token account)
//   "403 ... Access forbidden" (public RPC blocking the request)
//
// Pure string matching, no dependencies -- safe to import from both
// server routes and client components.

const FALLBACK_MESSAGE = "Something went wrong with that transaction. Please try again.";

export function humanizeChainError(raw: unknown): string {
  if (raw == null) return FALLBACK_MESSAGE;
  const message = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : String(raw);
  if (!message || message === "[object Object]") return FALLBACK_MESSAGE;

  if (/no record of a prior credit/i.test(message) || /insufficient lamports/i.test(message)) {
    return "The wallet paying for this transaction doesn't have enough SOL to cover the network fee. Send it a small amount of SOL (0.02-0.05 SOL) and try again.";
  }

  if (/invalid account data for instruction/i.test(message) || /InvalidAccountData/.test(message)) {
    return "One of the wallets involved doesn't hold the token this transaction needs yet (no token account exists for it on-chain). Make sure it actually holds the token first.";
  }

  if (/insufficient funds/i.test(message) || /custom program error: 0x1\b/.test(message)) {
    return "One of the wallets involved doesn't have enough balance to cover this transaction.";
  }

  if (/blockhash not found/i.test(message) || /block height exceeded/i.test(message)) {
    return "This transaction took too long to confirm and expired. Please try again.";
  }

  if (/403/.test(message) && /forbidden/i.test(message)) {
    return "The Solana RPC endpoint rejected this request (403 Forbidden). The configured RPC provider may be rate-limiting or blocking this app -- try again shortly, or switch to a different RPC provider.";
  }

  if (/user rejected/i.test(message) || /rejected the request/i.test(message)) {
    return "The transaction was rejected in the wallet.";
  }

  // Unknown error shape. If it already reads like a short, plain-language
  // message -- e.g. one of this app's own thrown Errors, which are
  // already written for a human -- pass it through unchanged rather than
  // mangling it. Only trim things that actually look like raw
  // simulation/program-log noise or are implausibly long for a message a
  // person is meant to read.
  const looksRaw = /Logs:|Program log:|Program [A-Za-z0-9]{20,}|SendTransactionError|0x[0-9a-fA-F]{2,}\b/.test(
    message
  );
  if (!looksRaw && message.length <= 160) {
    return message;
  }
  const firstLine = message.split("\n")[0].split(". Logs:")[0].trim();
  const short = firstLine.length > 160 ? firstLine.slice(0, 160) + "..." : firstLine;
  return `${short || "The transaction failed."} (full details logged for debugging)`;
}
