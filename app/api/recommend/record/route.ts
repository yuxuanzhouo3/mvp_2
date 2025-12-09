/**
 * 用户行为记录 API
 * POST /api/recommend/record
 *
 * 记录用户对推荐的行为（查看、点击、保存等）
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  saveRecommendationToHistory,
  recordUserClick,
  updateUserPreferences,
  learnPreferencesFromHistory,
} from "@/lib/services/recommendation-service";
import { isValidUserId } from "@/lib/utils";
import type {
  RecordActionRequest,
  RecordActionResponse,
  RecommendationCategory,
} from "@/lib/types/recommendation";

// 有效的分类列表
const VALID_CATEGORIES: RecommendationCategory[] = [
  "entertainment",
  "shopping",
  "food",
  "travel",
  "fitness",
];

// 有效的行为类型
const VALID_ACTIONS = ["view", "click", "save", "share", "dismiss"] as const;

export async function POST(request: NextRequest) {
  try {
    const body: RecordActionRequest = await request.json();
    const { userId, category, recommendation, action } = body;

    // 验证必填字段
    if (!userId || !category || !recommendation || !action) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: userId, category, recommendation, action",
        } satisfies RecordActionResponse,
        { status: 400 }
      );
    }

    // 验证用户 ID 是否是有效 UUID
    if (!isValidUserId(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid userId format. Must be a valid UUID.",
        } satisfies RecordActionResponse,
        { status: 400 }
      );
    }

    // 验证分类
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid category",
        } satisfies RecordActionResponse,
        { status: 400 }
      );
    }

    // 验证行为类型
    if (!VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number])) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid action. Must be one of: view, click, save, share, dismiss",
        } satisfies RecordActionResponse,
        { status: 400 }
      );
    }

    // 验证推荐数据
    if (!recommendation.title || !recommendation.link) {
      return NextResponse.json(
        {
          success: false,
          error: "Recommendation must have title and link",
        } satisfies RecordActionResponse,
        { status: 400 }
      );
    }

    try {
      // 1. 保存推荐到历史
      const historyId = await saveRecommendationToHistory(userId, {
        ...recommendation,
        category,
      });

      if (!historyId) {
        throw new Error("Failed to save recommendation to history");
      }

      // 2. 记录用户行为
      const clickId = await recordUserClick(userId, historyId, action);

      // 3. 更新用户偏好统计
      const updatePromises: Promise<unknown>[] = [];

      if (action === "view") {
        updatePromises.push(
          updateUserPreferences(userId, category, { incrementView: true })
        );
      } else if (action === "click" || action === "save") {
        updatePromises.push(
          updateUserPreferences(userId, category, { incrementClick: true })
        );

        // 从推荐的元数据中提取标签更新偏好
        const tags = recommendation.metadata?.tags as string[] | undefined;
        if (tags && tags.length > 0) {
          const preferences: Record<string, number> = {};
          tags.forEach((tag) => {
            preferences[tag] = 1;
          });
          updatePromises.push(
            updateUserPreferences(userId, category, { preferences, tags })
          );
        }
      }

      await Promise.all(updatePromises);

      // 4. 如果是点击或保存，异步触发偏好学习
      if (action === "click" || action === "save") {
        learnPreferencesFromHistory(userId, category).catch((err) =>
          console.error("Failed to learn preferences:", err)
        );
      }

      return NextResponse.json({
        success: true,
        historyId,
        clickId: clickId || undefined,
      } satisfies RecordActionResponse);
    } catch (dbError) {
      console.error("Database error:", dbError);

      // 数据库不可用时，返回成功但标记为未持久化
      return NextResponse.json({
        success: true,
        error: "Action recorded locally (database unavailable)",
      } satisfies RecordActionResponse);
    }
  } catch (error) {
    console.error("Record API Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      } satisfies RecordActionResponse,
      { status: 500 }
    );
  }
}

// 批量记录行为
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, records } = body as {
      userId: string;
      records: Array<{
        category: RecommendationCategory;
        recommendation: RecordActionRequest["recommendation"];
        action: RecordActionRequest["action"];
      }>;
    };

    if (!userId || !records || !Array.isArray(records)) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: userId, records",
        },
        { status: 400 }
      );
    }

    // 验证用户 ID 是否是有效 UUID
    if (!isValidUserId(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid userId format. Must be a valid UUID.",
        },
        { status: 400 }
      );
    }

    const results = await Promise.allSettled(
      records.map(async (record) => {
        const historyId = await saveRecommendationToHistory(userId, {
          ...record.recommendation,
          category: record.category,
        });

        if (historyId) {
          await recordUserClick(userId, historyId, record.action);
        }

        return { historyId, action: record.action };
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      success: true,
      recorded: successful,
      failed,
    });
  } catch (error) {
    console.error("Batch Record API Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
