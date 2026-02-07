/**
 * /api/assistant/preferences
 *
 * 功能描述：AI 助手偏好管理接口
 * GET - 获取用户所有偏好
 * POST - 保存/更新偏好
 * DELETE - 删除偏好
 *
 * @returns 偏好列表或操作结果
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import {
  getUserPreferences,
  savePreference,
  deletePreference,
} from "@/lib/assistant/preference-manager";

/**
 * GET /api/assistant/preferences
 * 获取用户所有已保存的偏好
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

    const preferences = await getUserPreferences(authResult.user.id);

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error("[API /assistant/preferences GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assistant/preferences
 * 保存或更新偏好
 * Body: { name: string, filters: object }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, filters } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { success: false, error: "Preference name is required" },
        { status: 400 }
      );
    }

    const result = await savePreference(authResult.user.id, name, filters || {});

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API /assistant/preferences POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/assistant/preferences
 * 删除偏好
 * Body: { name: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { success: false, error: "Preference name is required" },
        { status: 400 }
      );
    }

    const result = await deletePreference(authResult.user.id, name);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API /assistant/preferences DELETE] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
