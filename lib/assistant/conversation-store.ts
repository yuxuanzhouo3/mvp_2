/**
 * AI 助手对话持久化
 *
 * 功能描述：保存和加载用户的对话历史
 * 支持双环境：INTL (Supabase) / CN (CloudBase)
 * 用于跨会话保留上下文，让 AI 能"记住"之前的对话
 */

import { createClient } from "@supabase/supabase-js";
import { isChinaDeployment } from "@/lib/config/deployment.config";
import type { AssistantResponse } from "./types";

// ==========================================
// 数据库客户端
// ==========================================

let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (supabaseAdminInstance) return supabaseAdminInstance;
  supabaseAdminInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  return supabaseAdminInstance;
}

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
// 保存对话消息
// ==========================================

/**
 * 保存一条对话消息
 * @param userId - 用户 ID
 * @param role - 消息角色
 * @param content - 文本内容
 * @param structuredResponse - 结构化响应（仅 assistant）
 * @param metadata - 附加元数据
 */
export async function saveConversationMessage(
  userId: string,
  role: "user" | "assistant",
  content: string,
  structuredResponse?: AssistantResponse,
  metadata?: Record<string, unknown>,
  createdAt?: string
): Promise<void> {
  try {
    if (isChinaDeployment()) {
      await saveMessageCN(userId, role, content, structuredResponse, metadata, createdAt);
    } else {
      await saveMessageINTL(userId, role, content, structuredResponse, metadata, createdAt);
    }
  } catch (error) {
    // 对话保存失败不应阻断主流程
    console.error("[ConversationStore] Failed to save message:", error);
  }
}

async function saveMessageINTL(
  userId: string,
  role: string,
  content: string,
  structuredResponse?: AssistantResponse,
  metadata?: Record<string, unknown>,
  createdAt?: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("assistant_conversations") as any).insert({
    user_id: userId,
    role,
    content,
    structured_response: structuredResponse || null,
    metadata: metadata || {},
    created_at: createdAt || new Date().toISOString(),
  });
}

async function saveMessageCN(
  userId: string,
  role: string,
  content: string,
  structuredResponse?: AssistantResponse,
  metadata?: Record<string, unknown>,
  createdAt?: string
): Promise<void> {
  const db = await getCloudBaseDb();
  await db.collection("assistant_conversations").add({
    user_id: userId,
    role,
    content,
    structured_response: structuredResponse || null,
    metadata: metadata || {},
    created_at: createdAt || new Date().toISOString(),
  });
}

// ==========================================
// 加载对话历史
// ==========================================

export interface ConversationRecord {
  id: string;
  role: "user" | "assistant";
  content: string;
  structuredResponse?: AssistantResponse;
  createdAt: string;
}

const CONVERSATION_ROLE_ORDER: Record<ConversationRecord["role"], number> = {
  user: 0,
  assistant: 1,
};

function parseConversationTime(createdAt: string): number {
  const parsed = Date.parse(createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortConversationRecordsChronologically(
  records: ConversationRecord[]
): ConversationRecord[] {
  return [...records].sort((left, right) => {
    const timeDelta = parseConversationTime(left.createdAt) - parseConversationTime(right.createdAt);
    if (timeDelta !== 0) return timeDelta;

    const roleDelta = CONVERSATION_ROLE_ORDER[left.role] - CONVERSATION_ROLE_ORDER[right.role];
    if (roleDelta !== 0) return roleDelta;

    return left.id.localeCompare(right.id);
  });
}

/**
 * 获取用户最近的对话历史
 * @param userId - 用户 ID
 * @param limit - 最多返回条数（默认 20）
 * @returns 对话记录列表（按时间正序）
 */
export async function getRecentConversations(
  userId: string,
  limit: number = 20
): Promise<ConversationRecord[]> {
  try {
    if (isChinaDeployment()) {
      return getRecentConversationsCN(userId, limit);
    }
    return getRecentConversationsINTL(userId, limit);
  } catch (error) {
    console.error("[ConversationStore] Failed to load conversations:", error);
    return [];
  }
}

async function getRecentConversationsINTL(
  userId: string,
  limit: number
): Promise<ConversationRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const records = data
    .reverse() // 按时间正序
    .map((row: Record<string, unknown>) => ({
      id: row.id as string,
      role: row.role as "user" | "assistant",
      content: row.content as string,
      structuredResponse: row.structured_response as AssistantResponse | undefined,
      createdAt: row.created_at as string,
    }));

  return sortConversationRecordsChronologically(records);
}

async function getRecentConversationsCN(
  userId: string,
  limit: number
): Promise<ConversationRecord[]> {
  const db = await getCloudBaseDb();
  const result = await db
    .collection("assistant_conversations")
    .where({ user_id: userId })
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();

  if (!result.data) return [];

  const records = result.data
    .reverse()
    .map((row: Record<string, unknown>) => ({
      id: (row._id as string) || "",
      role: row.role as "user" | "assistant",
      content: row.content as string,
      structuredResponse: row.structured_response as AssistantResponse | undefined,
      createdAt: row.created_at as string,
    }));

  return sortConversationRecordsChronologically(records);
}

/**
 * 清除用户对话历史
 * @param userId - 用户 ID
 */
export async function clearConversations(userId: string): Promise<{ success: boolean }> {
  try {
    if (isChinaDeployment()) {
      const db = await getCloudBaseDb();
      // CloudBase 不支持批量删除，需要逐条删除
      const result = await db
        .collection("assistant_conversations")
        .where({ user_id: userId })
        .limit(100)
        .get();
      if (result.data) {
        for (const doc of result.data) {
          await db.collection("assistant_conversations").doc(doc._id as string).remove();
        }
      }
    } else {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("assistant_conversations")
        .delete()
        .eq("user_id", userId);
    }
    return { success: true };
  } catch (error) {
    console.error("[ConversationStore] Failed to clear conversations:", error);
    return { success: false };
  }
}
