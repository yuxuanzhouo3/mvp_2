import type { RecommendationCategory } from "@/lib/types/recommendation";
import { isChinaDeployment } from "@/lib/config/deployment.config";
import { dedupeRecommendations } from "@/lib/recommendation/dedupe";

export type FallbackRecommendationItem = {
  title: string;
  description: string;
  reason: string;
  tags: string[];
  searchQuery: string;
  platform: string;
  entertainmentType?: "video" | "game" | "music" | "review";
  fitnessType?: "nearby_place" | "tutorial" | "equipment" | "theory_article";
};

type GenerateFallbackParams = {
  category: RecommendationCategory;
  locale: "zh" | "en";
  count: number;
  client?: "app" | "web";
  userPreference?: { tags?: string[] | null } | null;
  userHistory?: Array<{ title?: string; metadata?: { searchQuery?: string } | null }> | null;
  excludeTitles?: string[] | null;
};

function normalizeTag(input: string): string {
  return input.trim().toLowerCase();
}

function overlapScore(tags: string[], preferenceTags: string[]): number {
  if (tags.length === 0 || preferenceTags.length === 0) return 0;
  const pref = new Set(preferenceTags.map(normalizeTag));
  let score = 0;
  for (const tag of tags) {
    if (pref.has(normalizeTag(tag))) score += 1;
  }
  return score;
}

function shuffleWithScore<T extends { tags: string[] }>(
  items: T[],
  preferenceTags: string[]
): T[] {
  const scored = items.map((item) => ({
    item,
    score: overlapScore(item.tags || [], preferenceTags),
    r: Math.random(),
  }));

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.r - b.r;
  });

  return scored.map((s) => s.item);
}

export function getFallbackPool(locale: "zh" | "en"): Record<RecommendationCategory, FallbackRecommendationItem[]> {
  if (locale === "en") {
    return {
      entertainment: [
        {
          title: "Underrated Sci‑Fi Movies (Mind‑Bending Picks)",
          description: "A curated list of lesser-known sci‑fi films with strong concepts and reviews",
          reason: "Hidden gems with cult followings worth discovering",
          tags: ["movies", "sci-fi", "underrated", "concept"],
          searchQuery: "underrated sci fi movies mind bending list",
          platform: "IMDb",
          entertainmentType: "review",
        },
        {
          title: "Top‑Rated Games This Quarter on Metacritic",
          description: "Browse the highest-scored new releases across all platforms",
          reason: "Trending this quarter with strong critical consensus",
          tags: ["games", "reviews", "top rated", "new releases"],
          searchQuery: "highest rated games 2025",
          platform: "Metacritic",
          entertainmentType: "review",
        },
        {
          title: "Indie Puzzle Games You Can Finish in a Weekend",
          description: "Short indie puzzle games with great reviews and creative mechanics",
          reason: "Perfect for a relaxing weekend gaming session",
          tags: ["games", "indie", "puzzle", "short"],
          searchQuery: "indie puzzle games short story weekend",
          platform: "MiniReview",
          entertainmentType: "game",
        },
        {
          title: "Lo‑Fi Focus Playlist (Productivity)",
          description: "A focus-friendly lo‑fi playlist with consistent tempo and minimal vocals",
          reason: "Matches your need for distraction-free background music",
          tags: ["music", "lofi", "focus", "playlist"],
          searchQuery: "lofi focus playlist productivity",
          platform: "Spotify",
          entertainmentType: "music",
        },
        {
          title: "YouTube: Stand‑Up Comedy Sets (Clean)",
          description: "Searchable, safe-for-work stand-up sets with high engagement",
          reason: "Highly recommended by the comedy community",
          tags: ["video", "comedy", "stand up", "clean"],
          searchQuery: "clean stand up comedy full set",
          platform: "YouTube",
          entertainmentType: "video",
        },
        {
          title: "Co‑op Games for 2 Players (Casual)",
          description: "Easy-to-start co-op games suitable for casual sessions",
          reason: "Great value picks for social play nights",
          tags: ["games", "co-op", "2 players", "casual"],
          searchQuery: "best co op games 2 players casual",
          platform: "Steam",
          entertainmentType: "game",
        },
        {
          title: "Workout Pop: 140–160 BPM Mix",
          description: "Up-tempo pop tracks suited for training sessions",
          reason: "Energizing tempo ideal for high-intensity workouts",
          tags: ["music", "workout", "pop", "bpm"],
          searchQuery: "140 160 bpm workout pop playlist",
          platform: "Spotify",
          entertainmentType: "music",
        },
        {
          title: "Classic Film Noir: Must‑Watch Essentials",
          description: "Iconic noir films with atmospheric cinematography and gripping plots",
          reason: "Under-the-radar classics that shaped modern thrillers",
          tags: ["movies", "noir", "classic", "essentials"],
          searchQuery: "classic film noir must watch essentials",
          platform: "IMDb",
          entertainmentType: "review",
        },
      ],
      shopping: [
        {
          title: "Noise‑Cancelling Earbuds (Mid‑Range Best Value)",
          description: "Look for comfort, mic quality, transparency mode, and return policy",
          reason: "Great value for money in a competitive product niche",
          tags: ["shopping", "audio", "earbuds", "value"],
          searchQuery: "best value noise cancelling earbuds 2025",
          platform: "Amazon",
        },
        {
          title: "Ergonomic Desk Setup Essentials",
          description: "Budget-friendly upgrades: monitor arm, footrest, lumbar support",
          reason: "Practical upgrades that boost daily comfort",
          tags: ["shopping", "home office", "ergonomic", "desk"],
          searchQuery: "ergonomic desk setup essentials monitor arm footrest",
          platform: "Amazon",
        },
        {
          title: "Minimalist Everyday Carry (EDC) Under $50",
          description: "Practical, lightweight EDC items with good durability",
          reason: "Budget-friendly finds with strong buyer ratings",
          tags: ["shopping", "edc", "minimal", "budget"],
          searchQuery: "minimalist edc under 50 dollars list",
          platform: "eBay",
        },
        {
          title: "Kitchen Tools That Actually Save Time",
          description: "Time-saving kitchen tools with high review-to-return ratio",
          reason: "Top-rated tools that streamline meal prep",
          tags: ["shopping", "kitchen", "tools", "time saving"],
          searchQuery: "kitchen tools that save time highly rated",
          platform: "Walmart",
        },
        {
          title: "Local Stores for Home & Garden Supplies",
          description: "Find nearby home improvement and garden supply stores with good reviews",
          reason: "Conveniently located nearby for same-day pickup",
          tags: ["shopping", "local", "home", "garden"],
          searchQuery: "home garden supplies store near me",
          platform: "Google Maps",
        },
      ],
      food: [
        {
          title: "15‑Minute High‑Protein Lunch Ideas",
          description: "Quick meals with protein + fiber to keep you full",
          reason: "Matches your interest in fast, nutritious cooking",
          tags: ["food", "high protein", "quick", "lunch"],
          searchQuery: "15 minute high protein lunch ideas",
          platform: "Love and Lemons",
        },
        {
          title: "Best Sushi Spots Nearby (Omakase Friendly)",
          description: "Use reviews to filter freshness and service; reserve ahead",
          reason: "Conveniently located with top-rated reviews nearby",
          tags: ["food", "sushi", "restaurant", "omakase"],
          searchQuery: "omakase sushi restaurants near me",
          platform: "Google Maps",
        },
        {
          title: "Weekend Brunch Delivery: Comfort Classics",
          description: "Order hearty brunch favorites delivered to your door",
          reason: "Perfect for a lazy weekend morning treat",
          tags: ["food", "brunch", "delivery", "comfort"],
          searchQuery: "brunch delivery comfort food",
          platform: "Uber Eats",
        },
        {
          title: "Spicy Noodle Recipes (Heat Level Guide)",
          description: "Choose by spice level and pantry difficulty, with substitutions",
          reason: "Trending recipe with customizable heat levels",
          tags: ["food", "noodles", "spicy", "recipe"],
          searchQuery: "spicy noodle recipes heat level guide",
          platform: "Love and Lemons",
        },
        {
          title: "Outdoor Dining & Picnic Spots Worth Visiting",
          description: "Find scenic outdoor dining and picnic-friendly restaurants",
          reason: "Hidden gem patios and gardens rated by locals",
          tags: ["food", "outdoor", "picnic", "dining"],
          searchQuery: "outdoor dining picnic spots near me",
          platform: "Yelp",
        },
      ],
      travel: [
        {
          title: "Tokyo: Neighborhood Guide (First‑Time)",
          description: "Pick a base by vibe: Shinjuku for transit, Asakusa for old town",
          reason: "Highly recommended destination for first-time visitors",
          tags: ["travel", "tokyo", "neighborhood", "guide"],
          searchQuery: "Tokyo neighborhood guide where to stay first time",
          platform: "TripAdvisor",
        },
        {
          title: "Lisbon: 3‑Day Itinerary (Food + Views)",
          description: "A compact itinerary focused on viewpoints, trams, and local eats",
          reason: "Trending European city with great weekend appeal",
          tags: ["travel", "lisbon", "itinerary", "food"],
          searchQuery: "Lisbon 3 day itinerary food viewpoints",
          platform: "YouTube",
        },
        {
          title: "Kruger National Park Safari Planning Guide",
          description: "Best camps, routes, and seasons for wildlife viewing in Kruger",
          reason: "Bucket-list safari experience with expert planning tips",
          tags: ["travel", "safari", "kruger", "wildlife"],
          searchQuery: "Kruger National Park safari guide",
          platform: "SANParks",
        },
        {
          title: "Budget Hotels With Great Reviews",
          description: "Filter by cleanliness, noise, and transport access",
          reason: "Great value stays with consistently positive ratings",
          tags: ["travel", "hotel", "budget", "reviews"],
          searchQuery: "best budget hotels good reviews quiet clean",
          platform: "Booking.com",
        },
        {
          title: "Hidden Gems: Day Trips Near You",
          description: "Short day trips with nature + local culture; keep it realistic",
          reason: "Discover nearby escapes you haven't explored yet",
          tags: ["travel", "day trip", "nearby", "nature"],
          searchQuery: "best day trips near me nature culture",
          platform: "Google Maps",
        },
      ],
      fitness: [
        {
          title: "Nearby Gym Options (Check Reviews First)",
          description: "Prioritize ventilation, squat racks count, and a 15‑min walkable distance",
          reason: "Conveniently located gyms with verified member reviews",
          tags: ["fitness", "nearby", "gym", "walkable"],
          searchQuery: "gym near me walkable ventilation squat racks",
          platform: "Google Maps",
          fitnessType: "nearby_place",
        },
        {
          title: "45‑Minute Full‑Body Strength Follow‑Along",
          description: "Beginner-friendly full-body strength session with cues and pacing",
          reason: "Highly rated tutorial you can start immediately",
          tags: ["fitness", "strength", "tutorial", "follow along"],
          searchQuery: "full body strength follow along tutorial video",
          platform: "YouTube Fitness",
          fitnessType: "tutorial",
        },
        {
          title: "Best Protein Powders & Pre‑Workout Supplements",
          description: "Compare top-rated supplements for muscle recovery and energy",
          reason: "Great value picks backed by lab-tested reviews",
          tags: ["fitness", "supplements", "protein", "pre-workout"],
          searchQuery: "best protein powder pre workout supplements",
          platform: "Muscle & Strength",
          fitnessType: "equipment",
        },
        {
          title: "Beginner Mobility Routine (10 Minutes)",
          description: "A short daily mobility routine to reduce stiffness and improve range",
          reason: "Perfect for morning warm-up or post-work recovery",
          tags: ["fitness", "mobility", "beginner", "routine"],
          searchQuery: "10 minute mobility routine beginner follow along tutorial",
          platform: "YouTube Fitness",
          fitnessType: "tutorial",
        },
        {
          title: "Home Gym Equipment Essentials on a Budget",
          description: "Dumbbells, resistance bands, and mats for effective home workouts",
          reason: "Budget-friendly gear to build a solid home setup",
          tags: ["fitness", "home gym", "equipment", "budget"],
          searchQuery: "home gym equipment essentials budget",
          platform: "Muscle & Strength",
          fitnessType: "equipment",
        },
      ],
    };
  }

  return {
    entertainment: [
      {
        title: "玄幻长篇：诡秘之主",
        description: "克苏鲁风格的神秘奇幻长篇，世界观宏大",
        reason: "剧情张力强，适合沉浸式阅读",
        tags: ["小说", "奇幻", "长篇", "克苏鲁"],
        searchQuery: "诡秘之主",
        platform: "笔趣阁",
        entertainmentType: "review",
      },
      {
        title: "悬疑短剧：一口气刷完的迷你剧",
        description: "节奏快、反转多、集数少，适合周末集中观看",
        reason: "从“悬疑”子类型做长尾拓展",
        tags: ["电视剧", "悬疑", "短剧", "反转"],
        searchQuery: "悬疑 迷你剧 高分 短剧 推荐",
        platform: "腾讯视频",
        entertainmentType: "video",
      },
      {
        title: "独立解谜手游：通关不劝退（口碑向）",
        description: "偏剧情/机关/推理，优先挑“短而精”的作品",
        reason: "从游戏拓展到“独立解谜”细分",
        tags: ["游戏", "解谜", "独立", "口碑"],
        searchQuery: "独立 解谜 手游 口碑 通关",
        platform: "TapTap",
        entertainmentType: "game",
      },
      {
        title: "通勤歌单：轻快不吵的 Lo‑Fi/City Pop",
        description: "节奏稳定、旋律友好，适合通勤与轻度工作",
        reason: "按使用场景做音乐类拓展",
        tags: ["音乐", "歌单", "通勤", "LoFi"],
        searchQuery: "通勤 歌单 LoFi CityPop 推荐",
        platform: "网易云音乐",
        entertainmentType: "music",
      },
      {
        title: "权谋爽文：庆余年",
        description: "权谋与成长线交织，节奏明快不拖沓",
        reason: "故事张力足，适合一口气追读",
        tags: ["小说", "权谋", "爽文", "长篇"],
        searchQuery: "庆余年",
        platform: "笔趣阁",
        entertainmentType: "review",
      },
      {
        title: "轻松向双人合作游戏（不吃操作）",
        description: "适合周末一起玩，主打解压与互动",
        reason: "从游戏拓展到“合作/休闲”相邻主题",
        tags: ["游戏", "合作", "休闲", "双人"],
        searchQuery: "双人 合作 休闲 游戏 推荐",
        platform: "TapTap",
        entertainmentType: "game",
      },
      {
        title: "健身BGM：140–160BPM 跟练节奏歌单",
        description: "更适合跟练与有氧，节奏稳定不拖沓",
        reason: "从音乐拓展到“运动场景”",
        tags: ["音乐", "健身", "BPM", "跟练"],
        searchQuery: "140 160 BPM 健身 跟练 歌单",
        platform: "QQ音乐",
        entertainmentType: "music",
      },
      {
        title: "修仙经典：凡人修仙传",
        description: "从凡人起步的修仙成长线，剧情稳扎稳打",
        reason: "成长路线清晰，适合长期追更",
        tags: ["小说", "修仙", "经典", "长篇"],
        searchQuery: "凡人修仙传",
        platform: "笔趣阁",
        entertainmentType: "review",
      },
    ],
    shopping: [
      {
        title: "降噪真无线耳机（性价比区间）",
        description: "重点看佩戴舒适、通透模式、通话降噪与退换政策",
        reason: "从“数码”拓展到更具体可决策的细分品类",
        tags: ["数码", "耳机", "降噪", "性价比"],
        searchQuery: "降噪 真无线 耳机 性价比 口碑",
        platform: "京东",
      },
      {
        title: "人体工学桌面：显示器支架/脚踏/腰靠",
        description: "低成本提升坐姿舒适度，优先选可调节款",
        reason: "从购物拓展到“办公健康”相邻需求",
        tags: ["办公", "人体工学", "桌面", "舒适"],
        searchQuery: "人体工学 桌面 显示器支架 脚踏 腰靠 推荐",
        platform: "淘宝",
      },
      {
        title: "收纳好物：小户型“隐形收纳”清单",
        description: "优先选可叠放、可抽拉、尺寸明确的收纳盒/架",
        reason: "从家居拓展到“小户型收纳”长尾主题",
        tags: ["家居", "收纳", "小户型", "清单"],
        searchQuery: "小户型 隐形 收纳 清单 好物",
        platform: "拼多多",
      },
      {
        title: "户外入门：轻量化露营必备（不过度）",
        description: "按“可用性优先”，避开一次性堆装备",
        reason: "按兴趣相邻拓展到“户外/露营”",
        tags: ["户外", "露营", "轻量化", "入门"],
        searchQuery: "轻量化 露营 装备 入门 必备",
        platform: "京东",
      },
      {
        title: "厨房省时工具：真能提高效率的那种",
        description: "优先选易清洗、耐用、评价集中提到“省时间”的工具",
        reason: "从购物拓展到“效率提升”具体需求",
        tags: ["厨房", "工具", "省时", "实用"],
        searchQuery: "厨房 省时 工具 实用 好评",
        platform: "淘宝",
      },
    ],
    food: [
      {
        title: "宫保鸡丁",
        description: "经典川味下饭菜，鸡丁外酥里嫩、酱香微辣",
        reason: "食谱类拓展：用具体菜名提升可搜索性",
        tags: ["食谱", "家常菜", "川菜", "下饭"],
        searchQuery: "宫保鸡丁",
        platform: "下厨房",
      },
      {
        title: "回锅肉",
        description: "经典川菜代表，咸香下饭，适合快节奏工作日晚餐",
        reason: "具体菜品替代泛类目，便于直接搜索和下单",
        tags: ["美食", "川菜", "家常菜", "下饭"],
        searchQuery: "回锅肉",
        platform: "高德地图美食",
      },
      {
        title: "炙烧三文鱼寿司",
        description: "口感层次丰富，偏清爽，适合工作日轻负担午餐",
        reason: "将场景表达收敛为可消费的具体菜品",
        tags: ["美食", "日料", "寿司", "午餐"],
        searchQuery: "炙烧三文鱼寿司",
        platform: "高德地图美食",
      },
      {
        title: "番茄牛腩",
        description: "酸甜开胃，适合配米饭或面，做一锅吃两顿",
        reason: "食谱类拓展：具体菜名 + 高复购",
        tags: ["食谱", "炖菜", "番茄", "牛腩"],
        searchQuery: "番茄牛腩",
        platform: "下厨房",
      },
      {
        title: "蒜蓉生蚝",
        description: "热门夜宵单品，适合多人分享，风味鲜香明显",
        reason: "避免抽象“场景词”，直接给出可点单的菜品",
        tags: ["美食", "烧烤", "海鲜", "夜宵"],
        searchQuery: "蒜蓉生蚝",
        platform: "大众点评",
      },
    ],
    travel: [
      {
        title: "中国·西安·大雁塔",
        description: "城市历史地标，适合夜景与步行漫游",
        reason: "国内目的地拓展：具体到景点",
        tags: ["旅行", "西安", "地标", "夜景"],
        searchQuery: "西安 大雁塔 游玩 攻略",
        platform: "携程",
      },
      {
        title: "中国·杭州·西湖骑行路线",
        description: "适合半天轻松路线，兼顾景色与拍照点",
        reason: "国内玩法拓展：从“目的地”细化到“路线玩法”",
        tags: ["旅行", "杭州", "西湖", "骑行"],
        searchQuery: "杭州 西湖 骑行 路线 半天",
        platform: "小红书",
      },
      {
        title: "日本·东京·下北泽一日漫游",
        description: "复古小店、咖啡馆、二手店集中，适合慢逛",
        reason: "国外目的地拓展：具体到街区玩法",
        tags: ["旅行", "东京", "街区", "咖啡馆"],
        searchQuery: "东京 下北泽 一日 漫游 攻略",
        platform: "马蜂窝",
      },
      {
        title: "中国·成都·宽窄巷子周边美食路线",
        description: "把“景点+吃”串起来，减少踩雷",
        reason: "从出行拓展到“目的地+美食路线”",
        tags: ["旅行", "成都", "美食", "路线"],
        searchQuery: "成都 宽窄巷子 周边 美食 路线",
        platform: "去哪儿",
      },
      {
        title: "葡萄牙·里斯本·3天行程（海景+老城）",
        description: "用短行程模板快速规划：老城/观景台/电车/小吃",
        reason: "用行程模板做长尾拓展",
        tags: ["旅行", "里斯本", "行程", "观景台"],
        searchQuery: "里斯本 3天 行程 老城 观景台 电车",
        platform: "小红书",
      },
    ],
    fitness: [
      {
        title: "附近健身房推荐（先看评论）",
        description: "优先选择通风好、异味少的场馆；留意深蹲架数量是否够用、是否需要排队；尽量选步行15分钟内更容易坚持",
        reason: "根据“附近场所”需求生成的本地健身地点推荐",
        tags: ["附近", "健身房", "通风", "深蹲架"],
        searchQuery: "附近 健身房 步行 地铁 商圈 深蹲架 通风",
        platform: "大众点评",
        fitnessType: "nearby_place",
      },
      {
        title: "45分钟全身力量跟练教程",
        description: "新手友好的全身力量训练跟练视频，包含动作要点与常见错误提示",
        reason: "根据“教程”需求生成的可直接跟练内容",
        tags: ["力量训练", "跟练", "教程", "新手"],
        searchQuery: "全身力量 跟练 教程 视频课",
        platform: "B站健身",
        fitnessType: "tutorial",
      },
      {
        title: "哑铃使用教程：动作要点与常见错误",
        description: "哑铃训练动作要点与发力细节，避免肩肘受伤，适合家庭训练入门",
        reason: "根据“器材”需求生成的使用教程推荐",
        tags: ["哑铃", "使用教程", "动作要点", "入门"],
        searchQuery: "哑铃 使用教程 怎么用 动作要点 入门",
        platform: "B站健身",
        fitnessType: "equipment",
      },
      {
        title: "健身小白必读：肌肉增长与恢复原理",
        description: "用通俗方式讲清训练刺激、恢复与进步的关系，减少无效训练",
        reason: "补齐“健身原理”类型，帮助建立正确训练观念",
        tags: ["健身原理", "小白", "科普", "误区"],
        searchQuery: "健身小白 原理 科普 肌肉增长 恢复",
        platform: "知乎",
        fitnessType: "theory_article",
      },
      {
        title: "10分钟日常拉伸：改善久坐僵硬",
        description: "短时拉伸跟练，重点放松髋屈肌、胸椎与后侧链",
        reason: "从训练拓展到“恢复与灵活性”",
        tags: ["拉伸", "久坐", "恢复", "灵活性"],
        searchQuery: "10分钟 拉伸 跟练 教程 久坐",
        platform: "B站健身",
        fitnessType: "tutorial",
      },
    ],
  };
}

function pickRequiredKinds(
  candidates: FallbackRecommendationItem[],
  kinds: Array<NonNullable<FallbackRecommendationItem["entertainmentType"] | FallbackRecommendationItem["fitnessType"]>>,
  params: {
    userHistory: GenerateFallbackParams["userHistory"];
    excludeTitles: string[];
  }
): FallbackRecommendationItem[] {
  const selected: FallbackRecommendationItem[] = [];
  let rollingExcludeTitles = [...params.excludeTitles];

  for (const kind of kinds) {
    const poolForKind = candidates.filter((c) => c.entertainmentType === kind || c.fitnessType === kind);
    const picked = dedupeRecommendations(poolForKind, {
      count: 1,
      userHistory: params.userHistory || [],
      excludeTitles: rollingExcludeTitles,
      mode: "strict",
    })[0];
    if (picked) {
      selected.push(picked);
      rollingExcludeTitles = [...rollingExcludeTitles, picked.title].slice(0, 200);
    }
  }

  return selected;
}

export function generateFallbackCandidates(params: GenerateFallbackParams): FallbackRecommendationItem[] {
  const count = Math.min(Math.max(params.count, 1), 10);
  const pool = getFallbackPool(params.locale)[params.category] || [];
  const preferenceTags = (params.userPreference?.tags || []).filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0
  );

  const ordered = shuffleWithScore(pool, preferenceTags);
  const baseExcludeTitles = (params.excludeTitles || []).filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0
  );

  const isCnWebFitness =
    params.category === "fitness" &&
    params.locale === "zh" &&
    params.client === "web" &&
    isChinaDeployment();

  const requiredKinds =
    params.category === "entertainment"
      ? (["video", "game", "music", "review"] as const)
      : params.category === "fitness"
        ? (isCnWebFitness
          ? (["tutorial", "theory_article", "equipment"] as const)
          : (["nearby_place", "tutorial", "equipment"] as const))
        : [];

  const requiredSelections =
    requiredKinds.length > 0
      ? pickRequiredKinds(ordered, requiredKinds as any, {
          userHistory: params.userHistory || [],
          excludeTitles: baseExcludeTitles,
        })
      : [];

  const rollingExcludeTitles = [
    ...baseExcludeTitles,
    ...requiredSelections.map((r) => r.title),
  ];

  const rest = dedupeRecommendations(ordered, {
    count,
    userHistory: params.userHistory || [],
    excludeTitles: rollingExcludeTitles,
    mode: "strict",
  });

  const merged = dedupeRecommendations([...requiredSelections, ...rest], {
    count,
    userHistory: params.userHistory || [],
    excludeTitles: baseExcludeTitles,
    mode: "strict",
  });

  return merged.slice(0, count);
}
