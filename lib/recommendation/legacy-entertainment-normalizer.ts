import type { AIRecommendation } from "@/lib/types/recommendation";

type EntertainmentPatch = {
  title: string;
  description: string;
  reason: string;
  tags: string[];
  searchQuery: string;
  platform: string;
};
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toLegacyMojibake(value: string): string {
  try {
    return new TextDecoder("gb18030").decode(new TextEncoder().encode(value));
  } catch {
    return value;
  }
}

function createLegacyPrefixPattern(value: string): RegExp {
  const cleanPrefix = escapeRegExp(value);
  const legacyPrefix = escapeRegExp(toLegacyMojibake(value));

  return new RegExp(`^(?:${cleanPrefix}|${legacyPrefix})`);
}


const LEGACY_ENTERTAINMENT_FIXES: Array<{
  match: RegExp;
  patch: EntertainmentPatch;
}> = [
  {
    match: createLegacyPrefixPattern("玄幻长篇"),
    patch: {
      title: "玄幻长篇：诡秘之主",
      description: "克苏鲁风格的神秘奇幻长篇，世界观宏大",
      reason: "剧情张力强，适合沉浸式阅读",
      tags: ["小说", "奇幻", "长篇", "克苏鲁"],
      searchQuery: "诡秘之主",
      platform: "笔趣阁",
    },
  },
  {
    match: createLegacyPrefixPattern("悬疑短剧"),
    patch: {
      title: "悬疑短剧：一口气刷完的迷你剧",
      description: "节奏快、反转多、集数少，适合周末集中观看",
      reason: "从“悬疑”子类型做长尾拓展",
      tags: ["电视剧", "悬疑", "短剧", "反转"],
      searchQuery: "悬疑 迷你剧 高分 短剧 推荐",
      platform: "腾讯视频",
    },
  },
  {
    match: createLegacyPrefixPattern("独立解谜手游"),
    patch: {
      title: "独立解谜手游：通关不劝退（口碑向）",
      description: "偏剧情/机关/推理，优先挑“短而精”的作品",
      reason: "从游戏拓展到“独立解谜”细分",
      tags: ["游戏", "解谜", "独立", "口碑"],
      searchQuery: "独立 解谜 手游 口碑 通关",
      platform: "TapTap",
    },
  },
  {
    match: createLegacyPrefixPattern("通勤歌单"),
    patch: {
      title: "通勤歌单：轻快不吵的 Lo‑Fi/City Pop",
      description: "节奏稳定、旋律友好，适合通勤与轻度工作",
      reason: "按使用场景做音乐类拓展",
      tags: ["音乐", "歌单", "通勤", "LoFi"],
      searchQuery: "通勤 歌单 LoFi CityPop 推荐",
      platform: "网易云音乐",
    },
  },
  {
    match: createLegacyPrefixPattern("权谋爽文"),
    patch: {
      title: "权谋爽文：庆余年",
      description: "权谋与成长线交织，节奏明快不拖沓",
      reason: "故事张力足，适合一口气追读",
      tags: ["小说", "权谋", "爽文", "长篇"],
      searchQuery: "庆余年",
      platform: "笔趣阁",
    },
  },
  {
    match: createLegacyPrefixPattern("轻松向双人合作游戏"),
    patch: {
      title: "轻松向双人合作游戏（不吃操作）",
      description: "适合周末一起玩，主打解压与互动",
      reason: "从游戏拓展到“合作/休闲”相邻主题",
      tags: ["游戏", "合作", "休闲", "双人"],
      searchQuery: "双人 合作 休闲 游戏 推荐",
      platform: "TapTap",
    },
  },
  {
    match: createLegacyPrefixPattern("健身BGM"),
    patch: {
      title: "健身BGM：140–160BPM 跟练节奏歌单",
      description: "更适合跟练与有氧，节奏稳定不拖沓",
      reason: "从音乐拓展到“运动场景”",
      tags: ["音乐", "健身", "BPM", "跟练"],
      searchQuery: "140 160 BPM 健身 跟练 歌单",
      platform: "QQ音乐",
    },
  },
  {
    match: createLegacyPrefixPattern("修仙经典"),
    patch: {
      title: "修仙经典：凡人修仙传",
      description: "从凡人起步的修仙成长线，剧情稳扎稳打",
      reason: "成长路线清晰，适合长期追更",
      tags: ["小说", "修仙", "经典", "长篇"],
      searchQuery: "凡人修仙传",
      platform: "笔趣阁",
    },
  },
  {
    match: createLegacyPrefixPattern("Underrated Sci‑Fi Movies"),
    patch: {
      title: "Underrated Sci‑Fi Movies (Mind‑Bending Picks)",
      description: "A curated list of lesser-known sci‑fi films with strong concepts and reviews",
      reason: "Hidden gems with cult followings worth discovering",
      tags: ["movies", "sci-fi", "underrated", "concept"],
      searchQuery: "underrated sci fi movies mind bending list",
      platform: "IMDb",
    },
  },
  {
    match: createLegacyPrefixPattern("Top‑Rated Games"),
    patch: {
      title: "Top‑Rated Games This Quarter on Metacritic",
      description: "Browse the highest-scored new releases across all platforms",
      reason: "Trending this quarter with strong critical consensus",
      tags: ["games", "reviews", "top rated", "new releases"],
      searchQuery: "highest rated games 2025",
      platform: "Metacritic",
    },
  },
  {
    match: createLegacyPrefixPattern("Lo‑Fi Focus Playlist"),
    patch: {
      title: "Lo‑Fi Focus Playlist (Productivity)",
      description: "A focus-friendly lo‑fi playlist with consistent tempo and minimal vocals",
      reason: "Matches your need for distraction-free background music",
      tags: ["music", "lofi", "focus", "playlist"],
      searchQuery: "lofi focus playlist productivity",
      platform: "Spotify",
    },
  },
  {
    match: createLegacyPrefixPattern("YouTube: Stand‑Up Comedy Sets"),
    patch: {
      title: "YouTube: Stand‑Up Comedy Sets (Clean)",
      description: "Searchable, safe-for-work stand-up sets with high engagement",
      reason: "Highly recommended by the comedy community",
      tags: ["video", "comedy", "stand up", "clean"],
      searchQuery: "clean stand up comedy full set",
      platform: "YouTube",
    },
  },
  {
    match: createLegacyPrefixPattern("Co‑op Games for 2 Players"),
    patch: {
      title: "Co‑op Games for 2 Players (Casual)",
      description: "Easy-to-start co-op games suitable for casual sessions",
      reason: "Great value picks for social play nights",
      tags: ["games", "co-op", "2 players", "casual"],
      searchQuery: "best co op games 2 players casual",
      platform: "Steam",
    },
  },
  {
    match: createLegacyPrefixPattern("Classic Film Noir: Must‑Watch Essentials"),
    patch: {
      title: "Classic Film Noir: Must‑Watch Essentials",
      description: "Iconic noir films with atmospheric cinematography and gripping plots",
      reason: "Under-the-radar classics that shaped modern thrillers",
      tags: ["movies", "noir", "classic", "essentials"],
      searchQuery: "classic film noir must watch essentials",
      platform: "IMDb",
    },
  },
];

export function normalizeLegacyEntertainmentRecommendation<T extends AIRecommendation>(
  recommendation: T
): T {
  if (recommendation.category !== "entertainment") {
    return recommendation;
  }

  const title = String(recommendation.title || "");
  const matched = LEGACY_ENTERTAINMENT_FIXES.find((entry) => entry.match.test(title));
  if (!matched) {
    return recommendation;
  }

  const { patch } = matched;

  return {
    ...recommendation,
    title: patch.title,
    description: patch.description,
    reason: patch.reason,
    platform: patch.platform,
    tags: patch.tags,
    candidateLink: recommendation.candidateLink
      ? {
          ...recommendation.candidateLink,
          provider: patch.platform,
          title: patch.title,
          metadata: {
            ...(recommendation.candidateLink.metadata || {}),
            platform: patch.platform,
          },
        }
      : recommendation.candidateLink,
    metadata: {
      ...(recommendation.metadata || {}),
      tags: patch.tags,
      searchQuery: patch.searchQuery,
      originalPlatform:
        typeof recommendation.metadata?.originalPlatform === "string"
          ? patch.platform
          : recommendation.metadata?.originalPlatform,
    },
  };
}
