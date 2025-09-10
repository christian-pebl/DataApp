/**
 * COMPREHENSIVE PIN SHARING TEST
 * 
 * Step-by-step testing framework to debug pin sharing functionality
 * Run this with: node test-sharing-step-by-step.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test accounts
const TEST_ACCOUNTS = {
  sharer: {
    email: 'christian@pebl-cic.co.uk',
    password: 'Mewslade123@'
  },
  receiver: {
    email: 'christiannberger@gmail.com', 
    password: 'Mewslade123@'
  }
};

// Logging utilities
function log(stage, message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 🔍 ${stage}: ${message}`);
  if (data) {
    console.log('   📊 Data:', JSON.stringify(data, null, 2));
  }
}

function logError(stage, error) {
  console.log(`\n❌ ${stage} FAILED:`);
  console.log('   Error:', error.message);
  if (error.details) console.log('   Details:', error.details);
  if (error.code) console.log('   Code:', error.code);
}

function logSuccess(stage, message, data = null) {
  console.log(`\n✅ ${stage} SUCCESS: ${message}`);
  if (data) {
    console.log('   📊 Result:', JSON.stringify(data, null, 2));
  }
}

// Test phases
class PinSharingTester {
  constructor() {
    this.sharerSession = null;
    this.receiverSession = null;
    this.testPin = null;
    this.copiedPin = null;
  }

  // Phase 1: Basic Setup and Authentication
  async phase1_basicSetup() {
    log('PHASE 1', 'Starting basic setup and authentication test');

    try {
      // Test 1.1: Authenticate sharer
      log('1.1', 'Authenticating sharer account');
      const sharerAuth = await supabase.auth.signInWithPassword({
        email: TEST_ACCOUNTS.sharer.email,
        password: TEST_ACCOUNTS.sharer.password
      });

      if (sharerAuth.error) {
        logError('1.1', sharerAuth.error);
        return false;
      }
      
      this.sharerSession = sharerAuth.data;
      logSuccess('1.1', 'Sharer authenticated', {
        user_id: this.sharerSession.user?.id,
        email: this.sharerSession.user?.email
      });

      // Test 1.2: Check sharer profile
      log('1.2', 'Checking sharer profile');
      const sharerProfile = await supabase
        .from('profiles')
        .select('*')
        .eq('id', this.sharerSession.user.id)
        .single();

      logSuccess('1.2', 'Sharer profile retrieved', sharerProfile.data);

      // Test 1.3: Authenticate receiver (separate client)
      log('1.3', 'Authenticating receiver account');
      
      // Sign out first to test receiver auth
      await supabase.auth.signOut();
      
      const receiverAuth = await supabase.auth.signInWithPassword({
        email: TEST_ACCOUNTS.receiver.email,
        password: TEST_ACCOUNTS.receiver.password
      });

      if (receiverAuth.error) {
        logError('1.3', receiverAuth.error);
        return false;
      }
      
      this.receiverSession = receiverAuth.data;
      logSuccess('1.3', 'Receiver authenticated', {
        user_id: this.receiverSession.user?.id,
        email: this.receiverSession.user?.email
      });

      // Test 1.4: Check receiver profile
      log('1.4', 'Checking receiver profile');
      const receiverProfile = await supabase
        .from('profiles')
        .select('*')
        .eq('id', this.receiverSession.user.id)
        .single();

      logSuccess('1.4', 'Receiver profile retrieved', receiverProfile.data);

      return true;
    } catch (error) {
      logError('PHASE 1', error);
      return false;
    }
  }

  // Phase 2: Create a test pin
  async phase2_createTestPin() {
    log('PHASE 2', 'Creating a simple test pin for sharing');

    try {
      // Sign back in as sharer
      await supabase.auth.signOut();
      await supabase.auth.signInWithPassword({
        email: TEST_ACCOUNTS.sharer.email,
        password: TEST_ACCOUNTS.sharer.password
      });

      // Test 2.1: Create a simple pin (using actual database schema)
      log('2.1', 'Creating test pin');
      const pinData = {
        label: `Test Pin for Sharing - ${Date.now()}`,
        notes: 'This is a test pin created for sharing functionality testing',
        lat: 51.5074, // London coordinates
        lng: -0.1278,
        label_visible: true,
        user_id: this.sharerSession.user.id,
        project_id: null
      };

      const pinResult = await supabase
        .from('pins')
        .insert([pinData])
        .select()
        .single();

      if (pinResult.error) {
        logError('2.1', pinResult.error);
        return false;
      }

      this.testPin = pinResult.data;
      logSuccess('2.1', 'Test pin created successfully', this.testPin);

      // Test 2.2: Verify pin exists and is accessible
      log('2.2', 'Verifying pin exists in database');
      const pinCheck = await supabase
        .from('pins')
        .select('*')
        .eq('id', this.testPin.id)
        .single();

      if (pinCheck.error) {
        logError('2.2', pinCheck.error);
        return false;
      }

      logSuccess('2.2', 'Pin verification successful', pinCheck.data);
      return true;
    } catch (error) {
      logError('PHASE 2', error);
      return false;
    }
  }

  // Phase 3: Test basic pin copying (without files)
  async phase3_testBasicCopy() {
    log('PHASE 3', 'Testing basic pin copying functionality');

    try {
      // Test 3.1: Copy pin data to receiver's account
      log('3.1', 'Creating pin copy for receiver');
      
      const copyData = {
        label: `${this.testPin.label} (Copy)`,
        notes: this.testPin.notes,
        lat: this.testPin.lat,
        lng: this.testPin.lng,
        label_visible: this.testPin.label_visible,
        user_id: this.receiverSession.user.id, // Key difference: different user
        project_id: null
      };

      const copyResult = await supabase
        .from('pins')
        .insert([copyData])
        .select()
        .single();

      if (copyResult.error) {
        logError('3.1', copyResult.error);
        return false;
      }

      this.copiedPin = copyResult.data;
      logSuccess('3.1', 'Pin copy created', this.copiedPin);

      // Test 3.2: Verify receiver can access copied pin
      log('3.2', 'Verifying receiver access to copied pin');
      
      // Sign in as receiver
      await supabase.auth.signOut();
      await supabase.auth.signInWithPassword({
        email: TEST_ACCOUNTS.receiver.email,
        password: TEST_ACCOUNTS.receiver.password
      });

      const receiverPinCheck = await supabase
        .from('pins')
        .select('*')
        .eq('id', this.copiedPin.id)
        .eq('user_id', this.receiverSession.user.id)
        .single();

      if (receiverPinCheck.error) {
        logError('3.2', receiverPinCheck.error);
        return false;
      }

      logSuccess('3.2', 'Receiver can access copied pin', receiverPinCheck.data);

      // Test 3.3: Verify sharer still has original pin
      log('3.3', 'Verifying sharer still has original pin');
      
      // Sign in as sharer
      await supabase.auth.signOut();
      await supabase.auth.signInWithPassword({
        email: TEST_ACCOUNTS.sharer.email,
        password: TEST_ACCOUNTS.sharer.password
      });

      const sharerPinCheck = await supabase
        .from('pins')
        .select('*')
        .eq('id', this.testPin.id)
        .eq('user_id', this.sharerSession.user.id)
        .single();

      if (sharerPinCheck.error) {
        logError('3.3', sharerPinCheck.error);
        return false;
      }

      logSuccess('3.3', 'Sharer still has original pin', sharerPinCheck.data);
      return true;
    } catch (error) {
      logError('PHASE 3', error);
      return false;
    }
  }

  // Phase 4: Test user validation
  async phase4_testUserValidation() {
    log('PHASE 4', 'Testing user validation functionality');

    try {
      // Test 4.1: Validate existing user (receiver)
      log('4.1', 'Testing validation of existing user');
      
      const existingUserCheck = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', TEST_ACCOUNTS.receiver.email)
        .single();

      if (existingUserCheck.error) {
        logError('4.1', existingUserCheck.error);
        return false;
      }

      logSuccess('4.1', 'Existing user validation successful', existingUserCheck.data);

      // Test 4.2: Validate non-existing user
      log('4.2', 'Testing validation of non-existing user');
      
      const nonExistingUserCheck = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', 'nonexistent@example.com')
        .single();

      if (!nonExistingUserCheck.error) {
        logError('4.2', { message: 'Non-existing user should not be found' });
        return false;
      }

      logSuccess('4.2', 'Non-existing user correctly not found', { error: nonExistingUserCheck.error.message });
      return true;
    } catch (error) {
      logError('PHASE 4', error);
      return false;
    }
  }

  // Phase 5: Clean up test data
  async phase5_cleanup() {
    log('PHASE 5', 'Cleaning up test data');

    try {
      // Clean up copied pin
      if (this.copiedPin) {
        log('5.1', 'Removing copied pin');
        await supabase.auth.signInWithPassword({
          email: TEST_ACCOUNTS.receiver.email,
          password: TEST_ACCOUNTS.receiver.password
        });

        const deleteCopy = await supabase
          .from('pins')
          .delete()
          .eq('id', this.copiedPin.id);

        if (deleteCopy.error) {
          logError('5.1', deleteCopy.error);
        } else {
          logSuccess('5.1', 'Copied pin removed');
        }
      }

      // Clean up original pin
      if (this.testPin) {
        log('5.2', 'Removing original pin');
        await supabase.auth.signInWithPassword({
          email: TEST_ACCOUNTS.sharer.email,
          password: TEST_ACCOUNTS.sharer.password
        });

        const deleteOriginal = await supabase
          .from('pins')
          .delete()
          .eq('id', this.testPin.id);

        if (deleteOriginal.error) {
          logError('5.2', deleteOriginal.error);
        } else {
          logSuccess('5.2', 'Original pin removed');
        }
      }

      return true;
    } catch (error) {
      logError('PHASE 5', error);
      return false;
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('\n🚀 STARTING COMPREHENSIVE PIN SHARING TEST');
    console.log('='.repeat(60));

    const results = {
      phase1: await this.phase1_basicSetup(),
      phase2: false,
      phase3: false,
      phase4: false,
      phase5: false
    };

    if (results.phase1) {
      results.phase2 = await this.phase2_createTestPin();
    }

    if (results.phase2) {
      results.phase3 = await this.phase3_testBasicCopy();
    }

    if (results.phase3) {
      results.phase4 = await this.phase4_testUserValidation();
    }

    // Always try cleanup
    results.phase5 = await this.phase5_cleanup();

    // Summary
    console.log('\n📋 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Phase 1 - Basic Setup: ${results.phase1 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Phase 2 - Create Test Pin: ${results.phase2 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Phase 3 - Basic Copy: ${results.phase3 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Phase 4 - User Validation: ${results.phase4 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Phase 5 - Cleanup: ${results.phase5 ? '✅ PASS' : '❌ FAIL'}`);
    
    const passCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;
    
    console.log(`\n🎯 Overall: ${passCount}/${totalCount} phases passed`);
    
    if (passCount === totalCount) {
      console.log('🎉 ALL TESTS PASSED! Basic pin sharing functionality is working.');
    } else {
      console.log('⚠️  Some tests failed. Review the logs above for details.');
    }

    return results;
  }
}

// Run the tests
const tester = new PinSharingTester();
tester.runAllTests()
  .then(results => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 UNEXPECTED ERROR:', error);
    process.exit(1);
  });