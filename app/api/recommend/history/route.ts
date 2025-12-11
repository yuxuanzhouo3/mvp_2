/**
 * 推荐历史管理 API
 * GET /api/recommend/history - 获取历史记录
 * DELETE /api/recommend/history - 删除历史记录
 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isValidUserId } from "@/lib/utils"
import type { RecommendationHistory } from "@/lib/types/recommendation"

// 创建服务端 Supabase 客户端
function getServiceClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Missing Supabase environment variables")
    }

    return createClient(supabaseUrl, supabaseServiceKey)
}

/**
 * 获取用户推荐历史记录
 * GET /api/recommend/history?userId=xxx&category=xxx&limit=20
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const userId = searchParams.get("userId")
        const category = searchParams.get("category")
        const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100"), 1), 500)

        if (!userId || !isValidUserId(userId)) {
            return NextResponse.json(
                { success: false, error: "Invalid or missing userId" },
                { status: 400 }
            )
        }

        const supabase = getServiceClient()

        let query = supabase
            .from("recommendation_history")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit)

        if (category) {
            query = query.eq("category", category)
        }

        const { data, error } = await query

        if (error) {
            console.error("Error fetching recommendation history:", error)
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            data: data || [],
            count: (data || []).length,
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

        const supabase = getServiceClient()

        let query = supabase
            .from("recommendation_history")
            .delete()
            .eq("user_id", userId)

        // 如果指定了 ID，只删除这些记录
        if (historyIds && Array.isArray(historyIds) && historyIds.length > 0) {
            query = query.in("id", historyIds)
        }

        // 如果指定了分类，只删除该分类的记录
        if (category) {
            query = query.eq("category", category)
        }

        const { error, count } = await query

        if (error) {
            console.error("Error deleting recommendation history:", error)
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            deletedCount: count || 0,
            message: `Successfully deleted ${count || 0} record(s)`,
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

        const supabase = getServiceClient()

        switch (action) {
            case "mark-as-clicked": {
                if (!historyIds || historyIds.length === 0) {
                    return NextResponse.json(
                        { success: false, error: "historyIds required" },
                        { status: 400 }
                    )
                }

                const { error } = await supabase
                    .from("recommendation_history")
                    .update({ clicked: true })
                    .eq("user_id", userId)
                    .in("id", historyIds)

                if (error) throw error

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

                const { error } = await supabase
                    .from("recommendation_history")
                    .update({ saved: true })
                    .eq("user_id", userId)
                    .in("id", historyIds)

                if (error) throw error

                return NextResponse.json({
                    success: true,
                    message: "Marked as saved",
                })
            }

            case "clear-all": {
                const { error, count } = await supabase
                    .from("recommendation_history")
                    .delete()
                    .eq("user_id", userId)

                if (error) throw error

                return NextResponse.json({
                    success: true,
                    deletedCount: count,
                    message: `Cleared all ${count} records`,
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
