/**
 * 推荐历史管理 API
 * GET /api/recommend/history - 获取历史记录
 * DELETE /api/recommend/history - 删除历史记录
 * PUT /api/recommend/history - 批量更新历史记录
 *
 * 支持双环境架构：INTL (Supabase) 和 CN (CloudBase)
 * 
 * 注意：历史记录需要用户登录才能查看
 */

import { type NextRequest, NextResponse } from "next/server"

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
import { isValidUserId } from "@/lib/utils"
import { getRecommendationAdapter } from "@/lib/database"
import type { RecommendationCategory } from "@/lib/database/types"
import { requireAuth } from "@/lib/auth/auth"

async function resolveRecommendationAdapter(provider?: string) {
    const normalizedProvider = provider === "cloudbase" || provider === "supabase" ? provider : null

    if (normalizedProvider === "cloudbase") {
        const { CloudBaseRecommendationAdapter } = await import("@/lib/database/adapters/cloudbase-recommendation")
        return new CloudBaseRecommendationAdapter()
    }

    if (normalizedProvider === "supabase") {
        const { SupabaseRecommendationAdapter } = await import("@/lib/database/adapters/supabase-recommendation")
        return new SupabaseRecommendationAdapter()
    }

    return getRecommendationAdapter()
}

/**
 * 获取用户推荐历史记录
 * GET /api/recommend/history?userId=xxx&category=xxx&limit=20
 * 
 * 需要用户认证
 */
export async function GET(request: NextRequest) {
    try {
        // 验证用户登录状态
        const authResult = await requireAuth(request)
        if (!authResult) {
            return NextResponse.json(
                { success: false, error: "Unauthorized. Please login to view history." },
                { status: 401 }
            )
        }

        const searchParams = request.nextUrl.searchParams
        const userId = searchParams.get("userId")
        const category = searchParams.get("category") as RecommendationCategory | null
        const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100"), 1), 500)
        const offset = parseInt(searchParams.get("offset") || "0")
        const provider = searchParams.get("provider") || undefined

        if (!userId || !isValidUserId(userId)) {
            return NextResponse.json(
                { success: false, error: "Invalid or missing userId" },
                { status: 400 }
            )
        }

        // 验证请求的 userId 是否与登录用户匹配
        if (authResult.user.id !== userId) {
            return NextResponse.json(
                { success: false, error: "You can only view your own history" },
                { status: 403 }
            )
        }

        const adapter = await resolveRecommendationAdapter(provider)
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
 * 
 * 需要用户认证
 */
export async function DELETE(request: NextRequest) {
    try {
        // 验证用户登录状态
        const authResult = await requireAuth(request)
        if (!authResult) {
            return NextResponse.json(
                { success: false, error: "Unauthorized. Please login first." },
                { status: 401 }
            )
        }

        const body = await request.json()
        const { userId, historyIds, category, provider } = body

        if (!userId || !isValidUserId(userId)) {
            return NextResponse.json(
                { success: false, error: "Invalid or missing userId" },
                { status: 400 }
            )
        }

        // 验证请求的 userId 是否与登录用户匹配
        if (authResult.user.id !== userId) {
            return NextResponse.json(
                { success: false, error: "You can only delete your own history" },
                { status: 403 }
            )
        }

        const adapter = await resolveRecommendationAdapter(provider)
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
 * 
 * 需要用户认证
 */
export async function PUT(request: NextRequest) {
    try {
        // 验证用户登录状态
        const authResult = await requireAuth(request)
        if (!authResult) {
            return NextResponse.json(
                { success: false, error: "Unauthorized. Please login first." },
                { status: 401 }
            )
        }

        const body = await request.json()
        const { userId, historyIds, action, provider } = body

        if (!userId || !isValidUserId(userId)) {
            return NextResponse.json(
                { success: false, error: "Invalid or missing userId" },
                { status: 400 }
            )
        }

        // 验证请求的 userId 是否与登录用户匹配
        if (authResult.user.id !== userId) {
            return NextResponse.json(
                { success: false, error: "You can only modify your own history" },
                { status: 403 }
            )
        }

        const adapter = await resolveRecommendationAdapter(provider)

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
