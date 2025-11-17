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

async function applyMigrationDirect() {
  try {
    console.log('🚀 Area File Upload Migration');
    console.log('═'.repeat(60));
    console.log('\nThis migration will allow files to be uploaded to areas (polygons)');
    console.log('in addition to pins. Great for multi-location datasets!\n');

    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20251023_add_area_file_support.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Migration SQL Generated');
    console.log('─'.repeat(60));
    console.log('\nCopy and paste the following SQL into your Supabase SQL editor:');
    console.log('👉 https://supabase.com/dashboard/project/tujjhrliibqgstbrohfn/sql/new\n');
    console.log('╔═══════════ START OF SQL ═══════════╗');
    console.log(migrationSQL);
    console.log('╚═══════════ END OF SQL ═════════════╝');

    console.log('\n✨ What this migration does:');
    console.log('  1. ✅ Adds area_id column to pin_files table');
    console.log('  2. ✅ Makes pin_id optional (files can attach to pin OR area)');
    console.log('  3. ✅ Adds constraint to ensure exactly one attachment (pin XOR area)');
    console.log('  4. ✅ Creates performance index for area file queries');
    console.log('  5. ✅ Adds documentation comment');

    console.log('\n📊 Expected Changes:');
    console.log('  • pin_files table: +1 column (area_id)');
    console.log('  • pin_files table: +1 constraint (target_check)');
    console.log('  • pin_files table: +1 index (idx_pin_files_area_id)');

    console.log('\n⚠️  IMPORTANT:');
    console.log('  • Existing pin files are NOT affected');
    console.log('  • All current data remains intact');
    console.log('  • This is a backwards-compatible addition');

    console.log('\n🧪 After running migration, verify with:');
    console.log('─'.repeat(60));
    console.log(`
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'pin_files'
  AND column_name IN ('pin_id', 'area_id')
ORDER BY ordinal_position;
    `.trim());
    console.log('─'.repeat(60));

    console.log('\n✅ Once migration is applied, come back here and press Enter to continue...');

  } catch (error) {
    console.error('Failed to read migration:', error);
    process.exit(1);
  }
}

applyMigrationDirect();
