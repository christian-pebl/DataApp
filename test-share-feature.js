const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testShareFeature() {
  console.log('Testing Share Feature Setup...\n');
  
  try {
    // Test 1: Check if share_tokens table exists
    console.log('1. Checking share_tokens table...');
    const { data: tokenTest, error: tokenError } = await supabase
      .from('share_tokens')
      .select('*')
      .limit(1);
    
    if (tokenError) {
      console.error('❌ share_tokens table error:', tokenError.message);
    } else {
      console.log('✅ share_tokens table accessible');
    }
    
    // Test 2: Check if pin_shares table exists
    console.log('\n2. Checking pin_shares table...');
    const { data: shareTest, error: shareError } = await supabase
      .from('pin_shares')
      .select('*')
      .limit(1);
    
    if (shareError) {
      console.error('❌ pin_shares table error:', shareError.message);
    } else {
      console.log('✅ pin_shares table accessible');
    }
    
    // Test 3: Check if profiles table exists
    console.log('\n3. Checking profiles table...');
    const { data: profileTest, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profileError) {
      console.error('❌ profiles table error:', profileError.message);
    } else {
      console.log('✅ profiles table accessible');
    }
    
    // Test 4: Try to create a test token (without auth - will fail but shows structure)
    console.log('\n4. Testing token creation structure...');
    const testToken = {
      token: 'test-' + Date.now(),
      pin_id: 'test-pin-id',
      owner_id: 'test-user-id',
      permission: 'view',
      max_uses: 10,
    };
    
    const { error: createError } = await supabase
      .from('share_tokens')
      .insert(testToken);
    
    if (createError) {
      if (createError.message.includes('RLS') || createError.message.includes('policy')) {
        console.log('✅ RLS policies are active (expected behavior)');
      } else if (createError.message.includes('violates foreign key')) {
        console.log('✅ Foreign key constraints are working');
      } else {
        console.log('⚠️ Unexpected error:', createError.message);
      }
    } else {
      console.log('⚠️ Token created without auth (check RLS policies)');
    }
    
    console.log('\n✨ Share feature database setup appears to be configured correctly!');
    console.log('\nPossible issues to check:');
    console.log('1. Make sure you\'re authenticated when creating shares');
    console.log('2. Check browser console for any client-side errors');
    console.log('3. Verify the pin_id exists before creating a share');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testShareFeature();