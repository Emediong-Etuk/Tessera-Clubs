import { describe, expect, it, vi } from "vitest";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { sendJupiterSwapWithRetry } from "../solana";

// A syntactically valid (32 zero-byte) base58 blockhash -- never actually
// submitted to a network in these tests, just needs to serialize.
const FAKE_BLOCKHASH = bs58.encode(new Uint8Array(32));

// Builds a real, validly-signable (but never broadcast) v0 transaction so
// the retry helper's actual deserialize/sign/serialize path is exercised,
// not just mocked away.
function fakeSwapTransaction(payer: PublicKey, blockhash: string) {
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({ fromPubkey: payer, toPubkey: Keypair.generate().publicKey, lamports: 1 }),
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  return Buffer.from(tx.serialize()).toString("base64");
}

function mockConn(overrides: { sendRawTransaction?: () => Promise<string>; confirmTransaction?: () => Promise<unknown> }) {
  return {
    sendRawTransaction: overrides.sendRawTransaction ?? vi.fn().mockResolvedValue("sig123"),
    confirmTransaction: overrides.confirmTransaction ?? vi.fn().mockResolvedValue({ value: { err: null } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("sendJupiterSwapWithRetry", () => {
  it("returns the signature on first-attempt success without retrying", async () => {
    const signer = Keypair.generate();
    let buildCount = 0;
    const conn = mockConn({});

    const signature = await sendJupiterSwapWithRetry({
      conn,
      signer,
      buildSwapTransaction: async () => {
        buildCount++;
        return {
          swapTransaction: fakeSwapTransaction(signer.publicKey, FAKE_BLOCKHASH),
          lastValidBlockHeight: 1000,
        };
      },
    });

    expect(signature).toBe("sig123");
    expect(buildCount).toBe(1);
  });

  it("rebuilds with a fresh blockhash and retries on a real observed blockhash-expiry error", async () => {
    const signer = Keypair.generate();
    let buildCount = 0;
    let confirmCalls = 0;

    const conn = mockConn({
      confirmTransaction: vi.fn().mockImplementation(async () => {
        confirmCalls++;
        if (confirmCalls === 1) {
          throw new Error("TransactionExpiredBlockheightExceededError: block height exceeded");
        }
        return { value: { err: null } };
      }),
    });

    const signature = await sendJupiterSwapWithRetry({
      conn,
      signer,
      maxAttempts: 3,
      buildSwapTransaction: async () => {
        buildCount++;
        return {
          swapTransaction: fakeSwapTransaction(signer.publicKey, FAKE_BLOCKHASH),
          lastValidBlockHeight: 1000,
        };
      },
    });

    expect(signature).toBe("sig123");
    expect(buildCount).toBe(2); // rebuilt once after the expiry, then succeeded
  });

  it("does not retry a non-expiry failure -- fails fast instead of masking a real problem", async () => {
    const signer = Keypair.generate();
    let buildCount = 0;
    const conn = mockConn({
      sendRawTransaction: vi.fn().mockRejectedValue(new Error("Attempt to debit an account but found no record of a prior credit.")),
    });

    await expect(
      sendJupiterSwapWithRetry({
        conn,
        signer,
        maxAttempts: 3,
        buildSwapTransaction: async () => {
          buildCount++;
          return {
            swapTransaction: fakeSwapTransaction(signer.publicKey, FAKE_BLOCKHASH),
            lastValidBlockHeight: 1000,
          };
        },
      })
    ).rejects.toThrow(/no record of a prior credit/);
    expect(buildCount).toBe(1);
  });

  it("gives up after maxAttempts even if every failure is an expiry", async () => {
    const signer = Keypair.generate();
    let buildCount = 0;
    const conn = mockConn({
      confirmTransaction: vi.fn().mockRejectedValue(new Error("blockhash not found")),
    });

    await expect(
      sendJupiterSwapWithRetry({
        conn,
        signer,
        maxAttempts: 2,
        buildSwapTransaction: async () => {
          buildCount++;
          return {
            swapTransaction: fakeSwapTransaction(signer.publicKey, FAKE_BLOCKHASH),
            lastValidBlockHeight: 1000,
          };
        },
      })
    ).rejects.toThrow(/blockhash not found/);
    expect(buildCount).toBe(2);
  });
});
