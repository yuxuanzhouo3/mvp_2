#!/usr/bin/env node
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

async function testDatabaseOperations() {
  console.log("Testing Supabase database operations...\n");

  try {
    // Test 1: 检查表是否存在
    console.log("1. Checking if tables exist...");
    const { data: tables, error: tableError } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public");

    if (tableError) {
      console.log("   Tables check (using workaround):", tableError.message);
    } else {
      console.log("   ✓ Tables found:", tables?.map(t => (t as any).table_name).join(", "));
    }

    // Test 2: 尝试插入推荐
    console.log("\n2. Testing recommendation_history insert...");
    const testUserId = "550e8400-e29b-41d4-a716-446655440000"; // Test UUID
    const { data: insertData, error: insertError } = await supabase
      .from("recommendation_history")
      .insert({
        user_id: testUserId,
        category: "entertainment",
        title: "Test Recommendation",
        description: "This is a test recommendation",
        link: "https://example.com/test",
        link_type: "article",
        metadata: { tags: ["test"] },
        reason: "Test insert",
      })
      .select();

    if (insertError) {
      console.log("   ✗ Error:", insertError.message);
      console.log("   Code:", insertError.code);
      console.log("   Details:", insertError.details);
    } else {
      console.log("   ✓ Successfully inserted:");
      console.log("   ID:", insertData?.[0]?.id);
      console.log("   Title:", insertData?.[0]?.title);
    }

    // Test 3: 尝试读取推荐
    console.log("\n3. Testing recommendation_history select...");
    const { data: selectData, error: selectError } = await supabase
      .from("recommendation_history")
      .select("*")
      .eq("user_id", testUserId)
      .limit(1);

    if (selectError) {
      console.log("   ✗ Error:", selectError.message);
    } else {
      console.log("   ✓ Retrieved", selectData?.length || 0, "records");
      if (selectData && selectData.length > 0) {
        console.log("   First record:", selectData[0]);
      }
    }

    // Test 4: 检查 RLS 策略
    console.log("\n4. Checking RLS policies...");
    const { data: policies, error: policiesError } = await supabase
      .from("pg_policies")
      .select("*")
      .eq("tablename", "recommendation_history");

    if (policiesError) {
      console.log("   Info: RLS policies info not directly accessible");
    } else {
      console.log("   ✓ Found", policies?.length || 0, "policies");
    }

    // Test 5: 尝试插入到 user_preferences
    console.log("\n5. Testing user_preferences insert...");
    const { data: prefData, error: prefError } = await supabase
      .from("user_preferences")
      .insert({
        user_id: testUserId,
        category: "entertainment",
        preferences: { tags: ["test"] },
        tags: ["test"],
      })
      .select();

    if (prefError) {
      console.log("   ✗ Error:", prefError.message);
      console.log("   Code:", prefError.code);
    } else {
      console.log("   ✓ Successfully inserted user preference");
      console.log("   ID:", prefData?.[0]?.id);
    }

    console.log("\n✓ Database tests completed!");
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

testDatabaseOperations();
