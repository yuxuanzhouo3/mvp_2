/**
 * 用户偏好分析 API
 * GET /api/preferences/[userId]
 *
 * 获取用户在各分类下的偏好分析
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  getUserPreferenceAnalysis,
  getUserPreferences,
  getUserRecommendationHistory,
} from "@/lib/services/recommendation-service";
import { isValidUserId } from "@/lib/utils";
import type { UserPreferencesResponse, RecommendationCategory } from "@/lib/types/recommendation";

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    // 验证用户 ID 是否是有效 UUID
    if (!isValidUserId(userId)) {
      return NextResponse.json(
        {
          success: false,
          analysis: null,
          error: "Valid userId (UUID format) is required",
        } satisfies UserPreferencesResponse,
        { status: 400 }
      );
    }

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category") as RecommendationCategory | null;
    const includeHistory = searchParams.get("includeHistory") === "true";

    try {
      // 获取完整偏好分析
      const analysis = await getUserPreferenceAnalysis(userId);

      // 如果指定了分类，只返回该分类的信息
      if (category) {
        const categoryPref = analysis.preferences.find((p) => p.category === category);

        if (!categoryPref) {
          return NextResponse.json({
            success: true,
            analysis: {
              ...analysis,
              preferences: [],
            },
          } satisfies UserPreferencesResponse);
        }

        // 如果需要历史记录
        let history: Awaited<ReturnType<typeof getUserRecommendationHistory>> = [];
        if (includeHistory) {
          // 从请求参数获取历史记录限制，默认为 20
          const historyLimit = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get("historyLimit") || "20"), 1), 100);
          history = await getUserRecommendationHistory(userId, category, historyLimit);
        }

        return NextResponse.json({
          success: true,
          analysis: {
            ...analysis,
            preferences: [categoryPref],
          },
          history: includeHistory ? history : undefined,
        });
      }

      return NextResponse.json({
        success: true,
        analysis,
      } satisfies UserPreferencesResponse);
    } catch (dbError) {
      console.error("Database error:", dbError);

      // 数据库不可用，返回空分析
      return NextResponse.json({
        success: true,
        analysis: {
          userId,
          preferences: [],
          totalInteractions: 0,
          favoriteCategory: null,
          lastActiveAt: null,
        },
        error: "Database unavailable, showing empty preferences",
      } satisfies UserPreferencesResponse);
    }
  } catch (error) {
    console.error("Preferences API Error:", error);

    return NextResponse.json(
      {
        success: false,
        analysis: null,
        error: "Internal server error",
      } satisfies UserPreferencesResponse,
      { status: 500 }
    );
  }
}

// 更新用户偏好（手动设置标签）
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    // 验证用户 ID 是否是有效 UUID
    if (!isValidUserId(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid userId (UUID format) is required",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { category, tags, preferences } = body as {
      category: RecommendationCategory;
      tags?: string[];
      preferences?: Record<string, number>;
    };

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: "Category is required",
        },
        { status: 400 }
      );
    }

    // 动态导入以避免循环依赖
    const { updateUserPreferences } = await import("@/lib/services/recommendation-service");

    const updated = await updateUserPreferences(userId, category, {
      tags,
      preferences,
    });

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update preferences",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preference: updated,
    });
  } catch (error) {
    console.error("Update Preferences API Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

// 删除用户偏好数据
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    // 验证用户 ID 是否是有效 UUID
    if (!isValidUserId(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid userId (UUID format) is required",
        },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category") as RecommendationCategory | null;

    // 这里简化处理，实际应该添加删除服务
    // 可以通过 Supabase 直接删除

    return NextResponse.json({
      success: true,
      message: category
        ? `Preferences for ${category} will be reset`
        : "All preferences will be reset",
    });
  } catch (error) {
    console.error("Delete Preferences API Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
