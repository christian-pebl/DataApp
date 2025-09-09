const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFileRetention() {
  console.log('🔍 Testing File Retention System\n');
  console.log('================================\n');

  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('❌ Not authenticated. Please log in first.');
      return;
    }

    console.log(`✅ Authenticated as user: ${user.email} (${user.id})\n`);

    // Check all pins for this user
    console.log('📍 Fetching user pins...');
    const { data: pins, error: pinsError } = await supabase
      .from('pins')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (pinsError) {
      console.error('❌ Error fetching pins:', pinsError);
      return;
    }

    console.log(`Found ${pins?.length || 0} pins for this user\n`);

    // For each pin, check associated files
    for (const pin of (pins || [])) {
      console.log(`\n📌 Pin: ${pin.title || 'Untitled'} (ID: ${pin.id})`);
      console.log(`   Created: ${new Date(pin.created_at).toLocaleString()}`);
      
      // Get files for this pin
      const { data: files, error: filesError } = await supabase
        .from('pin_files')
        .select('*')
        .eq('pin_id', pin.id)
        .order('uploaded_at', { ascending: false });

      if (filesError) {
        console.error(`   ❌ Error fetching files for pin ${pin.id}:`, filesError);
        continue;
      }

      if (!files || files.length === 0) {
        console.log('   📁 No files uploaded to this pin');
      } else {
        console.log(`   📁 Files (${files.length}):`);
        
        for (const file of files) {
          console.log(`\n      📄 ${file.file_name}`);
          console.log(`         - ID: ${file.id}`);
          console.log(`         - Path: ${file.file_path}`);
          console.log(`         - Size: ${(file.file_size / 1024).toFixed(2)} KB`);
          console.log(`         - Type: ${file.file_type}`);
          console.log(`         - Uploaded: ${new Date(file.uploaded_at).toLocaleString()}`);
          
          // Check if the file actually exists in storage
          console.log(`         - Checking storage...`);
          const { data: storageData, error: storageError } = await supabase.storage
            .from('pin-files')
            .list(file.file_path.split('/').slice(0, -1).join('/'), {
              search: file.file_path.split('/').pop()
            });

          if (storageError) {
            console.log(`         ⚠️  Storage check error:`, storageError.message);
          } else if (storageData && storageData.length > 0) {
            console.log(`         ✅ File exists in storage`);
          } else {
            console.log(`         ❌ File NOT found in storage!`);
          }
        }
      }
    }

    // Check for orphaned files (files without corresponding pins)
    console.log('\n\n🔍 Checking for orphaned files...');
    const { data: allFiles, error: allFilesError } = await supabase
      .from('pin_files')
      .select(`
        *,
        pins!inner(user_id)
      `)
      .eq('pins.user_id', user.id);

    if (allFilesError) {
      console.error('❌ Error checking for orphaned files:', allFilesError);
    } else {
      console.log(`Total files in database for user: ${allFiles?.length || 0}`);
      
      // Group files by pin_id
      const filesByPin = {};
      for (const file of (allFiles || [])) {
        if (!filesByPin[file.pin_id]) {
          filesByPin[file.pin_id] = [];
        }
        filesByPin[file.pin_id].push(file);
      }
      
      console.log(`Files are distributed across ${Object.keys(filesByPin).length} pins`);
    }

    // Check storage bucket for any files
    console.log('\n\n🗄️ Checking storage bucket...');
    const { data: storageList, error: storageListError } = await supabase.storage
      .from('pin-files')
      .list('pins', {
        limit: 100,
        offset: 0
      });

    if (storageListError) {
      console.error('❌ Error listing storage:', storageListError);
    } else {
      console.log(`Found ${storageList?.length || 0} items in storage bucket under 'pins/' directory`);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testFileRetention();