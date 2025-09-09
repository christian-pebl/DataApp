const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Test configuration
const APP_URL = 'http://localhost:9002';
const TEST_FILE = path.join(__dirname, 'test-data.csv');

async function runAutomatedTest() {
  console.log('🤖 Starting Automated Test\n');
  console.log('='.repeat(50));
  
  let browser;
  let context;
  let page;
  
  try {
    // Launch browser
    console.log('\n📌 Step 1: Launching Browser');
    browser = await chromium.launch({
      headless: false, // Set to true for headless mode
      slowMo: 500 // Slow down actions for visibility
    });
    
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['geolocation'],
    });
    
    page = await context.newPage();
    
    // Capture console logs
    const consoleLogs = [];
    page.on('console', msg => {
      const log = {
        type: msg.type(),
        text: msg.text(),
        time: new Date().toISOString()
      };
      consoleLogs.push(log);
      
      // Print errors and warnings
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`  🔴 Console ${msg.type()}: ${msg.text()}`);
      }
    });
    
    // Capture page errors
    page.on('pageerror', error => {
      console.log(`  ❌ Page Error: ${error.message}`);
    });
    
    // Navigate to app
    console.log('\n📌 Step 2: Navigating to Application');
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    console.log(`  ✅ Loaded: ${await page.title()}`);
    
    // Check if we're on login page or main app
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log(`  📍 Current URL: ${currentUrl}`);
    
    // Check for authentication
    console.log('\n📌 Step 3: Checking Authentication');
    
    // Look for login button or user menu
    const loginButton = await page.$('button:has-text("Continue with Google")');
    const userMenu = await page.$('[aria-label="User menu"]');
    
    if (loginButton) {
      console.log('  ℹ️  Not logged in - Login page detected');
      console.log('  ⚠️  Google OAuth requires manual interaction');
      console.log('\n  📝 Manual Step Required:');
      console.log('  1. Click "Continue with Google" in the browser');
      console.log('  2. Complete Google sign-in');
      console.log('  3. Wait for redirect back to app');
      
      // Wait for manual login (timeout after 60 seconds)
      console.log('\n  ⏳ Waiting for manual login (60s timeout)...');
      try {
        await page.waitForURL('**/map-drawing**', { timeout: 60000 });
        console.log('  ✅ Login successful!');
      } catch {
        console.log('  ❌ Login timeout - please run test again after logging in');
        return;
      }
    } else if (userMenu) {
      console.log('  ✅ Already authenticated');
    } else {
      console.log('  ⚠️  Unknown authentication state');
    }
    
    // Wait for map to load
    console.log('\n📌 Step 4: Waiting for Map to Load');
    await page.waitForTimeout(3000);
    
    // Try to find the map container
    const mapContainer = await page.$('#map, .leaflet-container, [data-testid="map"]');
    if (mapContainer) {
      console.log('  ✅ Map loaded successfully');
    } else {
      console.log('  ⚠️  Map container not found');
    }
    
    // Create a test pin
    console.log('\n📌 Step 5: Creating Test Pin');
    
    // Click on the map to create a pin (center of map)
    const mapBounds = await page.$eval('.leaflet-container', el => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }).catch(() => null);
    
    if (mapBounds) {
      // First, ensure we're in pin mode
      const pinButton = await page.$('button:has-text("Pin")');
      if (pinButton) {
        await pinButton.click();
        console.log('  ✅ Pin mode activated');
      }
      
      // Click on map center
      await page.mouse.click(mapBounds.x, mapBounds.y);
      console.log('  ✅ Clicked on map to create pin');
      
      // Wait for pin creation dialog/form
      await page.waitForTimeout(1000);
      
      // Look for label input
      const labelInput = await page.$('input[placeholder*="label"], input[placeholder*="Label"], input[placeholder*="name"], input[placeholder*="Name"]');
      if (labelInput) {
        await labelInput.fill('Automated Test Pin');
        console.log('  ✅ Pin label set');
        
        // Look for notes textarea
        const notesInput = await page.$('textarea[placeholder*="notes"], textarea[placeholder*="Notes"], textarea[placeholder*="description"]');
        if (notesInput) {
          await notesInput.fill('This pin was created by automated testing');
          console.log('  ✅ Pin notes added');
        }
        
        // Save the pin
        const saveButton = await page.$('button:has-text("Save"), button:has-text("Create"), button:has-text("Add")');
        if (saveButton) {
          await saveButton.click();
          console.log('  ✅ Pin saved');
          await page.waitForTimeout(2000);
        }
      }
    } else {
      console.log('  ⚠️  Could not locate map for pin creation');
    }
    
    // Check for existing pins
    console.log('\n📌 Step 6: Checking Existing Pins');
    const pinMarkers = await page.$$('.leaflet-marker-icon');
    console.log(`  📍 Found ${pinMarkers.length} pins on the map`);
    
    // Get console logs summary
    console.log('\n📌 Step 7: Console Log Analysis');
    const errors = consoleLogs.filter(log => log.type === 'error');
    const warnings = consoleLogs.filter(log => log.type === 'warning');
    
    console.log(`  📊 Total logs: ${consoleLogs.length}`);
    console.log(`  ❌ Errors: ${errors.length}`);
    console.log(`  ⚠️  Warnings: ${warnings.length}`);
    
    if (errors.length > 0) {
      console.log('\n  Error Details:');
      errors.slice(0, 5).forEach(err => {
        console.log(`    - ${err.text.substring(0, 100)}`);
      });
    }
    
    // Check network activity
    console.log('\n📌 Step 8: Network Activity Check');
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('supabase')) {
        requests.push({
          method: request.method(),
          url: request.url(),
          type: request.resourceType()
        });
      }
    });
    
    // Make a simple action to trigger network activity
    await page.reload();
    await page.waitForTimeout(3000);
    
    console.log(`  📡 Supabase API calls: ${requests.length}`);
    
    // Take a screenshot
    console.log('\n📌 Step 9: Taking Screenshot');
    const screenshotPath = path.join(__dirname, 'test-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  📸 Screenshot saved: ${screenshotPath}`);
    
    // Test complete
    console.log('\n' + '='.repeat(50));
    console.log('✅ Automated Test Complete!\n');
    
    console.log('📊 Test Results:');
    console.log(`  • Page loaded: ✅`);
    console.log(`  • Authentication: ${loginButton ? '⚠️ Manual login required' : '✅'}`);
    console.log(`  • Map rendered: ${mapContainer ? '✅' : '❌'}`);
    console.log(`  • Pins found: ${pinMarkers.length}`);
    console.log(`  • Console errors: ${errors.length === 0 ? '✅ None' : `❌ ${errors.length} errors`}`);
    console.log(`  • API connectivity: ${requests.length > 0 ? '✅' : '⚠️ No API calls detected'}`);
    
  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
  } finally {
    // Keep browser open for manual inspection
    console.log('\n💡 Browser will stay open for manual inspection.');
    console.log('   Close it manually when done.\n');
    
    // Uncomment to auto-close:
    // await browser.close();
  }
}

// Run the test
console.log('🚀 Automated Pin Data Test\n');
console.log('This test will:');
console.log('1. Open your app in a browser');
console.log('2. Check authentication status');
console.log('3. Create a test pin (if possible)');
console.log('4. Monitor console for errors');
console.log('5. Check network activity');
console.log('6. Take a screenshot\n');

runAutomatedTest().catch(console.error);