/**
 * Check the actual pins table schema
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkPinsSchema() {
  console.log('🔍 Checking pins table schema...\n');

  try {
    // Sign in with test account
    const { data: auth } = await supabase.auth.signInWithPassword({
      email: 'christian@pebl-cic.co.uk',
      password: 'Mewslade123@'
    });

    if (auth?.user) {
      console.log('✅ Authenticated as:', auth.user.email);
    }

    // Method 1: Try to get existing pins to see actual structure
    console.log('\n📊 Checking existing pins structure:');
    const { data: existingPins, error: pinsError } = await supabase
      .from('pins')
      .select('*')
      .limit(1);

    if (pinsError) {
      console.log('❌ Error getting pins:', pinsError.message);
    } else if (existingPins && existingPins.length > 0) {
      console.log('✅ Found existing pin structure:');
      console.log('Columns:', Object.keys(existingPins[0]));
      console.log('Sample data:', JSON.stringify(existingPins[0], null, 2));
    } else {
      console.log('ℹ️  No existing pins found');
    }

    // Method 2: Try to create a minimal pin to test required columns
    console.log('\n🧪 Testing minimal pin creation:');
    
    const minimalPin = {
      user_id: auth.user.id,
      label: 'Schema Test Pin',
      lat: 51.5074,
      lng: -0.1278
    };

    const { data: createdPin, error: createError } = await supabase
      .from('pins')
      .insert([minimalPin])
      .select()
      .single();

    if (createError) {
      console.log('❌ Minimal pin creation failed:', createError.message);
      console.log('Details:', createError.details);
      console.log('Code:', createError.code);
    } else {
      console.log('✅ Minimal pin created successfully:');
      console.log('Created pin columns:', Object.keys(createdPin));
      console.log('Created pin:', JSON.stringify(createdPin, null, 2));
      
      // Clean up the test pin
      await supabase.from('pins').delete().eq('id', createdPin.id);
      console.log('🧹 Test pin cleaned up');
    }

    // Method 3: Check profiles table for comparison
    console.log('\n📊 Checking profiles table structure:');
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (profiles && profiles.length > 0) {
      console.log('✅ Profile columns:', Object.keys(profiles[0]));
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

checkPinsSchema();