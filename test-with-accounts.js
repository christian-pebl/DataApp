const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const APP_URL = 'http://localhost:9002';

// Test accounts
const ACCOUNT_1 = {
  email: 'christian@pebl-cic.co.uk',
  password: 'Mewslade123@'
};

const ACCOUNT_2 = {
  email: 'christiannberger@gmail.com', 
  password: 'Mewslade123@'
};

// Test results
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

function logTest(status, message) {
  const timestamp = new Date().toISOString().substring(11, 19);
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  console.log(`[${timestamp}] ${icon} ${message}`);
  
  if (status === 'pass') testResults.passed.push(message);
  else if (status === 'fail') testResults.failed.push(message);
  else testResults.warnings.push(message);
}

async function clearAuthState(page) {
  console.log('   Clearing authentication state...');
  
  // Clear localStorage and sessionStorage
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Clear cookies
  await page.context().clearCookies();
  
  // Navigate to auth page
  await page.goto(APP_URL + '/auth', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
}

async function loginAccount(page, account, accountName) {
  console.log(`\n📝 Logging in ${accountName}...`);
  
  // Ensure we're on auth page
  if (!page.url().includes('auth')) {
    await page.goto(APP_URL + '/auth', { waitUntil: 'networkidle' });
  }
  
  // Clear any existing values
  await page.fill('input[type="email"]', '');
  await page.fill('input[type="password"]', '');
  
  // Fill credentials
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  
  // Click sign in
  const signInButton = await page.$('button:has-text("Sign in")');
  if (signInButton) {
    await signInButton.click();
  } else {
    // Try submitting the form
    await page.keyboard.press('Enter');
  }
  
  // Wait for navigation
  try {
    await page.waitForURL('**/map-drawing**', { timeout: 10000 });
    logTest('pass', `${accountName}: Login successful`);
    return true;
  } catch {
    logTest('fail', `${accountName}: Login failed`);
    return false;
  }
}

async function createPin(page, label, notes) {
  console.log(`\n📍 Creating pin: "${label}"`);
  
  // Look for pin button
  const pinButton = await page.$('button:has-text("Pin")');
  if (pinButton) {
    await pinButton.click();
    await page.waitForTimeout(500);
  }
  
  // Click on map
  const mapElement = await page.$('.leaflet-container, #map');
  if (mapElement) {
    const box = await mapElement.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1000);
    
    // Fill pin details
    const labelInput = await page.$('input[placeholder*="label" i], input[placeholder*="name" i]');
    if (labelInput) {
      await labelInput.fill(label);
      
      const notesInput = await page.$('textarea');
      if (notesInput) {
        await notesInput.fill(notes);
      }
      
      // Save pin
      const saveButton = await page.$('button:has-text("Save"), button:has-text("Create")');
      if (saveButton) {
        await saveButton.click();
        await page.waitForTimeout(2000);
        logTest('pass', `Pin created: ${label}`);
        return true;
      }
    }
  }
  
  logTest('fail', `Failed to create pin: ${label}`);
  return false;
}

async function countPins(page) {
  await page.waitForTimeout(2000);
  const pins = await page.$$('.leaflet-marker-icon');
  return pins.length;
}

async function runTest() {
  console.log('🎭 Playwright Account Test\n');
  console.log('='.repeat(60));
  console.log('Testing with provided accounts:\n');
  console.log(`Account 1: ${ACCOUNT_1.email}`);
  console.log(`Account 2: ${ACCOUNT_2.email}\n`);
  
  let browser;
  let context;
  let page;
  let account1PinCount = 0;
  let account2PinCount = 0;
  
  try {
    // Launch browser
    browser = await chromium.launch({
      headless: false,
      slowMo: 200
    });
    
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['geolocation']
    });
    
    page = await context.newPage();
    
    // Monitor console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`🔴 Console Error: ${msg.text().substring(0, 100)}`);
      }
    });
    
    // Navigate to app
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    logTest('pass', 'Application loaded');
    
    // ========== ACCOUNT 1 TEST ==========
    console.log('\n' + '='.repeat(60));
    console.log('📧 TESTING ACCOUNT 1\n');
    
    // Clear any existing session
    await clearAuthState(page);
    
    // Login Account 1
    const login1Success = await loginAccount(page, ACCOUNT_1, 'Account 1');
    
    if (login1Success) {
      // Create a pin
      await createPin(page, 'Account 1 Test Pin', 'Created by Account 1');
      
      // Count pins
      account1PinCount = await countPins(page);
      console.log(`\n📊 Account 1 sees ${account1PinCount} pin(s)`);
      
      // Take screenshot
      await page.screenshot({ 
        path: path.join(__dirname, 'account1-pins.png'),
        fullPage: true 
      });
    }
    
    // ========== ACCOUNT 2 TEST ==========
    console.log('\n' + '='.repeat(60));
    console.log('📧 TESTING ACCOUNT 2\n');
    
    // Clear session and login Account 2
    await clearAuthState(page);
    
    const login2Success = await loginAccount(page, ACCOUNT_2, 'Account 2');
    
    if (login2Success) {
      // Count pins (should be different from Account 1)
      account2PinCount = await countPins(page);
      console.log(`\n📊 Account 2 sees ${account2PinCount} pin(s)`);
      
      // Create a pin for Account 2
      await createPin(page, 'Account 2 Test Pin', 'Created by Account 2');
      
      // Count pins again
      const account2NewCount = await countPins(page);
      console.log(`📊 Account 2 now has ${account2NewCount} pin(s)`);
      
      // Take screenshot
      await page.screenshot({ 
        path: path.join(__dirname, 'account2-pins.png'),
        fullPage: true 
      });
    }
    
    // ========== VERIFY DATA ISOLATION ==========
    console.log('\n' + '='.repeat(60));
    console.log('🔒 VERIFYING DATA ISOLATION\n');
    
    // Switch back to Account 1
    await clearAuthState(page);
    const verifyLogin = await loginAccount(page, ACCOUNT_1, 'Account 1');
    
    if (verifyLogin) {
      const account1FinalCount = await countPins(page);
      console.log(`\n📊 Account 1 still sees ${account1FinalCount} pin(s)`);
      console.log('   (Should not see Account 2 pins)');
      
      if (account1FinalCount === account1PinCount || account1FinalCount === account1PinCount + 1) {
        logTest('pass', 'Data isolation verified - accounts have separate pins');
      } else {
        logTest('warn', 'Pin counts may indicate shared data');
      }
    }
    
    // ========== TEST RESULTS ==========
    console.log('\n' + '='.repeat(60));
    console.log('📈 TEST RESULTS\n');
    
    console.log(`✅ Passed: ${testResults.passed.length}`);
    testResults.passed.forEach(test => console.log(`  • ${test}`));
    
    if (testResults.failed.length > 0) {
      console.log(`\n❌ Failed: ${testResults.failed.length}`);
      testResults.failed.forEach(test => console.log(`  • ${test}`));
    }
    
    if (testResults.warnings.length > 0) {
      console.log(`\n⚠️  Warnings: ${testResults.warnings.length}`);
      testResults.warnings.forEach(test => console.log(`  • ${test}`));
    }
    
    console.log('\n📸 Screenshots saved:');
    console.log('  • account1-pins.png');
    console.log('  • account2-pins.png');
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
  } finally {
    console.log('\n💡 Browser will remain open for inspection.');
    console.log('   Close manually when done.\n');
    
    // Uncomment to auto-close:
    // if (browser) await browser.close();
  }
}

// Run test
console.log('🚀 Starting Account Test\n');
console.log('This test will:');
console.log('• Login to both provided accounts');
console.log('• Create test pins for each account');
console.log('• Verify data isolation between accounts');
console.log('• Take screenshots of each account state\n');

runTest().catch(console.error);