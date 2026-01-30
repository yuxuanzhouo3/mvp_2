"use client";

import { isValidUserId } from "@/lib/utils";

const SESSION_KEY = "analytics_session_id";
const SESSION_STARTED_KEY = "analytics_session_started";

function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

async function postEvent(payload: any): Promise<void> {
  try {
    await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    return;
  }
}

export async function trackClientEvent(input: {
  eventType:
    | "session_start"
    | "page_view"
    | "onboarding_step_view"
    | "onboarding_abandon"
    | "onboarding_complete"
    | "recommend_request"
    | "recommend_success"
    | "recommend_error"
    | "recommend_result_view"
    | "recommend_click"
    | "recommend_return"
    | "payment_success"
    | "payment_failed";
  userId?: string | null;
  path?: string;
  step?: string | null;
  properties?: Record<string, any>;
}) {
  const sessionId = getOrCreateSessionId();
  const userId =
    input.userId && isValidUserId(input.userId) ? input.userId : null;
  await postEvent({
    eventType: input.eventType,
    userId,
    sessionId,
    path: input.path,
    step: input.step,
    properties: input.properties || {},
    referrer: typeof document !== "undefined" ? document.referrer : null,
  });
}

export async function ensureSessionStarted(input: {
  userId?: string | null;
  path?: string;
}) {
  try {
    const started = localStorage.getItem(SESSION_STARTED_KEY);
    if (started) return;
    localStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
  } catch {
    return;
  }

  await trackClientEvent({
    eventType: "session_start",
    userId: input.userId,
    path: input.path,
  });
}
