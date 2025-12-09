#!/usr/bin/env node
/**
 * Test that the search link fix works correctly
 * Verify that recommendations can now be saved without constraint errors
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

async function testSearchLinkFix() {
  console.log("Testing Search Link Fix\n");

  // Create a test user ID
  const testUserId = "550e8400-e29b-41d4-a716-446655440099";

  try {
    // Clean up previous test data
    console.log("1. Cleaning up previous test data...");
    await supabase
      .from("recommendation_history")
      .delete()
      .eq("user_id", testUserId);
    console.log("   ✓ Cleaned up\n");

    // Test saving a recommendation with article link type (mapped from search)
    console.log("2. Testing recommendation save with article link type...");

    const testRecommendation = {
      user_id: testUserId,
      category: "food",
      title: "Culinary Artistry: The Complete Series",
      description: "Experience the art of cooking with this series of exclusive interviews and recipes from renowned chefs",
      link: "https://www.google.com/maps/search/Culinary%20Artistry%3A%20The%20Complete%20Series",
      link_type: "article", // Changed from 'search' to 'article'
      metadata: {
        searchQuery: "renowned chefs cooking series",
        originalPlatform: "Google Maps",
        isSearchLink: true
      },
      reason: "You've shown interest in both MasterClass and The Food Network",
    };

    const { data: insertData, error: insertError } = await supabase
      .from("recommendation_history")
      .insert(testRecommendation)
      .select("id")
      .single();

    if (insertError) {
      console.log(`   ✗ Failed to insert: ${insertError.message}`);
      console.log(`   Details:`, insertError.details);
      console.log("\n   NOTE: If you still see constraint errors, please run the following SQL in Supabase SQL Editor:");
      console.log("   ------------------------------------------------");
      console.log("   ALTER TABLE recommendation_history DROP CONSTRAINT IF EXISTS recommendation_history_link_type_check;");
      console.log("   ALTER TABLE recommendation_history ADD CONSTRAINT recommendation_history_link_type_check CHECK (link_type IN ('product', 'video', 'book', 'location', 'article', 'app', 'music', 'movie', 'game', 'restaurant', 'recipe', 'hotel', 'course', 'search'));");
      console.log("   ------------------------------------------------");
    } else {
      console.log(`   ✓ Successfully saved recommendation with ID: ${insertData.id}`);
      console.log(`   ✓ Link type 'article' (mapped from 'search') is now working!`);
    }

    // Verify the saved data
    console.log("\n3. Verifying saved data...");
    const { data: verifyData, error: verifyError } = await supabase
      .from("recommendation_history")
      .select("*")
      .eq("user_id", testUserId)
      .eq("category", "food")
      .single();

    if (verifyError) {
      console.log(`   ✗ Failed to verify: ${verifyError.message}`);
    } else {
      console.log("   ✓ Found saved recommendation:");
      console.log(`     - Title: ${verifyData.title}`);
      console.log(`     - Link Type: ${verifyData.link_type}`);
      console.log(`     - Link: ${verifyData.link.substring(0, 60)}...`);
      console.log(`     - Metadata: ${JSON.stringify(verifyData.metadata, null, 2)}`);
    }

    console.log("\n✓ Test completed!");
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

testSearchLinkFix();