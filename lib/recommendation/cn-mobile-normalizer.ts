import type { RecommendationCategory } from "@/lib/types/recommendation";

export function isCnMobileScenario(params: {
  locale: "zh" | "en";
  isMobile?: boolean;
}): boolean {
  return params.locale === "zh" && Boolean(params.isMobile);
}

export function normalizeCnMobileCategoryPlatform(params: {
  category: RecommendationCategory;
  platform: string;
  client: "app" | "web";
  isMobile?: boolean;
  locale: "zh" | "en";
  index: number;
  fitnessType?: string;
}): string {
  const { category, platform, client, isMobile, locale, index, fitnessType } = params;
  if (!isCnMobileScenario({ locale, isMobile })) {
    return platform;
  }

  if (client !== "app") {
    return platform;
  }

  if (category === "fitness") {
    if (fitnessType === "tutorial") {
      return "B站";
    }
    if (fitnessType === "equipment") {
      return "京东";
    }
    if (fitnessType === "nearby_place") {
      return index % 2 === 0 ? "美团" : "高德地图";
    }
    if (platform === "B站健身" || platform === "哔哩哔哩") {
      return "B站";
    }
    if (platform === "高德地图健身") {
      return "高德地图";
    }
    return platform;
  }

  if (category === "food") {
    if (platform === "百度地图美食" || platform === "腾讯地图美食") {
      return "小红书";
    }
    if (platform === "高德地图" || platform === "腾讯地图" || platform === "百度地图") {
      return "小红书";
    }
  }

  return platform;
}

export function stripCnFoodGenericTerms(value: string): string {
  return String(value || "")
    .replace(/美食|餐厅|推荐|附近/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCnMobileAppScenario(params: {
  locale: "zh" | "en";
  isMobile?: boolean;
  client: "app" | "web";
}): boolean {
  return isCnMobileScenario(params) && params.client === "app";
}

function ensureContainsAny(value: string, tokens: string[], suffix: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) return suffix.trim();
  if (tokens.some((token) => normalized.includes(token))) {
    return normalized;
  }
  return `${normalized} ${suffix}`.trim();
}

type EquipmentBlueprint = {
  canonical: string;
  aliases: string[];
  features: string[];
};

const CN_MOBILE_EQUIPMENT_BLUEPRINTS: EquipmentBlueprint[] = [
  {
    canonical: "可调节哑铃",
    aliases: ["可调节哑铃", "adjustable dumbbell"],
    features: ["切换结构", "重量范围", "占地收纳"],
  },
  {
    canonical: "哑铃",
    aliases: ["哑铃", "dumbbell"],
    features: ["重量范围", "握把防滑", "占地收纳"],
  },
  {
    canonical: "壶铃",
    aliases: ["壶铃", "kettlebell"],
    features: ["握把宽度", "底座稳定", "涂层手感"],
  },
  {
    canonical: "弹力带",
    aliases: ["弹力带", "拉力带", "阻力带", "resistance band"],
    features: ["阻力等级", "乳胶材质", "是否易卷边"],
  },
  {
    canonical: "瑜伽垫",
    aliases: ["瑜伽垫", "yoga mat"],
    features: ["厚度", "防滑", "回弹"],
  },
  {
    canonical: "泡沫轴",
    aliases: ["泡沫轴", "foam roller"],
    features: ["硬度", "颗粒设计", "长度"],
  },
  {
    canonical: "健腹轮",
    aliases: ["健腹轮", "ab wheel"],
    features: ["双轮稳定", "回弹辅助", "握把防滑"],
  },
  {
    canonical: "跳绳",
    aliases: ["跳绳", "jump rope"],
    features: ["轴承顺滑", "绳长调节", "手柄防滑"],
  },
  {
    canonical: "引体向上单杠",
    aliases: ["引体向上单杠", "门上单杠", "pull up bar"],
    features: ["承重", "安装方式", "防滑护垫"],
  },
  {
    canonical: "卧推凳",
    aliases: ["卧推凳", "训练凳", "bench"],
    features: ["承重", "角度调节", "折叠收纳"],
  },
  {
    canonical: "跑步机",
    aliases: ["跑步机", "treadmill"],
    features: ["减震", "跑带宽度", "噪音"],
  },
  {
    canonical: "划船机",
    aliases: ["划船机", "rower", "rowing machine"],
    features: ["阻力类型", "轨道顺滑", "占地收纳"],
  },
  {
    canonical: "筋膜枪",
    aliases: ["筋膜枪", "massage gun"],
    features: ["震幅", "续航", "档位"],
  },
  {
    canonical: "护腕",
    aliases: ["护腕", "wrist wrap"],
    features: ["支撑强度", "透气", "长度"],
  },
  {
    canonical: "护膝",
    aliases: ["护膝", "knee sleeve"],
    features: ["包裹支撑", "弹性", "尺码"],
  },
];

const CN_MOBILE_GENERIC_EQUIPMENT_TERMS = [
  "健身器材",
  "器材",
  "装备",
  "运动装备",
  "家用",
  "居家",
  "家庭",
  "必备",
  "入门",
  "基础",
  "新手",
  "全身",
  "综合",
  "通用",
  "套装",
  "清单",
  "推荐",
  "评测",
  "选购",
  "怎么买",
  "怎么选",
  "使用教程",
  "动作要点",
  "健身",
  "训练",
  "essential",
  "essentials",
  "equipment",
  "gear",
  "home gym",
  "budget",
];

function normalizeEquipmentText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findEquipmentBlueprint(values: Array<string | undefined | null>): EquipmentBlueprint | null {
  const haystack = values
    .map((value) => normalizeEquipmentText(String(value || "")))
    .filter(Boolean)
    .join(" ");

  if (!haystack) return null;

  for (const blueprint of CN_MOBILE_EQUIPMENT_BLUEPRINTS) {
    if (blueprint.aliases.some((alias) => haystack.includes(normalizeEquipmentText(alias)))) {
      return blueprint;
    }
  }

  return null;
}

function isGenericEquipmentKeyword(value: string): boolean {
  const normalized = normalizeEquipmentText(value).replace(/\s+/g, "");
  if (!normalized) return true;
  return CN_MOBILE_GENERIC_EQUIPMENT_TERMS.some((term) => normalized.includes(normalizeEquipmentText(term).replace(/\s+/g, "")));
}

function pickSpecificEquipmentFallback(values: Array<string | undefined | null>): EquipmentBlueprint {
  const haystack = values
    .map((value) => normalizeEquipmentText(String(value || "")))
    .filter(Boolean)
    .join(" ");

  if (/(拉伸|瑜伽|普拉提|flexibility|mobility)/.test(haystack)) {
    return CN_MOBILE_EQUIPMENT_BLUEPRINTS.find((item) => item.canonical === "瑜伽垫")!;
  }

  if (/(恢复|放松|筋膜|recovery|massage)/.test(haystack)) {
    return CN_MOBILE_EQUIPMENT_BLUEPRINTS.find((item) => item.canonical === "泡沫轴")!;
  }

  if (/(腹|核心|core|ab)/.test(haystack)) {
    return CN_MOBILE_EQUIPMENT_BLUEPRINTS.find((item) => item.canonical === "健腹轮")!;
  }

  if (/(燃脂|有氧|cardio|跳跃|jump)/.test(haystack)) {
    return CN_MOBILE_EQUIPMENT_BLUEPRINTS.find((item) => item.canonical === "跳绳")!;
  }

  if (/(居家|家用|家庭|home)/.test(haystack)) {
    return CN_MOBILE_EQUIPMENT_BLUEPRINTS.find((item) => item.canonical === "可调节哑铃")!;
  }

  return CN_MOBILE_EQUIPMENT_BLUEPRINTS.find((item) => item.canonical === "哑铃")!;
}

function extractFitnessEquipmentBlueprint(params: {
  title?: string;
  description?: string;
  searchQuery?: string;
  tags?: string[] | null;
}): EquipmentBlueprint {
  const { title, description, searchQuery, tags } = params;
  const values = [...(Array.isArray(tags) ? tags : []), title, description, searchQuery];
  const exactBlueprint = findEquipmentBlueprint(values);
  if (exactBlueprint) {
    return exactBlueprint;
  }

  const genericPattern =
    /(健身器材|器材|健身|训练|教程|使用教程|动作要点|常见错误|跟练|视频|课程|推荐|选购|购买|京东|附近|健身房|步行|地铁|商圈|入门|新手|全身|居家)/g;

  for (const value of values) {
    const candidate = String(value || "")
      .replace(/[^\w\u4e00-\u9fa5]+/g, " ")
      .replace(genericPattern, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (candidate && candidate.length <= 8 && !isGenericEquipmentKeyword(candidate)) {
      return {
        canonical: candidate,
        aliases: [candidate],
        features: ["规格参数", "收纳", "适用动作"],
      };
    }

    const firstToken = candidate.split(/\s+/).find(Boolean);
    if (firstToken && !isGenericEquipmentKeyword(firstToken)) {
      return {
        canonical: firstToken.slice(0, 8),
        aliases: [firstToken.slice(0, 8)],
        features: ["规格参数", "收纳", "适用动作"],
      };
    }
  }

  return pickSpecificEquipmentFallback(values);
}

export function normalizeCnMobileFitnessRecommendation(params: {
  title?: string;
  description?: string;
  reason?: string;
  searchQuery?: string;
  tags?: string[] | null;
  platform: string;
  client: "app" | "web";
  isMobile?: boolean;
  locale: "zh" | "en";
  index: number;
  fitnessType?: string;
}): {
  title?: string;
  description?: string;
  reason?: string;
  searchQuery?: string;
  tags?: string[];
  platform: string;
} {
  const { title, description, reason, searchQuery, tags, platform, client, isMobile, locale, index, fitnessType } = params;

  if (!isCnMobileAppScenario({ locale, isMobile, client })) {
    return {
      title,
      description,
      reason,
      searchQuery,
      tags: Array.isArray(tags) ? tags : undefined,
      platform,
    };
  }

  const normalizedPlatform = normalizeCnMobileCategoryPlatform({
    category: "fitness",
    platform,
    client,
    isMobile,
    locale,
    index,
    fitnessType,
  });

  if (fitnessType === "equipment") {
    const blueprint = extractFitnessEquipmentBlueprint({ title, description, searchQuery, tags });
    const keyword = blueprint.canonical;
    const featureText = blueprint.features.join("、");
    return {
      title: `${keyword}推荐`,
      description: `重点看${keyword}的${featureText}，避免只给“必备器材”这类泛推荐，更适合直接筛选具体商品。`,
      reason: "将健身器材结果对齐到京东选购场景，避免内容与平台错位。",
      searchQuery: `${keyword} 推荐 ${blueprint.features.slice(0, 2).join(" ")} 京东`,
      tags: Array.from(new Set([keyword, ...blueprint.features.slice(0, 2), "京东"])),
      platform: normalizedPlatform,
    };
  }

  if (fitnessType === "tutorial") {
    return {
      title,
      description,
      reason,
      searchQuery: ensureContainsAny(String(searchQuery || title || ""), ["视频", "跟练", "教程"], "健身视频 跟练"),
      tags: Array.isArray(tags) ? tags : undefined,
      platform: normalizedPlatform,
    };
  }

  if (fitnessType === "nearby_place") {
    return {
      title,
      description,
      reason,
      searchQuery: ensureContainsAny(String(searchQuery || title || ""), ["健身房", "场馆", "附近"], "附近 健身房"),
      tags: Array.isArray(tags) ? tags : undefined,
      platform: normalizedPlatform,
    };
  }

  return {
    title,
    description,
    reason,
    searchQuery,
    tags: Array.isArray(tags) ? tags : undefined,
    platform: normalizedPlatform,
  };
}
