/**
 * 微信小程序登录工具库
 * 用于在 WebView 中检测小程序环境并处理登录回调
 */

interface WxMiniProgram {
  postMessage?: (data: unknown) => void;
  navigateTo?: (options: { url: string }) => void;
  navigateBack?: (options?: { delta?: number }) => void;
  switchTab?: (options: { url: string }) => void;
  reLaunch?: (options: { url: string }) => void;
  redirectTo?: (options: { url: string }) => void;
  getEnv?: (callback: (res: { miniprogram: boolean }) => void) => void;
}

declare global {
  interface Window {
    wx?: { miniProgram?: WxMiniProgram };
    __wxjs_environment?: string;
  }
}

/**
 * 检测是否在微信小程序 WebView 环境中
 */
export function isMiniProgram(): boolean {
  if (typeof window === "undefined") return false;

  // 检测 User-Agent
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("miniprogram")) return true;

  // 检测微信 JS 环境变量
  if (window.__wxjs_environment === "miniprogram") return true;

  // 检测 wx.miniProgram 对象
  if (window.wx?.miniProgram) return true;

  return false;
}

/**
 * 等待 wx.miniProgram 对象可用
 * 小程序 WebView 中，wx.miniProgram 可能需要一些时间才能注入完成
 */
export function waitForWxMiniProgram(timeout: number = 3000): Promise<WxMiniProgram | null> {
  return new Promise((resolve) => {
    // 如果已经可用，直接返回
    if (window.wx?.miniProgram?.navigateTo) {
      resolve(window.wx.miniProgram);
      return;
    }

    const startTime = Date.now();
    const checkInterval = 100; // 每 100ms 检查一次

    const check = () => {
      if (window.wx?.miniProgram?.navigateTo) {
        resolve(window.wx.miniProgram);
        return;
      }

      if (Date.now() - startTime >= timeout) {
        console.warn("[wechat-mp] Timeout waiting for wx.miniProgram");
        resolve(null);
        return;
      }

      setTimeout(check, checkInterval);
    };

    check();
  });
}

/**
 * 检测是否在微信环境中（包括小程序和公众号）
 */
export function isWechatEnvironment(): boolean {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("micromessenger");
}

/**
 * 登录回调数据接口
 */
export interface WxMpLoginCallback {
  token: string | null;
  openid: string | null;
  expiresIn: string | null;
  nickName: string | null;
  avatarUrl: string | null;
  code: string | null;
  userId: string | null;
  refreshToken: string | null;
}

/**
 * 解析 URL 参数中的登录回调数据
 * 小程序通过 URL 参数传递登录信息给 WebView
 */
export function parseWxMpLoginCallback(): WxMpLoginCallback | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const openid = params.get("openid");
  const code = params.get("mpCode");

  // 如果没有任何登录相关参数，返回 null
  if (!token && !openid && !code) return null;

  return {
    token,
    openid,
    expiresIn: params.get("expiresIn"),
    nickName: params.get("mpNickName") ? decodeURIComponent(params.get("mpNickName")!) : null,
    avatarUrl: params.get("mpAvatarUrl") ? decodeURIComponent(params.get("mpAvatarUrl")!) : null,
    code,
    userId: params.get("userId"),
    refreshToken: params.get("refreshToken"),
  };
}

/**
 * 清除 URL 中的登录参数
 * 登录成功后调用，避免参数暴露在地址栏
 */
export function clearWxMpLoginParams(): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const paramsToRemove = [
    "token",
    "openid",
    "expiresIn",
    "mpCode",
    "mpNickName",
    "mpAvatarUrl",
    "userId",
    "refreshToken",
  ];

  paramsToRemove.forEach((key) => url.searchParams.delete(key));

  // 使用 replaceState 避免产生浏览器历史记录
  window.history.replaceState({}, "", url.toString());
}

/**
 * 请求微信小程序原生登录
 * 跳转到小程序的登录页面
 * 异步版本：会等待 wx.miniProgram 对象可用，并有 postMessage 备用方案
 */
export async function requestWxMpLoginAsync(returnUrl?: string): Promise<boolean> {
  console.log("[wechat-mp] requestWxMpLoginAsync called");

  const currentUrl = returnUrl || window.location.href;

  // 等待 wx.miniProgram 可用
  const mp = await waitForWxMiniProgram(3000);

  // 方案1：使用 navigateTo 直接跳转
  if (mp && typeof mp.navigateTo === "function") {
    const encodedUrl = encodeURIComponent(currentUrl);
    console.log("[wechat-mp] Using navigateTo to login page");

    mp.navigateTo({
      url: `/pages/webshell/login?returnUrl=${encodedUrl}`,
    });

    return true;
  }

  // 方案2：通过 postMessage 请求小程序处理登录
  console.log("[wechat-mp] navigateTo not available, trying postMessage fallback");

  if (mp && typeof mp.postMessage === "function") {
    mp.postMessage({
      type: "REQUEST_WX_LOGIN",
      returnUrl: currentUrl,
    });
    console.log("[wechat-mp] postMessage sent for login request");
    return true;
  }

  // 方案3：直接使用 window.wx.miniProgram.postMessage
  if (window.wx?.miniProgram?.postMessage) {
    window.wx.miniProgram.postMessage({
      type: "REQUEST_WX_LOGIN",
      returnUrl: currentUrl,
    });
    console.log("[wechat-mp] Direct postMessage sent for login request");
    return true;
  }

  console.error("[wechat-mp] All methods failed, cannot request login");
  return false;
}

/**
 * 请求微信小程序原生登录（同步版本，兼容旧代码）
 * 跳转到小程序的登录页面
 * @deprecated 推荐使用 requestWxMpLoginAsync
 */
export function requestWxMpLogin(returnUrl?: string): boolean {
  const mp = window.wx?.miniProgram;
  if (!mp || typeof mp.navigateTo !== "function") {
    console.warn("[wechat-mp] Not in miniprogram environment or navigateTo not available");
    return false;
  }

  const currentUrl = returnUrl || window.location.href;
  const encodedUrl = encodeURIComponent(currentUrl);

  // 跳转到小程序登录页面，登录成功后会带参数返回
  mp.navigateTo({
    url: `/pages/webshell/login?returnUrl=${encodedUrl}`,
  });

  return true;
}

/**
 * 向小程序发送消息
 */
export function postMessageToMiniProgram(data: unknown): boolean {
  const mp = window.wx?.miniProgram;
  if (!mp || typeof mp.postMessage !== "function") {
    return false;
  }

  mp.postMessage(data);
  return true;
}

/**
 * 返回小程序上一页
 */
export function navigateBackInMiniProgram(delta: number = 1): boolean {
  const mp = window.wx?.miniProgram;
  if (!mp || typeof mp.navigateBack !== "function") {
    return false;
  }

  mp.navigateBack({ delta });
  return true;
}

/**
 * 使用 code 换取 token（兜底方案）
 * 当小程序直接传递 code 而非 token 时使用
 */
export async function exchangeCodeForToken(
  code: string,
  nickName?: string | null,
  avatarUrl?: string | null
): Promise<{ success: boolean; token?: string; openid?: string; error?: string }> {
  try {
    const response = await fetch("/api/wxlogin/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.message || "登录失败" };
    }

    // 如果有用户资料，调用 mp-callback 更新
    if (nickName || avatarUrl) {
      await fetch("/api/auth/mp-callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token: data.token,
          openid: data.openid,
          expiresIn: data.expiresIn,
          nickName,
          avatarUrl,
        }),
      });
    }

    return {
      success: true,
      token: data.token,
      openid: data.openid,
    };
  } catch (error) {
    console.error("[wechat-mp] exchangeCodeForToken error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "网络错误",
    };
  }
}

/**
 * 处理小程序登录回调的完整流程
 * 自动检测并处理 URL 中的登录参数
 */
export async function handleMpLoginCallback(): Promise<{
  success: boolean;
  needsLogin: boolean;
  error?: string;
}> {
  const callback = parseWxMpLoginCallback();

  if (!callback) {
    return { success: false, needsLogin: false };
  }

  try {
    // 情况1：直接收到 token（推荐流程）
    if (callback.token && callback.openid) {
      const res = await fetch("/api/auth/mp-callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token: callback.token,
          openid: callback.openid,
          expiresIn: callback.expiresIn,
          nickName: callback.nickName,
          avatarUrl: callback.avatarUrl,
        }),
      });

      if (res.ok) {
        clearWxMpLoginParams();
        return { success: true, needsLogin: false };
      } else {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          needsLogin: true,
          error: errorData.error || "设置登录状态失败",
        };
      }
    }

    // 情况2：收到 code（兜底流程）
    if (callback.code) {
      const result = await exchangeCodeForToken(
        callback.code,
        callback.nickName,
        callback.avatarUrl
      );

      if (result.success) {
        clearWxMpLoginParams();
        return { success: true, needsLogin: false };
      } else {
        clearWxMpLoginParams();
        return {
          success: false,
          needsLogin: true,
          error: result.error || "code 换取 token 失败",
        };
      }
    }

    clearWxMpLoginParams();
    return { success: false, needsLogin: true, error: "无效的登录参数" };
  } catch (error) {
    console.error("[wechat-mp] handleMpLoginCallback error:", error);
    clearWxMpLoginParams();
    return {
      success: false,
      needsLogin: true,
      error: error instanceof Error ? error.message : "处理登录回调失败",
    };
  }
}
