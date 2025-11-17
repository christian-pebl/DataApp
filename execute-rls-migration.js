const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌ Could not extract project ref from Supabase URL');
  process.exit(1);
}

async function executeRLSMigration() {
  console.log('🚀 RLS Security Migration - Generating psql Command');
  console.log('='.repeat(60) + '\n');

  console.log('⚠️  Direct SQL execution via Node.js is not available without database password.');
  console.log('📝 Generating psql command for CLI execution...\n');

  const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20251015095622_enable_rls_security_fixes.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  // Clean SQL (remove comments for inline execution)
  const cleanSQL = migrationSQL
    .split('\n')
    .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
    .join(' ');

  console.log('📋 Option 1: Using psql (requires database password)');
  console.log('='.repeat(60));
  console.log(`psql "postgresql://postgres:[YOUR_DB_PASSWORD]@db.${projectRef}.supabase.co:5432/postgres" -c "${cleanSQL.replace(/"/g, '\\"')}"`);

  console.log('\n📋 Option 2: Using Supabase Dashboard (Recommended)');
  console.log('='.repeat(60));
  console.log(`1. Go to: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log('2. Paste the SQL from: supabase/migrations/20251015095622_enable_rls_security_fixes.sql');
  console.log('3. Click "Run"');

  console.log('\n📋 Option 3: Individual ALTER TABLE commands');
  console.log('='.repeat(60));

  const tables = [
    'lines', 'notifications', 'pin_files', 'projects', 'areas',
    'pin_tags', 'line_tags', 'area_tags', 'tags', 'invitations'
  ];

  tables.forEach((table, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('💡 Recommended: Use Option 2 (Supabase Dashboard)');
  console.log('   It\'s the quickest and most reliable method.');
  console.log('='.repeat(60));
}

executeRLSMigration().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
