const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test account details
const testEmail = 'testuser@gmail.com';
const testPassword = 'TestPassword123!';

async function createTestAccount() {
  console.log('🔐 Creating Test Account for Automated Testing\n');
  console.log('='.repeat(50));
  
  try {
    // Try to sign up
    console.log('\n📌 Step 1: Creating new test account');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });
    
    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        console.log('   ℹ️  Account already exists, trying to sign in...');
        
        // Try to sign in instead
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword,
        });
        
        if (signInError) {
          console.error('   ❌ Sign in failed:', signInError.message);
          return null;
        }
        
        console.log('   ✅ Successfully signed in with existing account');
        return signInData;
      } else {
        console.error('   ❌ Sign up failed:', signUpError.message);
        return null;
      }
    }
    
    console.log('   ✅ Account created successfully');
    
    // Check if email confirmation is required
    if (signUpData.user && !signUpData.session) {
      console.log('\n   ⚠️  Email confirmation required!');
      console.log('   Please check your email and confirm the account.');
      console.log('   Or disable email confirmation in Supabase dashboard:');
      console.log('   1. Go to Authentication → Settings');
      console.log('   2. Disable "Enable email confirmations"');
      return signUpData;
    }
    
    return signUpData;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

async function testAuthentication() {
  console.log('\n📌 Step 2: Testing Authentication');
  
  // Try to sign in
  const { data, error } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  
  if (error) {
    console.error('   ❌ Authentication failed:', error.message);
    return false;
  }
  
  console.log('   ✅ Authentication successful');
  console.log(`   User ID: ${data.user.id}`);
  console.log(`   Email: ${data.user.email}`);
  
  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    console.log('   ✅ Session active');
    console.log(`   Access token: ${session.access_token.substring(0, 20)}...`);
  }
  
  return true;
}

async function createTestPin() {
  console.log('\n📌 Step 3: Creating Test Pin');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('   ❌ Not authenticated');
    return null;
  }
  
  const testPin = {
    lat: 51.5074,
    lng: -0.1278,
    label: 'Test Pin for Automation',
    notes: 'Created by automated test script',
    user_id: user.id,
    project_id: 'default',
    label_visible: true
  };
  
  const { data, error } = await supabase
    .from('pins')
    .insert(testPin)
    .select()
    .single();
  
  if (error) {
    console.error('   ❌ Failed to create pin:', error.message);
    return null;
  }
  
  console.log('   ✅ Pin created successfully');
  console.log(`   Pin ID: ${data.id}`);
  console.log(`   Location: ${data.lat}, ${data.lng}`);
  
  return data;
}

async function listUserPins() {
  console.log('\n📌 Step 4: Listing User Pins');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('   ❌ Not authenticated');
    return;
  }
  
  const { data: pins, error } = await supabase
    .from('pins')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('   ❌ Failed to fetch pins:', error.message);
    return;
  }
  
  console.log(`   ✅ Found ${pins.length} pins`);
  pins.forEach((pin, index) => {
    console.log(`   ${index + 1}. ${pin.label} (${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)})`);
  });
}

async function main() {
  console.log('🚀 Test Account Setup\n');
  
  // Create or sign in to test account
  await createTestAccount();
  
  // Test authentication
  const authenticated = await testAuthentication();
  
  if (authenticated) {
    // Create a test pin
    const pin = await createTestPin();
    
    // List all pins
    await listUserPins();
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Test Setup Complete!\n');
    console.log('📝 You can now use these credentials in the browser:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log('\n🎯 Next Steps:');
    console.log('1. Go to http://localhost:9002/auth');
    console.log('2. Enter the test credentials');
    console.log('3. Click "Sign in"');
    console.log('4. You should see the map with test pins');
    console.log('5. Test file upload and sharing features');
  } else {
    console.log('\n❌ Authentication setup failed');
    console.log('   Please check Supabase configuration');
  }
}

main().catch(console.error);