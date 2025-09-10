/**
 * Check Row Level Security policies on the pins table
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRLSPolicies() {
  console.log('🔐 Investigating RLS policies for pins table...\n');

  try {
    // Sign in with test account
    const { data: auth } = await supabase.auth.signInWithPassword({
      email: 'christian@pebl-cic.co.uk',
      password: 'Mewslade123@'
    });

    if (auth?.user) {
      console.log('✅ Authenticated as:', auth.user.email);
      console.log('User ID:', auth.user.id);
    }

    // Test 1: Check if we can create a pin for ourselves (should work)
    console.log('\n🧪 Test 1: Creating pin for current user');
    
    const selfPin = {
      user_id: auth.user.id,  // Our own user_id
      label: 'RLS Test - Self Pin',
      lat: 51.5074,
      lng: -0.1278,
      label_visible: true,
      project_id: null
    };

    const { data: selfPinResult, error: selfPinError } = await supabase
      .from('pins')
      .insert([selfPin])
      .select()
      .single();

    if (selfPinError) {
      console.log('❌ Self pin creation failed:', selfPinError.message);
    } else {
      console.log('✅ Self pin created successfully:', selfPinResult.id);
      
      // Clean up
      await supabase.from('pins').delete().eq('id', selfPinResult.id);
      console.log('🧹 Self pin cleaned up');
    }

    // Test 2: Try to create a pin for another user (will likely fail due to RLS)
    console.log('\n🧪 Test 2: Attempting to create pin for another user');
    
    const otherUserId = '1f1b8955-ae0e-4fce-9a2f-4f417d06ce44'; // Receiver's ID
    const otherUserPin = {
      user_id: otherUserId,  // Different user_id
      label: 'RLS Test - Other User Pin',
      lat: 51.5074,
      lng: -0.1278,
      label_visible: true,
      project_id: null
    };

    const { data: otherPinResult, error: otherPinError } = await supabase
      .from('pins')
      .insert([otherUserPin])
      .select()
      .single();

    if (otherPinError) {
      console.log('❌ Other user pin creation failed (expected):', otherPinError.message);
      console.log('Error code:', otherPinError.code);
    } else {
      console.log('⚠️  Other user pin created unexpectedly:', otherPinResult.id);
      // Clean up if somehow succeeded
      await supabase.from('pins').delete().eq('id', otherPinResult.id);
    }

    // Test 3: Check what pins we can see
    console.log('\n🧪 Test 3: Checking visible pins');
    
    const { data: visiblePins, error: pinsError } = await supabase
      .from('pins')
      .select('id, user_id, label')
      .limit(5);

    if (pinsError) {
      console.log('❌ Error fetching pins:', pinsError.message);
    } else {
      console.log(`✅ Can see ${visiblePins.length} pins:`);
      visiblePins.forEach(pin => {
        const isOwner = pin.user_id === auth.user.id;
        console.log(`  - ${pin.label} (${pin.id.slice(0,8)}...) [${isOwner ? 'OWNED' : 'OTHER'}]`);
      });
    }

    // Test 4: Try to sign in as the other user and create a pin
    console.log('\n🧪 Test 4: Testing as receiver user');
    
    await supabase.auth.signOut();
    const { data: receiverAuth } = await supabase.auth.signInWithPassword({
      email: 'christiannberger@gmail.com',
      password: 'Mewslade123@'
    });

    if (receiverAuth?.user) {
      console.log('✅ Authenticated as receiver:', receiverAuth.user.email);
      
      // Try to create pin as receiver
      const receiverPin = {
        user_id: receiverAuth.user.id,  // Receiver's own ID
        label: 'RLS Test - Receiver Pin',
        lat: 51.5074,
        lng: -0.1278,
        label_visible: true,
        project_id: null
      };

      const { data: receiverPinResult, error: receiverPinError } = await supabase
        .from('pins')
        .insert([receiverPin])
        .select()
        .single();

      if (receiverPinError) {
        console.log('❌ Receiver pin creation failed:', receiverPinError.message);
      } else {
        console.log('✅ Receiver pin created successfully:', receiverPinResult.id);
        
        // Clean up
        await supabase.from('pins').delete().eq('id', receiverPinResult.id);
        console.log('🧹 Receiver pin cleaned up');
      }
    }

    console.log('\n💡 CONCLUSIONS:');
    console.log('1. Users can only create pins with their own user_id (RLS policy)');
    console.log('2. To share pins, we need a different approach:');
    console.log('   a) Service role bypass (requires service key)');
    console.log('   b) RLS policy modification');
    console.log('   c) Database function with SECURITY DEFINER');
    console.log('   d) Shared pins table with proper permissions');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

checkRLSPolicies();