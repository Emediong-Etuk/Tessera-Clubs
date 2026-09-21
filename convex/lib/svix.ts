// Manual Svix webhook signature verification. AgentMail signs webhook
// deliveries with Svix; we don't pull in the "svix" npm package because
// this runs in Convex's default V8 runtime (Web Crypto, not Node crypto).
// Spec: https://docs.agentmail.to/webhook-verification
export async function verifySvixSignature(params: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  body: string;
}): Promise<boolean> {
  const { secret, svixId, svixTimestamp, svixSignature, body } = params;

  const timestamp = Number(svixTimestamp);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 5 * 60) return false;

  const secretBytes = base64Decode(secret.replace(/^whsec_/, ""));
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent) as BufferSource,
  );
  const expected = base64Encode(new Uint8Array(signatureBytes));

  return svixSignature
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter((candidate): candidate is string => Boolean(candidate))
    .some((candidate) => timingSafeEqual(candidate, expected));
}

function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
