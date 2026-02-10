/**
 * 深链跳转辅助函数
 * 从 app/outbound/page.tsx 提取的纯函数模块
 * 用于 CandidateLink 解码、设备检测、链接排序与过滤
 */

import type { CandidateLink, OutboundLink } from "@/lib/types/recommendation";
import type { MobileOs } from "@/lib/outbound/provider-catalog";
import { isAllowedOutboundUrl } from "@/lib/search/platform-validator";
import { RegionConfig } from "@/lib/config/region";

/**
 * 将 base64url 编码的字符串解码为 UTF-8 字符串
 * base64url 规则：`-` → `+`，`_` → `/`，补齐 `=` 填充
 */
export function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * 将 UTF-8 字符串编码为 base64url 字符串
 * base64url 规则：`+` → `-`，`/` → `_`，去除尾部 `=` 填充
 * 与 base64UrlDecode 互为逆操作
 */
export function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const binary = String.fromCharCode(...bytes);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}


/**
 * 通过 User-Agent 字符串检测移动操作系统
 * 返回 "ios" | "android" | "other"
 */
export function detectMobileOs(): MobileOs {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

/**
 * 获取可尝试打开的 App 链接列表（按优先级排序）
 * 包含 app scheme、universal_link、intent URL
 *
 * iOS: 排除 intent:// 链接，universal_link 优先
 * Android: intent > app > universal_link
 */
export function getAutoTryLinks(
  candidateLink: CandidateLink,
  os: MobileOs
): OutboundLink[] {
  const isPrimaryProviderCompanionLink = (link: OutboundLink): boolean => {
    const normalizedLabel = (link.label || "").trim().toLowerCase();
    if (!normalizedLabel) return true;
    return normalizedLabel === "ios" || normalizedLabel === "android";
  };

  const shouldKeepForOs = (link: OutboundLink): boolean => {
    if (
      link.type !== "app" &&
      link.type !== "intent" &&
      link.type !== "universal_link"
    )
      return true;
    const label = (link.label || "").toLowerCase();
    if (os === "android") {
      if (label.includes("ios")) return false;
      if (label.includes("android")) return true;
      return true;
    }
    if (os === "ios") {
      if (label.includes("android")) return false;
      if (label.includes("ios")) return true;
      return true;
    }
    return true;
  };

  const primaryTry =
    candidateLink.primary.type === "app" ||
    candidateLink.primary.type === "intent" ||
    candidateLink.primary.type === "universal_link"
      ? [candidateLink.primary]
      : [];

  const fallbackTry = candidateLink.fallbacks.filter(
    (l) =>
      (l.type === "app" || l.type === "intent" || l.type === "universal_link") &&
      isPrimaryProviderCompanionLink(l)
  );

  const ordered = [...primaryTry, ...fallbackTry];
  const seen = new Set<string>();
  const unique: OutboundLink[] = [];

  for (const l of ordered) {
    if (!l.url || seen.has(l.url)) continue;
    if (!shouldKeepForOs(l)) continue;
    // iOS 不支持 intent:// URL
    if (os === "ios" && l.type === "intent") continue;
    const sanitizedLink =
      os === "android" && l.type === "intent"
        ? { ...l, url: stripIntentBrowserFallbackUrl(l.url) }
        : l;
    seen.add(sanitizedLink.url);
    unique.push(sanitizedLink);
  }

  if (os === "android") {
    const hasExplicitDeepLink = unique.some(
      (link) => link.type === "intent" || link.type === "app"
    );
    if (hasExplicitDeepLink) {
      const withoutUniversalLink = unique.filter(
        (link) => link.type !== "universal_link"
      );
      unique.length = 0;
      unique.push(...withoutUniversalLink);
    }
  }

  // Android 排序：intent > app > universal_link
  if (os === "android") {
    unique.sort((a, b) => {
      const priority = { intent: 0, app: 1, universal_link: 2 } as Record<
        string,
        number
      >;
      return (priority[a.type] ?? 3) - (priority[b.type] ?? 3);
    });
  }

  return unique;
}

/**
 * 从 CandidateLink 中获取 web 类型的链接
 * 优先检查 primary，然后检查 fallbacks
 */
export function getWebLink(
  candidateLink: CandidateLink
): OutboundLink | null {
  if (candidateLink.primary.type === "web") return candidateLink.primary;
  const web = candidateLink.fallbacks.find((l) => l.type === "web");
  return web || null;
}

/**
 * 从 CandidateLink 的 fallbacks 中获取所有 store 类型的链接
 */
export function getStoreLinks(candidateLink: CandidateLink): OutboundLink[] {
  return candidateLink.fallbacks.filter((l) => l.type === "store");
}

/**
 * 根据操作系统过滤商店链接
 *
 * iOS: 过滤掉 market://、含 com.android.vending 的 intent://、标签含 Google Play 的链接
 *      App Store 链接排在前面
 *
 * Android: 过滤掉 itms-apps://、标签含 App Store 但不含 Play 的链接
 *          排序：Intent Play Store > market:// > 应用宝 > 其他
 */
export function filterStoreLinksByOs(
  storeLinks: OutboundLink[],
  os: MobileOs
) {
  if (os === "ios") {
    // Filter out Android-specific links:
    // - URLs starting with market://
    // - URLs starting with intent:// that contain com.android.vending
    // - Labels containing "Google Play"
    const filtered = storeLinks.filter((l) => {
      const url = l.url.toLowerCase();
      const label = (l.label || "").toLowerCase();
      if (url.startsWith("market://")) return false;
      if (url.startsWith("intent://") && url.includes("com.android.vending"))
        return false;
      if (label.includes("google play")) return false;
      return true;
    });
    const appStore = filtered.filter((l) =>
      (l.label || "").toLowerCase().includes("app store")
    );
    const rest = filtered.filter((l) => !appStore.includes(l));
    return [...appStore, ...rest];
  }
  if (os === "android") {
    // Filter out iOS App Store links:
    // - URLs starting with itms-apps://
    // - Labels containing "App Store" but not "Play"
    const filtered = storeLinks.filter((l) => {
      const url = l.url.toLowerCase();
      const label = (l.label || "").toLowerCase();
      if (url.startsWith("itms-apps://")) return false;
      if (label.includes("app store") && !label.includes("play")) return false;
      return true;
    });
    // Sort: Intent URL Play Store links first, then market://, then rest
    const intentPlayStore = filtered.filter(
      (l) =>
        l.url.toLowerCase().includes("intent://") &&
        l.url.toLowerCase().includes("com.android.vending")
    );
    const marketLinks = filtered.filter(
      (l) =>
        l.url.toLowerCase().startsWith("market://") &&
        !intentPlayStore.includes(l)
    );
    const yingyongbao = filtered.filter(
      (l) =>
        (l.label || "").includes("应用宝") &&
        !intentPlayStore.includes(l) &&
        !marketLinks.includes(l)
    );
    const rest = filtered.filter(
      (l) =>
        !intentPlayStore.includes(l) &&
        !marketLinks.includes(l) &&
        !yingyongbao.includes(l)
    );
    return [...intentPlayStore, ...marketLinks, ...yingyongbao, ...rest];
  }
  return storeLinks;
}

/**
 * 解码并验证 CandidateLink
 * 将 page.tsx 中 `decoded` useMemo 的解析逻辑提取为可测试的纯函数
 *
 * 流程：
 * 1. 检查 raw 是否为空 → 返回"缺少跳转参数"错误 (Req 4.3)
 * 2. base64url 解码 + JSON.parse → 失败则返回"跳转参数无效"错误 (Req 4.4)
 * 3. 验证结构完整性（provider, title, primary.type, primary.url）→ 不完整则返回"跳转参数无效"错误 (Req 4.4)
 * 4. 验证 primary URL 安全性 → 不通过则返回"目标链接不被允许"错误 (Req 4.5)
 * 5. 过滤 fallbacks 中不安全的链接 (Req 7.3)
 * 6. 返回验证后的 CandidateLink
 */
export function decodeCandidateLink(
  raw: string,
  language: "zh" | "en"
): { candidateLink: CandidateLink | null; error: string | null } {
  // Step 1: Check for empty/null/undefined raw parameter (Req 4.3)
  if (!raw) {
    return {
      candidateLink: null,
      error: language === "zh" ? "缺少跳转参数" : "Missing redirect parameters",
    };
  }

  // Step 2: Try base64url decode and JSON.parse (Req 4.4)
  let parsed: CandidateLink;
  try {
    const json = base64UrlDecode(raw);
    parsed = JSON.parse(json) as CandidateLink;
  } catch {
    return {
      candidateLink: null,
      error: language === "zh" ? "跳转参数无效" : "Invalid redirect parameters",
    };
  }

  // Step 3: Validate required CandidateLink structure (Req 4.4)
  // Required fields: provider, title, primary with type and url
  if (
    !parsed ||
    typeof parsed.provider !== "string" ||
    !parsed.provider ||
    typeof parsed.title !== "string" ||
    !parsed.title ||
    !parsed.primary ||
    typeof parsed.primary.type !== "string" ||
    !parsed.primary.type ||
    typeof parsed.primary.url !== "string" ||
    !parsed.primary.url
  ) {
    return {
      candidateLink: null,
      error: language === "zh" ? "跳转参数无效" : "Invalid redirect parameters",
    };
  }

  // Step 4: Validate primary URL passes security check (Req 4.5)
  if (!isAllowedOutboundUrl(parsed.primary.url)) {
    return {
      candidateLink: null,
      error: language === "zh" ? "目标链接不被允许" : "Target link not allowed",
    };
  }

  // Step 5: Filter fallbacks to only include links that pass security check (Req 7.3)
  const validFallbacks = (parsed.fallbacks || []).filter((fallback) =>
    isAllowedOutboundUrl(fallback.url)
  );

  // Step 6: Return validated CandidateLink
  return {
    candidateLink: { ...parsed, fallbacks: validFallbacks },
    error: null,
  };
}

export function stripIntentBrowserFallbackUrl(url: string): string {
  if (!url.toLowerCase().startsWith("intent://")) {
    return url;
  }

  return url
    .replace(/;S\.browser_fallback_url=[^;]*;?/gi, ";")
    .replace(/;;+/g, ";")
    .replace(/#Intent;end$/i, "#Intent;end");
}

export function sanitizeAutoTryLinksForIntlAndroid(
  links: OutboundLink[]
): OutboundLink[] {
  const normalizeTikTokIntent = (url: string): string => {
    if (!url.toLowerCase().startsWith("intent://")) {
      return url;
    }

    const isTikTokPackage = /package=com\.zhiliaoapp\.musically/i.test(url);
    const hasSnssdkScheme = /;scheme=snssdk1128;/i.test(url);
    if (!isTikTokPackage || !hasSnssdkScheme) {
      return url;
    }

    const fallbackMatch = url.match(/;S\.browser_fallback_url=([^;]*);/i);
    const fallbackPart = fallbackMatch
      ? `;S.browser_fallback_url=${fallbackMatch[1]};`
      : ";";

    return `intent://#Intent;action=android.intent.action.VIEW;package=com.zhiliaoapp.musically${fallbackPart}end`;
  };

  const hasExplicitDeepLink = links.some(
    (link) => link.type === "app" || link.type === "intent"
  );

  const seen = new Set<string>();
  const result: OutboundLink[] = [];

  for (const link of links) {
    // 在 INTL Android 下：
    // - 若已有 app/intent 深链，移除 universal_link，避免回落到网页
    // - 若仅有 universal_link，保留它（已安装 App 时仍可能通过 App Links 拉起）
    if (link.type === "universal_link" && hasExplicitDeepLink) {
      continue;
    }

    const url =
      link.type === "intent"
        ? normalizeTikTokIntent(stripIntentBrowserFallbackUrl(link.url))
        : link.url;
    const key = `${link.type}:${url}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(url === link.url ? link : { ...link, url });
  }

  return result;
}

/**
 * INTL Android 环境下获取首选的 Google Play 商店链接
 * 优先返回 intent:// 格式（可直接拉起 Google Play App），
 * 其次返回 Google Play 网页链接，最后返回 market:// 链接
 */
export function getGooglePlayLink(
  storeLinks: OutboundLink[]
): OutboundLink | null {
  // 优先：intent:// 格式的 Google Play 链接（含 com.android.vending）
  const intentPlay = storeLinks.find(
    (l) =>
      l.url.toLowerCase().startsWith("intent://") &&
      l.url.toLowerCase().includes("com.android.vending")
  );
  if (intentPlay) return intentPlay;

  // 其次：Google Play 网页链接
  const playWeb = storeLinks.find(
    (l) =>
      l.url.toLowerCase().includes("play.google.com")
  );
  if (playWeb) return playWeb;

  // 最后：market:// 链接
  const market = storeLinks.find(
    (l) => l.url.toLowerCase().startsWith("market://")
  );
  if (market) return market;

  return null;
}

/**
 * 判断给定的 CandidateLink 是否处于 INTL Android 上下文
 *
 * 判断逻辑：
 * 1. candidate 为空或当前设备不是 Android → false
 * 2. metadata.region === "INTL" → true
 * 3. metadata.region === "CN" → false
 * 4. 无 region metadata → 通过 RegionConfig.database.provider !== "cloudbase" 判断
 *
 * 此函数从 Outbound_Page 组件中提取，用于独立测试。
 *
 * Validates: Requirements 1.1, 2.1
 */
export function isIntlAndroidContext(
  candidate: CandidateLink | null | undefined,
  currentOs?: MobileOs
): boolean {
  const os = currentOs ?? detectMobileOs();
  if (!candidate || os !== "android") {
    return false;
  }

  const region =
    typeof candidate.metadata?.region === "string"
      ? (candidate.metadata.region as string).toUpperCase()
      : null;

  if (region === "INTL") return true;
  if (region === "CN") return false;

  return RegionConfig.database.provider !== "cloudbase";
}

/**
 * 为 INTL Android 环境构造 Google Play 搜索兜底 URL
 *
 * 使用 provider 显示名称（providerDisplayName）作为搜索关键词，
 * 依次回退到 provider ID、title、最后使用 "app" 作为默认值。
 *
 * 格式：https://play.google.com/store/search?q={keyword}&c=apps
 *
 * Validates: Requirements 2.3
 */
export function getFallbackGooglePlayUrl(
  candidate: CandidateLink | null | undefined
): string {
  const providerDisplayName =
    typeof candidate?.metadata?.providerDisplayName === "string"
      ? candidate.metadata.providerDisplayName
      : "";
  const keyword =
    providerDisplayName ||
    candidate?.provider ||
    candidate?.title ||
    "app";
  return `https://play.google.com/store/search?q=${encodeURIComponent(
    keyword
  )}&c=apps`;
}

/**
 * 验证 returnTo 参数是否为安全的相对路径
 *
 * 仅接受以 "/" 开头（但非 "//"）的相对路径作为有效的返回地址。
 * 拒绝所有其他字符串，包括：
 * - 外部 URL（http://、https://）
 * - 协议相对 URL（//evil.com — 会被浏览器解析为外部链接）
 * - 空字符串
 * - javascript: 协议
 * - 其他非 "/" 开头的字符串
 *
 * @param returnTo - 返回地址参数，可能为 null
 * @returns 有效的返回地址字符串，或 null（当参数无效时）
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */
export function validateReturnTo(returnTo: string | null): string | null {
  if (returnTo === null) return null;
  if (typeof returnTo !== "string") return null;
  // Must start with "/" but NOT "//" (protocol-relative URL → open redirect)
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
  return null;
}
