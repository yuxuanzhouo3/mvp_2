/**
 * 推荐历史管理 API
 * GET /api/recommend/history - 获取历史记录
 * DELETE /api/recommend/history - 删除历史记录
 * PUT /api/recommend/history - 批量更新历史记录
 *
 * 支持双环境架构：INTL (Supabase) 和 CN (CloudBase)
 */

import { type NextRequest, NextResponse } from "next/server"

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
import { isValidUserId } from "@/lib/utils"
import { getRecommendationAdapter } from "@/lib/database"
import type { RecommendationCategory, UserAction } from "@/lib/database/types"

/**
 * 获取用户推荐历史记录
 * GET /api/recommend/history?userId=xxx&category=xxx&limit=20
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const userId = searchParams.get("userId")
        const category = searchParams.get("category") as RecommendationCategory | null
        const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100"), 1), 500)
        const offset = parseInt(searchParams.get("offset") || "0")

        if (!userId || !isValidUserId(userId)) {
            return NextResponse.json(
                { success: false, error: "Invalid or missing userId" },
                { status: 400 }
            )
        }

        const adapter = await getRecommendationAdapter()
        const result = await adapter.getRecommendationHistory(userId, category || undefined, {
            limit,
            offset,
            orderBy: 'created_at',
            ascending: false,
        })

        if (result.error) {
            console.error("Error fetching recommendation history:", result.error)
            return NextResponse.json(
                { success: false, error: result.error.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            data: result.data || [],
            count: result.count || 0,
        })
    } catch (error) {
        console.error("Error in GET /api/recommend/history:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
}

/**
 * 删除推荐历史记录
 * DELETE /api/recommend/history
 *
 * 请求体：
 * {
 *   "userId": "user-id",
 *   "historyIds": ["id1", "id2"]  // 要删除的记录 ID，如果为空则删除所有
 *   "category": "food"  // 可选，只删除该分类的记录
 * }
 */
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json()
        const { userId, historyIds, category } = body

        if (!userId || !isValidUserId(userId)) {
            return NextResponse.json(
                { success: false, error: "Invalid or missing userId" },
                { status: 400 }
            )
        }

        const adapter = await getRecommendationAdapter()
        const result = await adapter.deleteRecommendations(
            userId,
            historyIds && Array.isArray(historyIds) && historyIds.length > 0 ? historyIds : undefined,
            category as RecommendationCategory | undefined
        )

        if (result.error) {
            console.error("Error deleting recommendation history:", result.error)
            return NextResponse.json(
                { success: false, error: result.error.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            deletedCount: result.deletedCount || 0,
            message: `Successfully deleted ${result.deletedCount || 0} record(s)`,
        })
    } catch (error) {
        console.error("Error in DELETE /api/recommend/history:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
}

/**
 * 批量操作历史记录（更新等）
 * PUT /api/recommend/history
 *
 * 请求体：
 * {
 *   "userId": "user-id",
 *   "historyIds": ["id1", "id2"],
 *   "action": "mark-as-clicked" | "mark-as-saved" | "clear-all"
 * }
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { userId, historyIds, action } = body

        if (!userId || !isValidUserId(userId)) {
            return NextResponse.json(
                { success: false, error: "Invalid or missing userId" },
                { status: 400 }
            )
        }

        const adapter = await getRecommendationAdapter()

        switch (action) {
            case "mark-as-clicked": {
                if (!historyIds || historyIds.length === 0) {
                    return NextResponse.json(
                        { success: false, error: "historyIds required" },
                        { status: 400 }
                    )
                }

                // 逐个更新
                for (const id of historyIds) {
                    await adapter.updateRecommendation(id, { clicked: true })
                }

                return NextResponse.json({
                    success: true,
                    message: "Marked as clicked",
                })
            }

            case "mark-as-saved": {
                if (!historyIds || historyIds.length === 0) {
                    return NextResponse.json(
                        { success: false, error: "historyIds required" },
                        { status: 400 }
                    )
                }

                // 逐个更新
                for (const id of historyIds) {
                    await adapter.updateRecommendation(id, { saved: true })
                }

                return NextResponse.json({
                    success: true,
                    message: "Marked as saved",
                })
            }

            case "clear-all": {
                const result = await adapter.deleteRecommendations(userId)

                return NextResponse.json({
                    success: true,
                    deletedCount: result.deletedCount,
                    message: `Cleared all ${result.deletedCount} records`,
                })
            }

            default:
                return NextResponse.json(
                    { success: false, error: "Unknown action" },
                    { status: 400 }
                )
        }
    } catch (error) {
        console.error("Error in PUT /api/recommend/history:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
}
