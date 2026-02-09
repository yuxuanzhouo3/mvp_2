"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CandidateLink, OutboundLink } from "@/lib/types/recommendation";
import { useLanguage } from "@/components/language-provider";
import {
  decodeCandidateLink,
  validateReturnTo,
  detectMobileOs,
  getAutoTryLinks,
  getWebLink,
  getStoreLinks,
  filterStoreLinksByOs,
  getGooglePlayLink,
  sanitizeAutoTryLinksForIntlAndroid,
  isIntlAndroidContext as isIntlAndroidContextHelper,
  getFallbackGooglePlayUrl as getFallbackGooglePlayUrlHelper,
} from "@/lib/outbound/deep-link-helpers";

/**
 * 出站跳转中间页
 * 处理移动端 App 唤醒、深链跳转、下载引导与 Web 兜底
 * 流程：优先唤起 App → 未安装则引导安装 → 商店返回后重试打开 App → 失败再跳转网页版
 * 从推荐 App 返回后自动回到推荐结果页
 */

type OpenState = "idle" | "trying" | "opened" | "failed";
type InstallChoice = "none" | "asking" | "yes" | "no";
const STORE_RETURN_SESSION_KEY = "outbound:store-return";

/* ---- helpers ---- */

/**
 * 检测是否在 App 容器（GoNative/Median WebView）中运行
 */
function isInAppContainer(): boolean {
  if (typeof window === "undefined") return false;
  const search = new URLSearchParams(window.location.search);
  if (search.get("app") === "1") return true;
  const w = window as any;
  if (typeof w.ReactNativeWebView?.postMessage === "function") return true;
  if (typeof w.webkit?.messageHandlers?.native?.postMessage === "function") return true;
  if (typeof w.Android?.wechatLogin === "function") return true;
  if (typeof w.AndroidWeChatBridge?.startLogin === "function") return true;
  const ua = navigator.userAgent || "";
  if (ua.includes("median") || ua.includes("gonative")) return true;
  return false;
}



/**
 * 在 App 容器中打开外部链接
 * 针对 GoNative/Median WebView 做兼容处理
 */
function openUrlInAppContainer(url: string): void {
  // 对于 intent:// URL，直接使用 location.href（Android WebView 会拦截并处理）
  if (url.startsWith("intent://")) {
    window.location.href = url;
    return;
  }

  // 对于自定义 scheme（非 http/https），创建 <a> 标签并模拟点击
  // 这在 GoNative/Median WebView 中比 location.href 更可靠
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch { /* ignore */ }
      }, 100);
      return;
    } catch {
      // 回退到 location.href
    }
  }

  // 对于 https universal links，使用 location.href
  window.location.href = url;
}

/**
 * 尝试打开 App URL
 * 通过监听 visibilitychange 和 blur 事件检测 App 是否成功打开
 */
async function attemptOpenUrl(
  url: string,
  timeoutMs: number
): Promise<boolean> {
  return await new Promise((resolve) => {
    let completed = false;
    let timer: number | null = null;
    const inApp = isInAppContainer();

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

    if (inApp) {
      // App 容器中：使用专用方法打开
      openUrlInAppContainer(url);
    } else {
      // 普通浏览器中
      const isCustomScheme =
        !url.startsWith("http") && !url.startsWith("intent://");
      if (isCustomScheme) {
        try {
          const iframe = document.createElement("iframe");
          iframe.style.display = "none";
          iframe.src = url;
          document.body.appendChild(iframe);
          window.setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch {
              /* ignore */
            }
          }, 3000);
        } catch {
          window.location.href = url;
        }
      } else {
        window.location.href = url;
      }
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
  const [installChoice, setInstallChoice] = useState<InstallChoice>("none");
  const returnTo = searchParams.get("returnTo");
  const hasTriedRef = useRef(false);
  const appOpenedRef = useRef(false);
  const isHandlingStoreReturnRef = useRef(false);
  const isNavigatingBackRef = useRef(false);

  /**
   * 导航回推荐结果页
   */
  const handleBack = useCallback(() => {
    const safeReturnTo = validateReturnTo(returnTo);
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

  const decoded = useMemo(() => {
    const raw = searchParams.get("data");
    return decodeCandidateLink(raw ?? "", language);
  }, [searchParams, language]);

  const candidateLink = decoded.candidateLink;
  const webLinkUrl = useMemo(() => {
    if (!candidateLink) return null;
    const webLink = getWebLink(candidateLink);
    return webLink?.url || null;
  }, [candidateLink]);

  const navigateToWebFallback = useCallback(() => {
    if (webLinkUrl) {
      window.location.href = webLinkUrl;
      return;
    }
    handleBack();
  }, [handleBack, webLinkUrl]);

  /**
   * 点击商店链接下载 App
   */
  const handleStoreClick = useCallback((url: string) => {
    try {
      sessionStorage.setItem(STORE_RETURN_SESSION_KEY, JSON.stringify({ ts: Date.now() }));
    } catch {
      /* ignore */
    }
    if (isInAppContainer()) {
      openUrlInAppContainer(url);
    } else {
      window.location.href = url;
    }
  }, []);

  const getFallbackGooglePlayUrl = useCallback(() => {
    return getFallbackGooglePlayUrlHelper(decoded.candidateLink);
  }, [decoded.candidateLink]);

  const isIntlAndroidContext = useCallback(
    (candidate: CandidateLink | null | undefined) => {
      return isIntlAndroidContextHelper(candidate);
    },
    []
  );

  const redirectIntlAndroidToGooglePlay = useCallback(() => {
    const os = detectMobileOs();
    const isIntlAndroid = isIntlAndroidContext(decoded.candidateLink);

    if (!isIntlAndroid || !decoded.candidateLink) {
      return false;
    }

    const allStoreLinks = filterStoreLinksByOs(
      getStoreLinks(decoded.candidateLink),
      os
    );
    const playLink = getGooglePlayLink(allStoreLinks);
    setInstallChoice("yes");
    handleStoreClick(playLink?.url || getFallbackGooglePlayUrl());
    return true;
  }, [decoded.candidateLink, getFallbackGooglePlayUrl, handleStoreClick, isIntlAndroidContext]);

  // 自动尝试打开 App
  useEffect(() => {
    if (!decoded.candidateLink || hasTriedRef.current) return;
    hasTriedRef.current = true;

    const os = detectMobileOs();
    const autoTryLinksRaw = getAutoTryLinks(decoded.candidateLink, os);
    const autoTryLinks = isIntlAndroidContext(decoded.candidateLink)
      ? sanitizeAutoTryLinksForIntlAndroid(autoTryLinksRaw)
      : autoTryLinksRaw;

    if (autoTryLinks.length === 0) {
      setOpenState("failed");
      if (!redirectIntlAndroidToGooglePlay()) {
        setInstallChoice("asking");
      }
      return;
    }

    setOpenState("trying");
    attemptOpenLinksSequential(autoTryLinks, 2000).then((opened) => {
      if (opened) {
        // App 成功打开，标记状态
        appOpenedRef.current = true;
        setOpenState("opened");
      } else {
        // App 未安装：INTL Android 直接跳 Google Play，其他平台显示安装询问
        setOpenState("failed");
        if (!redirectIntlAndroidToGooglePlay()) {
          setInstallChoice("asking");
        }
      }
    });
  }, [decoded.candidateLink, isIntlAndroidContext, redirectIntlAndroidToGooglePlay]);

  // 当用户从 App 返回时，自动导航回推荐结果页
  useEffect(() => {
    const tryBackToRecommendation = () => {
      if (isNavigatingBackRef.current) return;
      // 如果此前 App 已成功打开，用户返回时自动回推荐页
      if (appOpenedRef.current) {
        appOpenedRef.current = false;
        isNavigatingBackRef.current = true;
        // 短暂延迟，确保页面完全可见
        window.setTimeout(() => {
          handleBack();
        }, 300);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      tryBackToRecommendation();
    };

    const onWindowFocus = () => {
      if (document.visibilityState !== "visible") return;
      tryBackToRecommendation();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [handleBack]);

  /**
   * 用户选择“否（不安装）”时，跳转到网页版
   */
  const handleInstallNo = useCallback(() => {
    setInstallChoice("no");
    if (webLinkUrl) {
      window.location.href = webLinkUrl;
    } else {
      handleBack();
    }
  }, [webLinkUrl, handleBack]);

  /**
   * 点击商店链接下载 App
   */
  

  /**
   * 用户选择“是（安装 App）”
   * INTL + Android：直接跳转 Google Play，跳过商店选择
   * 其他场景：展示商店选择列表
   */
  const handleInstallYes = useCallback(() => {
    if (redirectIntlAndroidToGooglePlay()) return;
    setInstallChoice("yes");
  }, [redirectIntlAndroidToGooglePlay]);

  // 从应用商店返回后：先尝试重新打开 App，失败则跳转网页版
  useEffect(() => {
    if (!decoded.candidateLink) return;

    const shouldHandleStoreReturn = (): boolean => {
      try {
        const raw = sessionStorage.getItem(STORE_RETURN_SESSION_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { ts?: number };
        const ts = typeof parsed?.ts === "number" ? parsed.ts : 0;
        sessionStorage.removeItem(STORE_RETURN_SESSION_KEY);
        if (!ts) return false;
        if (Date.now() - ts > 10 * 60 * 1000) return false;
        return true;
      } catch {
        return false;
      }
    };

    const processStoreReturn = () => {
      if (document.visibilityState !== "visible") return;
      if (isHandlingStoreReturnRef.current) return;
      if (!shouldHandleStoreReturn()) return;

      isHandlingStoreReturnRef.current = true;

      // 从商店返回后，优先重试打开 App
      const os = detectMobileOs();
      const retryLinksRaw = getAutoTryLinks(decoded.candidateLink!, os);
      const retryLinks = isIntlAndroidContext(decoded.candidateLink)
        ? sanitizeAutoTryLinksForIntlAndroid(retryLinksRaw)
        : retryLinksRaw;

      if (retryLinks.length > 0) {
        setOpenState("trying");
        attemptOpenLinksSequential(retryLinks, 2500).then((opened) => {
          if (opened) {
            // App 已安装且打开成功 -> 标记状态，用户从 App 返回时自动回推荐页
            appOpenedRef.current = true;
            setOpenState("opened");
            isHandlingStoreReturnRef.current = false;
          } else {
            // App 仍未安装 -> 跳转网页版
            setOpenState("failed");
            isHandlingStoreReturnRef.current = false;
            navigateToWebFallback();
          }
        });
      } else {
        // 没有可重试的 App 链接，直接跳转网页版
        isHandlingStoreReturnRef.current = false;
        navigateToWebFallback();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      processStoreReturn();
    };

    const onWindowFocus = () => {
      if (document.visibilityState !== "visible") return;
      processStoreReturn();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [decoded.candidateLink, isIntlAndroidContext, navigateToWebFallback]);

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
            {language === "zh" ? "返回 RandomLife" : "Back to RandomLife"}
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
  const isIntlAndroid = isIntlAndroidContext(link);

  const webLink = getWebLink(link);
  const storeLinks = filterStoreLinksByOs(getStoreLinks(link), os);
  const autoTryLinksRaw = getAutoTryLinks(link, os);
  const autoTryLinks = isIntlAndroid
    ? sanitizeAutoTryLinksForIntlAndroid(autoTryLinksRaw)
    : autoTryLinksRaw;
  const hasAutoTry = autoTryLinks.length > 0;
  const shouldShowInstallPrompt =
    openState === "failed" &&
    installChoice === "asking";

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
              ? `正在尝试打开 ${providerName} App...`
              : `Trying to open ${providerName} app...`}
          </div>
        )}

        {/* App 已成功打开 */}
        {openState === "opened" && (
          <div className="text-sm text-green-700 mb-4 flex items-center gap-2">
            <span className="text-lg">✅</span>
            {language === "zh"
              ? `${providerName} App 已打开，返回后将自动回到 RandomLife 推荐页`
              : `${providerName} app opened, and you will return to RandomLife recommendations when you come back`}
          </div>
        )}

        {/* 未检测到 App -> 询问是否安装 */}
        {shouldShowInstallPrompt && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">📱</span>
              <span className="font-medium text-amber-800 text-base">
                {language === "zh"
                  ? `未检测到 ${providerName} App`
                  : `${providerName} app not detected`}
              </span>
            </div>
            <p className="text-amber-700 text-sm mb-4">
              {language === "zh"
                ? `是否安装 ${providerName} App？安装后体验更好。`
                : `Would you like to install ${providerName}? It provides a better experience.`}
            </p>
            {isIntlAndroid ? (
              <Button
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600"
                onClick={handleInstallYes}
              >
                {language === "zh" ? "前往 Google Play 下载" : "Go to Google Play"}
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600"
                  onClick={handleInstallYes}
                >
                  {language === "zh" ? "是，去安装" : "Yes, install"}
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={handleInstallNo}
                >
                  {language === "zh" ? "否，用网页版" : "No, use web"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 用户选择安装 -> 显示商店选择（Android 已直跳 Google Play） */}
        {openState === "failed" && installChoice === "yes" && storeLinks.length > 0 && (
          <div className="mb-4">
            {isIntlAndroid ? (
              /* INTL Android：已直接跳转 Google Play，显示等待提示 */
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">📲</span>
                  <span className="font-medium text-blue-800 text-sm">
                    {language === "zh"
                      ? `正在前往 Google Play 下载 ${providerName}`
                      : `Going to Google Play to install ${providerName}`}
                  </span>
                </div>
                <p className="text-blue-700 text-xs">
                  {language === "zh"
                    ? "安装完成后返回 RandomLife 此页面，将自动打开 App"
                    : "After installing, return to this RandomLife page to auto-open the app"}
                </p>
                <Button
                  className="w-full mt-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600"
                  onClick={handleInstallYes}
                >
                  {language === "zh" ? "继续前往 Google Play" : "Continue to Google Play"}
                </Button>
              </div>
            ) : (
              /* 非 INTL Android：显示商店选择列表 */
              <>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                  <span className="text-base">👇</span>
                  <span>
                    {language === "zh"
                      ? `请选择下载 ${providerName} 的方式`
                      : `Choose where to download ${providerName}`}
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
                      onClick={() => handleStoreClick(l.url)}
                    >
                      {l.label || (language === "zh" ? "应用商店" : "Store")}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {language === "zh"
                    ? "安装完成后返回 RandomLife 此页面，将自动尝试打开 App"
                    : "After installing, return to this RandomLife page to auto-open the app"}
                </p>
              </>
            )}

            {/* 网页版兜底按钮（INTL Android 安装流程中隐藏） */}
            {!isIntlAndroid && webLink && (
              <Button
                className="w-full mt-3"
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
          </div>
        )}

        {/* 用户选择安装但没有商店链接 -> 非 INTL Android 降级到网页版 */}
        {openState === "failed" && installChoice === "yes" && storeLinks.length === 0 && !isIntlAndroid && (
          <div className="mb-4 text-sm text-gray-600">
            {language === "zh"
              ? "暂无可用下载链接，将为你打开网页版。"
              : "No download link available, opening web version."}
          </div>
        )}

        <div className="space-y-3">
          {/* 手动重试打开 App 按钮 */}
          {hasAutoTry && (openState === "failed" || openState === "idle") && (
            <Button
              className="w-full bg-black text-white hover:bg-black/90"
              onClick={() => {
                setOpenState("trying");
                attemptOpenLinksSequential(autoTryLinks, 2000).then(
                  (opened) => {
                    if (opened) {
                      appOpenedRef.current = true;
                      setOpenState("opened");
                    } else {
                      setOpenState("failed");
                      if (isIntlAndroid) {
                        redirectIntlAndroidToGooglePlay();
                      } else if (installChoice === "none") {
                        setInstallChoice("asking");
                      }
                    }
                  }
                );
              }}
            >
              {language === "zh"
                ? `重新打开 ${providerName} App`
                : `Retry opening ${providerName}`}
            </Button>
          )}

          {/* 网页版兜底（仅在非安装流程中显示） */}
          {webLink && installChoice !== "yes" && installChoice !== "asking" && (
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

          <Button className="w-full" variant="ghost" onClick={handleBack}>
            {language === "zh" ? "返回 RandomLife 推荐页" : "Back to RandomLife recommendations"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
