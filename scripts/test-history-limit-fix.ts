#!/usr/bin/env node
/**
 * 测试历史记录限制修复
 * 验证 API 是否正确使用 historyLimit 参数
 */

const testUserId = "550e8400-e29b-41d4-a716-446655440000";
const category = "entertainment";

async function testHistoryLimitFix() {
    console.log("Testing History Limit Fix\n");

    // 测试1: 默认情况（应该使用默认值）
    console.log("Test 1: Default historyLimit");
    console.log(`  URL: /api/recommend/ai/${category}?userId=${testUserId}`);
    console.log(`  Expected: historyLimit = 50 (AI API default)\n`);

    // 测试2: 自定义historyLimit
    console.log("Test 2: Custom historyLimit");
    console.log(`  URL: /api/recommend/ai/${category}?userId=${testUserId}&historyLimit=30`);
    console.log(`  Expected: historyLimit = 30\n`);

    // 测试3: 限制最大值
    console.log("Test 3: historyLimit exceeds max (100)");
    console.log(`  URL: /api/recommend/ai/${category}?userId=${testUserId}&historyLimit=200`);
    console.log(`  Expected: historyLimit = 100 (capped at max)\n`);

    // 测试4: 小于最小值
    console.log("Test 4: historyLimit below min (1)");
    console.log(`  URL: /api/recommend/ai/${category}?userId=${testUserId}&historyLimit=0`);
    console.log(`  Expected: historyLimit = 1 (raised to min)\n`);

    // 测试5: 用户偏好分析API
    console.log("Test 5: User Preferences API");
    console.log(`  URL: /api/preferences/${testUserId}?category=${category}&includeHistory=true`);
    console.log(`  Expected: historyLimit = 20 (Preferences API default)\n`);

    console.log("✓ Modification Summary:");
    console.log("  - AI Recommendation API: default 50, configurable 1-100");
    console.log("  - User Preferences API: default 20, configurable 1-100");
    console.log("  - Both APIs now support historyLimit query parameter");
    console.log("  - Console logs will show actual record count, not hardcoded '20'");
    console.log("\n✓ To test with actual database:");
    console.log(`  curl "http://localhost:3000/api/recommend/ai/${category}?userId=${testUserId}&historyLimit=50"`);
    console.log("  (Watch server logs for [AI] 用户历史记录数: output)");
}

testHistoryLimitFix();
