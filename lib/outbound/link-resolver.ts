import type {
  CandidateLink,
  OutboundLink,
  RecommendationCategory,
} from "@/lib/types/recommendation";
import {
  getProviderCatalog,
  type DeploymentRegion,
  type LinkContext,
  type ProviderDefinition,
  type ProviderId,
} from "@/lib/outbound/provider-catalog";

export type ResolveCandidateLinkInput = {
  title: string;
  query: string;
  category: RecommendationCategory;
  locale: "zh" | "en";
  region: DeploymentRegion;
  provider?: string;
};

function buildStoreLinks(
  provider: ProviderDefinition,
  locale: "zh" | "en",
  region: DeploymentRegion
): OutboundLink[] {
  const encoded = encodeURIComponent(provider.displayName[locale]);
  const iosStoreUrl = `itms-apps://apps.apple.com/search?term=${encoded}`;
  const iosWebUrl = `https://apps.apple.com/search?term=${encoded}`;

  const links: OutboundLink[] = [{ type: "store", label: "App Store", url: iosStoreUrl }];
  links.push({ type: "store", label: "App Store（网页）", url: iosWebUrl });

  if (provider.androidPackageId) {
    links.push({
      type: "store",
      label: region === "CN" ? "系统应用商店" : "App Store / Play",
      url: `market://details?id=${provider.androidPackageId}`,
    });

    if (region === "CN") {
      links.push({
        type: "store",
        label: "应用宝",
        url: `tmast://appdetails?pname=${encodeURIComponent(provider.androidPackageId)}`,
      });
      links.push({
        type: "store",
        label: "应用宝（网页）",
        url: `https://sj.qq.com/myapp/detail.htm?apkName=${encodeURIComponent(provider.androidPackageId)}`,
      });
    }
  } else if (region === "CN") {
    links.push({ type: "store", label: "应用宝（网页）", url: `https://sj.qq.com/myapp/search.htm?kw=${encoded}` });
  } else {
    links.push({
      type: "store",
      label: "Google Play（网页）",
      url: `https://play.google.com/store/search?q=${encoded}&c=apps`,
    });
  }

  return uniqueOutboundLinks(links);
}

function uniqueOutboundLinks(links: OutboundLink[]): OutboundLink[] {
  const seen = new Set<string>();
  const result: OutboundLink[] = [];
  for (const link of links) {
    const key = `${link.type}:${link.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(link);
  }
  return result;
}

function normalizeProviderId(provider: string | undefined, region: DeploymentRegion): ProviderId {
  if (!provider) return region === "CN" ? "百度" : "Google";
  const catalog = getProviderCatalog();
  const direct = provider as ProviderId;
  if (catalog[direct]) return direct;

  const byDisplayName = Object.values(catalog).find((item) => {
    const zh = item.displayName.zh.toLowerCase();
    const en = item.displayName.en.toLowerCase();
    const candidate = provider.toLowerCase();
    return candidate === zh || candidate === en;
  });

  if (byDisplayName) return byDisplayName.id;
  return region === "CN" ? "百度" : "Google";
}

function getFallbackProviders(
  category: RecommendationCategory,
  region: DeploymentRegion
): ProviderId[] {
  if (region === "CN") {
    switch (category) {
      case "food":
        return [
          "京东秒送",
          "淘宝闪购",
          "美团外卖",
          "大众点评",
          "小红书",
          "高德地图",
          "百度地图",
          "腾讯地图",
          "百度",
        ];
      case "shopping":
        return ["京东", "淘宝", "拼多多", "唯品会", "百度"];
      case "entertainment":
        return ["腾讯视频", "优酷", "QQ音乐", "酷狗音乐", "网易云音乐", "TapTap", "豆瓣", "百度"];
      case "travel":
        return ["携程", "去哪儿", "小红书", "马蜂窝", "百度"];
      case "fitness":
        return ["Keep", "B站", "优酷", "大众点评", "美团", "高德地图", "百度地图", "腾讯地图", "百度"];
      default:
        return ["百度"];
    }
  }

  switch (category) {
    case "food":
      return ["Google Maps", "Google", "YouTube"];
    case "shopping":
      return ["Google", "YouTube", "Google Maps"];
    case "entertainment":
      return ["YouTube", "Google"];
    case "travel":
      return ["Google Maps", "Google", "YouTube"];
    case "fitness":
      return ["YouTube Fitness", "Google", "Google Maps"];
    default:
      return ["Google"];
  }
}

function resolvePrimary(provider: ProviderDefinition, ctx: LinkContext): OutboundLink {
  if (provider.universalLink) {
    return { type: "universal_link", url: provider.universalLink(ctx) };
  }
  if (provider.iosScheme) {
    return { type: "app", url: provider.iosScheme(ctx) };
  }
  if (provider.androidScheme) {
    return { type: "app", url: provider.androidScheme(ctx) };
  }
  return { type: "web", url: provider.webLink(ctx) };
}

function resolveAppSchemes(provider: ProviderDefinition, ctx: LinkContext): OutboundLink[] {
  const links: OutboundLink[] = [];
  if (provider.iosScheme) links.push({ type: "app", url: provider.iosScheme(ctx), label: "iOS" });
  if (provider.androidScheme) links.push({ type: "app", url: provider.androidScheme(ctx), label: "Android" });
  return links;
}

export function resolveCandidateLink(input: ResolveCandidateLinkInput): CandidateLink {
  const catalog = getProviderCatalog();
  const providerId = normalizeProviderId(input.provider, input.region);

  const ctx: LinkContext = {
    title: input.title,
    query: input.query,
    category: input.category,
    locale: input.locale,
    region: input.region,
  };

  const provider = catalog[providerId];
  const primary = resolvePrimary(provider, ctx);
  const appSchemes = resolveAppSchemes(provider, ctx);
  const webLink: OutboundLink = { type: "web", url: provider.webLink(ctx), label: "Web" };
  const storeLinks = provider.hasApp ? buildStoreLinks(provider, input.locale, input.region) : [];

  const fallbackProviderIds = getFallbackProviders(input.category, input.region);
  const fallbackLinks: OutboundLink[] = [];
  for (const fallbackId of fallbackProviderIds) {
    if (fallbackId === providerId) continue;
    const fallbackProvider = catalog[fallbackId];
    if (!fallbackProvider) continue;

    const fallbackPrimary = resolvePrimary(fallbackProvider, ctx);
    const label = fallbackProvider.displayName[input.locale];
    if (fallbackPrimary.type === "universal_link") {
      if (fallbackId === "Google Maps" || fallbackId === "高德地图" || fallbackId === "百度地图") {
        fallbackLinks.push({ ...fallbackPrimary, type: "map", label });
      } else if (fallbackId === "YouTube" || fallbackId === "B站" || fallbackId === "YouTube Fitness") {
        fallbackLinks.push({ ...fallbackPrimary, type: "video", label });
      } else {
        fallbackLinks.push({ ...fallbackPrimary, type: "search", label });
      }
    } else if (fallbackPrimary.type === "web") {
      if (fallbackId === "Google Maps" || fallbackId === "高德地图" || fallbackId === "百度地图") {
        fallbackLinks.push({ ...fallbackPrimary, type: "map", label });
      } else if (fallbackId === "YouTube" || fallbackId === "B站" || fallbackId === "YouTube Fitness") {
        fallbackLinks.push({ ...fallbackPrimary, type: "video", label });
      } else {
        fallbackLinks.push({ ...fallbackPrimary, type: "search", label });
      }
    } else {
      fallbackLinks.push({ ...fallbackPrimary, label });
    }
  }

  const fallbacks = uniqueOutboundLinks([
    ...appSchemes.filter((l) => l.url !== primary.url),
    ...(primary.type !== "web" ? [webLink] : []),
    ...storeLinks,
    ...fallbackLinks,
  ]);

  return {
    provider: providerId,
    title: input.title,
    primary,
    fallbacks,
    metadata: {
      region: input.region,
      locale: input.locale,
      category: input.category,
      providerDisplayName: provider.displayName[input.locale],
    },
  };
}
