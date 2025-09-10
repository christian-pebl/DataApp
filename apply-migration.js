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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250909_simplify_sharing_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      // Skip pure comment blocks
      if (statement.trim().startsWith('--') || statement.trim().length === 1) {
        continue;
      }
      
      console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
      console.log(`Statement preview: ${statement.substring(0, 100)}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement
        }).single();
        
        if (error) {
          // Try direct execution if RPC fails
          const { error: directError } = await supabase.from('_sql').select(statement);
          
          if (directError) {
            console.error(`Error in statement ${i + 1}:`, directError.message);
            errorCount++;
            
            // Continue with other statements even if one fails
            if (!directError.message.includes('already exists') && 
                !directError.message.includes('does not exist')) {
              console.log('Continuing with remaining statements...');
            }
          } else {
            console.log(`✓ Statement ${i + 1} executed successfully`);
            successCount++;
          }
        } else {
          console.log(`✓ Statement ${i + 1} executed successfully`);
          successCount++;
        }
      } catch (err) {
        console.error(`Error in statement ${i + 1}:`, err.message);
        errorCount++;
      }
    }
    
    console.log('\n=== Migration Summary ===');
    console.log(`Total statements: ${statements.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (errorCount > 0) {
      console.log('\nNote: Some statements failed, but this might be expected if:');
      console.log('- Tables/columns already exist');
      console.log('- Constraints are already in place');
      console.log('- Functions have been updated');
      console.log('\nThe migration may have partially succeeded. Check your database schema.');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
    
  } catch (error) {
    console.error('Failed to apply migration:', error);
    process.exit(1);
  }
}

// Alternative approach using direct SQL execution
async function applyMigrationDirect() {
  try {
    console.log('Attempting direct migration application...');
    console.log('Note: This will need to be done through Supabase dashboard SQL editor');
    
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250909_simplify_sharing_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('\n=== Migration SQL Generated ===');
    console.log('Copy and paste the following SQL into your Supabase SQL editor:');
    console.log('(https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/sql/new)\n');
    console.log('--- START OF SQL ---');
    console.log(migrationSQL);
    console.log('--- END OF SQL ---');
    
    console.log('\nOnce applied, the following changes will be made:');
    console.log('1. Simplified permissions to view/edit only');
    console.log('2. Removed expiration dates from shares');
    console.log('3. Added invitations table for non-users');
    console.log('4. Enhanced notifications with read status');
    console.log('5. Added helper functions for user validation');
    
  } catch (error) {
    console.error('Failed to read migration:', error);
    process.exit(1);
  }
}

// Try direct approach since we don't have exec_sql RPC
applyMigrationDirect();