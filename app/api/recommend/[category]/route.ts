import { type NextRequest, NextResponse } from "next/server"

// Mock databases
const ENTERTAINMENT = [
  {
    id: "1",
    type: "sci-fi",
    title: "三体",
    description: "刘慈欣经典科幻小说，探索宇宙文明的宏大史诗",
  },
  {
    id: "2",
    type: "game",
    title: "原神",
    description: "开放世界冒险游戏，探索提瓦特大陆的奇幻世界",
  },
  {
    id: "3",
    type: "song",
    title: "稻香",
    description: "周杰伦经典歌曲，回忆童年美好时光",
  },
  {
    id: "4",
    type: "movie",
    title: "流浪地球",
    description: "中国科幻电影巅峰之作，人类拯救地球的壮举",
  },
]

const SHOPPING = [
  {
    id: "1",
    type: "fashion",
    title: "Uniqlo 基础T恤",
    price: "¥99",
    description: "简约百搭，舒适透气",
  },
  {
    id: "2",
    type: "shoes",
    title: "Nike Air Force 1",
    price: "¥899",
    description: "经典白色板鞋，百搭时尚",
  },
  {
    id: "3",
    type: "gadget",
    title: "AirPods Pro",
    price: "¥1899",
    description: "主动降噪，音质出色",
  },
  {
    id: "4",
    type: "daily",
    title: "无印良品收纳盒",
    price: "¥49",
    description: "简约设计，整理收纳好帮手",
  },
]

const FOOD = [
  {
    id: "1",
    title: "四川火锅",
    reason: "基于您最近5次川菜选择",
    calories: 650,
    description: "麻辣鲜香，暖胃暖心",
  },
  {
    id: "2",
    title: "日式拉面",
    reason: "根据当前天气推荐热汤面",
    calories: 480,
    description: "浓郁汤头，Q弹面条",
  },
  {
    id: "3",
    title: "意大利披萨",
    reason: "您上次评价很高的西餐",
    calories: 520,
    description: "芝士拉丝，香脆饼底",
  },
  {
    id: "4",
    title: "广式点心",
    reason: "适合下午茶时光",
    calories: 320,
    description: "精致小巧，口感丰富",
  },
]

const TRAVEL = [
  {
    id: "1",
    title: "西湖漫步",
    description: "在杭州西湖边悠闲散步，欣赏湖光山色",
    duration: "2-3小时",
    weather: "晴朗 22°C",
  },
  {
    id: "2",
    title: "故宫博物院",
    description: "探索中国古代皇家建筑的宏伟与精美",
    duration: "半天",
    weather: "多云 18°C",
  },
  {
    id: "3",
    title: "黄山登山",
    description: "挑战自我，登顶黄山观日出云海",
    duration: "全天",
    weather: "晴朗 15°C",
  },
]

const FITNESS = [
  {
    id: "1",
    title: "晨跑",
    description: "在公园里进行30分钟轻松慢跑",
    duration: "30分钟",
    weather: "适宜运动",
  },
  {
    id: "2",
    title: "瑜伽练习",
    description: "在家进行舒缓的瑜伽拉伸运动",
    duration: "45分钟",
    weather: "室内运动",
  },
  {
    id: "3",
    title: "游泳",
    description: "在游泳池进行有氧游泳训练",
    duration: "1小时",
    weather: "室内运动",
  },
]

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function aiRecommendation(history: any[], category: string) {
  void history
  void category

  // Simple AI logic - in real app, this would use ML models
  const preferences = ["川菜", "日料", "西餐", "粤菜"]
  const randomPreference = preferences[Math.floor(Math.random() * preferences.length)]

  return {
    ...getRandomItem(FOOD),
    reason: `基于您对${randomPreference}的偏好推荐`,
  }
}

export async function POST(request: NextRequest, { params }: { params: { category: string } }) {
  try {
    const body = await request.json()
    const { user_id } = body
    void user_id
    const category = params.category

    let recommendation

    switch (category) {
      case "entertainment":
        recommendation = getRandomItem(ENTERTAINMENT)
        break

      case "shopping":
        recommendation = getRandomItem(SHOPPING)
        break

      case "food":
        // Use AI recommendation for food
        recommendation = aiRecommendation([], category)
        break

      case "travel":
        recommendation = getRandomItem(TRAVEL)
        break

      case "fitness":
        recommendation = getRandomItem(FITNESS)
        break

      default:
        return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }

    return NextResponse.json(recommendation)
  } catch (error) {
    console.error("API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
