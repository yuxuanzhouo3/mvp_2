// app/api/subscription/export/route.ts - 历史记录导出API
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";

// 强制动态渲染，因为使用了request.headers
export const dynamic = 'force-dynamic';
import { canExportData, getUserRecommendationHistory } from "@/lib/subscription/usage-tracker";

/**
 * GET /api/subscription/export
 * 导出推荐历史记录
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const userId = user.id;

    // 检查导出权限
    const exportPermission = await canExportData(userId);
    if (!exportPermission.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: exportPermission.reason,
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    // 获取导出格式
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format") || "json";

    // 验证格式是否支持
    if (!exportPermission.formats.includes(format)) {
      return NextResponse.json(
        {
          success: false,
          error: `Format '${format}' is not supported. Available formats: ${exportPermission.formats.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // 获取历史记录
    const history = await getUserRecommendationHistory(userId, { limit: 1000 });

    if (format === "json") {
      return NextResponse.json({
        success: true,
        data: history.data,
        total: history.total,
        retentionDays: history.retentionDays,
        exportedAt: new Date().toISOString(),
      });
    }

    if (format === "csv") {
      // 生成CSV
      const csvRows: string[] = [];

      // 添加标题行
      csvRows.push("ID,Category,Recommendation,Created At");

      // 添加数据行
      for (const item of history.data) {
        const recommendation = item.recommendation as Record<string, unknown>;
        const csvRow = [
          item.id,
          (recommendation?.category as string) || "",
          JSON.stringify(recommendation?.content || recommendation).replace(/"/g, '""'),
          item.created_at,
        ]
          .map((field) => `"${field}"`)
          .join(",");
        csvRows.push(csvRow);
      }

      const csvContent = csvRows.join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="recommendations_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // PDF 格式需要额外处理（这里简化处理）
    if (format === "pdf") {
      return NextResponse.json(
        {
          success: false,
          error: "PDF export is not yet implemented. Please use JSON or CSV format.",
        },
        { status: 501 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Unknown format" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error exporting data:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
