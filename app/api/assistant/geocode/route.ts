/**
 * POST /api/assistant/geocode
 *
 * 功能描述：反向地理编码 API
 * 接收经纬度坐标，返回可读的城市/区/街道名称
 * 无需鉴权（仅做地理编码，不涉及用户数据）
 *
 * @param lat - 纬度（-90 到 90）
 * @param lng - 经度（-180 到 180）
 * @param locale - 语言 zh|en
 * @returns { success: true, displayName } 或 { success: false, error }
 */

import { NextRequest, NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/assistant/reverse-geocode";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lng, locale } = body;

    // 校验 lat 和 lng 是否为数字
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { success: false, error: "lat and lng must be numbers" },
        { status: 400 }
      );
    }

    // 校验 lat 和 lng 是否为有限数字（排除 NaN、Infinity）
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { success: false, error: "lat and lng must be finite numbers" },
        { status: 400 }
      );
    }

    // 校验 lat 范围：-90 到 90
    if (lat < -90 || lat > 90) {
      return NextResponse.json(
        { success: false, error: "lat must be between -90 and 90" },
        { status: 400 }
      );
    }

    // 校验 lng 范围：-180 到 180
    if (lng < -180 || lng > 180) {
      return NextResponse.json(
        { success: false, error: "lng must be between -180 and 180" },
        { status: 400 }
      );
    }

    // 校验 locale 参数
    const validLocale: "zh" | "en" =
      locale === "en" ? "en" : "zh";

    // 调用反向地理编码
    const result = await reverseGeocode(lat, lng, validLocale);

    if (result && result.displayName) {
      return NextResponse.json({
        success: true,
        displayName: result.displayName,
      });
    }

    return NextResponse.json({
      success: false,
      error: "Reverse geocoding returned no result",
    });
  } catch (error) {
    console.error("[Geocode API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
