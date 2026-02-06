"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CandidateLink, OutboundLink } from "@/lib/types/recommendation";
import { isAllowedOutboundUrl } from "@/lib/search/platform-validator";
import { useLanguage } from "@/components/language-provider";

/**
 * 跳转中间页
 * 处理移动端 App 唤醒、深链跳转、下载引导、Web 兜底
 * 流程: 优先唤起 App → 未安装则引导下载 → 下载返回后自动跳转网页版
 */

type OpenState = "idle" | "trying" | "failed";

/* ---- helpers ---- */

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function detectMobileOs(): "ios" | "android" | "other" {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

/**
 * 获取可尝试打开的 App 链接列表（按优先级排序）
 * 包含 app scheme、universal_link、intent URL
 */
function getAutoTryLinks(
  candidateLink: CandidateLink,
  os: "ios" | "android" | "other"
): OutboundLink[] {
  const primaryTry =
    candidateLink.primary.type === "app" ||
    candidateLink.primary.type === "intent" ||
    candidateLink.primary.type === "universal_link"
      ? [candidateLink.primary]
      : [];

  const fallbackTry = candidateLink.fallbacks.filter(
    (l) =>
      l.type === "app" || l.type === "intent" || l.type === "universal_link"
  );

  const ordered = [...primaryTry, ...fallbackTry];
  const seen = new Set<string>();
  const unique: OutboundLink[] = [];

  for (const l of ordered) {
    if (!l.url || seen.has(l.url)) continue;
    // iOS 不支持 intent:// URL
    if (os === "ios" && l.type === "intent") continue;
    // Android 优先 intent URL（有内建 fallback），其次 universal link
    seen.add(l.url);
    unique.push(l);
  }

  // Android 排序：intent > app > universal_link
  if (os === "android") {
    unique.sort((a, b) => {
      const priority = { intent: 0, app: 1, universal_link: 2 } as Record<string, number>;
      return (priority[a.type] ?? 3) - (priority[b.type] ?? 3);
    });
  }

  return unique;
}

function getWebLink(candidateLink: CandidateLink): OutboundLink | null {
  if (candidateLink.primary.type === "web") return candidateLink.primary;
  const web = candidateLink.fallbacks.find((l) => l.type === "web");
  return web || null;
}

function getStoreLinks(candidateLink: CandidateLink): OutboundLink[] {
  return candidateLink.fallbacks.filter((l) => l.type === "store");
}

function getOtherFallbackLinks(candidateLink: CandidateLink): OutboundLink[] {
  return candidateLink.fallbacks.filter(
    (l) => l.type !== "app" && l.type !== "web" && l.type !== "store" && l.type !== "intent"
  );
}

function filterStoreLinksByOs(
  storeLinks: OutboundLink[],
  os: "ios" | "android" | "other"
) {
  if (os === "ios") {
    const appStore = storeLinks.filter((l) =>
      (l.label || "").toLowerCase().includes("app store")
    );
    const rest = storeLinks.filter((l) => !appStore.includes(l));
    return [...appStore, ...rest];
  }
  if (os === "android") {
    const systemStore = storeLinks.filter(
      (l) =>
        l.url.toLowerCase().startsWith("market://") ||
        (l.label || "").includes("系统应用商店") ||
        (l.label || "").toLowerCase().includes("google play")
    );
    const yingyongbao = storeLinks.filter((l) =>
      (l.label || "").includes("应用宝")
    );
    const rest = storeLinks.filter(
      (l) => !systemStore.includes(l) && !yingyongbao.includes(l)
    );
    return [...systemStore, ...yingyongbao, ...rest];
  }
  return storeLinks;
}

/**
 * 尝试通过隐藏 iframe 打开 App scheme（iOS 更友好，不会替换当前页面）
 * 对于 intent:// URL 和 universal link，使用 window.location.href
 */
async function attemptOpenUrl(
  url: string,
  timeoutMs: number
): Promise<boolean> {
  return await new Promise((resolve) => {
    let completed = false;
    let timer: number | null = null;

    const cleanup = () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };

    const finish = (opened: boolean) => {
      if (completed) return;
      completed = true;
      cleanup();
      resolve(opened);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") finish(true);
    };

    const onBlur = () => {
      finish(true);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);

    timer = window.setTimeout(() => finish(false), timeoutMs);

    // 对于 custom scheme，使用 iframe 尝试可避免页面跳转
    // 但 intent:// 和 https:// 必须使用 location.href
    const isCustomScheme =
      !url.startsWith("http") && !url.startsWith("intent://");
    if (isCustomScheme) {
      try {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = url;
        document.body.appendChild(iframe);
        // 清理 iframe
        window.setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {
            /* ignore */
          }
        }, 3000);
      } catch {
        // iframe 方式失败，回退到 location.href
        window.location.href = url;
      }
    } else {
      window.location.href = url;
    }
  });
}

/**
 * 依次尝试多个链接打开 App
 */
async function attemptOpenLinksSequential(
  links: OutboundLink[],
  timeoutMsEach: number
): Promise<boolean> {
  for (const link of links) {
    const opened = await attemptOpenUrl(link.url, timeoutMsEach);
    if (opened) return true;
    await new Promise((r) => window.setTimeout(r, 120));
  }
  return false;
}

/* ---- Page Component ---- */

export default function OutboundPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const [openState, setOpenState] = useState<OpenState>("idle");
  const returnTo = searchParams.get("returnTo");
  const hasTriedRef = useRef(false);

  const handleBack = useCallback(() => {
    const safeReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : null;
    if (safeReturnTo) {
      router.replace(safeReturnTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace("/");
  }, [returnTo, router]);

  const decoded = useMemo((): {
    candidateLink: CandidateLink | null;
    error: string | null;
  } => {
    const raw = searchParams.get("data");
    if (!raw) {
      return {
        candidateLink: null,
        error: language === "zh" ? "缺少跳转参数" : "Missing redirect data",
      };
    }
    try {
      const json = base64UrlDecode(raw);
      const parsed = JSON.parse(json) as CandidateLink;
      if (!parsed?.primary?.url || !parsed?.title) {
        return {
          candidateLink: null,
          error:
            language === "zh" ? "跳转参数无效" : "Invalid redirect data",
        };
      }
      if (!isAllowedOutboundUrl(parsed.primary.url)) {
        return {
          candidateLink: null,
          error:
            language === "zh" ? "目标链接不被允许" : "Target URL is not allowed",
        };
      }
      // 验证 fallback 链接，但对不允许的 fallback 仅跳过而非拒绝整个请求
      const validFallbacks = (parsed.fallbacks || []).filter((fallback) =>
        isAllowedOutboundUrl(fallback.url)
      );
      return {
        candidateLink: { ...parsed, fallbacks: validFallbacks },
        error: null,
      };
    } catch {
      return {
        candidateLink: null,
        error:
          language === "zh"
            ? "跳转参数解析失败"
            : "Failed to parse redirect data",
      };
    }
  }, [searchParams, language]);

  const candidateLink = decoded.candidateLink;
  const webLinkUrl = useMemo(() => {
    if (!candidateLink) return null;
    const webLink = getWebLink(candidateLink);
    return webLink?.url || null;
  }, [candidateLink]);

  // 自动尝试打开 App
  useEffect(() => {
    if (!decoded.candidateLink || hasTriedRef.current) return;
    hasTriedRef.current = true;

    const os = detectMobileOs();
    const autoTryLinks = getAutoTryLinks(decoded.candidateLink, os);

    if (autoTryLinks.length === 0) {
      setOpenState("failed");
      return;
    }

    if (os === "ios") {
      // iOS: 优先尝试 universal links（自动），然后对 custom scheme 也自动尝试
      // iOS 13+ 允许通过 iframe 尝试自定义 scheme 而不弹出错误
      const universalLinks = autoTryLinks.filter(
        (l) => l.type === "universal_link"
      );
      const customSchemes = autoTryLinks.filter((l) => l.type === "app");

      if (universalLinks.length > 0 || customSchemes.length > 0) {
        setOpenState("trying");
        // 先尝试 custom scheme（优先级最高：直接打开 App 搜索），再试 universal link
        const orderedLinks = [...customSchemes, ...universalLinks];
        attemptOpenLinksSequential(orderedLinks, 1500).then((opened) => {
          if (!opened) setOpenState("failed");
        });
      } else {
        setOpenState("failed");
      }
      return;
    }

    // Android: 尝试所有 app 链接（intent URL 有内建 fallback）
    setOpenState("trying");
    attemptOpenLinksSequential(autoTryLinks, 1500).then((opened) => {
      if (!opened) setOpenState("failed");
    });
  }, [decoded.candidateLink]);

  // 从应用商店返回后，自动跳转到网页版
  useEffect(() => {
    if (!webLinkUrl) return;

    const key = "outbound:store-return";
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { ts?: number };
        const ts = typeof parsed?.ts === "number" ? parsed.ts : 0;
        sessionStorage.removeItem(key);
        if (!ts) return;
        if (Date.now() - ts > 10 * 60 * 1000) return;
      } catch {
        return;
      }
      window.location.href = webLinkUrl;
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [webLinkUrl]);

  /* ---- Error state ---- */
  if (decoded.error) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] p-4 flex items-center justify-center">
        <Card className="p-6 w-full max-w-md">
          <div className="text-base font-semibold text-gray-900 mb-2">
            {language === "zh" ? "无法跳转" : "Unable to redirect"}
          </div>
          <div className="text-sm text-gray-600 mb-4">{decoded.error}</div>
          <Button className="w-full" onClick={handleBack}>
            {language === "zh" ? "返回" : "Back"}
          </Button>
        </Card>
      </div>
    );
  }

  if (!decoded.candidateLink) return null;

  const os = detectMobileOs();
  const link = decoded.candidateLink;
  const providerName =
    link.metadata?.providerDisplayName || link.provider || "";

  const webLink = getWebLink(link);
  const storeLinks = filterStoreLinksByOs(getStoreLinks(link), os);
  const otherLinks = getOtherFallbackLinks(link);
  const autoTryLinks = getAutoTryLinks(link, os);
  const hasAutoTry = autoTryLinks.length > 0;

  return (
    <div className="min-h-screen bg-[#F7F9FC] p-4 flex items-center justify-center">
      <Card className="p-6 w-full max-w-md">
        <div className="text-lg font-semibold text-gray-900">
          {language === "zh" ? "正在为你打开" : "Opening"}
        </div>
        <div className="text-sm text-gray-600 mt-1 mb-4">{link.title}</div>

        {/* 正在尝试打开 App */}
        {openState === "trying" && (
          <div className="text-sm text-gray-700 mb-4 flex items-center gap-2">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full" />
            {language === "zh"
              ? `正在尝试打开 ${providerName} App…`
              : `Trying to open ${providerName} app...`}
          </div>
        )}

        {/* 未检测到 App → 引导下载 */}
        {openState === "failed" && (
          <div className="text-sm mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">📱</span>
              <span className="font-medium text-amber-800">
                {language === "zh"
                  ? `未检测到 ${providerName} App`
                  : `${providerName} app not detected`}
              </span>
            </div>
            <p className="text-amber-700 text-xs">
              {language === "zh"
                ? `建议下载 ${providerName} App 获得更好体验，安装后可直接打开搜索结果。您也可以先用网页版浏览。`
                : `Download ${providerName} for a better experience, or continue on web.`}
            </p>
          </div>
        )}

        {/* iOS idle 状态提示（需要手动点击） */}
        {openState === "idle" && os === "ios" && hasAutoTry && (
          <div className="text-sm text-gray-700 mb-4">
            {language === "zh"
              ? "iOS 需要手动点击按钮才能唤起 App。"
              : "On iOS, tap the button to open the app."}
          </div>
        )}

        <div className="space-y-3">
          {/* 打开 App 按钮（始终显示，让用户可以手动重试） */}
          {hasAutoTry && (
            <Button
              className="w-full bg-black text-white hover:bg-black/90"
              onClick={() => {
                setOpenState("trying");
                attemptOpenLinksSequential(autoTryLinks, 1500).then(
                  (opened) => {
                    if (!opened) setOpenState("failed");
                  }
                );
              }}
            >
              {language === "zh"
                ? `打开 ${providerName} App`
                : `Open ${providerName} app`}
            </Button>
          )}

          {/* 下载 App 区域 */}
          {storeLinks.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-2">
                <span className="text-base">⬇️</span>
                <span>
                  {language === "zh"
                    ? `下载 ${providerName} App 获得更好体验`
                    : `Download ${providerName} for better experience`}
                </span>
              </div>
              <div className="space-y-2">
                {storeLinks.map((l, idx) => (
                  <Button
                    key={`${l.type}:${l.url}`}
                    className={`w-full ${
                      idx === 0
                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600"
                        : ""
                    }`}
                    variant={idx === 0 ? "default" : "outline"}
                    onClick={() => {
                      try {
                        sessionStorage.setItem(
                          "outbound:store-return",
                          JSON.stringify({ ts: Date.now() })
                        );
                      } catch {
                        /* ignore */
                      }
                      window.location.href = l.url;
                    }}
                  >
                    {l.label || (language === "zh" ? "应用商店" : "Store")}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {language === "zh"
                  ? "安装完成后返回此页面，将自动跳转到网页版"
                  : "After installing, return here to continue on web"}
              </p>
            </div>
          )}

          {/* 网页版兜底 */}
          {webLink && (
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => {
                window.location.href = webLink.url;
              }}
            >
              {language === "zh"
                ? `继续打开 ${providerName} 网页版`
                : `Continue on ${providerName} web`}
            </Button>
          )}

          {/* 其他备选链接（地图、搜索、视频等） */}
          {otherLinks.length > 0 && (
            <div className="pt-1">
              <div className="text-sm font-medium text-gray-900 mb-2">
                {language === "zh" ? "其他方式" : "Other options"}
              </div>
              <div className="space-y-2">
                {otherLinks.map((l) => (
                  <Button
                    key={`${l.type}:${l.url}`}
                    className="w-full"
                    variant="ghost"
                    onClick={() => {
                      window.location.href = l.url;
                    }}
                  >
                    {l.label || l.type}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button className="w-full" variant="ghost" onClick={handleBack}>
            {language === "zh" ? "返回" : "Back"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
