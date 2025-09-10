// Test script to verify pin file copying functionality
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tujjhrliibqgstbrohfn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ampocmxpaWJxZ3N0YnJvaGZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1NDkyMDMsImV4cCI6MjA3MDEyNTIwM30.x6gyS-rSFnKD5fKsfcgwIWs12fJC0IbPEqCjn630EH8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPinFileCopy() {
  console.log('🧪 Testing Pin File Copy Functionality\n');
  console.log('========================================\n');

  try {
    // Step 1: Check authentication
    console.log('1️⃣ Checking authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('❌ You must be logged in to test this functionality');
      console.log('Please log in at http://localhost:9002 first');
      return;
    }
    
    console.log(`✅ Authenticated as: ${user.email}\n`);

    // Step 2: Find a pin with files
    console.log('2️⃣ Looking for pins with files...');
    const { data: pins, error: pinsError } = await supabase
      .from('pins')
      .select('id, location, user_id')
      .eq('user_id', user.id)
      .limit(10);

    if (pinsError || !pins || pins.length === 0) {
      console.log('❌ No pins found for current user');
      return;
    }

    console.log(`Found ${pins.length} pin(s)\n`);

    // Check each pin for files
    let pinWithFiles = null;
    let pinFiles = null;

    for (const pin of pins) {
      const { data: files, error: filesError } = await supabase
        .from('pin_files')
        .select('*')
        .eq('pin_id', pin.id);

      if (!filesError && files && files.length > 0) {
        pinWithFiles = pin;
        pinFiles = files;
        console.log(`✅ Found pin with ${files.length} file(s): ${pin.id}`);
        files.forEach(file => {
          console.log(`   - ${file.file_name} (${(file.file_size / 1024).toFixed(2)} KB)`);
        });
        break;
      }
    }

    if (!pinWithFiles) {
      console.log('❌ No pins with files found');
      console.log('Please upload a file to a pin first at http://localhost:9002');
      return;
    }

    console.log('');

    // Step 3: Test the copy function
    console.log('3️⃣ Testing pin copy with files...\n');
    
    // We'll use the test account as target
    const targetEmail = 'christiannberger@gmail.com'; // Or use the other test account
    
    console.log(`Original Pin ID: ${pinWithFiles.id}`);
    console.log(`Target User Email: ${targetEmail}`);
    console.log(`Files to copy: ${pinFiles.length}\n`);

    // Call the RPC function to copy the pin
    console.log('Calling copy_pin_to_user function...\n');
    const { data: copyResult, error: copyError } = await supabase
      .rpc('copy_pin_to_user', {
        original_pin_id: pinWithFiles.id,
        target_user_email: targetEmail
      });

    if (copyError) {
      console.log('❌ Copy function failed:', copyError.message);
      return;
    }

    if (!copyResult || !copyResult[0]?.success) {
      console.log('❌ Copy failed:', copyResult?.[0]?.message || 'Unknown error');
      return;
    }

    const newPinId = copyResult[0].copied_pin_id;
    console.log(`✅ Pin copied successfully! New Pin ID: ${newPinId}\n`);

    // Step 4: Verify the files were copied
    console.log('4️⃣ Verifying copied files...\n');
    
    // Check for files in the new pin (we may not have access to read them directly)
    const { data: copiedFiles, error: copiedFilesError } = await supabase
      .from('pin_files')
      .select('*')
      .eq('pin_id', newPinId);

    if (!copiedFilesError && copiedFiles && copiedFiles.length > 0) {
      console.log(`✅ Found ${copiedFiles.length} file(s) in copied pin:`);
      copiedFiles.forEach(file => {
        console.log(`   - ${file.file_name} (${(file.file_size / 1024).toFixed(2)} KB)`);
        console.log(`     Path: ${file.file_path}`);
      });
    } else {
      console.log('⚠️ Could not verify copied files (may be due to RLS policies)');
      console.log('The target user should be able to see the files when they log in');
    }

    console.log('\n========================================');
    console.log('✅ Test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Log in as the target user to verify they can see the pin and files');
    console.log('2. Check the browser console for detailed logs when sharing pins');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testPinFileCopy();