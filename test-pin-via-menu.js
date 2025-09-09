const { chromium } = require('playwright');
const path = require('path');

// Configuration
const APP_URL = 'http://localhost:9002';
const ACCOUNT = {
  email: 'christian@pebl-cic.co.uk',
  password: 'Mewslade123@'
};

async function testPinCreation() {
  console.log('🎯 Testing Pin Creation via Project Menu\n');
  console.log('='.repeat(60) + '\n');
  
  let browser;
  
  try {
    // Launch browser
    browser = await chromium.launch({
      headless: false,
      slowMo: 800 // Slower for better visibility
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['geolocation']
    });
    
    const page = await context.newPage();
    
    // Navigate and login
    console.log('📝 Step 1: Navigating to app...');
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    
    // Login if needed
    if (page.url().includes('auth')) {
      console.log('📝 Step 2: Logging in...');
      await page.fill('input[type="email"]', ACCOUNT.email);
      await page.fill('input[type="password"]', ACCOUNT.password);
      await page.click('button:has-text("Sign in")');
      await page.waitForURL('**/map-drawing**', { timeout: 10000 });
      console.log('✅ Login successful');
    }
    
    await page.waitForTimeout(2000);
    
    // Count initial pins
    const initialPins = await page.$$('.leaflet-marker-icon');
    console.log(`\n📍 Initial pin count: ${initialPins.length}`);
    
    // Open menu
    console.log('\n📝 Step 3: Opening menu...');
    const menuButton = await page.$('button[class*="menu"], button[aria-label*="menu"], svg[class*="menu"], button:has(svg)');
    if (menuButton) {
      await menuButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ Menu opened');
      
      // Click Project Menu
      console.log('\n📝 Step 4: Opening Project Menu...');
      const projectMenu = await page.$('text="Project Menu"');
      if (projectMenu) {
        await projectMenu.click();
        await page.waitForTimeout(1000);
        console.log('✅ Project Menu opened');
        
        // Take screenshot of project menu
        await page.screenshot({ 
          path: path.join(__dirname, 'project-menu.png'),
          fullPage: false 
        });
        console.log('📸 Screenshot: project-menu.png');
        
        // Look for pin-related options
        console.log('\n📝 Step 5: Looking for pin options...');
        
        // Try various pin-related text options
        const pinOptions = [
          'text="Add Pin"',
          'text="New Pin"',
          'text="Create Pin"',
          'text="Pin"',
          'text="Add Marker"',
          'text="New Marker"',
          'button:has-text("Pin")',
          '[class*="pin" i]',
          '[id*="pin" i]'
        ];
        
        let pinButton = null;
        for (const selector of pinOptions) {
          pinButton = await page.$(selector);
          if (pinButton) {
            const text = await pinButton.textContent();
            console.log(`✅ Found pin option: "${text}"`);
            break;
          }
        }
        
        if (pinButton) {
          await pinButton.click();
          await page.waitForTimeout(1000);
          console.log('✅ Pin mode activated');
          
          // Close menu if still open
          const closeButton = await page.$('button[aria-label*="close"], button:has-text("×")');
          if (closeButton) {
            await closeButton.click();
          } else {
            // Click outside menu
            await page.mouse.click(600, 400);
          }
          await page.waitForTimeout(500);
          
          // Click on map to create pin
          console.log('\n📝 Step 6: Creating pin on map...');
          const mapElement = await page.$('.leaflet-container, #map');
          if (mapElement) {
            const box = await mapElement.boundingBox();
            const x = box.x + box.width * 0.7;
            const y = box.y + box.height * 0.3;
            
            console.log(`   Clicking at (${Math.round(x)}, ${Math.round(y)})`);
            await page.mouse.click(x, y);
            await page.waitForTimeout(2000);
            
            // Check if a form appeared
            const labelInput = await page.$('input[type="text"]:not([type="email"]):not([type="password"]), input[placeholder*="label" i], input[placeholder*="name" i]');
            
            if (labelInput) {
              console.log('✅ Pin form appeared');
              
              // Fill details
              await labelInput.fill('Test Pin ' + new Date().toLocaleTimeString());
              
              const notesInput = await page.$('textarea');
              if (notesInput) {
                await notesInput.fill('Created via Project Menu test');
              }
              
              // Save
              const saveButton = await page.$('button:has-text("Save"), button:has-text("Create"), button:has-text("Add")');
              if (saveButton) {
                await saveButton.click();
                await page.waitForTimeout(2000);
                console.log('✅ Pin saved');
              }
            } else {
              console.log('⚠️  Pin form did not appear');
              
              // Take screenshot of current state
              await page.screenshot({ 
                path: path.join(__dirname, 'after-map-click.png'),
                fullPage: false 
              });
              console.log('📸 Screenshot: after-map-click.png');
            }
          }
        } else {
          console.log('⚠️  Pin option not found in Project Menu');
          
          // List all visible options
          const allButtons = await page.$$('button, [role="button"], [role="menuitem"]');
          console.log('\nVisible options in menu:');
          for (const button of allButtons) {
            const text = await button.textContent();
            if (text && text.trim()) {
              console.log(`  • ${text.trim()}`);
            }
          }
        }
      } else {
        console.log('⚠️  Project Menu not found');
      }
    } else {
      console.log('⚠️  Menu button not found');
    }
    
    // Final pin count
    await page.waitForTimeout(2000);
    const finalPins = await page.$$('.leaflet-marker-icon');
    console.log(`\n📍 Final pin count: ${finalPins.length}`);
    
    if (finalPins.length > initialPins.length) {
      console.log('✅ SUCCESS: New pin was created!');
    } else {
      console.log('⚠️  No new pins were created');
      
      // Try alternative method: keyboard shortcuts
      console.log('\n📝 Trying keyboard shortcuts...');
      
      // Common map shortcuts
      const shortcuts = ['p', 'n', 'a', 'm'];
      for (const key of shortcuts) {
        console.log(`   Trying key: ${key}`);
        await page.keyboard.press(key);
        await page.waitForTimeout(500);
        
        // Check if anything changed
        const hasDialog = await page.$('dialog, [role="dialog"], .modal');
        if (hasDialog) {
          console.log(`✅ Shortcut '${key}' opened a dialog`);
          break;
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Test complete. Browser remains open for inspection.');
    console.log('Check the screenshots for visual documentation.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run test
testPinCreation().catch(console.error);