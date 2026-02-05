"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CandidateLink, OutboundLink } from "@/lib/types/recommendation";
import { isAllowedOutboundUrl } from "@/lib/search/platform-validator";
import { useLanguage } from "@/components/language-provider";

type OpenState = "idle" | "trying" | "failed";

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const decoded = new TextDecoder().decode(bytes);
  return decoded;
}

function detectMobileOs(): "ios" | "android" | "other" {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

function getAutoTryLinks(candidateLink: CandidateLink, os: "ios" | "android" | "other"): OutboundLink[] {
  const primaryTry =
    candidateLink.primary.type === "app" ||
      candidateLink.primary.type === "intent" ||
      candidateLink.primary.type === "universal_link"
      ? [candidateLink.primary]
      : [];

  const fallbackTry = candidateLink.fallbacks.filter(
    (l) => l.type === "app" || l.type === "intent" || l.type === "universal_link"
  );

  const ordered = [...primaryTry, ...fallbackTry];
  const seen = new Set<string>();
  const unique: OutboundLink[] = [];
  for (const l of ordered) {
    if (!l.url || seen.has(l.url)) continue;
    if (os !== "other" && l.type === "intent" && os === "ios") continue;
    seen.add(l.url);
    unique.push(l);
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
  return candidateLink.fallbacks.filter((l) => l.type !== "app" && l.type !== "web" && l.type !== "store");
}

function filterStoreLinksByOs(storeLinks: OutboundLink[], os: "ios" | "android" | "other") {
  if (os === "ios") {
    const appStore = storeLinks.filter((l) => (l.label || "").toLowerCase().includes("app store"));
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
    const yingyongbao = storeLinks.filter((l) => (l.label || "").includes("应用宝"));
    const rest = storeLinks.filter((l) => !systemStore.includes(l) && !yingyongbao.includes(l));
    return [...systemStore, ...yingyongbao, ...rest];
  }
  return storeLinks;
}

async function attemptOpenUrl(url: string, timeoutMs: number): Promise<boolean> {
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
    window.location.href = url;
  });
}

async function attemptOpenLinksSequential(links: OutboundLink[], timeoutMsEach: number): Promise<boolean> {
  for (const link of links) {
    const opened = await attemptOpenUrl(link.url, timeoutMsEach);
    if (opened) return true;
    await new Promise((r) => window.setTimeout(r, 120));
  }
  return false;
}

export default function OutboundPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const [openState, setOpenState] = useState<OpenState>("idle");
  const returnTo = searchParams.get("returnTo");

  const handleBack = () => {
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
  };

  const decoded = useMemo((): { candidateLink: CandidateLink | null; error: string | null } => {
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
          error: language === "zh" ? "跳转参数无效" : "Invalid redirect data",
        };
      }
      if (!isAllowedOutboundUrl(parsed.primary.url)) {
        return {
          candidateLink: null,
          error: language === "zh" ? "目标链接不被允许" : "Target URL is not allowed",
        };
      }
      for (const fallback of parsed.fallbacks || []) {
        if (!isAllowedOutboundUrl(fallback.url)) {
          return {
            candidateLink: null,
            error: language === "zh" ? "回落链接不被允许" : "Fallback URL is not allowed",
          };
        }
      }
      return { candidateLink: parsed, error: null };
    } catch {
      return {
        candidateLink: null,
        error: language === "zh" ? "跳转参数解析失败" : "Failed to parse redirect data",
      };
    }
  }, [searchParams, language]);

  const candidateLink = decoded.candidateLink;
  const webLinkUrl = useMemo(() => {
    if (!candidateLink) return null;
    const webLink = getWebLink(candidateLink);
    return webLink?.url || null;
  }, [candidateLink]);

  useEffect(() => {
    if (!decoded.candidateLink) return;
    const os = detectMobileOs();
    const autoTryLinks = getAutoTryLinks(decoded.candidateLink, os);
    if (autoTryLinks.length === 0) {
      setOpenState("failed");
      return;
    }
    // iOS: only auto-try Universal Links (custom schemes require user gesture)
    if (os === "ios") {
      const universalLinks = autoTryLinks.filter(l => l.type === "universal_link");
      if (universalLinks.length === 0) {
        // No universal links - stay idle, show manual button
        return;
      }
      setOpenState("trying");
      attemptOpenLinksSequential(universalLinks, 1100).then((opened) => {
        if (!opened) setOpenState("failed");
      });
      return;
    }
    // Android: try all app links
    setOpenState("trying");
    attemptOpenLinksSequential(autoTryLinks, 1100).then((opened) => {
      if (!opened) setOpenState("failed");
    });
  }, [decoded.candidateLink]);

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
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [webLinkUrl]);

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
  const link = decoded.candidateLink; // Non-null confirmed by check above

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
        <div className="text-sm text-gray-600 mt-1 mb-4">
          {link.title}
        </div>

        {openState === "trying" && (
          <div className="text-sm text-gray-700 mb-4">
            {language === "zh"
              ? "正在尝试打开 App…"
              : "Trying to open the app..."}
          </div>
        )}

        {openState === "failed" && (
          <div className="text-sm mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">📱</span>
              <span className="font-medium text-amber-800">
                {language === "zh" ? "未检测到 App" : "App not detected"}
              </span>
            </div>
            <p className="text-amber-700 text-xs">
              {language === "zh"
                ? "建议下载 App 获得更好体验，或继续使用网页版。"
                : "Download the app for a better experience, or continue on web."}
            </p>
          </div>
        )}

        {openState === "idle" && os === "ios" && hasAutoTry && (
          <div className="text-sm text-gray-700 mb-4">
            {language === "zh"
              ? "iOS 需要手动点击按钮才能唤起 App。"
              : "On iOS, tap the button to open the app."}
          </div>
        )}

        <div className="space-y-3">
          {hasAutoTry && (
            <Button
              className="w-full bg-black text-white hover:bg-black/90"
              onClick={() => {
                setOpenState("trying");
                attemptOpenLinksSequential(autoTryLinks, 1100).then((opened) => {
                  if (!opened) setOpenState("failed");
                });
              }}
            >
              {language === "zh" ? "打开 App" : "Open app"}
            </Button>
          )}

          {storeLinks.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-2">
                <span className="text-base">⬇️</span>
                <span>{language === "zh" ? "下载 App 获得更好体验" : "Download App for better experience"}</span>
              </div>
              <div className="space-y-2">
                {storeLinks.map((l, idx) => (
                  <Button
                    key={`${l.type}:${l.url}`}
                    className={`w-full ${idx === 0
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600"
                      : ""
                      }`}
                    variant={idx === 0 ? "default" : "outline"}
                    onClick={() => {
                      try {
                        sessionStorage.setItem("outbound:store-return", JSON.stringify({ ts: Date.now() }));
                      } catch { }
                      window.location.href = l.url;
                    }}
                  >
                    {l.label || (language === "zh" ? "应用商店" : "Store")}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {language === "zh"
                  ? "下载安装后返回此页面，将自动跳转网页版"
                  : "After downloading, return here to continue on web"}
              </p>
            </div>
          )}

          {webLink && (
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => {
                window.location.href = webLink.url;
              }}
            >
              {language === "zh" ? "继续打开网页版/官网" : "Continue on web"}
            </Button>
          )}

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
