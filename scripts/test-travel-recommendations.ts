#!/usr/bin/env node

type TravelCase = {
  description: string
  title: string
  searchQuery: string
  locale: 'zh' | 'en'
}

function selectPlatform(locale: 'zh' | 'en'): 'Ctrip' | 'TripAdvisor' {
  return locale === 'zh' ? 'Ctrip' : 'TripAdvisor'
}

function optimizeQuery(platform: string, query: string): string {
  const base = query.trim()
  if (platform === 'Ctrip' || platform === 'Mafengwo' || platform === 'Qyer') {
    return /(攻略|指南)/.test(base) ? base : `${base} 攻略`
  }
  if (platform === 'TripAdvisor' || platform === 'Expedia') {
    return /(attractions|tours)/i.test(base) ? base : `${base} attractions`
  }
  return base
}

function buildUrl(platform: string, query: string): string {
  if (platform === 'Ctrip') {
    return `https://www.ctrip.com/s/?q=${encodeURIComponent(query)}`
  }
  if (platform === 'TripAdvisor') {
    return `https://www.tripadvisor.com/Search?q=${encodeURIComponent(query)}`
  }
  if (platform === 'Mafengwo') {
    return `https://www.mafengwo.cn/search/q.php?q=${encodeURIComponent(query)}`
  }
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

function testTravelRecommendations() {
  const cases: TravelCase[] = [
    {
      description: 'Chinese landmark recommendation',
      title: '故宫博物院',
      searchQuery: '故宫 历史文化 游览攻略',
      locale: 'zh',
    },
    {
      description: 'English tourist attraction',
      title: 'Eiffel Tower',
      searchQuery: 'Eiffel Tower tickets tours',
      locale: 'en',
    },
  ]

  console.log('Testing Travel Recommendation System\n')

  for (const item of cases) {
    const platform = selectPlatform(item.locale)
    const finalQuery = optimizeQuery(platform, item.searchQuery || item.title)
    const url = buildUrl(platform, finalQuery)

    console.log(`- ${item.description}`)
    console.log(`  Platform: ${platform}`)
    console.log(`  Query: ${finalQuery}`)
    console.log(`  URL: ${url}`)
  }
}

testTravelRecommendations()

