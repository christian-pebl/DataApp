const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function executeSQLStatements(sql) {
  // Split by semicolons but keep them for proper statement execution
  const statements = sql
    .split(/;\s*$/gm)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  const results = [];
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    
    // Skip pure comments
    if (statement.trim().startsWith('--')) continue;
    
    console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
    console.log(`Preview: ${statement.substring(0, 100)}...`);
    
    try {
      // For DO blocks and complex statements, we need to use raw SQL execution
      const { data, error } = await supabase.rpc('exec_raw_sql', {
        sql: statement
      }).single();
      
      if (error) {
        // If the RPC doesn't exist, try a different approach
        if (error.message.includes('exec_raw_sql')) {
          console.log('Note: Direct SQL execution not available via RPC');
          results.push({ statement: i + 1, status: 'skipped', message: 'Requires manual execution' });
        } else {
          console.error(`Error in statement ${i + 1}:`, error.message);
          results.push({ statement: i + 1, status: 'error', message: error.message });
        }
      } else {
        console.log(`✓ Statement ${i + 1} executed successfully`);
        results.push({ statement: i + 1, status: 'success' });
      }
    } catch (err) {
      console.error(`Error in statement ${i + 1}:`, err.message);
      results.push({ statement: i + 1, status: 'error', message: err.message });
    }
  }
  
  return results;
}

async function applyMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250909_safe_simplify_sharing.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Migration loaded. Preparing to execute...\n');
    
    // Since we can't execute raw SQL directly through the client library,
    // we'll need to use the Supabase management API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        query: migrationSQL
      })
    });

    if (!response.ok) {
      // Try alternative: create a temporary function to execute SQL
      console.log('Direct execution failed. Creating helper function...');
      
      // First, create a helper function if it doesn't exist
      const createHelperFunction = `
        CREATE OR REPLACE FUNCTION exec_migration_sql(sql_text TEXT)
        RETURNS TEXT
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql_text;
          RETURN 'Success';
        EXCEPTION
          WHEN OTHERS THEN
            RETURN 'Error: ' || SQLERRM;
        END;
        $$;
      `;
      
      const { error: funcError } = await supabase.rpc('exec_sql', {
        sql: createHelperFunction
      });
      
      if (!funcError) {
        // Now execute the migration using the helper
        const { data, error } = await supabase.rpc('exec_migration_sql', {
          sql_text: migrationSQL
        });
        
        if (error) {
          console.error('Migration execution error:', error);
        } else {
          console.log('Migration result:', data);
        }
      }
    }
    
    // Since direct execution might not work, let's provide instructions
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION INSTRUCTIONS');
    console.log('='.repeat(60));
    console.log('\nThe migration has been saved to:');
    console.log(`  ${migrationPath}`);
    console.log('\nTo apply this migration:');
    console.log('\n1. Go to your Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/sql/new');
    console.log('\n2. Copy the contents of the migration file above');
    console.log('\n3. Paste and run in the SQL editor');
    console.log('\nThis migration will:');
    console.log('  • Simplify permissions to view/edit only');
    console.log('  • Create invitations table for non-users');
    console.log('  • Add notification enhancements');
    console.log('  • Create helper functions for user validation');
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

applyMigration();