/**
 * Fix the link_type constraint to include 'search'
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function fixLinkTypeConstraint() {
  try {
    console.log('Updating link_type constraint to include "search"...');

    // First, drop the existing constraint
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE recommendation_history DROP CONSTRAINT IF EXISTS recommendation_history_link_type_check;`
    });

    if (dropError) {
      console.error('Error dropping constraint:', dropError);
      return;
    }

    console.log('✓ Dropped existing constraint');

    // Then, add the updated constraint with 'search' included
    const { error: addError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE recommendation_history ADD CONSTRAINT recommendation_history_link_type_check CHECK (link_type IN ('product', 'video', 'book', 'location', 'article', 'app', 'music', 'movie', 'game', 'restaurant', 'recipe', 'hotel', 'course', 'search'));`
    });

    if (addError) {
      console.error('Error adding new constraint:', addError);
      return;
    }

    console.log('✓ Added new constraint with "search" included');
    console.log('✓ Database schema updated successfully');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Alternative approach: use raw SQL via direct query
async function fixConstraintWithRawSQL() {
  try {
    console.log('Updating link_type constraint using raw SQL...');

    // Create a custom SQL function to execute the migration
    const migrationSQL = `
      DO $$
      BEGIN
        -- Drop the existing constraint if it exists
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'recommendation_history_link_type_check'
          AND table_name = 'recommendation_history'
        ) THEN
          EXECUTE 'ALTER TABLE recommendation_history DROP CONSTRAINT recommendation_history_link_type_check';
        END IF;

        -- Add the new constraint with 'search' included
        EXECUTE 'ALTER TABLE recommendation_history ADD CONSTRAINT recommendation_history_link_type_check CHECK (link_type IN (''product'', ''video'', ''book'', ''location'', ''article'', ''app'', ''music'', ''movie'', ''game'', ''restaurant'', ''recipe'', ''hotel'', ''course'', ''search''))';
      END $$;
    `;

    const { error } = await supabase
      .from('_temp_migration')
      .select('*')
      .limit(1);

    if (error) {
      console.log('Trying direct SQL approach via POSTGRES...');

      // Use the postgres meta function if available
      const { data, error: metaError } = await supabase
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public')
        .eq('tablename', 'recommendation_history');

      if (metaError) {
        console.error('Error accessing postgres meta:', metaError);
        return;
      }

      console.log('Found table:', data);
      console.log('Manual SQL execution may be required in Supabase dashboard');
      console.log('\nPlease run the following SQL in your Supabase SQL Editor:');
      console.log('---');
      console.log('ALTER TABLE recommendation_history DROP CONSTRAINT IF EXISTS recommendation_history_link_type_check;');
      console.log('ALTER TABLE recommendation_history ADD CONSTRAINT recommendation_history_link_type_check CHECK (link_type IN (\'product\', \'video\', \'book\', \'location\', \'article\', \'app\', \'music\', \'movie\', \'game\', \'restaurant\', \'recipe\', \'hotel\', \'course\', \'search\'));');
      console.log('---');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

fixConstraintWithRawSQL();