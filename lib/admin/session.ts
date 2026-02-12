import { getRequiredSecret } from "@/lib/auth/secrets";

const COOKIE_NAME = "admin_session";

type AdminSessionPayload = {
  v: 1;
  u: string;
  iat: number;
  exp: number;
};

function getAdminSessionSecret(): string {
  return getRequiredSecret("ADMIN_SESSION_SECRET", {
    minLength: 16,
  });
}

function utf8Encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function base64UrlEncode(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : (globalThis as any).Buffer.from(binary, "binary").toString("base64");
  return base64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecodeToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  const binary =
    typeof atob === "function"
      ? atob(padded)
      : (globalThis as any).Buffer.from(padded, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSha256(message: string, secret: string): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available in current runtime");
  }
  const key = await subtle.importKey(
    "raw",
    utf8Encode(secret) as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await subtle.sign(
    "HMAC",
    key,
    utf8Encode(message) as unknown as BufferSource
  );
  return new Uint8Array(sig);
}

function safeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function getAdminSessionCookieName(): string {
  return COOKIE_NAME;
}

export function getAdminSessionMaxAgeSeconds(): number {
  const days = Number(process.env.ADMIN_SESSION_DAYS || 7);
  if (!Number.isFinite(days) || days <= 0) return 7 * 24 * 60 * 60;
  return Math.floor(days * 24 * 60 * 60);
}

export async function createAdminSessionToken(username: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + getAdminSessionMaxAgeSeconds();
  const payload: AdminSessionPayload = { v: 1, u: username, iat, exp };

  const payloadBytes = utf8Encode(JSON.stringify(payload));
  const payloadPart = base64UrlEncode(payloadBytes);
  const secret = getAdminSessionSecret();
  const sigBytes = await hmacSha256(payloadPart, secret);
  const sigPart = base64UrlEncode(sigBytes);
  return `${payloadPart}.${sigPart}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined | null
): Promise<AdminSessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadPart, sigPart] = parts;
  if (!payloadPart || !sigPart) return null;

  let payloadJson: string;
  try {
    payloadJson = new TextDecoder().decode(base64UrlDecodeToBytes(payloadPart));
  } catch {
    return null;
  }

  let payload: AdminSessionPayload;
  try {
    payload = JSON.parse(payloadJson) as AdminSessionPayload;
  } catch {
    return null;
  }

  if (!payload || payload.v !== 1 || typeof payload.u !== "string") return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) return null;

  const secret = getAdminSessionSecret();
  const expectedSig = await hmacSha256(payloadPart, secret);
  let providedSig: Uint8Array;
  try {
    providedSig = base64UrlDecodeToBytes(sigPart);
  } catch {
    return null;
  }
  if (!safeEqualBytes(expectedSig, providedSig)) return null;

  return payload;
}
