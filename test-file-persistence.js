const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test accounts
const testAccounts = [
  { email: 'cj@pebl.co.uk', password: 'password123' },
  { email: 'ja@pebl.co.uk', password: 'password456' }
];

async function testFileOperations() {
  console.log('🔍 Testing File Persistence for Pin Uploads\n');
  console.log('=' .repeat(50));

  for (const account of testAccounts) {
    console.log(`\n📧 Testing with account: ${account.email}`);
    console.log('-'.repeat(40));

    try {
      // 1. Sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password
      });

      if (authError) {
        console.error(`❌ Login failed: ${authError.message}`);
        continue;
      }

      console.log(`✅ Logged in successfully`);
      const userId = authData.user.id;

      // 2. Get user's pins
      const { data: pins, error: pinsError } = await supabase
        .from('pins')
        .select('id, label, coordinates')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (pinsError) {
        console.error(`❌ Error fetching pins: ${pinsError.message}`);
        continue;
      }

      console.log(`📍 Found ${pins?.length || 0} pins for this user`);

      if (pins && pins.length > 0) {
        // 3. Check files for each pin
        for (const pin of pins.slice(0, 3)) { // Check first 3 pins
          console.log(`\n  Pin: ${pin.label || 'Unnamed'} (${pin.id})`);
          
          // Check pin_files table
          const { data: files, error: filesError } = await supabase
            .from('pin_files')
            .select('*')
            .eq('pin_id', pin.id)
            .order('uploaded_at', { ascending: false });

          if (filesError) {
            console.error(`    ❌ Error fetching files: ${filesError.message}`);
          } else if (files && files.length > 0) {
            console.log(`    📎 Found ${files.length} file(s):`);
            files.forEach(file => {
              console.log(`      - ${file.file_name} (${(file.file_size / 1024).toFixed(2)} KB)`);
              console.log(`        Path: ${file.file_path}`);
              console.log(`        Uploaded: ${new Date(file.uploaded_at).toLocaleString()}`);
            });

            // 4. Check if files exist in storage
            for (const file of files) {
              const { data: storageData, error: storageError } = await supabase.storage
                .from('pin-files')
                .download(file.file_path);

              if (storageError) {
                console.error(`        ⚠️ Storage issue: ${storageError.message}`);
              } else {
                console.log(`        ✅ File exists in storage (${storageData.size} bytes)`);
              }
            }
          } else {
            console.log(`    📭 No files attached to this pin`);
          }
        }
      }

      // 5. Check storage bucket directly
      console.log(`\n📦 Checking storage bucket for user's files...`);
      const { data: bucketFiles, error: bucketError } = await supabase.storage
        .from('pin-files')
        .list('pins', {
          limit: 100,
          offset: 0
        });

      if (bucketError) {
        console.error(`❌ Error listing bucket: ${bucketError.message}`);
      } else {
        console.log(`Found ${bucketFiles?.length || 0} folders/files in bucket`);
      }

      // 6. Sign out
      await supabase.auth.signOut();
      console.log(`👋 Signed out\n`);

    } catch (error) {
      console.error(`❌ Unexpected error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 File persistence test complete');
  console.log('\nNext steps:');
  console.log('1. Upload a CSV file to a pin using the UI');
  console.log('2. Run this script again to see if the file persists');
  console.log('3. Check the browser console for any errors during upload');
}

testFileOperations();