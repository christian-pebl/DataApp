const { chromium } = require('playwright');
require('dotenv').config({ path: '.env.local' });

// Test credentials - using actual test account
const TEST_EMAIL = 'christian@pebl-cic.co.uk';
const TEST_PASSWORD = 'Mewslade123@';

async function testShareFeature() {
  console.log('🎭 Starting Playwright test for share feature...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true // Open DevTools to see console
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture console messages
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({
      type: msg.type(),
      text: text,
      time: new Date().toISOString()
    });
    
    // Print important messages immediately
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', text);
    } else if (text.includes('Creating public link') || 
               text.includes('error') || 
               text.includes('Error') ||
               text.includes('Database error') ||
               text.includes('Share token')) {
      console.log('📝 Console:', text);
    }
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    console.log('❌ Page Error:', error.message);
  });
  
  try {
    // Step 1: Navigate to login page
    console.log('1️⃣ Navigating to login page...');
    await page.goto('http://localhost:9003/auth');
    await page.waitForLoadState('networkidle');
    
    // Step 2: Login
    console.log('2️⃣ Logging in...');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button:has-text("Sign")');
    
    // Wait for redirect to map page
    await page.waitForURL('**/map-drawing', { timeout: 10000 });
    console.log('✅ Successfully logged in\n');
    
    // Step 3: Create a pin to share
    console.log('3️⃣ Creating a pin...');
    
    // Click on the map center to create a pin
    const mapContainer = await page.locator('.leaflet-container').first();
    const box = await mapContainer.boundingBox();
    if (box) {
      // Click in the center of the map
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);
    }
    
    // Look for the drawing tools button and click it
    const drawingToolsButton = await page.locator('button:has(.h-5.w-5)').filter({ hasText: '' }).nth(1);
    await drawingToolsButton.click();
    await page.waitForTimeout(500);
    
    // Click "Add Pin" button
    const addPinButton = await page.locator('button:has-text("Add Pin")').first();
    await addPinButton.click();
    await page.waitForTimeout(1000);
    
    console.log('✅ Pin created\n');
    
    // Step 4: Find and click the share button
    console.log('4️⃣ Looking for share button...');
    
    // The share button should be in the object details panel
    // Look for the Share2 icon button
    const shareButton = await page.locator('button:has(svg.lucide-share-2)').first();
    
    if (await shareButton.isVisible()) {
      console.log('✅ Found share button, clicking...');
      await shareButton.click();
      await page.waitForTimeout(1000);
      
      // Step 5: Check if ShareDialog opened
      console.log('5️⃣ Checking if ShareDialog opened...');
      
      const dialogTitle = await page.locator('text="Share Pin"').first();
      if (await dialogTitle.isVisible()) {
        console.log('✅ ShareDialog is open\n');
        
        // Step 6: Switch to Public Link tab
        console.log('6️⃣ Switching to Public Link tab...');
        const publicLinkTab = await page.locator('button:has-text("Public Link")').first();
        await publicLinkTab.click();
        await page.waitForTimeout(500);
        
        // Step 7: Try to generate public link
        console.log('7️⃣ Generating public link...');
        const generateButton = await page.locator('button:has-text("Generate Public Link")').first();
        await generateButton.click();
        
        // Wait for response
        await page.waitForTimeout(3000);
        
        // Check for success or error
        const toastMessage = await page.locator('[data-sonner-toast]').first();
        if (await toastMessage.isVisible()) {
          const toastText = await toastMessage.textContent();
          console.log('📢 Toast message:', toastText);
        }
        
      } else {
        console.log('❌ ShareDialog did not open');
        
        // Check if the old privacy popover opened instead
        const privacyPopover = await page.locator('text="Pin Privacy Settings"').first();
        if (await privacyPopover.isVisible()) {
          console.log('⚠️ Old privacy popover opened instead of ShareDialog');
        }
      }
    } else {
      console.log('❌ Share button not found or not visible');
      
      // Try to find what buttons are visible
      const visibleButtons = await page.locator('button').all();
      console.log(`Found ${visibleButtons.length} buttons on page`);
    }
    
    // Step 8: Print all console logs
    console.log('\n📋 All Console Logs:');
    consoleLogs.forEach(log => {
      if (log.text.includes('share') || 
          log.text.includes('Share') || 
          log.text.includes('token') ||
          log.text.includes('error') ||
          log.text.includes('Error')) {
        console.log(`[${log.type}] ${log.text}`);
      }
    });
    
    // Take a screenshot
    await page.screenshot({ path: 'share-test-result.png' });
    console.log('\n📸 Screenshot saved as share-test-result.png');
    
    // Wait for user to see results
    console.log('\n⏸️ Test complete. Browser will close in 10 seconds...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Take error screenshot
    await page.screenshot({ path: 'share-test-error.png' });
    console.log('📸 Error screenshot saved as share-test-error.png');
  } finally {
    await browser.close();
    
    // Save logs to file
    const fs = require('fs');
    fs.writeFileSync('share-test-logs.json', JSON.stringify(consoleLogs, null, 2));
    console.log('📄 Console logs saved to share-test-logs.json');
  }
}

// Run the test
testShareFeature().catch(console.error);