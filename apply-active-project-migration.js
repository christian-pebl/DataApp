const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔄 Applying active project preference migration...');
  
  try {
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'add-active-project-preference.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL into individual statements (excluding comments and verification query)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('SELECT'))
      .filter(s => !s.includes('information_schema')); // Exclude verification query
    
    console.log(`📄 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}`);
        const { error } = await supabase.rpc('execute_sql', { sql_query: statement });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          throw error;
        }
      }
    }
    
    // Verify the migration worked
    console.log('🔍 Verifying migration...');
    const { data: columns, error: verifyError } = await supabase
      .rpc('execute_sql', { 
        sql_query: `SELECT column_name, data_type, is_nullable 
                   FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' 
                     AND table_schema = 'public' 
                     AND column_name = 'active_project_id'` 
      });
    
    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError);
    } else if (columns && columns.length > 0) {
      console.log('✅ Migration successful! active_project_id column added to user_profiles table');
      console.log('📊 Column details:', columns[0]);
    } else {
      console.log('⚠️  Column may not have been created. Please check manually.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Alternative approach using direct SQL execution
async function applyMigrationDirect() {
  console.log('🔄 Applying migration using direct approach...');
  
  try {
    // Add the column
    const { error: alterError } = await supabase.rpc('execute_sql', {
      sql_query: `ALTER TABLE public.user_profiles 
                  ADD COLUMN IF NOT EXISTS active_project_id TEXT DEFAULT NULL`
    });
    
    if (alterError) {
      console.error('❌ Error adding column:', alterError);
      throw alterError;
    }
    
    console.log('✅ Column added successfully');
    
    // Create index
    const { error: indexError } = await supabase.rpc('execute_sql', {
      sql_query: `CREATE INDEX IF NOT EXISTS idx_user_profiles_active_project 
                  ON public.user_profiles(active_project_id)`
    });
    
    if (indexError) {
      console.error('❌ Error creating index:', indexError);
      throw indexError;
    }
    
    console.log('✅ Index created successfully');
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Direct migration failed:', error.message);
    console.log('💡 You may need to run the SQL manually in Supabase dashboard');
  }
}

// Run the migration
if (process.argv.includes('--direct')) {
  applyMigrationDirect();
} else {
  applyMigration();
}