import { describe, expect, it } from "vitest";
import { humanizeChainError } from "../chainErrors";

describe("humanizeChainError", () => {
  it("explains a fee-payer-has-no-SOL failure (observed live: empty-SOL club wallet)", () => {
    const raw = new Error(
      "On-chain swap failed: Simulation failed. Message: Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.. Logs: []. Catch the `SendTransactionError` and call `getLogs()` on it for full details.."
    );
    const result = humanizeChainError(raw);
    expect(result).toMatch(/enough SOL/i);
    expect(result).not.toMatch(/Logs: \[\]/);
    expect(result).not.toMatch(/SendTransactionError/);
  });

  it("explains a missing-token-account failure (observed live: sender wallet with no USDC account)", () => {
    const raw = new Error(
      'Transaction simulation failed: Error processing Instruction 1: invalid account data for instruction. Logs: [ "Program log: Error: InvalidAccountData" ]'
    );
    const result = humanizeChainError(raw);
    expect(result).toMatch(/doesn't hold the token/i);
    expect(result).not.toMatch(/Program log/);
  });

  it("explains a public-RPC 403 (observed live: default public mainnet-beta endpoint)", () => {
    const raw = new Error('failed to get recent blockhash: Error: 403 : {"jsonrpc":"2.0","error":{"code": 403, "message":"Access forbidden"}}');
    const result = humanizeChainError(raw);
    expect(result).toMatch(/RPC/i);
    expect(result).toMatch(/403/);
  });

  it("explains an expired transaction", () => {
    expect(humanizeChainError(new Error("block height exceeded"))).toMatch(/took too long|expired/i);
  });

  it("explains a user-rejected wallet transaction", () => {
    expect(humanizeChainError(new Error("User rejected the request."))).toMatch(/rejected/i);
  });

  it("falls back to a short, truncated message for anything unrecognized rather than a raw dump", () => {
    const huge = "Some unrecognized error. " + "x".repeat(500);
    const result = humanizeChainError(new Error(huge));
    expect(result.length).toBeLessThan(220);
  });

  it("handles non-Error values without throwing or leaking 'undefined'/'null'/'[object Object]'", () => {
    expect(() => humanizeChainError("plain string error")).not.toThrow();
    expect(humanizeChainError(undefined)).not.toMatch(/undefined/);
    expect(humanizeChainError(null)).not.toMatch(/null/);
    expect(humanizeChainError({})).not.toMatch(/\[object Object\]/);
  });

  it("passes through an already-clean, short app-level message unchanged", () => {
    const clean =
      "This wallet doesn't hold any USDC yet. Get some real USDC into it first (e.g. swap SOL for USDC in your wallet), then try again.";
    expect(humanizeChainError(new Error(clean))).toBe(clean);
    expect(humanizeChainError(new Error("Enter a contribution amount greater than zero."))).toBe(
      "Enter a contribution amount greater than zero."
    );
  });
});
