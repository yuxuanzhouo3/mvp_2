"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { OutboundLink } from "@/lib/types/recommendation";
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
} from "@/lib/outbound/deep-link-helpers";

/**
 * 璺宠浆涓棿椤?
 * 澶勭悊绉诲姩绔?App 鍞ら啋銆佹繁閾捐烦杞€佷笅杞藉紩瀵笺€乄eb 鍏滃簳
 * 娴佺▼: 浼樺厛鍞よ捣 App 鈫?鏈畨瑁呭垯璇㈤棶鏄惁瀹夎 鈫?鏄垯閫夋嫨鍟嗗簵 鈫?鍚﹀垯璺宠浆缃戦〉鐗?
 * 浠?App 杩斿洖鍚庤嚜鍔ㄥ鑸洖鎺ㄨ崘缁撴灉椤?
 */

type OpenState = "idle" | "trying" | "opened" | "failed";
type InstallChoice = "none" | "asking" | "yes" | "no";

/* ---- helpers ---- */

/**
 * 妫€娴嬫槸鍚﹀湪 App 瀹瑰櫒锛圙oNative/Median WebView锛変腑杩愯
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
 * 鍦?App 瀹瑰櫒涓墦寮€澶栭儴閾炬帴
 * 閽堝 GoNative/Median WebView 鍋氬吋瀹瑰鐞?
 */
function openUrlInAppContainer(url: string): void {
  // 瀵逛簬 intent:// URL锛岀洿鎺ョ敤 location.href锛圓ndroid WebView 浼氭嫤鎴苟澶勭悊锛?
  if (url.startsWith("intent://")) {
    window.location.href = url;
    return;
  }

  // 瀵逛簬鑷畾涔?scheme (闈?http/https)锛屽垱寤?<a> 鏍囩骞舵ā鎷熺偣鍑?
  // 杩欏湪 GoNative/Median WebView 涓瘮 location.href 鏇村彲闈?
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
      // 鍥為€€鍒?location.href
    }
  }

  // 瀵逛簬 https universal links锛屼娇鐢?location.href
  window.location.href = url;
}

/**
 * 灏濊瘯鎵撳紑 App URL
 * 閫氳繃鐩戝惉 visibilitychange 鍜?blur 浜嬩欢鏉ユ娴?App 鏄惁鎴愬姛鎵撳紑
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
      // App 瀹瑰櫒涓細浣跨敤涓撶敤鏂规硶鎵撳紑
      openUrlInAppContainer(url);
    } else {
      // 鏅€氭祻瑙堝櫒涓?
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
 * 渚濇灏濊瘯澶氫釜閾炬帴鎵撳紑 App
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

  /**
   * 瀵艰埅鍥炴帹鑽愮粨鏋滈〉
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

  /**
   * 鐐瑰嚮鍟嗗簵閾炬帴涓嬭浇 App
   */
  const handleStoreClick = useCallback((url: string) => {
    try {
      sessionStorage.setItem(
        "outbound:store-return",
        JSON.stringify({ ts: Date.now() })
      );
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
    const providerDisplayName =
      typeof decoded.candidateLink?.metadata?.providerDisplayName === "string"
        ? decoded.candidateLink.metadata.providerDisplayName
        : "";
    const keyword =
      providerDisplayName ||
      decoded.candidateLink?.provider ||
      decoded.candidateLink?.title ||
      "app";
    return `https://play.google.com/store/search?q=${encodeURIComponent(
      keyword
    )}&c=apps`;
  }, [decoded.candidateLink]);

  const redirectIntlAndroidToGooglePlay = useCallback(() => {
    const os = detectMobileOs();
    const region = decoded.candidateLink?.metadata?.region;
    const isIntlAndroid = region === "INTL" && os === "android";

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
  }, [decoded.candidateLink, getFallbackGooglePlayUrl, handleStoreClick]);

  // 鑷姩灏濊瘯鎵撳紑 App
  useEffect(() => {
    if (!decoded.candidateLink || hasTriedRef.current) return;
    hasTriedRef.current = true;

    const os = detectMobileOs();
    const autoTryLinks = getAutoTryLinks(decoded.candidateLink, os);

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
        // App 鎴愬姛鎵撳紑锛屾爣璁扮姸鎬?
        appOpenedRef.current = true;
        setOpenState("opened");
      } else {
        // App 鏈畨瑁咃紝璇㈤棶鐢ㄦ埛鏄惁瀹夎
        setOpenState("failed");
        if (!redirectIntlAndroidToGooglePlay()) {
          setInstallChoice("asking");
        }
      }
    });
  }, [decoded.candidateLink, redirectIntlAndroidToGooglePlay]);

  // 褰撶敤鎴蜂粠 App 杩斿洖鏃讹紝鑷姩瀵艰埅鍥炴帹鑽愮粨鏋滈〉
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      // 濡傛灉涔嬪墠 App 宸叉垚鍔熸墦寮€锛岀敤鎴疯繑鍥炴椂鑷姩瀵艰埅鍥炴帹鑽愰〉
      if (appOpenedRef.current) {
        appOpenedRef.current = false;
        // 鐭殏寤惰繜纭繚椤甸潰瀹屽叏鍙
        window.setTimeout(() => {
          handleBack();
        }, 300);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [handleBack]);

  /**
   * 鐢ㄦ埛閫夋嫨"鍚?锛堜笉瀹夎锛夛紝璺宠浆鍒扮綉椤电増
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
   * 鐐瑰嚮鍟嗗簵閾炬帴涓嬭浇 App
   */
  

  /**
   * 鐢ㄦ埛閫夋嫨"鏄?锛堝畨瑁匒pp锛?   * INTL + Android锛氱洿鎺ヨ烦杞?Google Play锛岃烦杩囧晢搴楅€夋嫨
   * 鍏朵粬鎯呭喌锛氭樉绀哄晢搴楅€夋嫨鍒楄〃
   */
  const handleInstallYes = useCallback(() => {
    if (redirectIntlAndroidToGooglePlay()) return;
    setInstallChoice("yes");
  }, [redirectIntlAndroidToGooglePlay]);

  // 浠庡簲鐢ㄥ晢搴楄繑鍥炲悗锛氬厛灏濊瘯閲嶆柊鎵撳紑 App锛屽け璐ュ垯璺宠浆缃戦〉鐗?
  useEffect(() => {
    if (!decoded.candidateLink) return;

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

      // 浠庡晢搴楄繑鍥炲悗锛屽厛灏濊瘯閲嶆柊鎵撳紑 App
      const os = detectMobileOs();
      const retryLinks = getAutoTryLinks(decoded.candidateLink!, os);

      if (retryLinks.length > 0) {
        setOpenState("trying");
        attemptOpenLinksSequential(retryLinks, 2500).then((opened) => {
          if (opened) {
            // App 宸插畨瑁呭苟鎴愬姛鎵撳紑 鈫?鏍囪鐘舵€侊紝鐢ㄦ埛浠?App 杩斿洖鏃朵細鑷姩鍥炲埌鎺ㄨ崘椤?
            appOpenedRef.current = true;
            setOpenState("opened");
          } else {
            // App 浠嶆湭瀹夎 鈫?璺宠浆缃戦〉鐗?
            setOpenState("failed");
            if (webLinkUrl) {
              window.location.href = webLinkUrl;
            }
          }
        });
      } else if (webLinkUrl) {
        // 娌℃湁鍙皾璇曠殑 App 閾炬帴锛岀洿鎺ヨ烦杞綉椤电増
        window.location.href = webLinkUrl;
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [decoded.candidateLink, webLinkUrl]);

  /* ---- Error state ---- */
  if (decoded.error) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] p-4 flex items-center justify-center">
        <Card className="p-6 w-full max-w-md">
          <div className="text-base font-semibold text-gray-900 mb-2">
            {language === "zh" ? "鏃犳硶璺宠浆" : "Unable to redirect"}
          </div>
          <div className="text-sm text-gray-600 mb-4">{decoded.error}</div>
          <Button className="w-full" onClick={handleBack}>
            {language === "zh" ? "杩斿洖" : "Back"}
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
  const isIntlAndroid =
    link.metadata?.region === "INTL" && os === "android";

  const webLink = getWebLink(link);
  const storeLinks = filterStoreLinksByOs(getStoreLinks(link), os);
  const autoTryLinks = getAutoTryLinks(link, os);
  const hasAutoTry = autoTryLinks.length > 0;

  return (
    <div className="min-h-screen bg-[#F7F9FC] p-4 flex items-center justify-center">
      <Card className="p-6 w-full max-w-md">
        <div className="text-lg font-semibold text-gray-900">
          {language === "zh" ? "姝ｅ湪涓轰綘鎵撳紑" : "Opening"}
        </div>
        <div className="text-sm text-gray-600 mt-1 mb-4">{link.title}</div>

        {/* 姝ｅ湪灏濊瘯鎵撳紑 App */}
        {openState === "trying" && (
          <div className="text-sm text-gray-700 mb-4 flex items-center gap-2">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full" />
            {language === "zh"
              ? `正在尝试打开 ${providerName} App...`
              : `Trying to open ${providerName} app...`}
          </div>
        )}

        {/* App 宸叉垚鍔熸墦寮€ */}
        {openState === "opened" && (
          <div className="text-sm text-green-700 mb-4 flex items-center gap-2">
            <span className="text-lg">✅</span>
            {language === "zh"
              ? `${providerName} App 已打开，返回后将自动回到推荐页`
              : `${providerName} app opened, will return to recommendations when you come back`}
          </div>
        )}

        {/* 鏈娴嬪埌 App 鈫?璇㈤棶鏄惁瀹夎 */}
        {openState === "failed" && installChoice === "asking" && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">馃摫</span>
              <span className="font-medium text-amber-800 text-base">
                {language === "zh"
                  ? `鏈娴嬪埌 ${providerName} App`
                  : `${providerName} app not detected`}
              </span>
            </div>
            <p className="text-amber-700 text-sm mb-4">
              {language === "zh"
                ? `是否安装 ${providerName} App？安装后体验更好。`
                : `Would you like to install ${providerName}? It provides a better experience.`}
            </p>
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
                {language === "zh" ? "鍚︼紝鐢ㄧ綉椤电増" : "No, use web"}
              </Button>
            </div>
          </div>
        )}

        {/* 鐢ㄦ埛閫夋嫨瀹夎 鈫?鏄剧ず鍟嗗簵閫夋嫨锛圛NTL Android 宸茬洿鎺ヨ烦杞?Google Play锛?*/}
        {openState === "failed" && installChoice === "yes" && storeLinks.length > 0 && (
          <div className="mb-4">
            {isIntlAndroid ? (
              /* INTL Android: 宸茬洿鎺ヨ烦杞?Google Play锛屾樉绀虹瓑寰呮彁绀?*/
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">馃彧</span>
                  <span className="font-medium text-blue-800 text-sm">
                    {language === "zh"
                      ? `姝ｅ湪鍓嶅線 Google Play 涓嬭浇 ${providerName}`
                      : `Going to Google Play to install ${providerName}`}
                  </span>
                </div>
                <p className="text-blue-700 text-xs">
                  {language === "zh"
                    ? "瀹夎瀹屾垚鍚庤繑鍥炴椤甸潰锛屽皢鑷姩鎵撳紑 App"
                    : "After installing, return here to auto-open the app"}
                </p>
              </div>
            ) : (
              /* 闈?INTL Android锛氭樉绀哄晢搴楅€夋嫨鍒楄〃 */
              <>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                  <span className="text-base">猬囷笍</span>
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
                      {l.label || (language === "zh" ? "搴旂敤鍟嗗簵" : "Store")}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {language === "zh"
                    ? "瀹夎瀹屾垚鍚庤繑鍥炴椤甸潰锛屽皢鑷姩灏濊瘯鎵撳紑 App"
                    : "After installing, return here to auto-open the app"}
                </p>
              </>
            )}

            {/* 缃戦〉鐗堝厹搴曟寜閽?*/}
            {webLink && (
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

        {/* 鐢ㄦ埛閫夋嫨瀹夎浣嗘病鏈夊晢搴楅摼鎺?鈫?闄嶇骇鍒扮綉椤电増 */}
        {openState === "failed" && installChoice === "yes" && storeLinks.length === 0 && (
          <div className="mb-4 text-sm text-gray-600">
            {language === "zh"
              ? "暂无可用下载链接，将为你打开网页版。"
              : "No download link available, opening web version."}
          </div>
        )}

        <div className="space-y-3">
          {/* 鎵嬪姩閲嶈瘯鎵撳紑 App 鎸夐挳 */}
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
                      if (installChoice === "none") {
                        setInstallChoice("asking");
                      }
                    }
                  }
                );
              }}
            >
              {language === "zh"
                ? `閲嶆柊鎵撳紑 ${providerName} App`
                : `Retry opening ${providerName}`}
            </Button>
          )}

          {/* 缃戦〉鐗堝厹搴曪紙浠呭湪闈炲畨瑁呴€夋嫨娴佺▼涓樉绀猴級 */}
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
            {language === "zh" ? "杩斿洖鎺ㄨ崘缁撴灉" : "Back to recommendations"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

