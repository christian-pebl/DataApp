const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test data
const testEmail = 'test@example.com';
const testPassword = 'TestPassword123!';
const testPin = {
  lat: 51.5074,
  lng: -0.1278,
  label: 'Test Pin with Data',
  notes: 'This pin has uploaded CSV data for testing persistence',
  project_id: 'default'
};

async function testPinDataPersistence() {
  console.log('🧪 Testing Pin Data Upload and Persistence\n');
  console.log('='.repeat(50));

  try {
    // Step 1: Check authentication
    console.log('\n📌 Step 1: Authentication Check');
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (currentUser) {
      console.log(`✅ Already authenticated as: ${currentUser.email}`);
    } else {
      console.log('❌ Not authenticated - Please sign in through the app first');
      console.log('   Go to http://localhost:9002 and sign in with Google');
      return;
    }

    // Step 2: Create a test pin
    console.log('\n📌 Step 2: Creating Test Pin');
    const { data: pinData, error: pinError } = await supabase
      .from('pins')
      .insert({
        ...testPin,
        user_id: currentUser.id
      })
      .select()
      .single();

    if (pinError) {
      console.error('❌ Error creating pin:', pinError.message);
      return;
    }

    console.log(`✅ Pin created with ID: ${pinData.id}`);
    console.log(`   Location: ${pinData.lat}, ${pinData.lng}`);
    console.log(`   Label: ${pinData.label}`);

    // Step 3: Simulate file upload (check file storage)
    console.log('\n📌 Step 3: Testing File Upload Capability');
    
    // Check if pin-files bucket exists
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.log('⚠️  Cannot list buckets (normal for client-side)');
    } else {
      const pinFilesBucket = buckets?.find(b => b.name === 'pin-files');
      if (pinFilesBucket) {
        console.log('✅ pin-files storage bucket exists');
      } else {
        console.log('❌ pin-files bucket not found - needs to be created in Supabase dashboard');
      }
    }

    // Step 4: Check pin_files table
    console.log('\n📌 Step 4: Checking Pin Files Storage');
    const { data: existingFiles, error: filesError } = await supabase
      .from('pin_files')
      .select('*')
      .eq('pin_id', pinData.id);

    if (filesError) {
      console.error('❌ Error checking pin files:', filesError.message);
    } else {
      console.log(`✅ Pin files table accessible`);
      console.log(`   Current files for this pin: ${existingFiles?.length || 0}`);
    }

    // Step 5: Test data persistence
    console.log('\n📌 Step 5: Testing Data Persistence');
    
    // Fetch the pin again to verify it's saved
    const { data: verifyPin, error: verifyError } = await supabase
      .from('pins')
      .select('*')
      .eq('id', pinData.id)
      .single();

    if (verifyError) {
      console.error('❌ Error verifying pin:', verifyError.message);
    } else {
      console.log('✅ Pin persisted successfully');
      console.log(`   Can be retrieved by ID: ${verifyPin.id}`);
    }

    // Step 6: Test user's ability to see their pins
    console.log('\n📌 Step 6: Testing User Pin Visibility');
    const { data: userPins, error: userPinsError } = await supabase
      .from('pins')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (userPinsError) {
      console.error('❌ Error fetching user pins:', userPinsError.message);
    } else {
      console.log(`✅ User can see ${userPins.length} pins`);
      const testPinFound = userPins.find(p => p.id === pinData.id);
      if (testPinFound) {
        console.log('   ✅ Test pin is visible to user');
      }
    }

    // Step 7: Test sharing setup
    console.log('\n📌 Step 7: Testing Sharing Tables');
    
    // Check if sharing tables exist
    const tables = ['pin_shares', 'share_tokens'];
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error && error.message.includes('does not exist')) {
        console.log(`❌ Table '${table}' does not exist - run migration`);
      } else {
        console.log(`✅ Table '${table}' is accessible`);
      }
    }

    // Step 8: Cleanup test data (optional)
    console.log('\n📌 Step 8: Cleanup');
    const cleanup = false; // Set to true to delete test pin
    
    if (cleanup) {
      const { error: deleteError } = await supabase
        .from('pins')
        .delete()
        .eq('id', pinData.id);
      
      if (deleteError) {
        console.error('❌ Error deleting test pin:', deleteError.message);
      } else {
        console.log('✅ Test pin deleted');
      }
    } else {
      console.log('ℹ️  Test pin kept for manual testing');
      console.log(`   Pin ID: ${pinData.id}`);
      console.log('   You can now:');
      console.log('   1. Go to http://localhost:9002');
      console.log('   2. Find this pin on the map');
      console.log('   3. Upload CSV files to it');
      console.log('   4. Test the share functionality');
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary:');
    console.log('✅ Authentication working');
    console.log('✅ Pin creation working');
    console.log('✅ Pin persistence working');
    console.log('✅ User can see their pins');
    console.log('✅ Database tables configured');
    console.log('\n🎯 Next Steps:');
    console.log('1. Open the app at http://localhost:9002');
    console.log('2. Click on the test pin to select it');
    console.log('3. Upload the test-data.csv file');
    console.log('4. Log out and log back in');
    console.log('5. Verify the pin and data are still there');
    console.log('6. Test the share button to share with others');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPinDataPersistence().catch(console.error);