// test-profile-update.js
// Test script to verify user profile update after login

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testProfileUpdate() {
  console.log('🧪 Testing user profile update after login...\n');

  try {
    // Test credentials (you may need to create a test user first)
    const testEmail = 'test@example.com';
    const testPassword = 'test123456';

    console.log(`1. Signing in as ${testEmail}...`);

    // Sign in with test user
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      console.log('\n💡 Note: Make sure to create a test user first:');
      console.log('   - Email: test@example.com');
      console.log('   - Password: test123456');
      process.exit(1);
    }

    console.log('✅ Sign in successful');
    console.log(`   User ID: ${authData.user.id}`);
    console.log(`   Email: ${authData.user.email}\n`);

    console.log('2. Calling /api/profile to trigger profile update...');

    // Call the profile API endpoint
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/profile`, {
      headers: {
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Profile API call failed:', response.status);
      const errorData = await response.json();
      console.error('   Error:', errorData.error);
      process.exit(1);
    }

    const profileData = await response.json();
    console.log('✅ Profile API call successful');
    console.log('   Profile data:', JSON.stringify(profileData, null, 2));

    console.log('\n3. Checking user_profiles table directly...');

    // Check the user_profiles table using service role (if available)
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (SUPABASE_SERVICE_KEY) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const { data: dbProfile, error: dbError } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (dbError) {
        console.error('❌ Failed to fetch from user_profiles table:', dbError.message);
      } else {
        console.log('✅ Record found in user_profiles table');
        console.log('   DB Profile:', JSON.stringify(dbProfile, null, 2));
      }
    } else {
      console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY not set, skipping direct DB check');
    }

    console.log('\n4. Signing out...');
    await supabase.auth.signOut();
    console.log('✅ Signed out successfully');

    console.log('\n✅ Test completed successfully!');
    console.log('   The user profile should now be updated in the user_profiles table.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testProfileUpdate();