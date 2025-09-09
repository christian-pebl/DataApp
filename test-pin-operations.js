const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create two clients - one with anon key (user), one with service role (admin)
const userClient = createClient(supabaseUrl, supabaseAnonKey);
const adminClient = createClient(supabaseUrl, serviceRoleKey);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

async function checkTableStructure() {
  console.log(`\n${colors.cyan}=== CHECKING TABLE STRUCTURE ===${colors.reset}\n`);
  
  // Get pins table columns using admin client
  const { data: pins, error } = await adminClient
    .from('pins')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error(`${colors.red}❌ Error checking pins table:${colors.reset}`, error.message);
    return false;
  }
  
  console.log(`${colors.green}✅ Pins table exists and is accessible${colors.reset}`);
  
  if (pins && pins.length > 0) {
    console.log('\nPin table columns:');
    Object.keys(pins[0]).forEach(key => {
      console.log(`  - ${key}: ${typeof pins[0][key]}`);
    });
  }
  
  return true;
}

async function checkRLSPolicies() {
  console.log(`\n${colors.cyan}=== CHECKING RLS POLICIES ===${colors.reset}\n`);
  
  // Query to check RLS policies directly
  let policies, error;
  try {
    const result = await adminClient
      .rpc('get_policies', { schema_name: 'public', table_name: 'pins' });
    policies = result.data;
    error = result.error;
  } catch (err) {
    error = err;
    policies = null;
  }
  
  if (!error && policies) {
    console.log('RLS Policies found:');
    policies.forEach(policy => {
      console.log(`  - ${policy.policyname}: ${policy.cmd}`);
    });
  } else {
    console.log(`${colors.yellow}⚠️  Could not fetch RLS policies directly${colors.reset}`);
    console.log('Will test policies by attempting operations...\n');
  }
  
  return true;
}

async function testUserAuthentication(email, password) {
  console.log(`\n${colors.cyan}=== TESTING USER AUTHENTICATION ===${colors.reset}\n`);
  
  // Sign in with test account
  const { data: authData, error: authError } = await userClient.auth.signInWithPassword({
    email,
    password
  });
  
  if (authError) {
    console.error(`${colors.red}❌ Authentication failed:${colors.reset}`, authError.message);
    return null;
  }
  
  console.log(`${colors.green}✅ User authenticated successfully${colors.reset}`);
  console.log(`User ID: ${authData.user.id}`);
  console.log(`Email: ${authData.user.email}`);
  
  return authData.user;
}

async function testPinCreation(user) {
  console.log(`\n${colors.cyan}=== TESTING PIN CREATION ===${colors.reset}\n`);
  
  if (!user) {
    console.log(`${colors.yellow}⚠️  No authenticated user, skipping pin creation test${colors.reset}`);
    return null;
  }
  
  const testPin = {
    user_id: user.id,
    label: `Test Pin ${Date.now()}`,
    lat: 51.5074,
    lng: -0.1278,
    notes: 'Test pin for validating operations',
    label_visible: true
  };
  
  console.log(`Creating test pin: "${testPin.label}"`);
  console.log(`Location: ${testPin.lat}, ${testPin.lng}`);
  
  const { data: createdPin, error: createError } = await userClient
    .from('pins')
    .insert([testPin])
    .select()
    .single();
  
  if (createError) {
    console.error(`${colors.red}❌ Pin creation failed:${colors.reset}`, createError.message);
    console.error('Error details:', JSON.stringify(createError, null, 2));
    
    // Try without user_id (should be auto-set by RLS)
    console.log('\nRetrying without explicit user_id...');
    const pinWithoutUserId = { ...testPin };
    delete pinWithoutUserId.user_id;
    
    const { data: retryPin, error: retryError } = await userClient
      .from('pins')
      .insert([pinWithoutUserId])
      .select()
      .single();
    
    if (retryError) {
      console.error(`${colors.red}❌ Retry also failed:${colors.reset}`, retryError.message);
      return null;
    }
    
    console.log(`${colors.green}✅ Pin created successfully without explicit user_id${colors.reset}`);
    console.log(`Pin ID: ${retryPin.id}`);
    return retryPin;
  }
  
  console.log(`${colors.green}✅ Pin created successfully${colors.reset}`);
  console.log(`Pin ID: ${createdPin.id}`);
  
  return createdPin;
}

async function testPinUpdate(pinId, user) {
  console.log(`\n${colors.cyan}=== TESTING PIN UPDATE ===${colors.reset}\n`);
  
  if (!pinId || !user) {
    console.log(`${colors.yellow}⚠️  No pin or user available for update test${colors.reset}`);
    return false;
  }
  
  const updateData = {
    label: `Updated Pin ${Date.now()}`,
    notes: 'Updated via test script'
  };
  
  console.log(`Updating pin ${pinId.substring(0, 8)}...`);
  console.log(`New label: "${updateData.label}"`);
  
  // First, try update with explicit user_id check
  const { data: updatedPin, error: updateError } = await userClient
    .from('pins')
    .update(updateData)
    .eq('id', pinId)
    .eq('user_id', user.id)
    .select()
    .single();
  
  if (updateError) {
    console.error(`${colors.red}❌ Pin update with user_id check failed:${colors.reset}`, updateError.message);
    
    // Try without user_id check (RLS should handle it)
    console.log('\nRetrying without explicit user_id check...');
    const { data: retryUpdate, error: retryError } = await userClient
      .from('pins')
      .update(updateData)
      .eq('id', pinId)
      .select()
      .single();
    
    if (retryError) {
      console.error(`${colors.red}❌ Retry also failed:${colors.reset}`, retryError.message);
      
      // Check if pin exists and ownership
      const { data: checkPin } = await adminClient
        .from('pins')
        .select('*')
        .eq('id', pinId)
        .single();
        
      if (!checkPin) {
        console.error(`${colors.red}Pin not found in database${colors.reset}`);
      } else {
        console.log('\nPin details from admin check:');
        console.log(`  Pin user_id: ${checkPin.user_id}`);
        console.log(`  Current user_id: ${user.id}`);
        console.log(`  Match: ${checkPin.user_id === user.id ? 'YES' : 'NO'}`);
      }
      return false;
    }
    
    console.log(`${colors.green}✅ Pin updated successfully without user_id check${colors.reset}`);
    return true;
  }
  
  console.log(`${colors.green}✅ Pin updated successfully${colors.reset}`);
  console.log(`New label: ${updatedPin.label}`);
  return true;
}

async function testPinPersistence(user) {
  console.log(`\n${colors.cyan}=== TESTING PIN PERSISTENCE ===${colors.reset}\n`);
  
  if (!user) {
    console.log(`${colors.yellow}⚠️  No authenticated user, skipping persistence test${colors.reset}`);
    return;
  }
  
  // Get all pins for the user before logout
  const { data: userPins, error: fetchError } = await userClient
    .from('pins')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (fetchError) {
    console.error(`${colors.red}❌ Failed to fetch user pins:${colors.reset}`, fetchError.message);
    return;
  }
  
  console.log(`${colors.green}✅ Found ${userPins.length} pins for user before logout${colors.reset}`);
  
  if (userPins.length > 0) {
    console.log('\nRecent pins:');
    userPins.slice(0, 3).forEach(pin => {
      console.log(`  - ${pin.label || '(unnamed)'} (ID: ${pin.id.substring(0, 8)}...)`);
    });
  }
  
  // Sign out
  console.log(`\n${colors.blue}📤 Signing out...${colors.reset}`);
  await userClient.auth.signOut();
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Sign back in
  console.log(`${colors.blue}📥 Signing back in...${colors.reset}`);
  const { data: reAuthData, error: reAuthError } = await userClient.auth.signInWithPassword({
    email: user.email,
    password: 'Mewslade123@' // Using the known password
  });
  
  if (reAuthError) {
    console.error(`${colors.red}❌ Re-authentication failed:${colors.reset}`, reAuthError.message);
    return;
  }
  
  // Check pins again
  const { data: persistedPins, error: persistError } = await userClient
    .from('pins')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (persistError) {
    console.error(`${colors.red}❌ Failed to fetch pins after re-login:${colors.reset}`, persistError.message);
    return;
  }
  
  console.log(`\n${colors.green}✅ After re-login: Found ${persistedPins.length} pins${colors.reset}`);
  
  if (userPins.length === persistedPins.length) {
    console.log(`${colors.green}✅ Pin count matches - persistence verified!${colors.reset}`);
    
    // Verify pin names persisted
    const pinNamesMatch = userPins.every(pin => 
      persistedPins.some(p => p.id === pin.id && p.label === pin.label)
    );
    
    if (pinNamesMatch) {
      console.log(`${colors.green}✅ All pin names persisted correctly${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️  Some pin names may have changed${colors.reset}`);
    }
  } else {
    console.error(`${colors.red}❌ Pin count mismatch: ${userPins.length} before, ${persistedPins.length} after${colors.reset}`);
  }
}

async function testPinSharing(pinId, user) {
  console.log(`\n${colors.cyan}=== TESTING PIN SHARING ===${colors.reset}\n`);
  
  if (!pinId || !user) {
    console.log(`${colors.yellow}⚠️  No pin or user available for sharing test${colors.reset}`);
    return;
  }
  
  console.log(`${colors.yellow}Note: The pins table doesn't have a shared_settings column.${colors.reset}`);
  console.log(`${colors.yellow}Pin sharing might be handled through a separate table or mechanism.${colors.reset}`);
  
  // Test accessing the pin
  console.log('\nVerifying pin can be accessed...');
  const { data: sharedPin, error: sharedError } = await userClient
    .from('pins')
    .select('*')
    .eq('id', pinId)
    .single();
  
  if (sharedError) {
    console.error(`${colors.red}❌ Failed to access pin:${colors.reset}`, sharedError.message);
  } else {
    console.log(`${colors.green}✅ Pin accessible by owner${colors.reset}`);
    console.log(`Pin details: ${sharedPin.label} (${sharedPin.id.substring(0, 8)}...)`);
  }
}

async function cleanupTestPins(user) {
  console.log(`\n${colors.cyan}=== CLEANING UP TEST PINS ===${colors.reset}\n`);
  
  if (!user) {
    console.log(`${colors.yellow}⚠️  No user available for cleanup${colors.reset}`);
    return;
  }
  
  const { data: testPins, error: fetchError } = await userClient
    .from('pins')
    .select('id, label')
    .eq('user_id', user.id)
    .or('label.ilike.%Test Pin%,label.ilike.%Updated Pin%');
  
  if (fetchError) {
    console.error(`${colors.red}❌ Failed to fetch test pins:${colors.reset}`, fetchError.message);
    return;
  }
  
  if (!testPins || testPins.length === 0) {
    console.log('No test pins to clean up');
    return;
  }
  
  console.log(`Found ${testPins.length} test pins to clean up`);
  
  for (const pin of testPins) {
    const { error } = await userClient
      .from('pins')
      .delete()
      .eq('id', pin.id);
    
    if (error) {
      console.error(`${colors.red}❌ Failed to delete pin ${pin.label}:${colors.reset}`, error.message);
    } else {
      console.log(`${colors.green}✅ Deleted: ${pin.label}${colors.reset}`);
    }
  }
}

async function runAllTests() {
  console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}     COMPREHENSIVE PIN OPERATIONS TEST${colors.reset}`);
  console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}`);
  
  try {
    // Check table structure
    const tableOk = await checkTableStructure();
    if (!tableOk) {
      console.error(`${colors.red}Cannot proceed - table structure check failed${colors.reset}`);
      return;
    }
    
    // Check RLS policies
    await checkRLSPolicies();
    
    // Authenticate user
    const user = await testUserAuthentication('christiannberger@gmail.com', 'Mewslade123@');
    
    if (user) {
      // Create a test pin
      const createdPin = await testPinCreation(user);
      
      if (createdPin) {
        // Test pin update
        const updateSuccess = await testPinUpdate(createdPin.id, user);
        
        // Test pin sharing
        await testPinSharing(createdPin.id, user);
      }
      
      // Test persistence
      await testPinPersistence(user);
      
      // Cleanup
      await cleanupTestPins(user);
    }
    
    console.log(`\n${colors.blue}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.green}✅ All tests completed!${colors.reset}`);
    console.log(`\n${colors.cyan}Key findings:${colors.reset}`);
    console.log('1. Check if pins table has proper RLS policies');
    console.log('2. Verify user_id is correctly set on pin creation');
    console.log('3. Ensure update operations check ownership');
    console.log('4. Validate sharing settings are properly stored');
    
  } catch (error) {
    console.error(`\n${colors.red}❌ Test suite failed:${colors.reset}`, error);
  } finally {
    // Sign out at the end
    await userClient.auth.signOut();
    console.log(`\n${colors.blue}📤 Signed out. Test session ended.${colors.reset}`);
  }
}

// Run the tests
runAllTests();