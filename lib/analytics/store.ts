import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import {
  CloudBaseCollections,
  getCloudBaseDatabase,
  nowISO,
} from "@/lib/database/cloudbase-client";
import { isChinaDeployment } from "@/lib/config/deployment.config";
import { isValidUUID } from "@/lib/utils";

export type AnalyticsEventInput = {
  eventType: string;
  userId?: string | null;
  sessionId?: string | null;
  path?: string | null;
  step?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  device?: string | null;
  os?: string | null;
  browser?: string | null;
  properties?: Record<string, any> | null;
  createdAt?: string | null;
};

export async function recordAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  const createdAt = input.createdAt || new Date().toISOString();

  if (isChinaDeployment()) {
    const db = getCloudBaseDatabase();
    const collection = db.collection(CloudBaseCollections.ANALYTICS_EVENTS);
    await collection.add({
      event_type: input.eventType,
      user_id: input.userId || null,
      session_id: input.sessionId || null,
      path: input.path || null,
      step: input.step || null,
      referrer: input.referrer || null,
      user_agent: input.userAgent || null,
      device: input.device || null,
      os: input.os || null,
      browser: input.browser || null,
      properties: input.properties || {},
      created_at: input.createdAt || nowISO(),
    });
    return;
  }

  const supabase = getSupabaseAdmin();
  await supabase.from("analytics_events").insert({
    event_type: input.eventType,
    user_id: input.userId && isValidUUID(input.userId) ? input.userId : null,
    session_id: input.sessionId || null,
    path: input.path || null,
    step: input.step || null,
    referrer: input.referrer || null,
    user_agent: input.userAgent || null,
    device: input.device || null,
    os: input.os || null,
    browser: input.browser || null,
    properties: input.properties || {},
    created_at: createdAt,
  });
}

