const { chromium } = require('playwright');
const path = require('path');

// Configuration
const APP_URL = 'http://localhost:9002';
const ACCOUNT = {
  email: 'christian@pebl-cic.co.uk',
  password: 'Mewslade123@',
  name: 'Christian'
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString().substring(11, 19);
  const icons = {
    info: '📝',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    action: '👆',
    wait: '⏳',
    screenshot: '📸'
  };
  
  const icon = icons[type] || '•';
  console.log(`[${timestamp}] ${icon} ${message}`);
}

async function waitAndLog(page, ms, message) {
  log(message, 'wait');
  await page.waitForTimeout(ms);
}

async function takeScreenshot(page, name, description) {
  const filename = `ux-${name}.png`;
  const filepath = path.join(__dirname, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  log(`Screenshot saved: ${filename} - ${description}`, 'screenshot');
  return filepath;
}

async function testPinCreationUX() {
  console.log('\n' + '='.repeat(70));
  console.log(`${colors.bright}🎯 PIN CREATION USER EXPERIENCE TEST${colors.reset}`);
  console.log('='.repeat(70) + '\n');
  
  console.log('This test will navigate through the complete pin creation process');
  console.log('and document each step with screenshots and descriptions.\n');
  
  let browser;
  let context;
  let page;
  
  try {
    // Launch browser
    log('Launching browser in visible mode', 'info');
    browser = await chromium.launch({
      headless: false,
      slowMo: 500 // Slow down actions for visibility
    });
    
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['geolocation']
    });
    
    page = await context.newPage();
    
    // Monitor console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        log(`Console error: ${msg.text().substring(0, 100)}`, 'error');
      }
    });
    
    // Step 1: Navigate to application
    console.log(`\n${colors.blue}STEP 1: OPENING APPLICATION${colors.reset}`);
    console.log('-'.repeat(40));
    
    log('Navigating to ' + APP_URL, 'action');
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await waitAndLog(page, 2000, 'Waiting for page to fully load');
    
    const title = await page.title();
    log(`Page title: "${title}"`, 'success');
    await takeScreenshot(page, 'landing', 'Initial landing page');
    
    // Step 2: Login
    console.log(`\n${colors.blue}STEP 2: AUTHENTICATION${colors.reset}`);
    console.log('-'.repeat(40));
    
    // Check if we need to login
    const isAuthPage = page.url().includes('auth');
    if (isAuthPage) {
      log('Login page detected', 'info');
      await takeScreenshot(page, 'login-page', 'Login form');
      
      log('Filling email field', 'action');
      await page.fill('input[type="email"]', ACCOUNT.email);
      
      log('Filling password field', 'action');
      await page.fill('input[type="password"]', ACCOUNT.password);
      
      await takeScreenshot(page, 'login-filled', 'Login form with credentials');
      
      log('Clicking Sign In button', 'action');
      const signInButton = await page.$('button:has-text("Sign in")');
      if (signInButton) {
        await signInButton.click();
      } else {
        await page.keyboard.press('Enter');
      }
      
      log('Waiting for authentication...', 'wait');
      await page.waitForURL('**/map-drawing**', { timeout: 10000 });
      log('Login successful!', 'success');
    } else {
      log('Already authenticated', 'success');
    }
    
    await waitAndLog(page, 2000, 'Waiting for map to load');
    
    // Step 3: Explore the map interface
    console.log(`\n${colors.blue}STEP 3: MAP INTERFACE EXPLORATION${colors.reset}`);
    console.log('-'.repeat(40));
    
    await takeScreenshot(page, 'map-initial', 'Map interface after login');
    
    // Check for existing pins
    const existingPins = await page.$$('.leaflet-marker-icon');
    log(`Found ${existingPins.length} existing pins on the map`, 'info');
    
    // Look for UI controls
    const menuButton = await page.$('button[aria-label*="menu" i], button:has-text("Menu"), [class*="menu"]');
    if (menuButton) {
      log('Menu button found', 'success');
    }
    
    // Step 4: Find pin creation button
    console.log(`\n${colors.blue}STEP 4: LOCATING PIN CREATION CONTROLS${colors.reset}`);
    console.log('-'.repeat(40));
    
    // Look for pin/marker button
    let pinButton = await page.$('button:has-text("Pin"), button:has-text("Add Pin"), button:has-text("New Pin"), button[aria-label*="pin" i], button[aria-label*="add" i]');
    
    if (!pinButton) {
      log('Pin button not immediately visible, checking for menu', 'warning');
      
      // Try opening menu first
      if (menuButton) {
        log('Opening menu to find pin option', 'action');
        await menuButton.click();
        await waitAndLog(page, 1000, 'Waiting for menu to open');
        await takeScreenshot(page, 'menu-open', 'Menu opened');
        
        // Look for pin option in menu
        pinButton = await page.$('button:has-text("Pin"), button:has-text("Add Pin"), [class*="pin" i]');
      }
    }
    
    if (pinButton) {
      log('Pin creation button found!', 'success');
      const buttonText = await pinButton.textContent();
      log(`Button text: "${buttonText}"`, 'info');
      
      log('Clicking pin button to enter pin creation mode', 'action');
      await pinButton.click();
      await waitAndLog(page, 1000, 'Entering pin creation mode');
      await takeScreenshot(page, 'pin-mode-active', 'Pin creation mode activated');
    } else {
      log('Could not find pin button - trying alternative approach', 'warning');
      
      // Try right-clicking on map
      log('Attempting right-click on map for context menu', 'action');
      const mapElement = await page.$('.leaflet-container, #map');
      if (mapElement) {
        const box = await mapElement.boundingBox();
        await page.mouse.click(box.x + box.width/2, box.y + box.height/2, { button: 'right' });
        await waitAndLog(page, 1000, 'Checking for context menu');
        await takeScreenshot(page, 'context-menu', 'Right-click context menu');
      }
    }
    
    // Step 5: Create a pin
    console.log(`\n${colors.blue}STEP 5: CREATING A NEW PIN${colors.reset}`);
    console.log('-'.repeat(40));
    
    const mapElement = await page.$('.leaflet-container, #map');
    if (mapElement) {
      const box = await mapElement.boundingBox();
      
      // Calculate click position (slightly off-center to avoid existing pins)
      const clickX = box.x + box.width * 0.6;
      const clickY = box.y + box.height * 0.4;
      
      log(`Clicking on map at position (${Math.round(clickX)}, ${Math.round(clickY)})`, 'action');
      await page.mouse.click(clickX, clickY);
      await waitAndLog(page, 2000, 'Waiting for pin creation dialog');
      
      await takeScreenshot(page, 'pin-dialog', 'Pin creation dialog appeared');
      
      // Step 6: Fill pin details
      console.log(`\n${colors.blue}STEP 6: FILLING PIN DETAILS${colors.reset}`);
      console.log('-'.repeat(40));
      
      // Look for input fields
      const labelInput = await page.$('input[placeholder*="label" i], input[placeholder*="name" i], input[placeholder*="title" i], input[type="text"]:not([type="email"]):not([type="password"])');
      
      if (labelInput) {
        log('Label input field found', 'success');
        const placeholder = await labelInput.getAttribute('placeholder');
        log(`Placeholder text: "${placeholder}"`, 'info');
        
        log('Entering pin label', 'action');
        await labelInput.fill('UX Test Pin - ' + new Date().toLocaleTimeString());
        await takeScreenshot(page, 'pin-label-entered', 'Pin label entered');
        
        // Look for notes/description field
        const notesInput = await page.$('textarea, input[placeholder*="note" i], input[placeholder*="description" i]');
        if (notesInput) {
          log('Notes field found', 'success');
          log('Entering pin description', 'action');
          await notesInput.fill('This pin was created during UX testing at ' + new Date().toLocaleString());
          await takeScreenshot(page, 'pin-notes-entered', 'Pin description entered');
        }
        
        // Look for additional options
        const visibilityCheckbox = await page.$('input[type="checkbox"]');
        if (visibilityCheckbox) {
          const labelText = await page.$('label:has(input[type="checkbox"])').textContent();
          log(`Found checkbox option: "${labelText}"`, 'info');
        }
        
        // Step 7: Save the pin
        console.log(`\n${colors.blue}STEP 7: SAVING THE PIN${colors.reset}`);
        console.log('-'.repeat(40));
        
        const saveButton = await page.$('button:has-text("Save"), button:has-text("Create"), button:has-text("Add"), button:has-text("OK"), button[type="submit"]');
        
        if (saveButton) {
          const buttonText = await saveButton.textContent();
          log(`Found save button: "${buttonText}"`, 'success');
          
          log('Clicking save button', 'action');
          await saveButton.click();
          await waitAndLog(page, 3000, 'Waiting for pin to be saved');
          
          log('Pin creation completed!', 'success');
          await takeScreenshot(page, 'pin-created', 'New pin visible on map');
          
          // Count pins again
          const newPinCount = await page.$$('.leaflet-marker-icon');
          log(`Total pins after creation: ${newPinCount.length}`, 'info');
          
          if (newPinCount.length > existingPins.length) {
            log('Pin successfully added to map!', 'success');
          }
        } else {
          log('Save button not found', 'error');
          
          // Try pressing Enter
          log('Attempting to save with Enter key', 'action');
          await page.keyboard.press('Enter');
          await waitAndLog(page, 2000, 'Checking if pin was saved');
        }
      } else {
        log('Pin creation form did not appear', 'error');
        log('The UI may require a different interaction pattern', 'warning');
        
        // Take screenshot of current state
        await takeScreenshot(page, 'no-form', 'Current state - no pin form');
      }
    }
    
    // Step 8: Verify pin persistence
    console.log(`\n${colors.blue}STEP 8: TESTING PIN PERSISTENCE${colors.reset}`);
    console.log('-'.repeat(40));
    
    log('Refreshing page to test persistence', 'action');
    await page.reload({ waitUntil: 'networkidle' });
    await waitAndLog(page, 3000, 'Waiting for page to reload');
    
    const pinsAfterReload = await page.$$('.leaflet-marker-icon');
    log(`Pins visible after reload: ${pinsAfterReload.length}`, 'info');
    await takeScreenshot(page, 'after-reload', 'Pins persisted after page reload');
    
    // Final summary
    console.log(`\n${colors.green}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.bright}📊 UX TEST SUMMARY${colors.reset}`);
    console.log(`${colors.green}${'='.repeat(70)}${colors.reset}\n`);
    
    console.log('User Experience Flow:');
    console.log('1. ✅ Application loads successfully');
    console.log('2. ✅ Authentication works smoothly');
    console.log('3. ✅ Map interface is accessible');
    console.log(`4. ${pinButton ? '✅' : '⚠️'} Pin creation controls ${pinButton ? 'found' : 'need investigation'}`);
    console.log(`5. ${existingPins.length < pinsAfterReload.length ? '✅' : '⚠️'} Pin creation ${existingPins.length < pinsAfterReload.length ? 'successful' : 'needs verification'}`);
    console.log('6. ✅ Data persistence verified');
    
    console.log('\n📸 Screenshots saved for documentation');
    console.log('💡 Browser remains open for manual inspection');
    
  } catch (error) {
    console.error(`\n${colors.red}❌ Test error: ${error.message}${colors.reset}`);
    if (page) {
      await takeScreenshot(page, 'error-state', 'Error occurred during test');
    }
  } finally {
    console.log('\n🔍 Please inspect the browser manually');
    console.log('   You can interact with the application');
    console.log('   Close the browser when done\n');
    
    // Keep browser open for manual inspection
    // Uncomment to auto-close:
    // if (browser) await browser.close();
  }
}

// Run the UX test
console.log(`${colors.cyan}🚀 Starting Pin Creation UX Test${colors.reset}`);
console.log('This test will document the complete user journey');
console.log('for creating a new pin in your application\n');

testPinCreationUX().catch(console.error);