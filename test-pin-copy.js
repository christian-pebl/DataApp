// Test script for the simplified pin copy service
import { pinCopyService } from './src/lib/supabase/pin-copy-service.js';

console.log('🧪 Testing Pin Copy Service...');

// Test data
const testPinId = 'test-pin-id'; // Replace with actual pin ID
const testEmail = 'christian@pebl-cic.co.uk'; // Test email

async function testPinCopy() {
  try {
    console.log('📌 Starting pin copy test...');
    console.log('Original Pin ID:', testPinId);
    console.log('Target Email:', testEmail);
    
    const result = await pinCopyService.copyPinToUser(
      testPinId,
      testEmail,
      (progress) => {
        console.log('\n📊 Progress Update:');
        progress.forEach((step, index) => {
          const status = step.status === 'success' ? '✅' : 
                        step.status === 'error' ? '❌' : 
                        step.status === 'in-progress' ? '⏳' : '⏸️';
          console.log(`  ${index + 1}. ${status} ${step.step}: ${step.message}`);
          if (step.details) {
            console.log(`     Details: ${JSON.stringify(step.details, null, 2)}`);
          }
        });
      }
    );
    
    console.log('\n🎯 Final Result:');
    console.log('Success:', result.success);
    if (result.success) {
      console.log('✅ Copied Pin ID:', result.copiedPinId);
      console.log('📋 Total Steps:', result.progress.length);
    } else {
      console.log('❌ Error:', result.error);
      console.log('📋 Failed Steps:', result.progress.filter(s => s.status === 'error').length);
    }
    
  } catch (error) {
    console.error('💥 Test Error:', error);
  }
}

// Run the test
testPinCopy();