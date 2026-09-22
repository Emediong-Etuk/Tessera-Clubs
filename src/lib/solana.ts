import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  ACCOUNT_SIZE,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAccountLen,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import crypto from "crypto";
import bs58 from "bs58";
import { USDC_MINT } from "./constants";

/**
 * USDC is a classic SPL Token mint; every T-Token is confirmed (per
 * https://docs.tessera.pe/technicals/on-chain-programs) to be Token-2022
 * with a transfer-fee extension. Rather than an extra RPC round-trip to
 * inspect the mint's owner program on every call, this known split is
 * used directly.
 */
export function getProgramIdForMint(mint: string): PublicKey {
  return mint === USDC_MINT ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
}

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    const url = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
    connection = new Connection(url, "confirmed");
  }
  return connection;
}

// --- Club wallet keypair encryption -----------------------------------
//
// Custodial MVP: each club's pooled funds live in a server-generated
// keypair. The raw secret key never touches git or the client -- it's
// AES-256-GCM encrypted with CLUB_WALLET_ENCRYPTION_KEY before being
// stored in the database. See README's "Custody model" section for the
// honest disclosure of what this does and doesn't protect against.

function getEncryptionKey(): Buffer {
  const hex = process.env.CLUB_WALLET_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "CLUB_WALLET_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecretKey(secretKey: Uint8Array): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(secretKey)), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(
    "."
  );
}

export function decryptSecretKey(payload: string): Uint8Array {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted club wallet payload");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return new Uint8Array(decrypted);
}

export function generateClubWallet(): { publicKey: string; encryptedSecretKey: string } {
  const kp = Keypair.generate();
  return {
    publicKey: kp.publicKey.toBase58(),
    encryptedSecretKey: encryptSecretKey(kp.secretKey),
  };
}

export function loadClubKeypair(encryptedSecretKey: string): Keypair {
  return Keypair.fromSecretKey(decryptSecretKey(encryptedSecretKey));
}

export function keypairFromBase58(secret: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(secret));
}

// --- Rent / fee constants for the savings comparison --------------------
//
// The measurable, non-negligible efficiency win at $5-$20 contribution
// sizes isn't AMM price impact (see lib/savings.ts) -- it's that every
// individual buyer needs their own associated token account for the
// Token-2022 T-Token mint plus their own signed transaction, while a
// pooled club buy needs exactly one of each regardless of member count.
// These numbers come from live RPC calls, not hardcoded constants.

export const SOLANA_BASE_FEE_LAMPORTS_PER_SIGNATURE = 5000;

/** Real rent-exempt minimum (lamports) for a token account of the given mint, including any Token-2022 extensions (e.g. transfer fee). */
export async function getTokenAccountRentLamports(mintAddress: string): Promise<number> {
  const conn = getConnection();
  if (mintAddress === USDC_MINT) {
    return conn.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);
  }
  const mintPubkey = new PublicKey(mintAddress);
  const mintInfo = await getMint(conn, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);
  const extensions = mintInfo.tlvData.length > 0 ? [ExtensionType.TransferFeeAmount] : [];
  const accountLen = getAccountLen(extensions);
  return conn.getMinimumBalanceForRentExemption(accountLen);
}

export function getAssociatedTokenAddressForOwner(mint: string, owner: string): PublicKey {
  return getAssociatedTokenAddressSync(
    new PublicKey(mint),
    new PublicKey(owner),
    false,
    getProgramIdForMint(mint)
  );
}

export async function tokenAccountExists(mint: string, owner: string): Promise<boolean> {
  const conn = getConnection();
  const ata = getAssociatedTokenAddressForOwner(mint, owner);
  const info = await conn.getAccountInfo(ata);
  return info !== null;
}

export async function getMintDecimals(mintAddress: string): Promise<number> {
  const conn = getConnection();
  const mintInfo = await getMint(conn, new PublicKey(mintAddress), "confirmed", getProgramIdForMint(mintAddress));
  return mintInfo.decimals;
}

/** Live balance (in whole tokens, not base units) of `mint` held by `owner`'s associated token account. Returns 0 if the account doesn't exist yet. */
export async function getTokenBalance(mintAddress: string, owner: string): Promise<number> {
  const conn = getConnection();
  const ata = getAssociatedTokenAddressForOwner(mintAddress, owner);
  try {
    const balance = await conn.getTokenAccountBalance(ata);
    return balance.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Live native SOL balance (in SOL, not lamports) of an address. The club
 * wallet only ever *receives* USDC from contributions -- nothing funds
 * its SOL balance automatically, but the batched buy and every exit
 * payout are transactions signed and paid for by the club wallet itself.
 * Surfaced on the dashboard so it's obvious *before* clicking "Buy" or
 * "Leave club" that the wallet needs a small direct SOL top-up first,
 * rather than failing confusingly mid-transaction.
 */
export async function getSolBalance(owner: string): Promise<number> {
  const conn = getConnection();
  try {
    const lamports = await conn.getBalance(new PublicKey(owner));
    return lamports / 1_000_000_000;
  } catch {
    return 0;
  }
}

const EXPIRY_PATTERN = /block height exceeded|blockhash not found|TransactionExpiredBlockheightExceededError/i;

/**
 * Every Solana transaction is only valid for a short window (~60-90s)
 * after it's built -- if confirmation takes longer (network congestion, a
 * slow RPC, a low priority fee), it expires even though nothing was
 * actually wrong with it. Observed live in this project on a real batched
 * buy. Rather than surfacing that as a failure the user has to manually
 * retry, rebuild a transaction with a fresh blockhash and try again
 * automatically a couple of times before giving up.
 */
export async function sendJupiterSwapWithRetry(params: {
  conn: Connection;
  signer: Keypair;
  buildSwapTransaction: () => Promise<{ swapTransaction: string; lastValidBlockHeight: number }>;
  maxAttempts?: number;
}): Promise<string> {
  const { conn, signer, buildSwapTransaction, maxAttempts = 3 } = params;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { swapTransaction, lastValidBlockHeight } = await buildSwapTransaction();
    const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
    tx.sign([signer]);

    try {
      const signature = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
      await conn.confirmTransaction(
        { signature, blockhash: tx.message.recentBlockhash, lastValidBlockHeight },
        "confirmed"
      );
      return signature;
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      const expired = EXPIRY_PATTERN.test(message);
      if (!expired || attempt === maxAttempts) throw err;
      // otherwise loop: rebuild with a fresh blockhash and try again
    }
  }
  throw lastErr;
}
