/**
 * Test the new database functions for pin copying
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDatabaseFunctions() {
  console.log('🧪 Testing new database functions...\n');

  try {
    // Sign in as sharer
    const { data: auth } = await supabase.auth.signInWithPassword({
      email: 'christian@pebl-cic.co.uk',
      password: 'Mewslade123@'
    });

    if (!auth?.user) {
      console.error('❌ Authentication failed');
      return;
    }

    console.log('✅ Authenticated as:', auth.user.email);

    // Test 1: Check if user validation function works
    console.log('\n🧪 Test 1: User validation function');
    
    const { data: userCheck, error: userError } = await supabase
      .rpc('check_user_exists_by_email', { 
        user_email: 'christiannberger@gmail.com' 
      });

    if (userError) {
      console.log('❌ User check function not available:', userError.message);
      console.log('💡 Make sure to apply the SQL from fix-pin-copying-rls.sql first');
      return;
    }

    console.log('✅ User validation result:', userCheck);

    // Test 2: Create a test pin to copy
    console.log('\n🧪 Test 2: Creating test pin for copying');
    
    const testPin = {
      user_id: auth.user.id,
      label: `Function Test Pin - ${Date.now()}`,
      notes: 'Test pin for database function testing',
      lat: 51.5074,
      lng: -0.1278,
      label_visible: true,
      project_id: null
    };

    const { data: createdPin, error: createError } = await supabase
      .from('pins')
      .insert([testPin])
      .select()
      .single();

    if (createError) {
      console.log('❌ Pin creation failed:', createError.message);
      return;
    }

    console.log('✅ Test pin created:', createdPin.id);

    // Test 3: Use function to copy pin
    console.log('\n🧪 Test 3: Testing pin copy function');
    
    const { data: copyResult, error: copyError } = await supabase
      .rpc('copy_pin_to_user', {
        original_pin_id: createdPin.id,
        target_user_email: 'christiannberger@gmail.com'
      });

    if (copyError) {
      console.log('❌ Pin copy function failed:', copyError.message);
    } else {
      console.log('✅ Pin copy function result:', copyResult);
      
      if (copyResult?.[0]?.success) {
        console.log('🎉 PIN COPYING WORKS! Copied pin ID:', copyResult[0].copied_pin_id);
        
        // Verify the copy exists
        console.log('\n🔍 Verifying copied pin exists...');
        
        // Sign in as receiver to check
        await supabase.auth.signOut();
        await supabase.auth.signInWithPassword({
          email: 'christiannberger@gmail.com',
          password: 'Mewslade123@'
        });

        const { data: copiedPinCheck, error: checkError } = await supabase
          .from('pins')
          .select('*')
          .eq('id', copyResult[0].copied_pin_id)
          .single();

        if (checkError) {
          console.log('❌ Copied pin verification failed:', checkError.message);
        } else {
          console.log('✅ Copied pin verified in receiver account:', copiedPinCheck.label);
        }

        // Clean up copied pin
        await supabase.from('pins').delete().eq('id', copyResult[0].copied_pin_id);
        console.log('🧹 Copied pin cleaned up');
      } else {
        console.log('❌ Copy function returned failure:', copyResult?.[0]?.message);
      }
    }

    // Clean up original pin
    await supabase.auth.signOut();
    await supabase.auth.signInWithPassword({
      email: 'christian@pebl-cic.co.uk',
      password: 'Mewslade123@'
    });
    
    await supabase.from('pins').delete().eq('id', createdPin.id);
    console.log('🧹 Original test pin cleaned up');

    console.log('\n🎯 CONCLUSION:');
    if (copyResult?.[0]?.success) {
      console.log('✅ Database functions are working! Pin copying is now possible.');
      console.log('🔄 Next: Update the pin-copy-service to use these functions');
    } else {
      console.log('❌ Database functions need debugging');
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

testDatabaseFunctions();