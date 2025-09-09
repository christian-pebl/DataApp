const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('📦 Applying sharing tables migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250908_create_sharing_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split the SQL into individual statements (by semicolon)
    const statements = migrationSQL
      .split(/;\s*$/m)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments
      if (statement.trim().startsWith('--')) continue;
      
      // Get a preview of the statement
      const preview = statement.substring(0, 50).replace(/\n/g, ' ');
      console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);

      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement
        }).single();

        if (error) {
          // Try direct execution as fallback
          const { error: directError } = await supabase.from('_sql').insert({ query: statement });
          
          if (directError) {
            console.error(`   ❌ Error: ${directError.message}`);
            errorCount++;
            
            // For certain errors, we might want to continue
            if (directError.message.includes('already exists') || 
                directError.message.includes('duplicate')) {
              console.log('   ⚠️  Continuing despite error (already exists)');
              continue;
            }
          } else {
            console.log('   ✅ Success');
            successCount++;
          }
        } else {
          console.log('   ✅ Success');
          successCount++;
        }
      } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);

    if (errorCount > 0) {
      console.log('\n⚠️  Some statements failed. This might be okay if tables/policies already exist.');
      console.log('   You may need to apply remaining changes manually via Supabase dashboard.');
    } else {
      console.log('\n🎉 Migration completed successfully!');
    }

    // Test the new tables
    console.log('\n🔍 Testing new tables...');
    
    const tables = ['pin_shares', 'share_tokens', 'share_analytics'];
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`   ❌ Table '${table}': Not accessible (${error.message})`);
      } else {
        console.log(`   ✅ Table '${table}': Ready (${count || 0} records)`);
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Alternative: Direct SQL execution for Supabase
async function applyMigrationDirect() {
  console.log('📦 Applying sharing tables migration (Direct SQL)...\n');
  
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250908_create_sharing_tables.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('📋 Migration SQL loaded. Please execute this in your Supabase SQL editor:');
  console.log('   1. Go to: https://supabase.com/dashboard/project/_/sql/new');
  console.log('   2. Paste the SQL from: supabase/migrations/20250908_create_sharing_tables.sql');
  console.log('   3. Click "Run" to execute\n');
  
  console.log('📝 First 500 characters of migration:');
  console.log(migrationSQL.substring(0, 500) + '...\n');
  
  console.log('✅ Once done, the following tables will be created:');
  console.log('   - pin_shares (user-to-user sharing)');
  console.log('   - share_tokens (public link sharing)');
  console.log('   - share_analytics (usage tracking)');
  console.log('   - Updated RLS policies for shared access\n');
}

// Check if we can execute SQL directly
async function checkCapabilities() {
  try {
    const { data, error } = await supabase.rpc('version');
    
    if (error) {
      console.log('ℹ️  Cannot execute SQL directly via RPC.');
      console.log('   Will provide instructions for manual execution.\n');
      return false;
    }
    return true;
  } catch (err) {
    console.log('ℹ️  Cannot execute SQL directly via RPC.');
    console.log('   Will provide instructions for manual execution.\n');
    return false;
  }
}

async function main() {
  console.log('🚀 Supabase Sharing Migration Tool\n');
  
  const canExecute = await checkCapabilities();
  
  if (canExecute) {
    await applyMigration();
  } else {
    await applyMigrationDirect();
  }
}

main().catch(console.error);