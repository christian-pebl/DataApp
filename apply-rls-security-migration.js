const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyRLSMigration() {
  try {
    console.log('📋 Reading RLS security migration file...');
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20251015095622_enable_rls_security_fixes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split the migration into individual statements
    // Remove comment-only lines first
    const cleanSQL = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n');

    const statements = cleanSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`\n🔍 Found ${statements.length} SQL statements to execute\n`);
    console.log('Tables to enable RLS on:');
    console.log('  1. lines');
    console.log('  2. notifications');
    console.log('  3. pin_files');
    console.log('  4. projects');
    console.log('  5. areas');
    console.log('  6. pin_tags');
    console.log('  7. line_tags');
    console.log('  8. area_tags');
    console.log('  9. tags');
    console.log(' 10. invitations\n');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Skip pure comment blocks
      if (statement.trim().startsWith('--') || statement.trim().length === 1) {
        continue;
      }

      console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);
      console.log(`   ${statement.substring(0, 80)}...`);

      try {
        // Use raw SQL execution via Supabase
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement
        });

        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          errorCount++;

          // Continue with other statements
          if (!error.message.includes('already enabled') &&
              !error.message.includes('does not exist')) {
            console.log('   Continuing with remaining statements...');
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error in statement ${i + 1}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Total statements: ${statements.length}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    if (errorCount > 0) {
      console.log('\n⚠️  Some statements failed, but this might be expected if:');
      console.log('   - RLS is already enabled on some tables');
      console.log('   - Tables do not exist yet');
      console.log('\n   Check your Supabase dashboard for current RLS status.');
    } else {
      console.log('\n🎉 Migration completed successfully!');
      console.log('   All 10 tables now have RLS enabled.');
      console.log('\n📝 Next steps:');
      console.log('   - Verify RLS status in Supabase Dashboard');
      console.log('   - Add RLS policies for tables that need them');
      console.log('   - Test application functionality');
    }

  } catch (error) {
    console.error('❌ Failed to apply migration:', error);
    process.exit(1);
  }
}

// Alternative: Output SQL for manual execution
async function outputSQLForManualExecution() {
  try {
    console.log('📋 Reading RLS security migration file...\n');
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20251015095622_enable_rls_security_fixes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚠️  Automatic execution not available (exec_sql RPC not found)');
    console.log('📝 Please execute the following SQL manually in your Supabase Dashboard:\n');
    console.log('🔗 Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new\n');
    console.log('='.repeat(80));
    console.log('--- COPY AND PASTE THE SQL BELOW ---\n');
    console.log(migrationSQL);
    console.log('\n--- END OF SQL ---');
    console.log('='.repeat(80));
    console.log('\n✅ After executing the SQL, all 10 tables will have RLS enabled:');
    console.log('   1. lines, 2. notifications, 3. pin_files, 4. projects, 5. areas');
    console.log('   6. pin_tags, 7. line_tags, 8. area_tags, 9. tags, 10. invitations\n');
  } catch (error) {
    console.error('❌ Failed to read migration:', error);
    process.exit(1);
  }
}

// Run the manual SQL output
console.log('🚀 RLS Security Migration');
console.log('='.repeat(50) + '\n');
outputSQLForManualExecution();
