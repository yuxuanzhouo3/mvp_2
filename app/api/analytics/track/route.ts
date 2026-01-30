import { NextRequest, NextResponse } from "next/server";
import { parseUserAgent } from "@/lib/analytics/user-agent";
import { recordAnalyticsEvent } from "@/lib/analytics/store";

const COOKIE_NAME = "analytics_sid";
const MAX_PROPERTIES_SIZE = 8 * 1024;

const allowedEventTypes = new Set<string>([
  "session_start",
  "page_view",
  "onboarding_step_view",
  "onboarding_abandon",
  "onboarding_complete",
  "recommend_request",
  "recommend_success",
  "recommend_error",
  "recommend_result_view",
  "recommend_click",
  "recommend_return",
  "payment_success",
  "payment_failed",
]);

const rateLimitWindowMs = 10_000;
const rateLimitMax = 60;
const rateLimitMap = new Map<string, { ts: number; count: number }>();

function getClientKey(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.ip ||
    "unknown"
  );
}

function rateLimitOk(key: string): boolean {
  const now = Date.now();
  const item = rateLimitMap.get(key);
  if (!item || now - item.ts > rateLimitWindowMs) {
    rateLimitMap.set(key, { ts: now, count: 1 });
    return true;
  }
  item.count += 1;
  return item.count <= rateLimitMax;
}

export async function POST(request: NextRequest) {
  const key = getClientKey(request);
  if (!rateLimitOk(key)) {
    return NextResponse.json(
      { success: false, error: "Rate limited" },
      { status: 429 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const eventType = String(body?.eventType || "");
  if (!eventType || !allowedEventTypes.has(eventType)) {
    return NextResponse.json(
      { success: false, error: "Invalid eventType" },
      { status: 400 }
    );
  }

  const userId = body?.userId ? String(body.userId) : null;
  let sessionId = body?.sessionId ? String(body.sessionId) : null;
  const cookieSession = request.cookies.get(COOKIE_NAME)?.value;
  if (!sessionId) sessionId = cookieSession || null;
  const isNewSession = !sessionId;
  if (!sessionId) sessionId = crypto.randomUUID();

  const path = body?.path ? String(body.path) : request.nextUrl.pathname;
  const step = body?.step ? String(body.step) : null;
  const referrer = body?.referrer ? String(body.referrer) : null;
  const properties =
    body?.properties && typeof body.properties === "object" ? body.properties : {};

  try {
    const propertiesSize = JSON.stringify(properties).length;
    if (propertiesSize > MAX_PROPERTIES_SIZE) {
      return NextResponse.json(
        { success: false, error: "properties too large" },
        { status: 413 }
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid properties" },
      { status: 400 }
    );
  }

  const ua = request.headers.get("user-agent");
  const parsed = parseUserAgent(ua);

  await recordAnalyticsEvent({
    eventType,
    userId,
    sessionId,
    path,
    step,
    referrer,
    userAgent: ua,
    device: parsed.device,
    os: parsed.os,
    browser: parsed.browser,
    properties,
  });

  const res = NextResponse.json({ success: true, sessionId });
  if (isNewSession) {
    res.cookies.set(COOKIE_NAME, sessionId, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  }
  return res;
}
