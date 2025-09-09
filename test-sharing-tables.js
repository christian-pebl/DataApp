const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSharingTables() {
  console.log('🔍 Testing Sharing Tables Setup\n');

  const tables = [
    { name: 'pin_shares', description: 'User-to-user pin sharing' },
    { name: 'share_tokens', description: 'Public link sharing' },
    { name: 'share_analytics', description: 'Share usage tracking' }
  ];

  let allTablesExist = true;

  for (const table of tables) {
    try {
      // Try to query the table (will fail if table doesn't exist or RLS blocks it)
      const { data, error, count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.log(`❌ Table '${table.name}': Does not exist`);
          console.log(`   Description: ${table.description}`);
          allTablesExist = false;
        } else if (error.message.includes('permission denied') || error.code === 'PGRST301') {
          // This is actually good - table exists but RLS is working
          console.log(`✅ Table '${table.name}': Exists (RLS active)`);
          console.log(`   Description: ${table.description}`);
        } else {
          console.log(`⚠️  Table '${table.name}': Exists but has issues`);
          console.log(`   Error: ${error.message}`);
        }
      } else {
        console.log(`✅ Table '${table.name}': Accessible`);
        console.log(`   Description: ${table.description}`);
        console.log(`   Current records: ${count || 0}`);
      }
    } catch (err) {
      console.log(`❌ Table '${table.name}': Error checking`);
      console.log(`   Error: ${err.message}`);
      allTablesExist = false;
    }
  }

  console.log('\n' + '='.repeat(50));
  
  if (allTablesExist) {
    console.log('✅ All sharing tables are set up correctly!');
    console.log('\n📝 Next Steps:');
    console.log('1. The app is running at http://localhost:9002');
    console.log('2. Create or select a pin on the map');
    console.log('3. Click the share button (next to delete) to open the sharing dialog');
    console.log('4. You can share with specific users or create public links');
  } else {
    console.log('❌ Some tables are missing!');
    console.log('\n📝 To fix this:');
    console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy the contents of: supabase/migrations/20250908_create_sharing_tables.sql');
    console.log('4. Paste and run the SQL in the editor');
    console.log('5. Run this test again to verify');
  }

  // Test authentication
  console.log('\n🔐 Testing Authentication:');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (user) {
    console.log(`✅ Authenticated as: ${user.email || user.id}`);
  } else {
    console.log('❌ Not authenticated - Sign in to test sharing features');
  }
}

testSharingTables().catch(console.error);