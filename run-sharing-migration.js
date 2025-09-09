const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Use service key if available, otherwise use anon key
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.log('Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('🔧 Using Supabase URL:', supabaseUrl);
console.log('🔑 Using key type:', supabaseServiceKey ? 'Service Role Key' : 'Anon Key');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function runMigration() {
  console.log('\n🚀 Starting Sharing Feature Migration...\n');
  
  const migrations = [
    {
      name: 'Create profiles table',
      sql: `
        CREATE TABLE IF NOT EXISTS profiles (
          id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
          email TEXT UNIQUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
    },
    {
      name: 'Create share_tokens table',
      sql: `
        CREATE TABLE IF NOT EXISTS share_tokens (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          token VARCHAR(255) UNIQUE NOT NULL,
          pin_id UUID REFERENCES pins(id) ON DELETE CASCADE,
          owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
          password_hash TEXT,
          max_uses INTEGER,
          used_count INTEGER DEFAULT 0,
          expires_at TIMESTAMPTZ,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          last_used_at TIMESTAMPTZ
        )
      `
    },
    {
      name: 'Create pin_shares table',
      sql: `
        CREATE TABLE IF NOT EXISTS pin_shares (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
          owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          shared_with_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
          shared_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(pin_id, shared_with_id)
        )
      `
    },
    {
      name: 'Enable RLS on profiles',
      sql: `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY`
    },
    {
      name: 'Enable RLS on share_tokens',
      sql: `ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY`
    },
    {
      name: 'Enable RLS on pin_shares',
      sql: `ALTER TABLE pin_shares ENABLE ROW LEVEL SECURITY`
    },
    {
      name: 'Create profile read policy',
      sql: `
        CREATE POLICY "Users can read all profiles" ON profiles
        FOR SELECT USING (true)
      `
    },
    {
      name: 'Create profile update policy',
      sql: `
        CREATE POLICY "Users can update own profile" ON profiles
        FOR UPDATE USING (auth.uid() = id)
      `
    },
    {
      name: 'Create share_tokens insert policy',
      sql: `
        CREATE POLICY "Users can create their own share tokens" ON share_tokens
        FOR INSERT WITH CHECK (auth.uid() = owner_id)
      `
    },
    {
      name: 'Create share_tokens select policy',
      sql: `
        CREATE POLICY "Users can view their own share tokens" ON share_tokens
        FOR SELECT USING (auth.uid() = owner_id OR is_active = true)
      `
    },
    {
      name: 'Create share_tokens update policy',
      sql: `
        CREATE POLICY "Users can update their own share tokens" ON share_tokens
        FOR UPDATE USING (auth.uid() = owner_id)
      `
    },
    {
      name: 'Create share_tokens delete policy',
      sql: `
        CREATE POLICY "Users can delete their own share tokens" ON share_tokens
        FOR DELETE USING (auth.uid() = owner_id)
      `
    },
    {
      name: 'Create pin_shares insert policy',
      sql: `
        CREATE POLICY "Users can create shares for their pins" ON pin_shares
        FOR INSERT WITH CHECK (auth.uid() = owner_id)
      `
    },
    {
      name: 'Create pin_shares select policy',
      sql: `
        CREATE POLICY "Users can view shares they created or received" ON pin_shares
        FOR SELECT USING (auth.uid() = owner_id OR auth.uid() = shared_with_id)
      `
    },
    {
      name: 'Create pin_shares update policy',
      sql: `
        CREATE POLICY "Users can update their own shares" ON pin_shares
        FOR UPDATE USING (auth.uid() = owner_id)
      `
    },
    {
      name: 'Create pin_shares delete policy',
      sql: `
        CREATE POLICY "Users can delete their own shares" ON pin_shares
        FOR DELETE USING (auth.uid() = owner_id)
      `
    },
    {
      name: 'Create handle_new_user function',
      sql: `
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS trigger AS $$
        BEGIN
          INSERT INTO public.profiles (id, email)
          VALUES (new.id, new.email)
          ON CONFLICT (id) DO NOTHING;
          RETURN new;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER
      `
    },
    {
      name: 'Create auth trigger',
      sql: `
        CREATE OR REPLACE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()
      `
    },
    {
      name: 'Populate existing users',
      sql: `
        INSERT INTO profiles (id, email)
        SELECT id, email FROM auth.users
        ON CONFLICT (id) DO NOTHING
      `
    }
  ];

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  // Unfortunately, Supabase JS client doesn't support raw SQL execution
  // We need to test table existence instead
  console.log('⚠️  Note: Direct SQL execution via JS client is limited.');
  console.log('📋 Testing table creation by querying them...\n');

  // Test if tables exist by trying to query them
  const tablesToTest = ['profiles', 'share_tokens', 'pin_shares'];
  
  for (const table of tablesToTest) {
    try {
      console.log(`Testing ${table} table...`);
      const { error } = await supabase.from(table).select('*').limit(1);
      
      if (error) {
        if (error.message.includes('not find the table')) {
          console.log(`❌ Table '${table}' does not exist`);
          errorCount++;
          errors.push(`Table '${table}' needs to be created`);
        } else {
          console.log(`✅ Table '${table}' exists (may have RLS restrictions)`);
          successCount++;
        }
      } else {
        console.log(`✅ Table '${table}' exists and is accessible`);
        successCount++;
      }
    } catch (err) {
      console.log(`❌ Error testing ${table}:`, err.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Migration Test Results:`);
  console.log(`   ✅ Tables found: ${successCount}`);
  console.log(`   ❌ Tables missing: ${errorCount}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Missing tables need to be created manually:');
    errors.forEach(err => console.log(`   - ${err}`));
    
    console.log('\n📝 MANUAL STEPS REQUIRED:');
    console.log('1. Go to: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Click "SQL Editor" in the sidebar');
    console.log('4. Copy the SQL from the file: supabase/sharing_feature_migration.sql');
    console.log('5. Paste and run it in the SQL Editor');
    console.log('\n💡 The complete SQL migration has been saved to:');
    console.log('   C:\\Users\\Christian Abulhawa\\DeployApp\\supabase\\sharing_feature_migration.sql');
  } else {
    console.log('\n✨ All sharing tables are present!');
    console.log('   The sharing feature should now work.');
  }
}

runMigration().catch(console.error);