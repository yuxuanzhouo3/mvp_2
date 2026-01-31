"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

function getAutoTryLink(candidateLink: CandidateLink, os: "ios" | "android" | "other"): OutboundLink | null {
  const appLinks = candidateLink.fallbacks.filter((l) => l.type === "app");
  if (os === "ios") {
    const ios = appLinks.find((l) => l.label === "iOS") || appLinks[0];
    if (ios) return ios;
  }
  if (os === "android") {
    const android = appLinks.find((l) => l.label === "Android") || appLinks[0];
    if (android) return android;
  }
  if (candidateLink.primary.type === "intent" || candidateLink.primary.type === "app") return candidateLink.primary;
  return null;
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

export default function OutboundPage() {
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const [openState, setOpenState] = useState<OpenState>("idle");

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

  useEffect(() => {
    if (!decoded.candidateLink) return;
    const os = detectMobileOs();
    const autoTry = getAutoTryLink(decoded.candidateLink, os);
    if (!autoTry) {
      setOpenState("failed");
      return;
    }
    setOpenState("trying");
    attemptOpenUrl(autoTry.url, 1200).then((opened) => {
      if (!opened) setOpenState("failed");
    });
  }, [decoded.candidateLink]);

  if (decoded.error) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] p-4 flex items-center justify-center">
        <Card className="p-6 w-full max-w-md">
          <div className="text-base font-semibold text-gray-900 mb-2">
            {language === "zh" ? "无法跳转" : "Unable to redirect"}
          </div>
          <div className="text-sm text-gray-600 mb-4">{decoded.error}</div>
          <Link href="/">
            <Button className="w-full">{language === "zh" ? "返回首页" : "Go Home"}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (!decoded.candidateLink) return null;
  const candidateLink = decoded.candidateLink;

  const webLink = getWebLink(candidateLink);
  const storeLinks = getStoreLinks(candidateLink);
  const otherLinks = getOtherFallbackLinks(candidateLink);

  return (
    <div className="min-h-screen bg-[#F7F9FC] p-4 flex items-center justify-center">
      <Card className="p-6 w-full max-w-md">
        <div className="text-lg font-semibold text-gray-900">
          {language === "zh" ? "正在为你打开" : "Opening"}
        </div>
        <div className="text-sm text-gray-600 mt-1 mb-4">
          {candidateLink.title}
        </div>

        {openState === "trying" && (
          <div className="text-sm text-gray-700 mb-4">
            {language === "zh"
              ? "正在尝试打开 App…"
              : "Trying to open the app..."}
          </div>
        )}

        {openState === "failed" && (
          <div className="text-sm text-gray-700 mb-4">
            {language === "zh"
              ? "未检测到 App 拉起，建议下载 App 或继续使用网页版。"
              : "App launch not detected. Download the app or continue on web."}
          </div>
        )}

        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={() => attemptOpenUrl(candidateLink.primary.url, 1200)}
          >
            {language === "zh" ? "打开 App（或继续）" : "Open app (or continue)"}
          </Button>

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

          {storeLinks.length > 0 && (
            <div className="pt-1">
              <div className="text-sm font-medium text-gray-900 mb-2">
                {language === "zh" ? "下载 App" : "Download app"}
              </div>
              <div className="space-y-2">
                {storeLinks.map((l) => (
                  <Button
                    key={`${l.type}:${l.url}`}
                    className="w-full"
                    variant="outline"
                    onClick={() => window.open(l.url, "_blank", "noopener,noreferrer")}
                  >
                    {l.label || (language === "zh" ? "应用商店" : "Store")}
                  </Button>
                ))}
              </div>
            </div>
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
                    onClick={() => window.open(l.url, "_blank", "noopener,noreferrer")}
                  >
                    {l.label || l.type}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Link href="/">
            <Button className="w-full" variant="ghost">
              {language === "zh" ? "返回" : "Back"}
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
