/**
 * 降级推荐数据
 * 当 AI API 不可用时使用的静态推荐数据
 */

import type { AIRecommendation } from "@/lib/types/recommendation";

/**
 * 娱乐分类降级数据
 */
export const entertainmentFallback: AIRecommendation[] = [
  // 中国区
  {
    title: "三体",
    description: "刘慈欣经典科幻小说，探索宇宙文明的宏大史诗，获得雨果奖",
    category: "entertainment",
    link: "https://book.douban.com/subject/2567698/",
    linkType: "book",
    metadata: { rating: 9.4, author: "刘慈欣", tags: ["科幻", "宇宙"] },
    reason: "豆瓣高分科幻巨作，适合喜欢深度思考的读者",
  },
  {
    title: "原神",
    description: "开放世界冒险游戏，探索提瓦特大陆的奇幻世界",
    category: "entertainment",
    link: "https://ys.mihoyo.com/",
    linkType: "game",
    metadata: { rating: 4.8, platform: "PC/Mobile/PS5", tags: ["开放世界", "RPG"] },
    reason: "全球热门开放世界游戏，画面精美剧情丰富",
  },
  {
    title: "流浪地球2",
    description: "中国科幻电影巅峰之作，人类带着地球逃离太阳系的壮举",
    category: "entertainment",
    link: "https://movie.douban.com/subject/35267208/",
    linkType: "movie",
    metadata: { rating: 8.3, duration: "173分钟", tags: ["科幻", "灾难"] },
    reason: "国产科幻里程碑，视觉效果震撼",
  },
  {
    title: "周杰伦精选歌单",
    description: "华语乐坛天王周杰伦的经典歌曲合集",
    category: "entertainment",
    link: "https://music.163.com/#/artist?id=6452",
    linkType: "music",
    metadata: { tags: ["华语", "流行", "R&B"] },
    reason: "经典永流传，适合各种心情聆听",
  },
];

/**
 * 娱乐分类国际版降级数据
 */
export const entertainmentFallbackIntl: AIRecommendation[] = [
  {
    title: "Elden Ring",
    description: "From Software's masterpiece open-world action RPG with stunning landscapes and challenging gameplay",
    category: "entertainment",
    link: "https://store.steampowered.com/app/1245620/ELDEN_RING/",
    linkType: "game",
    metadata: { rating: 9.5, platform: "PC/PS5/Xbox", tags: ["Action", "RPG", "Open World"] },
    reason: "Game of the Year 2022, perfect for adventure seekers",
  },
  {
    title: "Oppenheimer",
    description: "Christopher Nolan's biographical thriller about the father of the atomic bomb",
    category: "entertainment",
    link: "https://www.imdb.com/title/tt15398776/",
    linkType: "movie",
    metadata: { rating: 8.5, duration: "180 min", tags: ["Biography", "Drama", "History"] },
    reason: "Oscar-winning masterpiece with stunning cinematography",
  },
  {
    title: "The Three-Body Problem",
    description: "Award-winning sci-fi novel exploring first contact with alien civilization",
    category: "entertainment",
    link: "https://www.amazon.com/dp/0765382032",
    linkType: "book",
    metadata: { rating: 4.3, author: "Liu Cixin", tags: ["Sci-Fi", "Space"] },
    reason: "Hugo Award winner, mind-bending science fiction",
  },
  {
    title: "Taylor Swift Top Hits",
    description: "Stream the best songs from one of the world's most popular artists",
    category: "entertainment",
    link: "https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02",
    linkType: "music",
    metadata: { tags: ["Pop", "Country", "Indie"] },
    reason: "Chart-topping hits perfect for any mood",
  },
];

/**
 * 购物分类降级数据
 */
export const shoppingFallback: AIRecommendation[] = [
  {
    title: "AirPods Pro (第2代)",
    description: "苹果主动降噪无线耳机，音质出色，续航持久",
    category: "shopping",
    link: "https://www.apple.com.cn/shop/product/MQD83CH/A",
    linkType: "product",
    metadata: { price: "¥1,899", rating: 4.8, tags: ["数码", "耳机"] },
    reason: "降噪效果一流，苹果生态无缝衔接",
  },
  {
    title: "优衣库基础款T恤",
    description: "简约百搭的纯棉T恤，舒适透气，多色可选",
    category: "shopping",
    link: "https://www.uniqlo.cn/",
    linkType: "product",
    metadata: { price: "¥79", tags: ["服装", "基础款"] },
    reason: "高性价比基础单品，衣橱必备",
  },
  {
    title: "宜家LACK 拉克边桌",
    description: "简约实用的小边桌，多场景适用",
    category: "shopping",
    link: "https://www.ikea.cn/cn/zh/p/lack-la-ke-bian-zhuo-bai-se-30449908/",
    linkType: "product",
    metadata: { price: "¥49.99", tags: ["家居", "家具"] },
    reason: "北欧简约风，小空间收纳神器",
  },
];

/**
 * 购物分类国际版降级数据
 */
export const shoppingFallbackIntl: AIRecommendation[] = [
  {
    title: "AirPods Pro (2nd Gen)",
    description: "Apple's premium wireless earbuds with active noise cancellation",
    category: "shopping",
    link: "https://www.apple.com/shop/product/MQD83AM/A",
    linkType: "product",
    metadata: { price: "$249", rating: 4.8, tags: ["Electronics", "Audio"] },
    reason: "Industry-leading noise cancellation and seamless Apple integration",
  },
  {
    title: "UNIQLO AIRism T-Shirt",
    description: "Ultra-comfortable, quick-drying basic tee perfect for everyday wear",
    category: "shopping",
    link: "https://www.uniqlo.com/us/en/products/E448941-000/00",
    linkType: "product",
    metadata: { price: "$14.90", tags: ["Clothing", "Basics"] },
    reason: "Essential wardrobe staple with excellent value",
  },
  {
    title: "IKEA KALLAX Shelf Unit",
    description: "Versatile storage solution that works as room divider or bookshelf",
    category: "shopping",
    link: "https://www.ikea.com/us/en/p/kallax-shelf-unit-white-80275887/",
    linkType: "product",
    metadata: { price: "$69.99", tags: ["Home", "Storage"] },
    reason: "Popular modular storage, endless configuration options",
  },
];

/**
 * 美食分类降级数据
 */
export const foodFallback: AIRecommendation[] = [
  {
    title: "海底捞火锅",
    description: "知名连锁火锅品牌，服务一流，食材新鲜，适合聚餐",
    category: "food",
    link: "https://www.dianping.com/search/keyword/1/0_%E6%B5%B7%E5%BA%95%E6%8D%9E",
    linkType: "restaurant",
    metadata: { price: "人均¥120", rating: 4.5, calories: 650, tags: ["火锅", "川菜"] },
    reason: "服务贴心，适合朋友聚会",
  },
  {
    title: "糖醋里脊做法",
    description: "经典家常菜，酸甜可口，做法简单易学",
    category: "food",
    link: "https://www.xiachufang.com/recipe/104065863/",
    linkType: "recipe",
    metadata: { duration: "30分钟", calories: 420, tags: ["家常菜", "中餐"] },
    reason: "新手友好的经典菜谱，成功率高",
  },
  {
    title: "喜茶奶茶",
    description: "网红奶茶品牌，多种口味选择，芝芝葡萄超人气",
    category: "food",
    link: "https://www.dianping.com/search/keyword/1/0_%E5%96%9C%E8%8C%B6",
    linkType: "restaurant",
    metadata: { price: "人均¥30", rating: 4.3, tags: ["奶茶", "饮品"] },
    reason: "下午茶首选，口感清新",
  },
];

/**
 * 美食分类国际版降级数据
 */
export const foodFallbackIntl: AIRecommendation[] = [
  {
    title: "Find Local Restaurants",
    description: "Discover highly-rated restaurants near you with reviews and photos",
    category: "food",
    link: "https://www.yelp.com/",
    linkType: "restaurant",
    metadata: { tags: ["Dining", "Reviews"] },
    reason: "Trusted restaurant reviews from millions of diners",
  },
  {
    title: "Easy Pasta Recipes",
    description: "Quick and delicious pasta recipes perfect for weeknight dinners",
    category: "food",
    link: "https://www.allrecipes.com/recipes/17562/main-dish/pasta/",
    linkType: "recipe",
    metadata: { duration: "30 min", tags: ["Italian", "Easy"] },
    reason: "Simple recipes with ingredients you probably have",
  },
  {
    title: "Book a Table - OpenTable",
    description: "Reserve tables at top restaurants with instant confirmation",
    category: "food",
    link: "https://www.opentable.com/",
    linkType: "restaurant",
    metadata: { tags: ["Reservations", "Fine Dining"] },
    reason: "Easy online reservations at thousands of restaurants",
  },
];

/**
 * 旅行分类降级数据
 */
export const travelFallback: AIRecommendation[] = [
  {
    title: "故宫博物院",
    description: "中国古代皇家宫殿，世界文���遗产，建筑宏伟精美",
    category: "travel",
    link: "https://www.dpm.org.cn/",
    linkType: "location",
    metadata: { price: "¥60", duration: "半天", address: "北京市东城区", tags: ["历史", "文化"] },
    reason: "必去的中国历史文化地标",
  },
  {
    title: "西湖风景区",
    description: "杭州标志性景点，湖光山色如画，四季皆美",
    category: "travel",
    link: "https://www.westlake.gov.cn/",
    linkType: "location",
    metadata: { price: "免费", duration: "2-3小时", address: "杭州市西湖区", tags: ["自然", "休闲"] },
    reason: "放松身心的绝佳去处",
  },
  {
    title: "携程酒店预订",
    description: "全国酒店在线预订，价格透明，选择丰富",
    category: "travel",
    link: "https://hotels.ctrip.com/",
    linkType: "hotel",
    metadata: { tags: ["酒店", "预订"] },
    reason: "一站式出行住宿解决方案",
  },
];

/**
 * 旅行分类国际版降级数据
 */
export const travelFallbackIntl: AIRecommendation[] = [
  {
    title: "TripAdvisor Travel Guide",
    description: "Discover top attractions and things to do at any destination",
    category: "travel",
    link: "https://www.tripadvisor.com/Attractions",
    linkType: "location",
    metadata: { tags: ["Attractions", "Reviews"] },
    reason: "Millions of traveler reviews to help you plan",
  },
  {
    title: "Book Hotels on Booking.com",
    description: "Compare prices and book accommodations worldwide",
    category: "travel",
    link: "https://www.booking.com/",
    linkType: "hotel",
    metadata: { tags: ["Hotels", "Booking"] },
    reason: "Free cancellation on most rooms, best price guarantee",
  },
  {
    title: "Unique Stays on Airbnb",
    description: "Find unique homes and experiences around the world",
    category: "travel",
    link: "https://www.airbnb.com/",
    linkType: "hotel",
    metadata: { tags: ["Vacation Rentals", "Experiences"] },
    reason: "Live like a local with unique accommodations",
  },
];

/**
 * 健身分类降级数据
 */
export const fitnessFallback: AIRecommendation[] = [
  {
    title: "Keep健身课程",
    description: "专业健身APP，海量免费课程，适合各种健身水平",
    category: "fitness",
    link: "https://www.gotokeep.com/",
    linkType: "app",
    metadata: { duration: "15-45分钟", calories: 200, tags: ["APP", "在家健身"] },
    reason: "随时随地开始健身，新手友好",
  },
  {
    title: "HIIT高强度间歇训练",
    description: "B站热门健身视频，高效燃脂，适合忙碌人群",
    category: "fitness",
    link: "https://search.bilibili.com/all?keyword=HIIT%E5%81%A5%E8%BA%AB",
    linkType: "video",
    metadata: { duration: "20分钟", calories: 300, tags: ["HIIT", "燃脂"] },
    reason: "短时间高效燃脂，适合时间有限的人",
  },
  {
    title: "瑜伽入门教程",
    description: "适合初学者的瑜伽课程，放松身心，提升柔韧性",
    category: "fitness",
    link: "https://search.bilibili.com/all?keyword=%E7%91%9C%E4%BC%BD%E5%85%A5%E9%97%A8",
    linkType: "video",
    metadata: { duration: "30分钟", calories: 150, tags: ["瑜伽", "放松"] },
    reason: "缓解压力，改善体态",
  },
];

/**
 * 健身分类国际版降级数据
 */
export const fitnessFallbackIntl: AIRecommendation[] = [
  {
    title: "Nike Training Club",
    description: "Free workout app with 185+ free workouts from world-class trainers",
    category: "fitness",
    link: "https://www.nike.com/ntc-app",
    linkType: "app",
    metadata: { duration: "15-60 min", tags: ["App", "Free"] },
    reason: "Professional workouts for all fitness levels",
  },
  {
    title: "YouTube Workout Videos",
    description: "Millions of free workout videos from top fitness creators",
    category: "fitness",
    link: "https://www.youtube.com/results?search_query=home+workout",
    linkType: "video",
    metadata: { duration: "Various", tags: ["Free", "Video"] },
    reason: "Endless variety of free workout content",
  },
  {
    title: "Find Gyms Near You",
    description: "Search for gyms and fitness centers in your area",
    category: "fitness",
    link: "https://www.google.com/maps/search/gyms/",
    linkType: "location",
    metadata: { tags: ["Gym", "Local"] },
    reason: "Find the perfect gym for your fitness goals",
  },
];

/**
 * 获取降级推荐数据
 */
export function getFallbackRecommendations(
  category: string,
  locale: "zh" | "en" = "zh",
  count: number = 3
): AIRecommendation[] {
  const isIntl = locale === "en";

  const fallbackMap: Record<string, AIRecommendation[]> = {
    entertainment: isIntl ? entertainmentFallbackIntl : entertainmentFallback,
    shopping: isIntl ? shoppingFallbackIntl : shoppingFallback,
    food: isIntl ? foodFallbackIntl : foodFallback,
    travel: isIntl ? travelFallbackIntl : travelFallback,
    fitness: isIntl ? fitnessFallbackIntl : fitnessFallback,
  };

  const recommendations = fallbackMap[category] || entertainmentFallback;

  // 随机打乱并返回指定数量
  const shuffled = [...recommendations].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
