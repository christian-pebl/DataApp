const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function checkSystemStatus() {
  console.log('🔍 System Status Check\n');
  console.log('='.repeat(50));
  
  const checks = {
    app: false,
    auth: false,
    database: false,
    storage: false,
    sharing: false
  };

  // 1. Check if app is running
  console.log('\n📱 Application Status:');
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://localhost:9002');
    if (response.ok) {
      checks.app = true;
      console.log('✅ App is running at http://localhost:9002');
    }
  } catch (error) {
    console.log('❌ App is not accessible');
  }

  // 2. Check Supabase connection
  console.log('\n🔌 Supabase Connection:');
  if (supabaseUrl && supabaseAnonKey) {
    console.log('✅ Credentials configured');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // 3. Check authentication
    console.log('\n🔐 Authentication:');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      checks.auth = true;
      console.log(`✅ Logged in as: ${user.email}`);
    } else {
      console.log('❌ Not authenticated');
    }

    // 4. Check database tables
    console.log('\n💾 Database Tables:');
    const tables = [
      { name: 'pins', required: true },
      { name: 'projects', required: true },
      { name: 'pin_files', required: true },
      { name: 'pin_shares', required: false },
      { name: 'share_tokens', required: false }
    ];

    let allRequired = true;
    let sharingEnabled = true;
    
    for (const table of tables) {
      const { error } = await supabase.from(table.name).select('*').limit(1);
      
      if (error && error.message.includes('does not exist')) {
        console.log(`❌ Table '${table.name}' does not exist`);
        if (table.required) allRequired = false;
        if (!table.required) sharingEnabled = false;
      } else {
        console.log(`✅ Table '${table.name}' exists`);
      }
    }
    
    checks.database = allRequired;
    checks.sharing = sharingEnabled;

    // 5. Check storage
    console.log('\n📦 Storage Status:');
    try {
      // Try to list files (will fail if bucket doesn't exist)
      const { data, error } = await supabase.storage.from('pin-files').list('test', { limit: 1 });
      if (!error || error.message.includes('not found')) {
        checks.storage = true;
        console.log('✅ Storage bucket configured');
      } else {
        console.log('⚠️  Storage bucket may need configuration');
      }
    } catch {
      console.log('⚠️  Cannot verify storage status');
    }
  } else {
    console.log('❌ Supabase credentials missing');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 System Summary:\n');
  
  const status = Object.entries(checks).map(([key, value]) => {
    const labels = {
      app: 'Application',
      auth: 'Authentication',
      database: 'Database',
      storage: 'File Storage',
      sharing: 'Sharing System'
    };
    return `${value ? '✅' : '❌'} ${labels[key]}: ${value ? 'Ready' : 'Needs Setup'}`;
  });
  
  status.forEach(s => console.log(s));
  
  const allReady = Object.values(checks).every(v => v);
  
  console.log('\n' + (allReady ? '🎉 System is fully operational!' : '⚠️  Some components need configuration'));
  
  if (!allReady) {
    console.log('\n📝 Next Steps:');
    if (!checks.auth) {
      console.log('1. Sign in at http://localhost:9002');
    }
    if (!checks.sharing) {
      console.log('2. Apply sharing migration in Supabase SQL editor');
    }
    if (!checks.storage) {
      console.log('3. Create pin-files bucket in Supabase Storage');
    }
  }
}

checkSystemStatus().catch(console.error);