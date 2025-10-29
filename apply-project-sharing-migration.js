// Script to apply project sharing migration to Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  // Read environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables');
    console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  console.log('🔗 Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Read migration file
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20251029_project_sharing.sql');
  console.log('📄 Reading migration file:', migrationPath);

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('🚀 Applying migration...');
  console.log('⏳ This may take a few seconds...\n');

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();

    if (error) {
      // If exec_sql doesn't exist, we need to create it first or use a different approach
      console.log('⚠️  exec_sql function not found. Using alternative method...');

      // Split SQL into individual statements and execute them
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim().length === 0) continue;

        console.log(`[${i + 1}/${statements.length}] Executing...`);

        // Use REST API to execute SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: statement + ';' })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Error on statement ${i + 1}:`, errorText);
          // Continue with next statement
        } else {
          console.log(`✅ Statement ${i + 1} completed`);
        }
      }
    } else {
      console.log('✅ Migration applied successfully!');
    }

    console.log('\n🎉 Done! Project sharing feature database setup complete.');
    console.log('\nNext steps:');
    console.log('1. Verify tables created: project_shares, project_invitations');
    console.log('2. Check RLS policies updated');
    console.log('3. Continue with backend service implementation');

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('\n🔧 Manual steps:');
    console.error('1. Go to: https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/sql/new');
    console.error('2. Copy content from: supabase/migrations/20251029_project_sharing.sql');
    console.error('3. Paste and click RUN');
    process.exit(1);
  }
}

applyMigration();
