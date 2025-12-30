import { NextResponse } from "next/server";
import { isChinaRegion } from "@/lib/config/region";
import { getCloudBaseDatabase, CloudBaseCollections } from "@/lib/database/cloudbase-client";

export const runtime = "nodejs";

/**
 * 微信小程序回调 API
 * POST /api/auth/mp-callback
 *
 * 在 WebView 上下文中设置 cookie，同时更新用户资料
 * 解决 wx.request 和 WebView cookie 不共享的问题
 */
export async function POST(req: Request) {
  // 仅限 CN 环境
  if (!isChinaRegion()) {
    return NextResponse.json(
      { error: "仅支持中国区域" },
      { status: 404 }
    );
  }

  try {
    const { token, openid, expiresIn, nickName, avatarUrl } = await req.json();

    if (!token || !openid) {
      return NextResponse.json(
        { error: "Token and openid required" },
        { status: 400 }
      );
    }

    console.log("[mp-callback] Processing callback for openid:", openid);

    // 更新用户资料（新用户首次登录时传递昵称和头像）
    if (nickName || avatarUrl) {
      try {
        const db = getCloudBaseDatabase();
        const usersCollection = db.collection(CloudBaseCollections.USERS);

        // 查找用户
        const userResult = await usersCollection.where({ wechatOpenId: openid }).get();

        // 兼容早期用 email 存储 openid 的情况
        let user = userResult.data?.[0];
        if (!user) {
          const wechatEmail = `wechat_${openid}@local.wechat`;
          const emailResult = await usersCollection.where({ email: wechatEmail }).get();
          user = emailResult.data?.[0];
        }

        if (user) {
          // 只有当用户没有设置过资料，或资料是默认值时才更新
          const shouldUpdate = !user.name || user.name === "微信用户" || !user.avatar;

          if (shouldUpdate) {
            const updateData: Record<string, unknown> = {
              updatedAt: new Date().toISOString(),
            };

            if (nickName && (!user.name || user.name === "微信用户")) {
              updateData.name = nickName;
            }
            if (avatarUrl && !user.avatar) {
              updateData.avatar = avatarUrl;
            }

            await usersCollection.doc(user._id).update(updateData);
            console.log("[mp-callback] Updated user profile:", { openid, nickName, avatarUrl });
          }
        }
      } catch (updateError) {
        console.error("[mp-callback] Update profile failed:", updateError);
        // 更新失败不影响登录流程
      }
    }

    const maxAge = expiresIn ? parseInt(String(expiresIn), 10) : 60 * 60 * 24 * 7; // 默认 7 天

    const res = NextResponse.json({
      success: true,
      openid,
      message: "Cookie set successfully",
    });

    // 设置 httpOnly cookie（在 WebView 上下文中设置，H5 可以读取）
    res.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    console.log("[mp-callback] Cookie set for openid:", openid);
    return res;
  } catch (error) {
    console.error("[mp-callback] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
