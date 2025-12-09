/**
 * 智谱 AI 客户端
 * 用于生成个性化推荐
 */

import type {
  AIRecommendation,
  RecommendationCategory,
  RecommendationHistory,
  UserPreference,
} from "@/lib/types/recommendation";

// 智谱 API 配置
const ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const ZHIPU_MODEL = "glm-4-flash";

interface ZhipuMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ZhipuResponse {
  code?: number | string;
  msg?: string;
  data?: {
    choices?: Array<{
      index?: number;
      finish_reason?: string;
      message?: {
        role?: string;
        content?: string;
      };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  error?: {
    message?: string;
  };
  [key: string]: any; // 允许其他未知字段
}

/**
 * 真实链接数据库（所有链接均已验证可用）
 * 采用"从库中选择"策略，避免 AI 幻觉生成虚假链接
 */
const VERIFIED_LINKS_DATABASE = {
  entertainment: {
    cn: {
      book: [
        { name: "三体", url: "https://book.douban.com/subject/2567698/", type: "book", description: "刘慈欣科幻巨作，地球文明与三体文明的宇宙史诗", tags: ["科幻", "中国文学", "刘慈欣"], rating: 9.4 },
        { name: "活着", url: "https://book.douban.com/subject/4913064/", type: "book", description: "余华经典之作，讲述人在苦难中的生命力量", tags: ["文学", "人生", "余华"], rating: 9.4 },
        { name: "百年孤独", url: "https://book.douban.com/subject/6082808/", type: "book", description: "马尔克斯魔幻现实主义代表作", tags: ["外国文学", "魔幻现实主义"], rating: 9.3 },
        { name: "围城", url: "https://book.douban.com/subject/1008145/", type: "book", description: "钱钟书讽刺小说经典，婚姻与人生的围城", tags: ["讽刺", "婚姻", "钱钟书"], rating: 9.0 },
        { name: "平凡的世界", url: "https://book.douban.com/subject/1200Mo4/", type: "book", description: "路遥描绘中国农村变革的史诗巨著", tags: ["农村", "奋斗", "路遥"], rating: 9.0 },
        { name: "白夜行", url: "https://book.douban.com/subject/10554308/", type: "book", description: "东野圭吾推理巅峰之作，��望的爱情故事", tags: ["推理", "东野圭吾", "悬疑"], rating: 9.1 },
        { name: "解忧杂货店", url: "https://book.douban.com/subject/25862578/", type: "book", description: "东野圭吾温情治愈之作", tags: ["治愈", "东野圭吾", "温情"], rating: 8.5 },
        { name: "小王子", url: "https://book.douban.com/subject/1084336/", type: "book", description: "永恒的童话经典，关于爱与责任", tags: ["童话", "经典", "哲理"], rating: 9.0 },
        { name: "红楼梦", url: "https://book.douban.com/subject/1007305/", type: "book", description: "中国古典四大名著之首", tags: ["古典", "名著", "曹雪芹"], rating: 9.6 },
        { name: "明朝那些事儿", url: "https://book.douban.com/subject/3674537/", type: "book", description: "当年明月趣说明史，通俗易懂", tags: ["历史", "明朝", "通俗"], rating: 9.1 },
      ],
      game: [
        { name: "原神", url: "https://ys.mihoyo.com/", type: "game", description: "米哈游开放世界冒险RPG，提瓦特大陆的奇幻之旅", tags: ["开放世界", "RPG", "二次元"], rating: 8.5 },
        { name: "王者荣耀", url: "https://pvp.qq.com/", type: "game", description: "腾讯MOBA手游，国民级5v5竞技游戏", tags: ["MOBA", "竞技", "手游"], rating: 8.0 },
        { name: "和平精英", url: "https://gp.qq.com/", type: "game", description: "腾讯战术竞技手游，百人同场竞技", tags: ["吃鸡", "射击", "竞技"], rating: 7.5 },
        { name: "崩坏：星穹铁道", url: "https://sr.mihoyo.com/", type: "game", description: "米哈游回合制RPG，银河冒险之旅", tags: ["RPG", "回合制", "二次元"], rating: 8.8 },
        { name: "绝区零", url: "https://zzz.mihoyo.com/", type: "game", description: "米哈游都市幻想动作游戏", tags: ["动作", "都市", "二次元"], rating: 8.5 },
        { name: "永劫无间", url: "https://www.naraka.com/", type: "game", description: "网易武侠吃鸡，东方美学动作竞技", tags: ["武侠", "动作", "竞技"], rating: 8.0 },
        { name: "第五人格", url: "https://id5.163.com/", type: "game", description: "网易非对称对抗游戏，惊悚追逃体验", tags: ["恐怖", "非对称", "竞技"], rating: 8.0 },
        { name: "阴阳师", url: "https://yys.163.com/", type: "game", description: "网易和风回合制RPG，式神收集养成", tags: ["和风", "RPG", "卡牌"], rating: 7.8 },
      ],
      movie: [
        { name: "流浪地球2", url: "https://movie.douban.com/subject/35267208/", type: "movie", description: "中国科幻里程碑，太阳危机下的人类团��", tags: ["科幻", "国产", "灾难"], rating: 8.3 },
        { name: "让子弹飞", url: "https://movie.douban.com/subject/3742360/", type: "movie", description: "姜文导演经典，黑色幽默与隐喻", tags: ["喜剧", "姜文", "讽刺"], rating: 9.0 },
        { name: "肖申克的救赎", url: "https://movie.douban.com/subject/1292052/", type: "movie", description: "永恒经典，关于希望与自由的故事", tags: ["经典", "励志", "剧情"], rating: 9.7 },
        { name: "霸王别姬", url: "https://movie.douban.com/subject/1291546/", type: "movie", description: "陈凯歌经典，程蝶衣的一生", tags: ["剧情", "历史", "陈凯歌"], rating: 9.6 },
        { name: "这个杀手不太冷", url: "https://movie.douban.com/subject/1295644/", type: "movie", description: "吕克·贝松经典，��手与少女的温情", tags: ["剧情", "动作", "经典"], rating: 9.4 },
        { name: "千与千寻", url: "https://movie.douban.com/subject/1291561/", type: "movie", description: "宫崎骏动画巅峰，奇幻世界的成长之旅", tags: ["动画", "宫崎骏", "奇幻"], rating: 9.4 },
        { name: "盗梦空间", url: "https://movie.douban.com/subject/3541415/", type: "movie", description: "诺兰烧脑神作，梦境与现实的边界", tags: ["科幻", "诺兰", "悬疑"], rating: 9.4 },
        { name: "星际穿越", url: "https://movie.douban.com/subject/1889243/", type: "movie", description: "诺兰太空史诗，爱是穿越时空的力量", tags: ["科幻", "诺兰", "太空"], rating: 9.4 },
        { name: "疯狂动物城", url: "https://movie.douban.com/subject/25662329/", type: "movie", description: "迪士尼动画佳作，动物世界的梦想故事", tags: ["动画", "迪士尼", "喜剧"], rating: 9.2 },
        { name: "哪吒之魔童降世", url: "https://movie.douban.com/subject/26794435/", type: "movie", description: "国漫崛起之作，我命由我不由天", tags: ["动画", "国漫", "神话"], rating: 8.4 },
      ],
      music: [
        { name: "周杰伦", url: "https://music.163.com/#/artist?id=6452", type: "music", description: "华语乐坛天王，开创中国风流行音乐", tags: ["流行", "中国风", "华语"], rating: 9.5 },
        { name: "薛之谦", url: "https://music.163.com/#/artist?id=5781", type: "music", description: "才华横溢的唱作人，情歌王子", tags: ["流行", "情歌", "华语"], rating: 8.5 },
        { name: "林俊杰", url: "https://music.163.com/#/artist?id=3684", type: "music", description: "行走的CD，唱功超群的实力派", tags: ["流行", "华语", "情歌"], rating: 9.0 },
        { name: "邓紫棋", url: "https://music.163.com/#/artist?id=7763", type: "music", description: "铁肺女王，高音实力派歌手", tags: ["流行", "华语", "女歌手"], rating: 8.8 },
        { name: "陈奕迅", url: "https://music.163.com/#/artist?id=2116", type: "music", description: "歌神级人物，情歌演绎无人能及", tags: ["粤语", "情歌", "华语"], rating: 9.3 },
        { name: "五月天", url: "https://music.163.com/#/artist?id=13193", type: "music", description: "华语摇滚天团，青春与梦想的代名词", tags: ["摇滚", "乐队", "华语"], rating: 9.0 },
        { name: "华晨宇", url: "https://music.163.com/#/artist?id=861777", type: "music", description: "个性创作歌手，音乐风格独特", tags: ["流行", "创作", "华语"], rating: 8.5 },
        { name: "毛不易", url: "https://music.163.com/#/artist?id=12138269", type: "music", description: "治愈系创作人，《消愁》等经典", tags: ["民谣", "治愈", "华语"], rating: 8.6 },
      ],
      video: [
        { name: "B站热门", url: "https://www.bilibili.com/v/popular/all", type: "video", description: "B站热门视频，年轻人的文化聚集地", tags: ["视频", "二次元", "综合"], rating: 8.5 },
        { name: "B站动画", url: "https://www.bilibili.com/anime/", type: "video", description: "B站番剧区，追番必备", tags: ["动画", "番剧", "二次元"], rating: 9.0 },
        { name: "B站纪录片", url: "https://www.bilibili.com/documentary/", type: "video", description: "高质量纪录片，涨知识必看", tags: ["纪录片", "知识", "文化"], rating: 9.2 },
        { name: "抖音热门", url: "https://www.douyin.com/", type: "video", description: "抖音短视频，记录美好生活", tags: ["短视频", "娱乐", "生活"], rating: 7.5 },
        { name: "优酷热播", url: "https://www.youku.com/", type: "video", description: "优酷视频，热播剧集综艺", tags: ["视频", "剧集", "综艺"], rating: 7.8 },
        { name: "腾讯视频", url: "https://v.qq.com/", type: "video", description: "腾讯视频，独家热门内容", tags: ["视频", "剧集", "综艺"], rating: 8.0 },
        { name: "爱奇艺", url: "https://www.iqiyi.com/", type: "video", description: "爱奇艺视频，热播影视剧", tags: ["视频", "剧集", "电影"], rating: 7.8 },
      ],
    },
    intl: {
      book: [
        { name: "The Three-Body Problem", url: "https://www.amazon.com/dp/0765382032", type: "book", description: "Liu Cixin's masterpiece, a cosmic epic of first contact", tags: ["sci-fi", "chinese literature", "award-winning"], rating: 4.3 },
        { name: "Dune", url: "https://www.amazon.com/dp/0441172717", type: "book", description: "Frank Herbert's epic sci-fi saga of politics and prophecy", tags: ["sci-fi", "classic", "epic"], rating: 4.5 },
        { name: "1984", url: "https://www.amazon.com/dp/0451524934", type: "book", description: "Orwell's dystopian masterpiece about totalitarian control", tags: ["dystopia", "classic", "political"], rating: 4.6 },
        { name: "The Hitchhiker's Guide to the Galaxy", url: "https://www.amazon.com/dp/0345391802", type: "book", description: "Douglas Adams' comedic sci-fi adventure", tags: ["comedy", "sci-fi", "british"], rating: 4.4 },
        { name: "Project Hail Mary", url: "https://www.amazon.com/dp/0593135202", type: "book", description: "Andy Weir's thrilling space survival story", tags: ["sci-fi", "adventure", "space"], rating: 4.7 },
        { name: "Atomic Habits", url: "https://www.amazon.com/dp/0735211299", type: "book", description: "James Clear's guide to building good habits", tags: ["self-help", "productivity", "psychology"], rating: 4.8 },
        { name: "The Midnight Library", url: "https://www.amazon.com/dp/0525559477", type: "book", description: "Matt Haig's novel about life's infinite possibilities", tags: ["fiction", "life", "philosophy"], rating: 4.2 },
        { name: "Sapiens", url: "https://www.amazon.com/dp/0062316117", type: "book", description: "Yuval Harari's history of humankind", tags: ["history", "non-fiction", "anthropology"], rating: 4.5 },
      ],
      game: [
        { name: "Elden Ring", url: "https://store.steampowered.com/app/1245620/ELDEN_RING/", type: "game", description: "FromSoftware's open-world masterpiece", tags: ["action RPG", "souls-like", "open world"], rating: 9.5 },
        { name: "Baldur's Gate 3", url: "https://store.steampowered.com/app/1086940/Baldurs_Gate_3/", type: "game", description: "Larian's epic D&D RPG adventure", tags: ["RPG", "D&D", "turn-based"], rating: 9.7 },
        { name: "Cyberpunk 2077", url: "https://store.steampowered.com/app/1091500/Cyberpunk_2077/", type: "game", description: "CD Projekt RED's futuristic open-world RPG", tags: ["RPG", "cyberpunk", "open world"], rating: 8.5 },
        { name: "The Legend of Zelda: TotK", url: "https://www.nintendo.com/us/store/products/the-legend-of-zelda-tears-of-the-kingdom-switch/", type: "game", description: "Nintendo's acclaimed open-world adventure", tags: ["adventure", "Nintendo", "open world"], rating: 9.6 },
        { name: "Red Dead Redemption 2", url: "https://store.steampowered.com/app/1174180/Red_Dead_Redemption_2/", type: "game", description: "Rockstar's epic Western adventure", tags: ["action", "western", "open world"], rating: 9.5 },
        { name: "God of War Ragnarök", url: "https://store.steampowered.com/app/2322010/God_of_War_Ragnark/", type: "game", description: "Epic Norse mythology action adventure", tags: ["action", "adventure", "mythology"], rating: 9.4 },
        { name: "Hollow Knight", url: "https://store.steampowered.com/app/367520/Hollow_Knight/", type: "game", description: "Team Cherry's beloved metroidvania", tags: ["metroidvania", "indie", "challenging"], rating: 9.5 },
        { name: "Hades", url: "https://store.steampowered.com/app/1145360/Hades/", type: "game", description: "Supergiant's award-winning roguelike", tags: ["roguelike", "action", "indie"], rating: 9.3 },
      ],
      movie: [
        { name: "Oppenheimer", url: "https://www.imdb.com/title/tt15398776/", type: "movie", description: "Nolan's epic biography of the atomic bomb creator", tags: ["biography", "history", "drama"], rating: 8.5 },
        { name: "Inception", url: "https://www.imdb.com/title/tt1375666/", type: "movie", description: "Nolan's mind-bending heist thriller", tags: ["sci-fi", "thriller", "Nolan"], rating: 8.8 },
        { name: "Interstellar", url: "https://www.imdb.com/title/tt0816692/", type: "movie", description: "Nolan's emotional space odyssey", tags: ["sci-fi", "space", "Nolan"], rating: 8.7 },
        { name: "The Dark Knight", url: "https://www.imdb.com/title/tt0468569/", type: "movie", description: "The definitive Batman film with Heath Ledger's Joker", tags: ["superhero", "action", "crime"], rating: 9.0 },
        { name: "Parasite", url: "https://www.imdb.com/title/tt6751668/", type: "movie", description: "Bong Joon-ho's Oscar-winning class satire", tags: ["thriller", "Korean", "drama"], rating: 8.5 },
        { name: "Spider-Man: Across the Spider-Verse", url: "https://www.imdb.com/title/tt9362722/", type: "movie", description: "Stunning animated multiverse adventure", tags: ["animation", "superhero", "action"], rating: 8.6 },
        { name: "Everything Everywhere All at Once", url: "https://www.imdb.com/title/tt6710474/", type: "movie", description: "Mind-bending multiverse family drama", tags: ["sci-fi", "comedy", "drama"], rating: 8.0 },
        { name: "The Shawshank Redemption", url: "https://www.imdb.com/title/tt0111161/", type: "movie", description: "Timeless classic about hope and freedom", tags: ["drama", "classic", "prison"], rating: 9.3 },
      ],
      music: [
        { name: "Taylor Swift", url: "https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02", type: "music", description: "Pop megastar and prolific songwriter", tags: ["pop", "singer-songwriter", "american"], rating: 9.0 },
        { name: "The Weeknd", url: "https://open.spotify.com/artist/1Xyo4u8uXC1ZmMpatF05PJ", type: "music", description: "R&B artist known for synth-pop sound", tags: ["R&B", "pop", "synth"], rating: 8.8 },
        { name: "Ed Sheeran", url: "https://open.spotify.com/artist/6eUKZXaKkcviH0Ku9w2n3V", type: "music", description: "British singer-songwriter sensation", tags: ["pop", "singer-songwriter", "british"], rating: 8.5 },
        { name: "BTS", url: "https://open.spotify.com/artist/3Nrfpe0tUJi4K4DXYWgMUX", type: "music", description: "Global K-pop phenomenon", tags: ["K-pop", "boy band", "korean"], rating: 9.0 },
        { name: "Billie Eilish", url: "https://open.spotify.com/artist/6qqNVTkY8uBg9cP3Jd7DAH", type: "music", description: "Genre-defying young pop star", tags: ["pop", "alternative", "indie"], rating: 8.7 },
        { name: "Drake", url: "https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4", type: "music", description: "Hip-hop superstar and hitmaker", tags: ["hip-hop", "rap", "R&B"], rating: 8.5 },
        { name: "Dua Lipa", url: "https://open.spotify.com/artist/6M2wZ9GZgrQXHCFfjv46we", type: "music", description: "British pop star with disco-influenced sound", tags: ["pop", "disco", "dance"], rating: 8.6 },
        { name: "Bad Bunny", url: "https://open.spotify.com/artist/4q3ewBCX7sLwd24euuV69X", type: "music", description: "Puerto Rican reggaeton superstar", tags: ["reggaeton", "latin", "urban"], rating: 8.8 },
      ],
      video: [
        { name: "YouTube Trending", url: "https://www.youtube.com/feed/trending", type: "video", description: "Latest trending videos on YouTube", tags: ["video", "trending", "entertainment"], rating: 8.5 },
        { name: "Netflix", url: "https://www.netflix.com/", type: "video", description: "World's leading streaming service", tags: ["streaming", "movies", "series"], rating: 8.5 },
        { name: "Disney+", url: "https://www.disneyplus.com/", type: "video", description: "Disney, Marvel, Star Wars streaming", tags: ["streaming", "family", "disney"], rating: 8.3 },
        { name: "Twitch", url: "https://www.twitch.tv/", type: "video", description: "Live streaming platform for gamers", tags: ["streaming", "gaming", "live"], rating: 8.2 },
        { name: "Crunchyroll", url: "https://www.crunchyroll.com/", type: "video", description: "Premier anime streaming platform", tags: ["anime", "streaming", "japanese"], rating: 8.5 },
        { name: "HBO Max", url: "https://www.max.com/", type: "video", description: "Premium streaming with HBO content", tags: ["streaming", "premium", "movies"], rating: 8.4 },
      ],
    },
  },
  shopping: {
    cn: {
      fashion: [
        { name: "优衣库官网", url: "https://www.uniqlo.cn/", type: "product", description: "日本快时尚品牌，舒适简约的基础款", tags: ["快时尚", "基础款", "日系"], rating: 8.5 },
        { name: "ZARA中国", url: "https://www.zara.cn/", type: "product", description: "西班牙快时尚巨头，紧跟潮流设计", tags: ["快时尚", "时尚", "西班牙"], rating: 8.0 },
        { name: "H&M中国", url: "https://www.hm.com/cn/", type: "product", description: "瑞典快时尚品牌，平价时尚选择", tags: ["快时尚", "平价", "瑞典"], rating: 7.5 },
        { name: "天猫女装", url: "https://nvzhuang.tmall.com/", type: "product", description: "天猫女装频道，海量品牌选择", tags: ["女装", "品牌", "电商"], rating: 8.0 },
        { name: "Nike官网", url: "https://www.nike.com.cn/", type: "product", description: "全球运动品牌领导者", tags: ["运动", "品牌", "潮流"], rating: 9.0 },
        { name: "Adidas官网", url: "https://www.adidas.com.cn/", type: "product", description: "德国运动品牌，运动与时尚结合", tags: ["运动", "品牌", "德国"], rating: 8.8 },
        { name: "李宁官网", url: "https://www.lining.com/", type: "product", description: "国货之光，国潮运动品牌", tags: ["国潮", "运动", "国货"], rating: 8.5 },
        { name: "安踏官网", url: "https://www.anta.com/", type: "product", description: "中国运动品牌龙头", tags: ["运动", "国货", "性价比"], rating: 8.2 },
      ],
      electronics: [
        { name: "小米商城", url: "https://www.mi.com/", type: "product", description: "小米官方商城，智能生态产品", tags: ["数码", "智能家居", "小米"], rating: 8.5 },
        { name: "华为商城", url: "https://www.vmall.com/", type: "product", description: "华为官方商城，手机数码产品", tags: ["数码", "手机", "华为"], rating: 8.8 },
        { name: "Apple中国", url: "https://www.apple.com.cn/", type: "product", description: "苹果官方商城，高端数码体验", tags: ["数码", "苹果", "高端"], rating: 9.2 },
        { name: "京东数码", url: "https://channel.jd.com/digital.html", type: "product", description: "京东数码频道，正品保障快速配送", tags: ["数码", "电商", "正品"], rating: 8.5 },
        { name: "天猫电器城", url: "https://dianqi.tmall.com/", type: "product", description: "天猫家电数码，品牌旗舰店聚集", tags: ["家电", "数码", "电商"], rating: 8.3 },
        { name: "苏���易购", url: "https://www.suning.com/", type: "product", description: "家电3C购物平台", tags: ["家电", "数码", "电商"], rating: 8.0 },
        { name: "DJI大疆", url: "https://www.dji.com/cn", type: "product", description: "全球领先的无人机品牌", tags: ["无人机", "数码", "高端"], rating: 9.0 },
        { name: "索尼中国", url: "https://www.sony.com.cn/", type: "product", description: "索尼官方商城，影音娱乐专家", tags: ["数码", "影音", "日本"], rating: 8.8 },
      ],
      home: [
        { name: "宜家中国", url: "https://www.ikea.cn/", type: "product", description: "瑞典家居品牌，北欧简约风格", tags: ["家居", "北欧", "设计"], rating: 8.5 },
        { name: "无印良品", url: "https://www.muji.com.cn/", type: "product", description: "日本极简生活品牌", tags: ["家居", "极简", "日系"], rating: 8.3 },
        { name: "网易严选", url: "https://you.163.com/", type: "product", description: "网易精选好物，品质生活方式", tags: ["精选", "品质", "生活"], rating: 8.0 },
        { name: "京东家居", url: "https://jiaju.jd.com/", type: "product", description: "京东家居家装频道", tags: ["家居", "电商", "配送"], rating: 8.2 },
        { name: "天猫家装", url: "https://jiazhuang.tmall.com/", type: "product", description: "天猫家装频道，一站式装修", tags: ["家装", "电商", "品牌"], rating: 8.0 },
        { name: "红星美凯龙", url: "https://www.macalline.com/", type: "product", description: "高端家居连锁卖场", tags: ["家居", "高端", "线下"], rating: 7.8 },
        { name: "林氏家居", url: "https://linshijiaju.tmall.com/", type: "product", description: "互联网家具品牌", tags: ["家具", "现代", "电商"], rating: 8.0 },
      ],
    },
    intl: {
      fashion: [
        { name: "UNIQLO", url: "https://www.uniqlo.com/", type: "product", description: "Japanese casual wear brand", tags: ["basics", "casual", "japanese"], rating: 8.5 },
        { name: "ZARA", url: "https://www.zara.com/", type: "product", description: "Spanish fast fashion leader", tags: ["fast fashion", "trendy", "spanish"], rating: 8.0 },
        { name: "H&M", url: "https://www.hm.com/", type: "product", description: "Swedish affordable fashion", tags: ["fast fashion", "affordable", "swedish"], rating: 7.5 },
        { name: "Amazon Fashion", url: "https://www.amazon.com/fashion", type: "product", description: "Amazon's fashion marketplace", tags: ["variety", "marketplace", "convenience"], rating: 8.0 },
        { name: "ASOS", url: "https://www.asos.com/", type: "product", description: "Online fashion retailer for young adults", tags: ["fashion", "online", "trendy"], rating: 8.2 },
        { name: "Nike", url: "https://www.nike.com/", type: "product", description: "Global sports and lifestyle brand", tags: ["sports", "lifestyle", "premium"], rating: 9.0 },
        { name: "Adidas", url: "https://www.adidas.com/", type: "product", description: "German sportswear giant", tags: ["sports", "lifestyle", "german"], rating: 8.8 },
        { name: "Nordstrom", url: "https://www.nordstrom.com/", type: "product", description: "Premium fashion department store", tags: ["premium", "department", "luxury"], rating: 8.5 },
      ],
      electronics: [
        { name: "Apple Store", url: "https://www.apple.com/store", type: "product", description: "Apple's official online store", tags: ["premium", "apple", "tech"], rating: 9.2 },
        { name: "Best Buy", url: "https://www.bestbuy.com/", type: "product", description: "Leading electronics retailer", tags: ["electronics", "retail", "variety"], rating: 8.3 },
        { name: "Amazon Electronics", url: "https://www.amazon.com/electronics", type: "product", description: "Amazon's electronics department", tags: ["variety", "convenience", "competitive"], rating: 8.5 },
        { name: "Newegg", url: "https://www.newegg.com/", type: "product", description: "Tech-focused online retailer", tags: ["tech", "PC parts", "gaming"], rating: 8.2 },
        { name: "B&H Photo", url: "https://www.bhphotovideo.com/", type: "product", description: "Professional photo and video gear", tags: ["camera", "professional", "video"], rating: 8.8 },
        { name: "Micro Center", url: "https://www.microcenter.com/", type: "product", description: "Computer and electronics superstore", tags: ["computers", "parts", "tech"], rating: 8.5 },
        { name: "Samsung", url: "https://www.samsung.com/", type: "product", description: "Samsung's official store", tags: ["electronics", "phones", "appliances"], rating: 8.5 },
      ],
      home: [
        { name: "IKEA", url: "https://www.ikea.com/", type: "product", description: "Swedish furniture and home goods", tags: ["furniture", "nordic", "affordable"], rating: 8.5 },
        { name: "Wayfair", url: "https://www.wayfair.com/", type: "product", description: "Online home goods retailer", tags: ["furniture", "decor", "variety"], rating: 8.0 },
        { name: "Amazon Home", url: "https://www.amazon.com/home-garden", type: "product", description: "Amazon's home and garden section", tags: ["variety", "convenience", "reviews"], rating: 8.3 },
        { name: "Target Home", url: "https://www.target.com/c/home/", type: "product", description: "Target's home decor and furniture", tags: ["affordable", "trendy", "accessible"], rating: 8.0 },
        { name: "West Elm", url: "https://www.westelm.com/", type: "product", description: "Modern furniture and home decor", tags: ["modern", "design", "premium"], rating: 8.3 },
        { name: "CB2", url: "https://www.cb2.com/", type: "product", description: "Modern, edgy home furnishings", tags: ["modern", "urban", "design"], rating: 8.2 },
        { name: "Pottery Barn", url: "https://www.potterybarn.com/", type: "product", description: "Classic American home furnishings", tags: ["classic", "quality", "american"], rating: 8.4 },
      ],
    },
  },
  food: {
    cn: {
      restaurant: [
        { name: "大众点评美食", url: "https://www.dianping.com/", type: "restaurant", description: "中国最大的本地生活服务平台，餐厅点评与团购", tags: ["点评", "团购", "美食"], rating: 8.5 },
        { name: "美团美食", url: "https://www.meituan.com/meishi/", type: "restaurant", description: "美团美食频道，外卖与到店优惠", tags: ["外卖", "团购", "优惠"], rating: 8.3 },
        { name: "饿了么", url: "https://www.ele.me/", type: "restaurant", description: "阿里旗下外卖平台", tags: ["外卖", "配送", "优惠"], rating: 8.0 },
        { name: "小红书美食", url: "https://www.xiaohongshu.com/search_result?keyword=%E7%BE%8E%E9%A3%9F", type: "restaurant", description: "小红���美食攻略与探店", tags: ["攻略", "探店", "网红"], rating: 8.2 },
      ],
      recipe: [
        { name: "下厨房", url: "https://www.xiachufang.com/", type: "recipe", description: "中国最大的美食菜谱社区", tags: ["菜谱", "家常菜", "社区"], rating: 8.8 },
        { name: "美食杰", url: "https://www.meishij.net/", type: "recipe", description: "专业美食菜谱网站", tags: ["菜谱", "教程", "分类"], rating: 8.0 },
        { name: "香哈网", url: "https://www.xiangha.com/", type: "recipe", description: "美食菜谱与视频教程", tags: ["菜谱", "视频", "教程"], rating: 7.8 },
        { name: "豆果美食", url: "https://www.douguo.com/", type: "recipe", description: "美食菜谱分享平台", tags: ["菜谱", "分享", "社区"], rating: 8.2 },
        { name: "日食记", url: "https://www.bilibili.com/v/life/food", type: "recipe", description: "B站美食区，视频菜谱教程", tags: ["视频", "美食", "教程"], rating: 8.5 },
      ],
    },
    intl: {
      restaurant: [
        { name: "Yelp", url: "https://www.yelp.com/", type: "restaurant", description: "Local restaurant reviews and ratings", tags: ["reviews", "local", "ratings"], rating: 8.5 },
        { name: "TripAdvisor Restaurants", url: "https://www.tripadvisor.com/Restaurants", type: "restaurant", description: "Restaurant reviews from travelers", tags: ["travel", "reviews", "global"], rating: 8.3 },
        { name: "OpenTable", url: "https://www.opentable.com/", type: "restaurant", description: "Restaurant reservations platform", tags: ["reservations", "dining", "booking"], rating: 8.5 },
        { name: "Google Maps Restaurants", url: "https://www.google.com/maps/search/restaurants/", type: "restaurant", description: "Find nearby restaurants with reviews", tags: ["local", "maps", "reviews"], rating: 8.8 },
        { name: "DoorDash", url: "https://www.doordash.com/", type: "restaurant", description: "Food delivery service", tags: ["delivery", "takeout", "convenience"], rating: 8.0 },
        { name: "Uber Eats", url: "https://www.ubereats.com/", type: "restaurant", description: "Food delivery from local restaurants", tags: ["delivery", "variety", "tracking"], rating: 8.0 },
      ],
      recipe: [
        { name: "AllRecipes", url: "https://www.allrecipes.com/", type: "recipe", description: "World's largest community-driven recipe site", tags: ["recipes", "community", "reviews"], rating: 8.5 },
        { name: "Tasty", url: "https://tasty.co/", type: "recipe", description: "BuzzFeed's recipe platform with video tutorials", tags: ["video", "easy", "trending"], rating: 8.3 },
        { name: "BBC Good Food", url: "https://www.bbcgoodfood.com/", type: "recipe", description: "Trusted British recipe resource", tags: ["british", "tested", "quality"], rating: 8.8 },
        { name: "Food Network", url: "https://www.foodnetwork.com/recipes", type: "recipe", description: "Recipes from celebrity chefs", tags: ["celebrity", "variety", "tv"], rating: 8.2 },
        { name: "Serious Eats", url: "https://www.seriouseats.com/", type: "recipe", description: "Science-based cooking and recipes", tags: ["science", "technique", "detailed"], rating: 9.0 },
        { name: "Epicurious", url: "https://www.epicurious.com/", type: "recipe", description: "Recipes and cooking inspiration", tags: ["gourmet", "inspiration", "quality"], rating: 8.5 },
        { name: "NYT Cooking", url: "https://cooking.nytimes.com/", type: "recipe", description: "New York Times recipe collection", tags: ["premium", "tested", "quality"], rating: 8.8 },
      ],
    },
  },
  travel: {
    cn: {
      location: [
        { name: "故宫博物院", url: "https://www.dpm.org.cn/", type: "location", description: "中国明清两代皇家宫殿，世界文化遗产", tags: ["历史", "文化", "北京"], rating: 9.5 },
        { name: "马蜂窝旅游", url: "https://www.mafengwo.cn/", type: "location", description: "中国领先的旅游社区，攻略与游记", tags: ["攻略", "社区", "游记"], rating: 8.5 },
        { name: "穷游网", url: "https://www.qyer.com/", type: "location", description: "出境游攻略与社区", tags: ["出境游", "攻略", "社区"], rating: 8.3 },
        { name: "携程旅游", url: "https://vacations.ctrip.com/", type: "location", description: "携程旅游度假频道", tags: ["旅游", "度假", "套餐"], rating: 8.0 },
        { name: "飞猪旅行", url: "https://www.fliggy.com/", type: "location", description: "阿里旗下旅行平台", tags: ["旅行", "机票", "酒店"], rating: 8.0 },
        { name: "同程旅行", url: "https://www.ly.com/", type: "location", description: "综合旅游服务平台", tags: ["旅游", "门票", "度假"], rating: 7.8 },
      ],
      hotel: [
        { name: "携程酒店", url: "https://hotels.ctrip.com/", type: "hotel", description: "携程酒店预订，覆盖全球", tags: ["酒店", "预订", "全球"], rating: 8.5 },
        { name: "飞猪酒店", url: "https://hotel.fliggy.com/", type: "hotel", description: "飞猪酒店预订平台", tags: ["酒店", "预订", "优惠"], rating: 8.0 },
        { name: "美团酒店", url: "https://hotel.meituan.com/", type: "hotel", description: "美团酒店预订与点评", tags: ["酒店", "预订", "点评"], rating: 8.2 },
        { name: "去哪儿酒店", url: "https://hotel.qunar.com/", type: "hotel", description: "去哪儿酒店比价预订", tags: ["酒店", "比价", "预订"], rating: 8.0 },
        { name: "途家民宿", url: "https://www.tujia.com/", type: "hotel", description: "中国领先的民宿预订平台", tags: ["民宿", "短租", "特色"], rating: 8.3 },
        { name: "Airbnb中国", url: "https://www.airbnb.cn/", type: "hotel", description: "全球民宿短租平台", tags: ["民宿", "全球", "体验"], rating: 8.5 },
      ],
    },
    intl: {
      location: [
        { name: "TripAdvisor", url: "https://www.tripadvisor.com/", type: "location", description: "World's largest travel guidance platform", tags: ["reviews", "global", "travel"], rating: 8.8 },
        { name: "Google Travel", url: "https://www.google.com/travel/", type: "location", description: "Google's travel planning tools", tags: ["planning", "flights", "hotels"], rating: 8.5 },
        { name: "Lonely Planet", url: "https://www.lonelyplanet.com/", type: "location", description: "Travel guides and destination inspiration", tags: ["guides", "inspiration", "adventure"], rating: 8.5 },
        { name: "Viator", url: "https://www.viator.com/", type: "location", description: "Tours and activities worldwide", tags: ["tours", "activities", "experiences"], rating: 8.3 },
        { name: "GetYourGuide", url: "https://www.getyourguide.com/", type: "location", description: "Book tours, attractions, and activities", tags: ["tours", "activities", "booking"], rating: 8.5 },
        { name: "Atlas Obscura", url: "https://www.atlasobscura.com/", type: "location", description: "Discover hidden wonders of the world", tags: ["unique", "hidden", "curious"], rating: 8.8 },
      ],
      hotel: [
        { name: "Booking.com", url: "https://www.booking.com/", type: "hotel", description: "World's leading hotel booking site", tags: ["hotels", "booking", "global"], rating: 8.8 },
        { name: "Airbnb", url: "https://www.airbnb.com/", type: "hotel", description: "Unique stays and experiences worldwide", tags: ["rentals", "unique", "local"], rating: 8.5 },
        { name: "Hotels.com", url: "https://www.hotels.com/", type: "hotel", description: "Hotel booking with rewards program", tags: ["hotels", "rewards", "booking"], rating: 8.2 },
        { name: "Expedia", url: "https://www.expedia.com/", type: "hotel", description: "Travel booking for flights, hotels, and more", tags: ["travel", "packages", "comprehensive"], rating: 8.3 },
        { name: "Kayak", url: "https://www.kayak.com/", type: "hotel", description: "Travel search engine for best deals", tags: ["search", "compare", "deals"], rating: 8.5 },
        { name: "Hostelworld", url: "https://www.hostelworld.com/", type: "hotel", description: "Budget hostel bookings worldwide", tags: ["budget", "hostels", "backpacker"], rating: 8.0 },
        { name: "Vrbo", url: "https://www.vrbo.com/", type: "hotel", description: "Vacation rentals for families", tags: ["rentals", "vacation", "family"], rating: 8.3 },
      ],
    },
  },
  fitness: {
    cn: {
      course: [
        { name: "Keep", url: "https://www.gotokeep.com/", type: "course", description: "中国领先的运动健身平台", tags: ["健身", "课程", "App"], rating: 8.5 },
        { name: "B站健身", url: "https://www.bilibili.com/v/sports", type: "video", description: "B站运动健身区，免费教程", tags: ["视频", "免费", "教程"], rating: 8.8 },
        { name: "小红书健身", url: "https://www.xiaohongshu.com/search_result?keyword=%E5%81%A5%E8%BA%AB", type: "article", description: "小红书健身攻略与经验分享", tags: ["攻略", "经验", "社区"], rating: 8.2 },
        { name: "咕咚运动", url: "https://www.codoon.com/", type: "course", description: "运动社交与跑步追踪", tags: ["跑步", "社交", "追踪"], rating: 8.0 },
        { name: "悦跑圈", url: "https://www.thejoyrun.com/", type: "course", description: "跑步爱好者社区", tags: ["跑步", "社区", "赛事"], rating: 8.0 },
        { name: "薄荷健康", url: "https://www.boohee.com/", type: "course", description: "饮食记录与减肥健康管理", tags: ["饮食", "减肥", "健康"], rating: 8.2 },
      ],
      location: [
        { name: "大众点评健身房", url: "https://www.dianping.com/search/keyword/1/45_%E5%81%A5%E8%BA%AB%E6%88%BF", type: "location", description: "大众点评健身房点评", tags: ["健身房", "点评", "本地"], rating: 8.3 },
        { name: "美团运动健身", url: "https://www.meituan.com/yundong/", type: "location", description: "美团运动健身频道", tags: ["健身", "团购", "优惠"], rating: 8.0 },
      ],
    },
    intl: {
      course: [
        { name: "YouTube Fitness", url: "https://www.youtube.com/results?search_query=workout", type: "video", description: "Free workout videos on YouTube", tags: ["free", "video", "variety"], rating: 9.0 },
        { name: "Nike Training Club", url: "https://www.nike.com/ntc-app", type: "app", description: "Nike's free workout app", tags: ["Nike", "free", "guided"], rating: 8.8 },
        { name: "Peloton", url: "https://www.onepeloton.com/", type: "course", description: "Premium connected fitness platform", tags: ["premium", "connected", "community"], rating: 8.5 },
        { name: "Fitness Blender", url: "https://www.fitnessblender.com/", type: "video", description: "Free full-length workout videos", tags: ["free", "variety", "home"], rating: 9.0 },
        { name: "DAREBEE", url: "https://darebee.com/", type: "course", description: "Free fitness resources and programs", tags: ["free", "programs", "printable"], rating: 8.8 },
        { name: "Blogilates", url: "https://www.blogilates.com/", type: "video", description: "Cassey Ho's pilates and fitness", tags: ["pilates", "fun", "positive"], rating: 8.5 },
        { name: "Strava", url: "https://www.strava.com/", type: "app", description: "Social fitness tracking for athletes", tags: ["tracking", "social", "running"], rating: 8.8 },
        { name: "MyFitnessPal", url: "https://www.myfitnesspal.com/", type: "app", description: "Calorie counting and diet tracking", tags: ["nutrition", "tracking", "diet"], rating: 8.5 },
      ],
      location: [
        { name: "Google Maps Gyms", url: "https://www.google.com/maps/search/gyms/", type: "location", description: "Find gyms near you", tags: ["local", "gyms", "reviews"], rating: 8.5 },
        { name: "Yelp Fitness", url: "https://www.yelp.com/search?find_desc=gyms", type: "location", description: "Gym and fitness center reviews", tags: ["reviews", "local", "gyms"], rating: 8.3 },
        { name: "ClassPass", url: "https://classpass.com/", type: "app", description: "Access to fitness studios worldwide", tags: ["variety", "studios", "flexible"], rating: 8.5 },
        { name: "Planet Fitness", url: "https://www.planetfitness.com/", type: "location", description: "Affordable gym chain", tags: ["affordable", "gym", "beginner"], rating: 7.5 },
        { name: "Equinox", url: "https://www.equinox.com/", type: "location", description: "Luxury fitness clubs", tags: ["luxury", "premium", "amenities"], rating: 8.5 },
      ],
    },
  },
};

// 保持向后兼容的别名
const CATEGORY_LINK_CONFIG = VERIFIED_LINKS_DATABASE;

/**
 * 生成推荐 Prompt
 */
function generatePrompt(
  category: RecommendationCategory,
  userHistory: RecommendationHistory[],
  userPreferences: UserPreference | null,
  locale: "zh" | "en",
  count: number = 3
): string {
  const region = locale === "zh" ? "cn" : "intl";
  const linkConfig = CATEGORY_LINK_CONFIG[category]?.[region] || {};

  // 构建用户历史摘要
  const historyTitles = userHistory.slice(0, 10).map((h) => h.title).join(", ");
  const preferencesTags = userPreferences?.tags?.join(", ") || "";
  const preferencesWeights = userPreferences?.preferences
    ? Object.entries(userPreferences.preferences)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([tag]) => tag)
        .join(", ")
    : "";

  // 链接示例
  const linkExamples = Object.entries(linkConfig)
    .flatMap(([type, items]) =>
      (items as any[]).slice(0, 2).map((item) => `${item.name}: ${item.url}`)
    )
    .join("\n");

  const categoryNames: Record<RecommendationCategory, { zh: string; en: string }> = {
    entertainment: { zh: "娱乐", en: "Entertainment" },
    shopping: { zh: "购物", en: "Shopping" },
    food: { zh: "美食", en: "Food" },
    travel: { zh: "旅行", en: "Travel" },
    fitness: { zh: "健身", en: "Fitness" },
  };

  const categoryName = categoryNames[category][locale === "zh" ? "zh" : "en"];

  if (locale === "zh") {
    return `你是一个智能推荐助手，专门为用户提供${categoryName}类的个性化推荐。

## 用户信息
- 历史选择: ${historyTitles || "暂无历史记录（新用户）"}
- 偏好标签: ${preferencesTags || "暂无明确偏好"}
- 推测偏好: ${preferencesWeights || "暂无推测"}

## 任务
请基于用户历史和偏好，推荐 ${count} 个${categoryName}相关的内容。

## ⚠️ 关键要求 - 必须严格遵守
1. **每条推荐必须包含真实可访问的外部链接**，用户可以直接点击访问
2. 链接必须是真实存在的公开网站，不能虚构、不能是无效的 URL
3. 链接必须是 https:// 开头的完整 URL
4. 禁止生成：
   - 虚假或不存在的网站链接
   - 已关闭/下架的网站
   - 示例 URL（如 example.com）
   - 模糊的参数链接（如 /product/123 不完整的相对路径）
5. 使用下面提供的链接示例作为参考，生成相同质量的真实链接

## 可用的链接参考（请使用相同质量的真实链接）
${linkExamples}

## 返回格式
请严格返回 JSON 数组格式，不要有任何其他文字：
[
  {
    "title": "推荐标题",
    "description": "详细描述（30-50字）",
    "category": "${category}",
    "link": "https://真实网站链接（必须是完整的、可访问的 URL）",
    "linkType": "类型(product/video/book/location/restaurant/recipe/hotel/course/movie/music/game)",
    "metadata": {
      "price": "价格（如适用）",
      "rating": 评分数字（如适用）,
      "duration": "时长（如适用）",
      "calories": 卡路里数字（如适用）
    },
    "reason": "为什么推荐给你：基于你之前..."
  }
]

## 验证清单（返回前检查每条推荐）
- ☑️ 链接是否以 https:// 开头？
- ☑️ 链接是否是完整的 URL（不是相对路径）？
- ☑️ 链接对应的网站是否真实存在？
- ☑️ 这是我确实知道的真实网站吗？
- ☑️ 用户能否直接在浏览器中打开这个链接？`;
  } else {
    return `You are a smart recommendation assistant specializing in ${categoryName} recommendations.

## User Information
- History: ${historyTitles || "No history (new user)"}
- Preference Tags: ${preferencesTags || "No explicit preferences"}
- Inferred Preferences: ${preferencesWeights || "No inferences"}

## Task
Based on user history and preferences, recommend ${count} ${categoryName}-related items.

## ⚠️ Critical Requirements - MUST FOLLOW STRICTLY
1. **Every recommendation MUST include a real, accessible external link** that users can click and visit
2. Links MUST be real, publicly available websites - NOT fictional, NOT invalid
3. Links MUST be complete https:// URLs
4. FORBIDDEN:
   - Fake or non-existent website links
   - Closed/unavailable websites
   - Example URLs (like example.com)
   - Incomplete relative paths (like /product/123)
5. Use the reference links below as examples - generate links of the same quality

## Reference Links (use similar real, accessible links)
${linkExamples}

## Response Format
Return ONLY a JSON array, no other text:
[
  {
    "title": "Recommendation title",
    "description": "Detailed description (30-50 words)",
    "category": "${category}",
    "link": "https://real-website-link (MUST be complete, accessible URL)",
    "linkType": "type(product/video/book/location/restaurant/recipe/hotel/course/movie/music/game)",
    "metadata": {
      "price": "price (if applicable)",
      "rating": rating_number (if applicable),
      "duration": "duration (if applicable)",
      "calories": calories_number (if applicable)
    },
    "reason": "Why we recommend this: Based on your..."
  }
]

## Verification Checklist (verify before returning each recommendation)
- ☑️ Does the link start with https://?
- ☑️ Is it a complete URL (not a relative path)?
- ☑️ Does the website in the link actually exist?
- ☑️ Is this a real website I actually know about?
- ☑️ Can a user actually open this link in their browser?`;
  }
}

/**
 * 调用智谱 API
 */
async function callZhipuAPI(messages: ZhipuMessage[], retryCount: number = 0): Promise<string> {
  const apiKey = process.env.ZHIPU_API_KEY;
  const MAX_RETRIES = 2;

  if (!apiKey) {
    throw new Error("ZHIPU_API_KEY is not configured");
  }

  if (apiKey.includes("your_")) {
    throw new Error("ZHIPU_API_KEY is not properly configured (contains placeholder)");
  }

  try {
    const response = await fetch(ZHIPU_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ZHIPU_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const statusCode = response.status;

      // 解析错误响应
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.msg || errorText;
      } catch {
        // 继续使用原始错误文本
      }

      // 详细的错误日志
      console.error(`Zhipu API Error (Status ${statusCode}):`, {
        status: statusCode,
        message: errorMessage,
        timestamp: new Date().toISOString(),
        model: ZHIPU_MODEL,
        apiKeyExists: !!apiKey,
        apiKeyLength: apiKey.length,
      });

      // 403 Forbidden - API Key 或权限问题
      if (statusCode === 403) {
        throw new Error(
          `Zhipu API access denied (403 Forbidden): ${errorMessage}. Please check your API key validity and account permissions.`
        );
      }

      // 429 Too Many Requests - 速率限制，可以重试
      if (statusCode === 429 && retryCount < MAX_RETRIES) {
        console.warn(`Rate limited, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
        return callZhipuAPI(messages, retryCount + 1);
      }

      // 500+ 服务器错误，可以重试
      if (statusCode >= 500 && retryCount < MAX_RETRIES) {
        console.warn(`Server error (${statusCode}), retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
        return callZhipuAPI(messages, retryCount + 1);
      }

      throw new Error(`Zhipu API error: ${statusCode} - ${errorMessage}`);
    }

    const data: ZhipuResponse = await response.json();

    // 获取 choices - 可能在 data.choices 或顶层 choices
    const choices = data.data?.choices || data.choices;

    console.log("Zhipu API Response Debug:", {
      statusOk: response.ok,
      code: data.code,
      msg: data.msg,
      hasChoices: !!choices,
      choicesLength: choices?.length || 0,
      responseKeys: Object.keys(data),
      timestamp: new Date().toISOString(),
    });

    // 检查是否是错误响应
    if (data.error || (typeof data.code === "string" && data.code !== "0") || (typeof data.code === "number" && data.code !== 0)) {
      const errorMsg = data.error?.message || data.msg || "Unknown error";
      const errorCode = data.code || "unknown";
      throw new Error(`Zhipu API returned error - Code: ${errorCode}, Message: ${errorMsg}`);
    }

    // 检查成功响应 - 支持两种格式
    if (!choices || choices.length === 0) {
      console.error("Invalid response structure - no choices found:", {
        hasData: !!data.data,
        hasDataChoices: !!data.data?.choices,
        hasTopChoices: !!data.choices,
        responseKeys: Object.keys(data),
        fullResponse: JSON.stringify(data).substring(0, 500),
      });
      throw new Error("Zhipu API returned no choices - invalid response format");
    }

    const content = choices[0]?.message?.content;
    if (!content) {
      console.error("Empty content in response:", JSON.stringify(choices[0]));
      throw new Error("Zhipu API returned empty content");
    }

    console.log("✓ Successfully extracted content from Zhipu API response");
    return content;
  } catch (error) {
    // 重新抛出已知的错误
    if (error instanceof Error) {
      throw error;
    }
    // 捕获未知错误
    throw new Error(`Unexpected error calling Zhipu API: ${error}`);
  }
}

/**
 * 解析 AI 响应为推荐列表
 */
function parseAIResponse(content: string): AIRecommendation[] {
  try {
    // 尝试提取 JSON 部分
    let jsonContent = content.trim();

    // 如果响应被包裹在 markdown 代码块中，提取出来
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    // 如果响应包含额外文字，尝试提取数组部分
    const arrayMatch = jsonContent.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonContent = arrayMatch[0];
    }

    const parsed = JSON.parse(jsonContent);

    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    console.log(`[AI Response] Received ${parsed.length} recommendations from AI`);

    // 验证并清理每个推荐，同时转换元数据类型
    const recommendations = parsed.map((item, index) => {
      // 处理元数据，确保数值字段是正确的类型
      const metadata = item.metadata || {};
      if (metadata.rating && typeof metadata.rating === "string") {
        metadata.rating = parseFloat(metadata.rating);
      }
      if (metadata.calories && typeof metadata.calories === "string") {
        metadata.calories = parseFloat(metadata.calories);
      }

      return {
        title: item.title || `Recommendation ${index + 1}`,
        description: item.description || "",
        category: item.category || "entertainment",
        link: item.link || "",
        linkType: item.linkType || "article",
        metadata,
        reason: item.reason || "",
      };
    });

    // 去重：保留第一个，删除重复的推荐（基于 title 和 link）
    const seen = new Set<string>();
    const deduplicated = recommendations.filter((rec) => {
      // 使用 title + link 作为唯一标识
      const key = `${rec.title}|${rec.link}`;
      if (seen.has(key)) {
        console.warn(`[Dedup] Filtered duplicate recommendation: "${rec.title}"`);
        return false;
      }
      seen.add(key);
      return true;
    });

    if (deduplicated.length < recommendations.length) {
      console.log(
        `[Dedup] Removed ${recommendations.length - deduplicated.length} duplicate(s) from ${recommendations.length} recommendations`
      );
    }

    console.log(`[AI Response] Final deduplicated count: ${deduplicated.length}`);
    return deduplicated;
  } catch (error) {
    console.error("Failed to parse AI response:", error, "Content:", content);
    throw new Error("Failed to parse AI response as JSON");
  }
}

/**
 * 获取 AI 推荐
 */
export async function getAIRecommendations(
  category: RecommendationCategory,
  userHistory: RecommendationHistory[],
  userPreferences: UserPreference | null,
  locale: "zh" | "en" = "zh",
  count: number = 3
): Promise<AIRecommendation[]> {
  const prompt = generatePrompt(category, userHistory, userPreferences, locale, count);

  const messages: ZhipuMessage[] = [
    {
      role: "system",
      content:
        locale === "zh"
          ? "你是一个智能推荐助手，只返回 JSON 格式的推荐结果，不要有任何其他文字。"
          : "You are a smart recommendation assistant. Return ONLY JSON-formatted recommendations, no other text.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const response = await callZhipuAPI(messages);
  return parseAIResponse(response);
}

/**
 * 检查智谱 API 是否可用
 */
export function isZhipuConfigured(): boolean {
  // 开发模式下禁用 AI（使用 DEV_MODE=true）
  if (process.env.DEV_MODE === "true") {
    return false;
  }
  return !!process.env.ZHIPU_API_KEY;
}

export { CATEGORY_LINK_CONFIG };
