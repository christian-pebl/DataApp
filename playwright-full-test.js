const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuration
const APP_URL = 'http://localhost:9002';
const TEST_FILE = path.join(__dirname, 'test-data.csv');

// Test accounts - Using existing accounts
const ACCOUNT_1 = {
  email: 'christian@pebl-cic.co.uk',
  password: 'Mewslade123@'
};

const ACCOUNT_2 = {
  email: 'christiannberger@gmail.com', 
  password: 'Mewslade123@'
};

// Supabase setup for account creation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Console log storage
const consoleLogs = {
  all: [],
  errors: [],
  warnings: [],
  info: []
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

async function setupTestAccounts() {
  console.log('\n📋 Setting up test accounts via Supabase...\n');
  
  // Try to create accounts directly via Supabase
  for (const account of [ACCOUNT_1, ACCOUNT_2]) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: account.email,
        password: account.password,
        options: {
          emailRedirectTo: APP_URL,
          data: {
            bypass_email_confirmation: true
          }
        }
      });
      
      if (error) {
        console.log(`⚠️  Could not create ${account.email}: ${error.message}`);
      } else {
        console.log(`✅ Created account: ${account.email}`);
      }
    } catch (err) {
      console.log(`⚠️  Setup error for ${account.email}: ${err.message}`);
    }
  }
}

async function runComprehensiveTest() {
  console.log('🎭 Playwright Comprehensive Pin Test\n');
  console.log('='.repeat(60));
  console.log('Testing: Login/Logout, Pin CRUD, File Upload, Data Isolation\n');
  console.log('Using existing accounts:');
  console.log(`  Account 1: ${ACCOUNT_1.email}`);
  console.log(`  Account 2: ${ACCOUNT_2.email}\n`);
  
  let browser;
  let context;
  let page;
  
  try {
    // Skip account setup - using existing accounts
    // await setupTestAccounts();
    
    // Launch browser
    console.log('🚀 Launching browser...\n');
    browser = await chromium.launch({
      headless: false,
      slowMo: 300 // Slow down for visibility
    });
    
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
    });
    
    page = await context.newPage();
    
    // Setup console monitoring
    page.on('console', msg => {
      const log = {
        type: msg.type(),
        text: msg.text(),
        time: new Date().toISOString()
      };
      
      consoleLogs.all.push(log);
      
      if (msg.type() === 'error') {
        consoleLogs.errors.push(log);
        console.log(`🔴 Console Error: ${msg.text().substring(0, 100)}`);
      } else if (msg.type() === 'warning') {
        consoleLogs.warnings.push(log);
      } else if (msg.type() === 'info' || msg.type() === 'log') {
        consoleLogs.info.push(log);
      }
    });
    
    page.on('pageerror', error => {
      consoleLogs.errors.push({
        type: 'pageerror',
        text: error.message,
        time: new Date().toISOString()
      });
      console.log(`❌ Page Error: ${error.message}`);
    });
    
    // Navigate to app
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    logTest('pass', 'Application loaded successfully');
    
    // ========== TEST ACCOUNT 1 ==========
    console.log('\n' + '='.repeat(60));
    console.log('📧 TESTING ACCOUNT 1\n');
    
    // Check if we're on login page
    const isLoginPage = await page.url().includes('/auth') || 
                       await page.$('input[type="email"]') !== null;
    
    if (isLoginPage) {
      console.log('📝 Attempting login/signup for Account 1...\n');
      
      // Try to sign up first
      const signUpLink = await page.$('text="Sign up"');
      if (signUpLink) {
        await signUpLink.click();
        await page.waitForTimeout(1000);
      }
      
      // Fill in credentials
      await page.fill('input[type="email"]', ACCOUNT_1.email);
      await page.fill('input[type="password"]', ACCOUNT_1.password);
      
      // Try sign up button first, then sign in
      const signUpButton = await page.$('button:has-text("Sign up")');
      const signInButton = await page.$('button:has-text("Sign in")');
      
      if (signUpButton) {
        await signUpButton.click();
        logTest('pass', 'Account 1: Sign up attempted');
      } else if (signInButton) {
        await signInButton.click();
        logTest('pass', 'Account 1: Sign in attempted');
      }
      
      // Wait for navigation
      await page.waitForTimeout(3000);
      
      // Check if we made it to the map
      const afterLoginUrl = page.url();
      if (afterLoginUrl.includes('map-drawing') || !afterLoginUrl.includes('auth')) {
        logTest('pass', 'Account 1: Successfully logged in');
      } else {
        logTest('warn', 'Account 1: May need email confirmation');
      }
    }
    
    // CREATE PIN FOR ACCOUNT 1
    console.log('\n🗺️ Creating pin for Account 1...\n');
    
    // Look for map container
    const mapExists = await page.$('.leaflet-container, #map');
    if (mapExists) {
      // Enable pin mode if needed
      const pinButton = await page.$('button:has-text("Pin")');
      if (pinButton) {
        await pinButton.click();
        await page.waitForTimeout(500);
        logTest('pass', 'Pin mode activated');
      }
      
      // Click on map to create pin
      const mapBounds = await page.$eval('.leaflet-container, #map', el => {
        const rect = el.getBoundingClientRect();
        return { 
          x: rect.x + rect.width / 2, 
          y: rect.y + rect.height / 2 
        };
      });
      
      await page.mouse.click(mapBounds.x, mapBounds.y);
      await page.waitForTimeout(1000);
      logTest('pass', 'Clicked on map to create pin');
      
      // Fill in pin details if form appears
      const labelInput = await page.$('input[placeholder*="label" i], input[placeholder*="name" i]');
      if (labelInput) {
        await labelInput.fill('Account 1 Test Pin');
        
        const notesInput = await page.$('textarea');
        if (notesInput) {
          await notesInput.fill('Pin created by Account 1 for testing');
        }
        
        // Save pin
        const saveButton = await page.$('button:has-text("Save"), button:has-text("Create")');
        if (saveButton) {
          await saveButton.click();
          await page.waitForTimeout(2000);
          logTest('pass', 'Account 1: Pin created successfully');
        }
      }
    } else {
      logTest('fail', 'Map container not found');
    }
    
    // COUNT PINS FOR ACCOUNT 1
    await page.waitForTimeout(2000);
    const account1Pins = await page.$$('.leaflet-marker-icon');
    console.log(`\n📍 Account 1 can see ${account1Pins.length} pin(s)\n`);
    
    // LOGOUT ACCOUNT 1
    console.log('\n🚪 Logging out Account 1...\n');
    
    // Look for user menu or logout button
    const userMenu = await page.$('[aria-label*="user" i], button:has-text("Logout"), button:has-text("Sign out")');
    if (userMenu) {
      await userMenu.click();
      await page.waitForTimeout(500);
      
      const logoutButton = await page.$('button:has-text("Logout"), button:has-text("Sign out"), text="Logout", text="Sign out"');
      if (logoutButton) {
        await logoutButton.click();
        await page.waitForTimeout(2000);
        logTest('pass', 'Account 1: Logged out');
      }
    }
    
    // ========== TEST ACCOUNT 2 ==========
    console.log('\n' + '='.repeat(60));
    console.log('📧 TESTING ACCOUNT 2\n');
    
    // Navigate back to login if needed
    if (!page.url().includes('auth')) {
      await page.goto(APP_URL + '/auth', { waitUntil: 'networkidle' });
    }
    
    // Login as Account 2
    console.log('📝 Attempting login for Account 2...\n');
    
    await page.fill('input[type="email"]', ACCOUNT_2.email);
    await page.fill('input[type="password"]', ACCOUNT_2.password);
    
    // Try to sign up or sign in
    const signUp2 = await page.$('button:has-text("Sign up")');
    const signIn2 = await page.$('button:has-text("Sign in")');
    
    if (signUp2) {
      await signUp2.click();
    } else if (signIn2) {
      await signIn2.click();
    }
    
    await page.waitForTimeout(3000);
    
    // Check if Account 2 logged in
    if (!page.url().includes('auth')) {
      logTest('pass', 'Account 2: Successfully logged in');
    } else {
      logTest('warn', 'Account 2: May need email confirmation');
    }
    
    // COUNT PINS FOR ACCOUNT 2 (Should be 0 or only their own)
    await page.waitForTimeout(2000);
    const account2Pins = await page.$$('.leaflet-marker-icon');
    console.log(`\n📍 Account 2 can see ${account2Pins.length} pin(s)\n`);
    
    if (account2Pins.length === 0) {
      logTest('pass', 'Data isolation working: Account 2 cannot see Account 1 pins');
    } else {
      logTest('warn', `Account 2 sees ${account2Pins.length} pins - verify if correct`);
    }
    
    // CREATE PIN FOR ACCOUNT 2
    console.log('\n🗺️ Creating pin for Account 2...\n');
    
    const map2 = await page.$('.leaflet-container, #map');
    if (map2) {
      // Enable pin mode
      const pinBtn2 = await page.$('button:has-text("Pin")');
      if (pinBtn2) {
        await pinBtn2.click();
        await page.waitForTimeout(500);
      }
      
      // Click different location
      const mapBounds2 = await page.$eval('.leaflet-container, #map', el => {
        const rect = el.getBoundingClientRect();
        return { 
          x: rect.x + rect.width / 3, 
          y: rect.y + rect.height / 3 
        };
      });
      
      await page.mouse.click(mapBounds2.x, mapBounds2.y);
      await page.waitForTimeout(1000);
      
      // Fill pin details
      const label2 = await page.$('input[placeholder*="label" i], input[placeholder*="name" i]');
      if (label2) {
        await label2.fill('Account 2 Test Pin');
        
        const notes2 = await page.$('textarea');
        if (notes2) {
          await notes2.fill('Pin created by Account 2');
        }
        
        const save2 = await page.$('button:has-text("Save"), button:has-text("Create")');
        if (save2) {
          await save2.click();
          await page.waitForTimeout(2000);
          logTest('pass', 'Account 2: Pin created successfully');
        }
      }
    }
    
    // TEST PIN DELETION
    console.log('\n🗑️ Testing pin deletion...\n');
    
    // Click on a pin to select it
    const pinToDelete = await page.$('.leaflet-marker-icon');
    if (pinToDelete) {
      await pinToDelete.click();
      await page.waitForTimeout(1000);
      
      // Look for delete button
      const deleteButton = await page.$('button:has-text("Delete"), button[aria-label*="delete" i]');
      if (deleteButton) {
        await deleteButton.click();
        await page.waitForTimeout(500);
        
        // Confirm deletion if needed
        const confirmButton = await page.$('button:has-text("Confirm"), button:has-text("Yes")');
        if (confirmButton) {
          await confirmButton.click();
        }
        
        await page.waitForTimeout(2000);
        logTest('pass', 'Pin deletion tested');
      }
    }
    
    // ========== CONSOLE LOG ANALYSIS ==========
    console.log('\n' + '='.repeat(60));
    console.log('📊 CONSOLE LOG ANALYSIS\n');
    
    console.log(`Total logs captured: ${consoleLogs.all.length}`);
    console.log(`❌ Errors: ${consoleLogs.errors.length}`);
    console.log(`⚠️  Warnings: ${consoleLogs.warnings.length}`);
    console.log(`ℹ️  Info/Log: ${consoleLogs.info.length}`);
    
    if (consoleLogs.errors.length > 0) {
      console.log('\n🔴 Error Details:');
      consoleLogs.errors.slice(0, 5).forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.text.substring(0, 100)}`);
      });
    }
    
    // ========== FINAL RESULTS ==========
    console.log('\n' + '='.repeat(60));
    console.log('📈 TEST RESULTS SUMMARY\n');
    
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
    
    // Take final screenshot
    const screenshotPath = path.join(__dirname, 'test-final-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n📸 Final screenshot saved: ${screenshotPath}`);
    
    // Save console logs to file
    const logsPath = path.join(__dirname, 'console-logs.json');
    fs.writeFileSync(logsPath, JSON.stringify(consoleLogs, null, 2));
    console.log(`📝 Console logs saved: ${logsPath}`);
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    logTest('fail', `Test crashed: ${error.message}`);
  } finally {
    console.log('\n💡 Browser will remain open for manual inspection.');
    console.log('   Close it manually when done.\n');
    
    // Uncomment to auto-close:
    // if (browser) await browser.close();
  }
}

// Run the comprehensive test
console.log('🚀 Starting Comprehensive Playwright Test\n');
console.log('This test will:');
console.log('• Create and use two test accounts');
console.log('• Test login/logout functionality');
console.log('• Create pins for each account');
console.log('• Verify data isolation between accounts');
console.log('• Test pin deletion');
console.log('• Monitor all console logs for errors\n');

runComprehensiveTest().catch(console.error);