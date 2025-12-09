#!/usr/bin/env node
/**
 * 诊断推荐数量少的原因
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function diagnoseRecommendationIssue() {
  console.log("Diagnosing Why Recommendations Are Few\n");

  const testUserId = "550e8400-e29b-41d4-a716-446655440000";

  try {
    // 1. 检查用户推荐历史数量
    console.log("1. Checking user recommendation history...");
    const { data: historyData, count: historyCount } = await supabase
      .from("recommendation_history")
      .select("*", { count: "exact" })
      .eq("user_id", testUserId);

    console.log(`   - Total recommendations in history: ${historyCount}`);
    if (historyData && historyData.length > 0) {
      const categories: Record<string, number> = {};
      historyData.forEach((rec: any) => {
        categories[rec.category] = (categories[rec.category] || 0) + 1;
      });
      console.log("   - Breakdown by category:");
      Object.entries(categories).forEach(([cat, count]) => {
        console.log(`     * ${cat}: ${count}`);
      });
    }

    // 2. 检查用户偏好
    console.log("\n2. Checking user preferences...");
    const { data: prefData } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", testUserId);

    if (prefData && prefData.length > 0) {
      console.log(`   - User has ${prefData.length} preference records`);
      prefData.forEach((pref: any) => {
        console.log(`   - ${pref.category}:`);
        console.log(`     * Click count: ${pref.click_count}`);
        console.log(`     * View count: ${pref.view_count}`);
        console.log(`     * Tags: ${pref.tags?.join(", ") || "none"}`);
      });
    } else {
      console.log("   - No user preferences recorded");
    }

    // 3. 检查缓存
    console.log("\n3. Checking recommendation cache...");
    const { data: cacheData } = await supabase
      .from("recommendation_cache")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .limit(5);

    if (cacheData && cacheData.length > 0) {
      console.log(`   - Found ${cacheData.length} active cache entries`);
      cacheData.forEach((cache: any) => {
        const recs = cache.recommendations as any;
        console.log(`   - ${cache.category} (hash: ${cache.preference_hash}):`);
        console.log(`     * Cached recommendations: ${Array.isArray(recs) ? recs.length : "unknown"}`);
        console.log(`     * Expires: ${cache.expires_at}`);
      });
    } else {
      console.log("   - No active cache entries");
    }

    // 4. 分析可能的问题
    console.log("\n4. Analysis of Why Recommendations Are Few:");
    console.log("\n   Possible reasons:");
    console.log("   a) LOGIN USER SCENARIO:");
    console.log("      - First request: AI generates initial recommendations (3-5)");
    console.log("      - Cached for 30 minutes with preferenceHash");
    console.log("      - Subsequent requests: Return cached results (same as first)");
    console.log("      - To get new recommendations: Wait 30 minutes or use skipCache=true");
    console.log("");
    console.log("   b) NEW USER (no history/preferences):");
    console.log("      - AI generates generic recommendations");
    console.log("      - Each user gets different results (shuffled)");
    console.log("      - These ARE saved to database for future personalization");
    console.log("");
    console.log("   c) API PARAMETER LIMITS:");
    console.log(`      - Max count parameter: 5 (hard limited in code)`);
    console.log(`      - Default: 3`);
    console.log("      - If requesting count=10, only 5 will be returned");
    console.log("");
    console.log("   d) DEDUPLICATION:");
    console.log("      - Removes recommendations already in user history");
    console.log("      - If user has viewed similar items, new recommendations fewer");
    console.log("");

    // 5. 建议
    console.log("5. Recommendations to get more suggestions:");
    console.log("   ✓ Use the API with skipCache=true parameter");
    console.log("   ✓ Wait 30 minutes for cache to expire");
    console.log("   ✓ Increase request count parameter (up to 5)");
    console.log("   ✓ Interact with recommendations (click/save) to build preferences");
    console.log("   ✓ Check server logs for detailed recommendation flow");
    console.log("");

    // 6. 检查最近的推荐请求日志
    console.log("6. Recent recommendations saved:");
    const { data: recentRecs } = await supabase
      .from("recommendation_history")
      .select("title, category, created_at, link")
      .eq("user_id", testUserId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (recentRecs && recentRecs.length > 0) {
      console.log(`   - Last ${recentRecs.length} recommendations:`);
      recentRecs.forEach((rec: any, idx) => {
        console.log(`   ${idx + 1}. ${rec.title}`);
        console.log(`      Category: ${rec.category}`);
        console.log(`      Created: ${new Date(rec.created_at).toLocaleString()}`);
      });
    } else {
      console.log("   - No recommendations saved for this user yet");
    }

    console.log("\n✓ Diagnosis complete!");
  } catch (error) {
    console.error("Error during diagnosis:", error);
  }
}

diagnoseRecommendationIssue();
