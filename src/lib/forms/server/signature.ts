// The webhook's signature: HMAC-SHA256 over `${timestamp}.${body}`, as
// `sha256=<hex>`. The timestamp (Unix seconds) is signed with the body, so a
// captured request cannot be replayed once it is older than the receiver's
// tolerance. Web Crypto only, so it runs on Node, on Workers and in a
// receiver written in either.

const encoder = new TextEncoder();
const PREFIX = "sha256=";

export type SignedRequest = { body: string; timestamp: string | null; signature: string | null };

const hmacKey = (secret: string, usage: "sign" | "verify") => crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);

/** The X-Form-Signature value for a body sent at `timestamp` (Unix seconds, as a string). */
export async function signFormBody(secret: string, timestamp: string, body: string): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), encoder.encode(`${timestamp}.${body}`));
  return PREFIX + [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * For a receiver written in JavaScript: true when the signature is the
 * body's and the timestamp is within the tolerance of now. The comparison is
 * crypto.subtle.verify's, which takes constant time.
 */
export async function verifyFormSignature(secret: string, { body, timestamp, signature }: SignedRequest, { toleranceSeconds = 300, now = Date.now() } = {}): Promise<boolean> {
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > toleranceSeconds) return false;
  const mac = signature?.startsWith(PREFIX) ? fromHex(signature.slice(PREFIX.length)) : undefined;
  if (!mac) return false;
  return crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), mac, encoder.encode(`${timestamp}.${body}`));
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | undefined {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) return undefined;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
