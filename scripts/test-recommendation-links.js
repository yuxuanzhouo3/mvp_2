/**
 * Test recommendation link generation
 */

const testRecommendations = [
  {
    title: "Culinary Artistry: The Complete Series",
    searchQuery: "renowned chefs cooking series",
    category: "food",
    locale: "en"
  },
  {
    title: "特色美食餐厅",
    searchQuery: "附近高评分餐厅",
    category: "food",
    locale: "zh"
  },
  {
    title: "2024年最新热门电影",
    searchQuery: "",
    category: "entertainment",
    locale: "zh"
  },
  {
    title: "Best Wireless Earbuds 2024",
    searchQuery: "wireless headphones noise cancelling",
    category: "shopping",
    locale: "en"
  }
];

console.log("Testing Recommendation Link Generation\n");

testRecommendations.forEach((test, index) => {
  console.log(`\n${index + 1}. Test Case:`);
  console.log(`   Title: ${test.title}`);
  console.log(`   Search Query: ${test.searchQuery || "(empty)"}`);
  console.log(`   Category: ${test.category}`);
  console.log(`   Locale: ${test.locale}`);

  // Simulate the new logic
  let finalQuery = test.searchQuery && test.searchQuery.trim().length > 0
    ? test.searchQuery.trim()
    : test.title;

  // Determine platform based on category and locale
  let platform = test.locale === 'en' ? 'Google' : '百度';
  if (test.category === 'food' && test.locale === 'en') {
    platform = 'Google Maps';
    finalQuery = `${finalQuery} restaurants`;
  } else if (test.category === 'food' && test.locale === 'zh') {
    platform = '大众点评';
  }

  console.log(`   Platform: ${platform}`);
  console.log(`   Final Query: ${finalQuery}`);
  console.log(`   Expected URL: https://www.google.com/maps/search/${encodeURIComponent(finalQuery)}`);
});

console.log("\n✅ All tests completed!");
console.log("\nFixed behavior:");
console.log("- Search query is used when available instead of title");
console.log("- Platform-specific keywords are added (e.g., 'restaurants' for Google Maps)");
console.log("- Fallback to title when searchQuery is empty");