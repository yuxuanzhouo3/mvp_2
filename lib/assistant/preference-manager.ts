/**
 * AI 助手偏好管理器
 *
 * 功能描述：管理用户在 AI 助手中保存的筛选偏好
 * 支持保存、读取、更新和删除偏好
 * 双环境支持：INTL (Supabase) / CN (CloudBase)
 */

import { createClient } from "@supabase/supabase-js";
import { isChinaDeployment } from "@/lib/config/deployment.config";
import type { AssistantPreference } from "./types";

// ==========================================
// 数据库客户端
// ==========================================

let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

/**
 * 获取 Supabase Admin 客户端
 * @returns Supabase Client
 */
function getSupabaseAdmin() {
  if (supabaseAdminInstance) return supabaseAdminInstance;
  supabaseAdminInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  return supabaseAdminInstance;
}

/**
 * 获取 CloudBase DB
 * @returns CloudBase Database
 */
async function getCloudBaseDb() {
  const cloudbase = (await import("@cloudbase/node-sdk")).default;
  const app = cloudbase.init({
    env: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
    secretId: process.env.CLOUDBASE_SECRET_ID,
    secretKey: process.env.CLOUDBASE_SECRET_KEY,
  });
  return app.database();
}

// ==========================================
// 保存偏好
// ==========================================

/**
 * 保存或更新用户偏好
 * @param userId - 用户 ID
 * @param name - 偏好名称
 * @param filters - 偏好筛选条件
 * @returns 操作结果
 */
export async function savePreference(
  userId: string,
  name: string,
  filters: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (isChinaDeployment()) {
    return savePreferenceCN(userId, name, filters);
  }
  return savePreferenceINTL(userId, name, filters);
}

async function savePreferenceINTL(
  userId: string,
  name: string,
  filters: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("assistant_preferences")
    .upsert(
      {
        user_id: userId,
        name,
        filters,
        updated_at: now,
      },
      { onConflict: "user_id,name" }
    );

  if (error) {
    console.error("[PreferenceManager] INTL save error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

async function savePreferenceCN(
  userId: string,
  name: string,
  filters: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const db = await getCloudBaseDb();
  const now = new Date().toISOString();

  try {
    // 尝试更新已有记录
    const existing = await db
      .collection("assistant_preferences")
      .where({ user_id: userId, name })
      .limit(1)
      .get();

    if (existing.data && existing.data.length > 0) {
      await db
        .collection("assistant_preferences")
        .doc(existing.data[0]._id)
        .update({ filters, updated_at: now });
    } else {
      await db.collection("assistant_preferences").add({
        user_id: userId,
        name,
        filters,
        created_at: now,
        updated_at: now,
      });
    }
    return { success: true };
  } catch (err) {
    console.error("[PreferenceManager] CN save error:", err);
    return { success: false, error: "Failed to save preference" };
  }
}

// ==========================================
// 读取偏好
// ==========================================

/**
 * 获取用户所有偏好
 * @param userId - 用户 ID
 * @returns 偏好列表
 */
export async function getUserPreferences(
  userId: string
): Promise<AssistantPreference[]> {
  if (isChinaDeployment()) {
    return getUserPreferencesCN(userId);
  }
  return getUserPreferencesINTL(userId);
}

async function getUserPreferencesINTL(
  userId: string
): Promise<AssistantPreference[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("assistant_preferences")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[PreferenceManager] INTL fetch error:", error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    userId: row.user_id as string,
    name: row.name as string,
    filters: (row.filters as Record<string, unknown>) || {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

async function getUserPreferencesCN(
  userId: string
): Promise<AssistantPreference[]> {
  const db = await getCloudBaseDb();

  try {
    const result = await db
      .collection("assistant_preferences")
      .where({ user_id: userId })
      .orderBy("updated_at", "desc")
      .get();

    return (result.data || []).map((row: Record<string, unknown>) => ({
      userId: row.user_id as string,
      name: row.name as string,
      filters: (row.filters as Record<string, unknown>) || {},
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  } catch {
    return [];
  }
}

/**
 * 删除用户偏好
 * @param userId - 用户 ID
 * @param name - 偏好名称
 * @returns 操作结果
 */
export async function deletePreference(
  userId: string,
  name: string
): Promise<{ success: boolean }> {
  if (isChinaDeployment()) {
    const db = await getCloudBaseDb();
    try {
      const result = await db
        .collection("assistant_preferences")
        .where({ user_id: userId, name })
        .limit(1)
        .get();
      if (result.data?.[0]) {
        await db.collection("assistant_preferences").doc(result.data[0]._id).remove();
      }
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  const supabase = getSupabaseAdmin();
  await supabase
    .from("assistant_preferences")
    .delete()
    .eq("user_id", userId)
    .eq("name", name);
  return { success: true };
}
