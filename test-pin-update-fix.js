const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const userClient = createClient(supabaseUrl, supabaseAnonKey);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function testPinUpdateFix() {
  console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}     TESTING PIN UPDATE FIX${colors.reset}`);
  console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}\n`);
  
  try {
    // Authenticate
    console.log(`${colors.cyan}1. Authenticating...${colors.reset}`);
    const { data: authData, error: authError } = await userClient.auth.signInWithPassword({
      email: 'christiannberger@gmail.com',
      password: 'Mewslade123@'
    });
    
    if (authError) {
      console.error(`${colors.red}❌ Authentication failed:${colors.reset}`, authError.message);
      return;
    }
    
    console.log(`${colors.green}✅ Authenticated as:${colors.reset} ${authData.user.email}`);
    
    // Generate a random UUID for a "local" pin
    const localPinId = crypto.randomUUID();
    console.log(`\n${colors.cyan}2. Testing update of non-existent pin (simulating local pin)${colors.reset}`);
    console.log(`Pin ID: ${localPinId}`);
    
    // Try to update a pin that doesn't exist in the database
    const { data: updateResult, error: updateError } = await userClient
      .from('pins')
      .update({
        label: 'Updated Local Pin',
        updated_at: new Date().toISOString()
      })
      .eq('id', localPinId)
      .eq('user_id', authData.user.id)
      .select();
    
    console.log(`\n${colors.cyan}Update Result:${colors.reset}`);
    console.log(`- Rows updated: ${updateResult?.length || 0}`);
    console.log(`- Error: ${updateError ? updateError.message : 'None'}`);
    
    if (updateResult && updateResult.length === 0) {
      console.log(`${colors.yellow}⚠️  No rows updated (expected - pin doesn't exist)${colors.reset}`);
      
      // Now test the fallback creation
      console.log(`\n${colors.cyan}3. Testing fallback pin creation${colors.reset}`);
      
      const { data: createResult, error: createError } = await userClient
        .from('pins')
        .insert({
          id: localPinId,
          lat: 51.5074,
          lng: -0.1278,
          label: 'Fallback Created Pin',
          user_id: authData.user.id,
          label_visible: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        console.log(`${colors.red}❌ Fallback creation failed:${colors.reset}`, createError.message);
      } else {
        console.log(`${colors.green}✅ Pin created successfully as fallback${colors.reset}`);
        console.log(`Pin: ${createResult.label} (${createResult.id.substring(0, 8)}...)`);
        
        // Clean up
        console.log(`\n${colors.cyan}4. Cleaning up test pin${colors.reset}`);
        const { error: deleteError } = await userClient
          .from('pins')
          .delete()
          .eq('id', localPinId);
        
        if (deleteError) {
          console.error(`${colors.yellow}⚠️  Cleanup failed:${colors.reset}`, deleteError.message);
        } else {
          console.log(`${colors.green}✅ Test pin deleted${colors.reset}`);
        }
      }
    }
    
    // Test updating an existing pin
    console.log(`\n${colors.cyan}5. Testing update of existing pin${colors.reset}`);
    
    // First create a pin
    const { data: newPin, error: newPinError } = await userClient
      .from('pins')
      .insert({
        lat: 51.5074,
        lng: -0.1278,
        label: 'Test Pin for Update',
        user_id: authData.user.id,
        label_visible: true
      })
      .select()
      .single();
    
    if (newPinError) {
      console.error(`${colors.red}❌ Failed to create test pin:${colors.reset}`, newPinError.message);
    } else {
      console.log(`${colors.green}✅ Created test pin:${colors.reset} ${newPin.label}`);
      
      // Now update it
      const { data: updated, error: updateErr } = await userClient
        .from('pins')
        .update({
          label: 'Successfully Updated Pin',
          updated_at: new Date().toISOString()
        })
        .eq('id', newPin.id)
        .eq('user_id', authData.user.id)
        .select()
        .single();
      
      if (updateErr) {
        console.error(`${colors.red}❌ Update failed:${colors.reset}`, updateErr.message);
      } else {
        console.log(`${colors.green}✅ Pin updated successfully:${colors.reset} ${updated.label}`);
      }
      
      // Clean up
      await userClient
        .from('pins')
        .delete()
        .eq('id', newPin.id);
      console.log(`${colors.green}✅ Test pin cleaned up${colors.reset}`);
    }
    
  } catch (error) {
    console.error(`${colors.red}❌ Test failed:${colors.reset}`, error);
  } finally {
    await userClient.auth.signOut();
    console.log(`\n${colors.blue}📤 Signed out. Test completed.${colors.reset}`);
  }
}

// Run the test
testPinUpdateFix();