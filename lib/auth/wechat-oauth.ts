import crypto from "node:crypto";

export type WeChatLoginType = "open" | "miniprogram" | "mobile_app";

export type WeChatSignedStatePayload = {
  n: string;
  r: string;
  t: WeChatLoginType;
  iat: number;
  exp: number;
};

function base64UrlEncode(input: string | Buffer): string {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buffer.toString("base64url");
}

function base64UrlDecodeToString(input: string): string {
  return Buffer.from(input, "base64url").toString("utf-8");
}

function getWeChatStateSecret(): string {
  const secret =
    process.env.WECHAT_OAUTH_STATE_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.WECHAT_MOBILE_APP_SECRET ||
    process.env.WECHAT_APP_SECRET ||
    "";
  if (!secret) {
    throw new Error("WECHAT_OAUTH_STATE_SECRET is not configured");
  }
  return secret;
}

function signStatePayload(payloadB64: string): string {
  const secret = getWeChatStateSecret();
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest();
  return base64UrlEncode(signature);
}

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

export function createWeChatSignedState(input: {
  nonce: string;
  redirectPath: string;
  loginType: WeChatLoginType;
  ttlSeconds?: number;
}): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttlSeconds = Math.max(60, input.ttlSeconds ?? 10 * 60);
  const payload: WeChatSignedStatePayload = {
    n: input.nonce,
    r: input.redirectPath,
    t: input.loginType,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signatureB64 = signStatePayload(payloadB64);
  return `${payloadB64}.${signatureB64}`;
}

export function parseWeChatSignedState(state: string | null): WeChatSignedStatePayload | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) return null;

  const expectedSignature = signStatePayload(payloadB64);
  const a = Buffer.from(signatureB64, "base64url");
  const b = Buffer.from(expectedSignature, "base64url");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const payload = safeJsonParse<WeChatSignedStatePayload>(base64UrlDecodeToString(payloadB64));
  if (!payload) return null;
  if (payload.t !== "open" && payload.t !== "miniprogram" && payload.t !== "mobile_app") return null;
  if (typeof payload.n !== "string" || typeof payload.r !== "string") return null;
  if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSeconds) return null;
  if (payload.iat > nowSeconds + 60) return null;

  return payload;
}
