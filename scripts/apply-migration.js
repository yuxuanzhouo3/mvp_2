/**
 * Apply the link_type constraint fix directly via Supabase client
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase configuration');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Not set');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', serviceKey ? 'Set' : 'Not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyMigration() {
  try {
    console.log('Applying link_type constraint fix...');

    // Check current constraint
    const { data: tables, error: tableError } = await supabase
      .from('recommendation_history')
      .select('*')
      .limit(1);

    if (tableError && tableError.code === 'PGRST116') {
      console.error('Table does not exist or access denied:', tableError);
      return;
    }

    // Try to insert a test record with 'search' link_type to see if constraint exists
    const testId = '00000000-0000-0000-0000-000000000000';
    const { error: insertError } = await supabase
      .from('recommendation_history')
      .insert({
        id: testId,
        user_id: testId,
        category: 'fitness',
        title: 'Test',
        description: 'Test',
        link: 'https://test.com',
        link_type: 'search',
        metadata: {},
        reason: 'Test'
      });

    if (insertError) {
      console.log('Constraint detected:', insertError.message);

      if (insertError.message.includes('check constraint')) {
        console.log('Executing SQL to fix constraint...');

        // Since we can't execute DDL directly via the client,
        // we need to provide the SQL for manual execution
        console.log('\n=== MANUAL ACTION REQUIRED ===');
        console.log('Please execute the following SQL in your Supabase SQL Editor:');
        console.log('https://app.supabase.com/project/_/sql');
        console.log('\nSQL to execute:');
        console.log('-------------------');
        console.log('ALTER TABLE recommendation_history DROP CONSTRAINT IF EXISTS recommendation_history_link_type_check;');
        console.log('ALTER TABLE recommendation_history ADD CONSTRAINT recommendation_history_link_type_check CHECK (link_type IN (\'product\', \'video\', \'book\', \'location\', \'article\', \'app\', \'music\', \'movie\', \'game\', \'restaurant\', \'recipe\', \'hotel\', \'course\', \'search\'));');
        console.log('-------------------');
      }
    } else {
      // Clean up test record if successful
      await supabase
        .from('recommendation_history')
        .delete()
        .eq('id', testId);

      console.log('✓ Constraint already allows "search" link_type');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

applyMigration();