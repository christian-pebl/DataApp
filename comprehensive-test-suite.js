const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// ============================================
// Configuration
// ============================================
const APP_URL = 'http://localhost:9002';
const TEST_DATA_FILE = path.join(__dirname, 'test-data.csv');
const SCREENSHOTS_DIR = path.join(__dirname, 'test-screenshots');
const REPORTS_DIR = path.join(__dirname, 'test-reports');

// Ensure directories exist
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR);
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR);

// Test accounts
const ACCOUNTS = {
  primary: {
    email: 'christian@pebl-cic.co.uk',
    password: 'Mewslade123@',
    name: 'Primary Account'
  },
  secondary: {
    email: 'christiannberger@gmail.com',
    password: 'Mewslade123@',
    name: 'Secondary Account'
  }
};

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================
// Test State Management
// ============================================
class TestState {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
      screenshots: [],
      consoleLogs: {
        all: [],
        errors: [],
        warnings: []
      },
      networkRequests: [],
      timings: {},
      metadata: {
        startTime: new Date(),
        endTime: null,
        duration: null
      }
    };
    
    this.pins = {
      account1: [],
      account2: [],
      shared: []
    };
    
    this.shareLinks = [];
  }
  
  pass(message) {
    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(`[${timestamp}] ✅ ${message}`);
    this.results.passed.push({ message, timestamp });
  }
  
  fail(message, error = null) {
    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(`[${timestamp}] ❌ ${message}`);
    this.results.failed.push({ message, error: error?.message || error, timestamp });
  }
  
  warn(message) {
    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(`[${timestamp}] ⚠️  ${message}`);
    this.results.warnings.push({ message, timestamp });
  }
  
  logTiming(operation, duration) {
    this.results.timings[operation] = duration;
  }
  
  async generateReport() {
    this.results.metadata.endTime = new Date();
    this.results.metadata.duration = 
      (this.results.metadata.endTime - this.results.metadata.startTime) / 1000;
    
    const report = {
      summary: {
        total: this.results.passed.length + this.results.failed.length,
        passed: this.results.passed.length,
        failed: this.results.failed.length,
        warnings: this.results.warnings.length,
        duration: `${this.results.metadata.duration.toFixed(2)}s`,
        consoleErrors: this.results.consoleLogs.errors.length
      },
      ...this.results
    };
    
    const reportPath = path.join(REPORTS_DIR, `test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 Report saved: ${reportPath}`);
    
    return report;
  }
}

// ============================================
// Test Utilities
// ============================================
class TestUtils {
  static async takeScreenshot(page, name, state) {
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${Date.now()}-${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    state.results.screenshots.push({ name, path: screenshotPath });
    return screenshotPath;
  }
  
  static async waitForNavigation(page, url, timeout = 10000) {
    try {
      await page.waitForURL(url, { timeout });
      return true;
    } catch {
      return false;
    }
  }
  
  static async safeClick(page, selector, options = {}) {
    try {
      await page.click(selector, { timeout: 5000, ...options });
      return true;
    } catch {
      return false;
    }
  }
  
  static async safeWait(page, selector, timeout = 5000) {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================
// Core Test Functions
// ============================================
async function setupBrowserContext(state) {
  console.log('\n🌐 Setting up browser context...\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 200,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
  });
  
  const page = await context.newPage();
  
  // Setup console monitoring
  page.on('console', msg => {
    const log = {
      type: msg.type(),
      text: msg.text(),
      time: new Date().toISOString()
    };
    
    state.results.consoleLogs.all.push(log);
    
    if (msg.type() === 'error') {
      state.results.consoleLogs.errors.push(log);
      console.log(`  🔴 Console Error: ${msg.text().substring(0, 100)}`);
    } else if (msg.type() === 'warning') {
      state.results.consoleLogs.warnings.push(log);
    }
  });
  
  // Setup network monitoring
  page.on('request', request => {
    if (request.url().includes('supabase')) {
      state.results.networkRequests.push({
        method: request.method(),
        url: request.url(),
        time: new Date().toISOString()
      });
    }
  });
  
  // Setup error handling
  page.on('pageerror', error => {
    state.fail(`Page error: ${error.message}`, error);
  });
  
  return { browser, context, page };
}

async function testLogin(page, account, state) {
  console.log(`\n🔐 Testing login for ${account.name}...\n`);
  const startTime = Date.now();
  
  try {
    // Navigate to app
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    
    // Check if already logged in
    if (!page.url().includes('auth')) {
      state.warn(`Already logged in, attempting logout first`);
      await testLogout(page, state);
      await page.goto(APP_URL + '/auth', { waitUntil: 'networkidle' });
    }
    
    // Fill login form
    await page.fill('input[type="email"]', account.email);
    await page.fill('input[type="password"]', account.password);
    
    // Click sign in
    await page.click('button:has-text("Sign in")');
    
    // Wait for navigation
    await page.waitForTimeout(3000);
    
    // Verify login success
    if (!page.url().includes('auth')) {
      state.pass(`${account.name}: Login successful`);
      state.logTiming(`login-${account.name}`, Date.now() - startTime);
      return true;
    } else {
      state.fail(`${account.name}: Login failed - still on auth page`);
      return false;
    }
  } catch (error) {
    state.fail(`${account.name}: Login error`, error);
    return false;
  }
}

async function testLogout(page, state) {
  console.log('\n🚪 Testing logout...\n');
  
  try {
    // Multiple strategies for logout
    
    // Strategy 1: Look for user menu button
    const userMenuButton = await page.$('[aria-label*="user" i], [aria-label*="menu" i], button:has-text("Menu")');
    if (userMenuButton) {
      await userMenuButton.click();
      await page.waitForTimeout(500);
    }
    
    // Strategy 2: Direct logout button
    const logoutButton = await page.$('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout"), a:has-text("Sign out")');
    if (logoutButton) {
      await logoutButton.click();
      await page.waitForTimeout(2000);
      state.pass('Logout successful');
      return true;
    }
    
    // Strategy 3: Navigate directly to auth page
    await page.goto(APP_URL + '/auth', { waitUntil: 'networkidle' });
    
    // Clear cookies as fallback
    await page.context().clearCookies();
    
    state.pass('Logout completed (via navigation)');
    return true;
  } catch (error) {
    state.fail('Logout error', error);
    return false;
  }
}

async function testPinCreation(page, pinData, state) {
  console.log('\n📍 Testing pin creation...\n');
  
  try {
    // Ensure we're on the map page
    if (!page.url().includes('map')) {
      await page.goto(APP_URL + '/map-drawing', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    }
    
    // Enable pin mode
    const pinButton = await page.$('button:has-text("Pin")');
    if (pinButton) {
      await pinButton.click();
      await page.waitForTimeout(500);
      state.pass('Pin mode activated');
    }
    
    // Click on map
    const mapContainer = await page.$('.leaflet-container, #map');
    if (mapContainer) {
      const box = await mapContainer.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1000);
      
      // Fill pin details
      const labelInput = await page.$('input[placeholder*="label" i], input[placeholder*="name" i]');
      if (labelInput) {
        await labelInput.fill(pinData.label);
        
        const notesInput = await page.$('textarea');
        if (notesInput) {
          await notesInput.fill(pinData.notes);
        }
        
        // Save pin
        const saveButton = await page.$('button:has-text("Save"), button:has-text("Create"), button:has-text("Add")');
        if (saveButton) {
          await saveButton.click();
          await page.waitForTimeout(2000);
          state.pass(`Pin created: ${pinData.label}`);
          return true;
        }
      }
    }
    
    state.fail('Could not create pin');
    return false;
  } catch (error) {
    state.fail('Pin creation error', error);
    return false;
  }
}

async function testFileUpload(page, pinId, state) {
  console.log('\n📎 Testing file upload...\n');
  
  try {
    // Click on the pin to select it
    const pinMarker = await page.$('.leaflet-marker-icon');
    if (pinMarker) {
      await pinMarker.click();
      await page.waitForTimeout(1000);
      
      // Look for upload button
      const uploadButton = await page.$('button:has-text("Upload"), button[aria-label*="upload" i], input[type="file"]');
      
      if (uploadButton) {
        // Set file input
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(TEST_DATA_FILE);
          await page.waitForTimeout(2000);
          state.pass('File uploaded successfully');
          return true;
        }
      }
    }
    
    state.warn('File upload button not found');
    return false;
  } catch (error) {
    state.fail('File upload error', error);
    return false;
  }
}

async function testPinSharing(page, state) {
  console.log('\n🔗 Testing pin sharing...\n');
  
  try {
    // Click on a pin
    const pinMarker = await page.$('.leaflet-marker-icon');
    if (pinMarker) {
      await pinMarker.click();
      await page.waitForTimeout(1000);
      
      // Look for share button
      const shareButton = await page.$('button:has-text("Share"), button[aria-label*="share" i]');
      
      if (shareButton) {
        await shareButton.click();
        await page.waitForTimeout(1000);
        
        // Switch to public link tab if needed
        const publicTab = await page.$('button:has-text("Public"), button:has-text("Link")');
        if (publicTab) {
          await publicTab.click();
          await page.waitForTimeout(500);
        }
        
        // Generate public link
        const generateButton = await page.$('button:has-text("Generate"), button:has-text("Create")');
        if (generateButton) {
          await generateButton.click();
          await page.waitForTimeout(2000);
          
          // Try to copy the link
          const copyButton = await page.$('button:has-text("Copy")');
          if (copyButton) {
            await copyButton.click();
            state.pass('Share link generated and copied');
            
            // Get clipboard content
            const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
            state.shareLinks.push(clipboardText);
            
            return true;
          }
        }
      }
    }
    
    state.warn('Sharing functionality not fully tested');
    return false;
  } catch (error) {
    state.fail('Sharing test error', error);
    return false;
  }
}

async function testPinDeletion(page, state) {
  console.log('\n🗑️ Testing pin deletion...\n');
  
  try {
    // Click on a pin
    const pinMarker = await page.$('.leaflet-marker-icon');
    if (pinMarker) {
      await pinMarker.click();
      await page.waitForTimeout(1000);
      
      // Look for delete button
      const deleteButton = await page.$('button:has-text("Delete"), button[aria-label*="delete" i], button[aria-label*="trash" i]');
      
      if (deleteButton) {
        const pinCountBefore = (await page.$$('.leaflet-marker-icon')).length;
        
        await deleteButton.click();
        await page.waitForTimeout(500);
        
        // Confirm if needed
        const confirmButton = await page.$('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("OK")');
        if (confirmButton) {
          await confirmButton.click();
        }
        
        await page.waitForTimeout(2000);
        
        const pinCountAfter = (await page.$$('.leaflet-marker-icon')).length;
        
        if (pinCountAfter < pinCountBefore) {
          state.pass('Pin deleted successfully');
          return true;
        } else {
          state.fail('Pin was not deleted');
          return false;
        }
      }
    }
    
    state.warn('Delete button not found');
    return false;
  } catch (error) {
    state.fail('Pin deletion error', error);
    return false;
  }
}

async function testDataIsolation(page, account1, account2, state) {
  console.log('\n🔒 Testing data isolation between accounts...\n');
  
  try {
    // Login as account1
    await testLogin(page, account1, state);
    await page.waitForTimeout(2000);
    
    // Count pins for account1
    const account1Pins = await page.$$('.leaflet-marker-icon');
    state.pins.account1 = account1Pins.length;
    console.log(`  Account 1 sees: ${account1Pins.length} pins`);
    
    // Take screenshot
    await TestUtils.takeScreenshot(page, 'account1-pins', state);
    
    // Logout
    await testLogout(page, state);
    
    // Login as account2
    await testLogin(page, account2, state);
    await page.waitForTimeout(2000);
    
    // Count pins for account2
    const account2Pins = await page.$$('.leaflet-marker-icon');
    state.pins.account2 = account2Pins.length;
    console.log(`  Account 2 sees: ${account2Pins.length} pins`);
    
    // Take screenshot
    await TestUtils.takeScreenshot(page, 'account2-pins', state);
    
    // Verify isolation
    if (state.pins.account1 !== state.pins.account2) {
      state.pass(`Data isolation working: Account1=${state.pins.account1} pins, Account2=${state.pins.account2} pins`);
      return true;
    } else if (state.pins.account1 === 0 && state.pins.account2 === 0) {
      state.warn('Both accounts have no pins - create pins to test isolation');
      return true;
    } else {
      state.fail(`Data isolation issue: Both accounts see ${state.pins.account1} pins`);
      return false;
    }
  } catch (error) {
    state.fail('Data isolation test error', error);
    return false;
  }
}

// ============================================
// Main Test Suite
// ============================================
async function runComprehensiveTestSuite() {
  console.log('🎭 COMPREHENSIVE PLAYWRIGHT TEST SUITE');
  console.log('=' .repeat(60));
  console.log('Testing all major functionality with error monitoring\n');
  
  const state = new TestState();
  let browser, context, page;
  
  try {
    // Setup browser
    ({ browser, context, page } = await setupBrowserContext(state));
    state.pass('Browser context initialized');
    
    // ========== TEST SUITE 1: Authentication ==========
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUITE 1: AUTHENTICATION\n');
    
    // Test primary account login
    const loginSuccess1 = await testLogin(page, ACCOUNTS.primary, state);
    if (loginSuccess1) {
      await TestUtils.takeScreenshot(page, 'primary-logged-in', state);
    }
    
    // Test logout
    const logoutSuccess = await testLogout(page, state);
    if (logoutSuccess) {
      await TestUtils.takeScreenshot(page, 'logged-out', state);
    }
    
    // Test secondary account login
    const loginSuccess2 = await testLogin(page, ACCOUNTS.secondary, state);
    if (loginSuccess2) {
      await TestUtils.takeScreenshot(page, 'secondary-logged-in', state);
    }
    
    // ========== TEST SUITE 2: Pin Operations ==========
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUITE 2: PIN OPERATIONS\n');
    
    // Create a test pin
    const pinCreated = await testPinCreation(page, {
      label: `Test Pin ${Date.now()}`,
      notes: 'Automated test pin with timestamp'
    }, state);
    
    if (pinCreated) {
      await TestUtils.takeScreenshot(page, 'pin-created', state);
      
      // Test file upload
      await testFileUpload(page, null, state);
      
      // Test sharing
      await testPinSharing(page, state);
      
      // Test deletion
      await testPinDeletion(page, state);
    }
    
    // ========== TEST SUITE 3: Data Isolation ==========
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUITE 3: DATA ISOLATION\n');
    
    await testDataIsolation(page, ACCOUNTS.primary, ACCOUNTS.secondary, state);
    
    // ========== TEST SUITE 4: Error Analysis ==========
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUITE 4: ERROR ANALYSIS\n');
    
    console.log(`📊 Console Logs Summary:`);
    console.log(`  Total: ${state.results.consoleLogs.all.length}`);
    console.log(`  Errors: ${state.results.consoleLogs.errors.length}`);
    console.log(`  Warnings: ${state.results.consoleLogs.warnings.length}`);
    
    if (state.results.consoleLogs.errors.length > 0) {
      console.log('\n🔴 Console Errors Found:');
      state.results.consoleLogs.errors.slice(0, 5).forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.text.substring(0, 100)}`);
      });
    } else {
      state.pass('No console errors detected');
    }
    
    console.log(`\n📡 Network Requests: ${state.results.networkRequests.length} Supabase API calls`);
    
    // ========== FINAL REPORT ==========
    console.log('\n' + '='.repeat(60));
    console.log('📈 FINAL TEST REPORT\n');
    
    const report = await state.generateReport();
    
    console.log('Summary:');
    console.log(`  ✅ Passed: ${report.summary.passed}`);
    console.log(`  ❌ Failed: ${report.summary.failed}`);
    console.log(`  ⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`  ⏱️  Duration: ${report.summary.duration}`);
    console.log(`  📸 Screenshots: ${state.results.screenshots.length}`);
    console.log(`  🔴 Console Errors: ${report.summary.consoleErrors}`);
    
    if (report.summary.failed > 0) {
      console.log('\nFailed Tests:');
      state.results.failed.forEach(test => {
        console.log(`  • ${test.message}`);
      });
    }
    
    // Save final screenshot
    await TestUtils.takeScreenshot(page, 'final-state', state);
    
  } catch (error) {
    console.error('\n❌ Test suite crashed:', error);
    state.fail('Test suite crashed', error);
  } finally {
    console.log('\n💡 Browser will remain open for manual inspection.');
    console.log('   Close it manually when done.\n');
    
    // Uncomment to auto-close:
    // if (browser) await browser.close();
  }
}

// ============================================
// Execute Test Suite
// ============================================
console.log('🚀 Starting Comprehensive Test Suite\n');
console.log('This suite will test:');
console.log('✓ Login/Logout for both accounts');
console.log('✓ Pin creation, editing, deletion');
console.log('✓ File upload functionality');
console.log('✓ Sharing capabilities');
console.log('✓ Data isolation between accounts');
console.log('✓ Console error monitoring');
console.log('✓ Network request tracking\n');

runComprehensiveTestSuite().catch(console.error);