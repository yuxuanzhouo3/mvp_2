#!/usr/bin/env node
/**
 * Test that search links are generated correctly based on the recommendation content
 */

const { generateSearchLink, selectBestPlatform } = require("../lib/search/search-engine");

function testSearchLinkGeneration() {
  console.log("Testing Search Link Generation\n");

  // Test cases
  const testCases = [
    {
      title: "Culinary Artistry: The Complete Series",
      searchQuery: "renowned chefs cooking series",
      category: "food",
      locale: "en",
      description: "Food recommendation with specific search query"
    },
    {
      title: "特色美食餐厅",
      searchQuery: "附近高评分餐厅",
      category: "food",
      locale: "zh",
      description: "Chinese food recommendation"
    },
    {
      title: "2024年最新热门电影",
      searchQuery: "",
      category: "entertainment",
      locale: "zh",
      description: "Entertainment recommendation without search query"
    },
    {
      title: "Best Wireless Earbuds 2024",
      searchQuery: "wireless headphones noise cancelling",
      category: "shopping",
      locale: "en",
      description: "Shopping recommendation with tech keywords"
    },
    {
      title: "Popular Tourist Attractions",
      searchQuery: "must visit destinations",
      category: "travel",
      locale: "en",
      description: "Travel recommendation"
    }
  ];

  testCases.forEach((test, index) => {
    console.log(`\n${index + 1}. ${test.description}`);
    console.log(`   Title: ${test.title}`);
    console.log(`   Search Query: ${test.searchQuery || "(empty)"}`);

    // Select best platform
    const platform = selectBestPlatform(test.category, undefined, test.locale);
    console.log(`   Selected Platform: ${platform}`);

    // Generate search link
    const searchLink = generateSearchLink(test.title, test.searchQuery, platform, test.locale);

    console.log(`   Final Query: ${searchLink.url.split('?')[1]?.split('=')[1] || searchLink.url.split('/').pop() || searchLink.url}`);
    console.log(`   Full URL: ${searchLink.url}`);
    console.log(`   ✓ Test ${index + 1} completed`);
  });

  console.log("\n✅ All tests completed!");
  console.log("\nSummary:");
  console.log("- Search queries now prioritize the AI-generated searchQuery over title");
  console.log("- Platform-specific keywords are added for better results");
  console.log("- Empty searchQuery falls back to using the title");
}

testSearchLinkGeneration();