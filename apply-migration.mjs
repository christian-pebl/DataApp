import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.log('\nRequired variables:');
  console.log('  - NEXT_PUBLIC_SUPABASE_URL');
  console.log('  - SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

console.log('🔗 Connecting to Supabase...');
console.log(`   URL: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

async function runMigration() {
  console.log('\n🚀 Applying migration: 003_add_object_visible.sql\n');

  const sqlStatements = [
    "ALTER TABLE pins ADD COLUMN IF NOT EXISTS object_visible BOOLEAN DEFAULT true",
    "ALTER TABLE lines ADD COLUMN IF NOT EXISTS object_visible BOOLEAN DEFAULT true",
    "ALTER TABLE areas ADD COLUMN IF NOT EXISTS object_visible BOOLEAN DEFAULT true",
    "CREATE INDEX IF NOT EXISTS pins_object_visible_idx ON pins(object_visible)",
    "CREATE INDEX IF NOT EXISTS lines_object_visible_idx ON lines(object_visible)",
    "CREATE INDEX IF NOT EXISTS areas_object_visible_idx ON areas(object_visible)"
  ];

  let successCount = 0;
  let failCount = 0;

  for (const [index, sql] of sqlStatements.entries()) {
    const shortSql = sql.length > 60 ? sql.substring(0, 60) + '...' : sql;
    console.log(`\n[${index + 1}/${sqlStatements.length}] ${shortSql}`);

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql });

      if (error) {
        console.log('   ⚠️  Unable to execute via RPC:', error.message);
        console.log('   ℹ️  This is expected - Supabase doesn\'t allow direct SQL via API');
        failCount++;
      } else {
        console.log('   ✅ Success');
        successCount++;
      }
    } catch (err) {
      console.log('   ⚠️  Error:', err.message);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  if (failCount > 0) {
    console.log('\n❌ Migration could not be applied automatically');
    console.log('\n📋 Please copy and run this SQL in Supabase Dashboard → SQL Editor:\n');
    console.log(sqlStatements.map(s => s + ';').join('\n'));
    console.log('\nTo access SQL Editor:');
    console.log('  1. Go to: ' + supabaseUrl.replace('.supabase.co', '.supabase.co/project/_/sql'));
    console.log('  2. Click "New Query"');
    console.log('  3. Paste the SQL above');
    console.log('  4. Click "Run"\n');
  } else {
    console.log('\n✅ All statements executed successfully!');
  }
  console.log('='.repeat(70) + '\n');
}

runMigration().catch(console.error);
