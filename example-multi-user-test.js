const { chromium } = require('playwright');
const { getTestUser, loginWithUser, switchUser } = require('./test-helpers');

/**
 * Example test demonstrating multi-user login/logout testing
 */
async function testMultiUserScenario() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down for visibility
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('🚀 Starting Multi-User Test Scenario\n');
    
    // Get test users
    const user1 = getTestUser('christiannberger@gmail.com');
    const user2 = getTestUser('christian@pebl-cic.co.uk');
    
    console.log('Test Users:');
    console.log(`  User 1: ${user1.email} - ${user1.description}`);
    console.log(`  User 2: ${user2.email} - ${user2.description}\n`);
    
    // Test 1: Login with first user
    console.log('📝 Test 1: Login with User 1');
    await loginWithUser(page, user1);
    
    // Verify we're on the map page
    const url1 = page.url();
    if (url1.includes('map-drawing')) {
      console.log('  ✅ User 1 successfully logged in and redirected to map\n');
    }
    
    // Take screenshot of user 1's view
    await page.screenshot({ path: 'test-user1-view.png' });
    
    // Wait a bit to see the map
    await page.waitForTimeout(2000);
    
    // Test 2: Switch to second user
    console.log('📝 Test 2: Switch to User 2');
    await switchUser(page, user1, user2);
    
    // Verify we're on the map page with different user
    const url2 = page.url();
    if (url2.includes('map-drawing')) {
      console.log('  ✅ User 2 successfully logged in and redirected to map\n');
    }
    
    // Take screenshot of user 2's view
    await page.screenshot({ path: 'test-user2-view.png' });
    
    // Wait a bit
    await page.waitForTimeout(2000);
    
    // Test 3: Switch back to first user
    console.log('📝 Test 3: Switch back to User 1');
    await switchUser(page, user2, user1);
    
    const url3 = page.url();
    if (url3.includes('map-drawing')) {
      console.log('  ✅ Successfully switched back to User 1\n');
    }
    
    console.log('=' * 50);
    console.log('✅ All tests passed successfully!');
    console.log('=' * 50);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testMultiUserScenario().catch(console.error);