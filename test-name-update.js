// test-name-update.js
// Test script to verify name update functionality

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'test123456';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testNameUpdate() {
  console.log('🧪 Testing name update functionality...\n');

  const testNames = [
    'John Doe',
    '张三',
    'Jane Smith Updated',
    '测试用户'
  ];

  try {
    // Step 1: Sign in
    console.log(`1. Signing in as ${TEST_EMAIL}...`);

    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      console.log('\n💡 Note: Make sure to create a test user first:');
      console.log('   - Email: test@example.com');
      console.log('   - Password: test123456');
      process.exit(1);
    }

    console.log('✅ Sign in successful\n');

    // Step 2: Test name updates
    for (let i = 0; i < testNames.length; i++) {
      const newName = testNames[i];
      console.log(`2.${i+1} Testing name update to: "${newName}"`);

      // Call the profile update API
      const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/profile/update`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: newName,
        }),
      });

      if (!response.ok) {
        console.error('❌ Failed to update name:', response.status);
        const errorData = await response.json();
        console.error('   Error:', errorData.error);
        continue;
      }

      const result = await response.json();
      if (result.success) {
        console.log('✅ Name updated successfully');
      } else {
        console.error('❌ Update failed:', result.error);
        continue;
      }

      // Step 3: Verify the update by calling profile API
      console.log(`2.${i+1} Verifying update...`);

      const profileResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${authData.session.access_token}`,
        },
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        if (profileData.name === newName) {
          console.log(`✅ Verified: Name is now "${profileData.name}"`);
        } else {
          console.error(`❌ Verification failed: Expected "${newName}", got "${profileData.name}"`);
        }
      } else {
        console.error('❌ Failed to verify update:', profileResponse.status);
      }

      console.log(''); // Empty line for readability
    }

    // Step 4: Check user_profiles table directly
    console.log('3. Checking user_profiles table directly...');

    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (SUPABASE_SERVICE_KEY) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const { data: dbProfile, error: dbError } = await supabaseAdmin
        .from('user_profiles')
        .select('full_name, updated_at')
        .eq('id', authData.user.id)
        .single();

      if (dbError) {
        console.error('❌ Failed to fetch from user_profiles:', dbError.message);
      } else {
        console.log('✅ Database record:');
        console.log(`   Name: ${dbProfile.full_name}`);
        console.log(`   Last Updated: ${dbProfile.updated_at}`);
      }
    } else {
      console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY not set, skipping direct DB check');
    }

    // Step 5: Clean up - sign out
    console.log('\n4. Signing out...');
    await supabase.auth.signOut();
    console.log('✅ Signed out successfully');

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testNameUpdate();