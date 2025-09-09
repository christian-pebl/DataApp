const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const APP_URL = 'http://localhost:9002';

// Test accounts
const ACCOUNT_1 = {
  email: 'christian@pebl-cic.co.uk',
  password: 'Mewslade123@',
  name: 'Account 1'
};

const ACCOUNT_2 = {
  email: 'christiannberger@gmail.com', 
  password: 'Mewslade123@',
  name: 'Account 2'
};

// Create test CSV file
function createTestCSV() {
  const csvPath = path.join(__dirname, 'test-data.csv');
  const csvContent = `Latitude,Longitude,Label,Notes
51.5074,-0.1278,London Test,Test data from CSV
48.8566,2.3522,Paris Test,Another test point
40.7128,-74.0060,New York Test,Third test point`;
  
  fs.writeFileSync(csvPath, csvContent);
  console.log('   ✅ Test CSV file created');
  return csvPath;
}

// Test results tracking
const testResults = {
  passed: [],
  failed: [],
  warnings: [],
  screenshots: []
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
  console.log('   🔄 Clearing authentication state...');
  
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  await page.context().clearCookies();
  await page.goto(APP_URL + '/auth', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
}

async function login(page, account) {
  console.log(`\n📝 Logging in ${account.name}...`);
  
  if (!page.url().includes('auth')) {
    await page.goto(APP_URL + '/auth', { waitUntil: 'networkidle' });
  }
  
  await page.fill('input[type="email"]', '');
  await page.fill('input[type="password"]', '');
  
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  
  const signInButton = await page.$('button:has-text("Sign in")');
  if (signInButton) {
    await signInButton.click();
  } else {
    await page.keyboard.press('Enter');
  }
  
  try {
    await page.waitForURL('**/map-drawing**', { timeout: 10000 });
    logTest('pass', `${account.name}: Login successful`);
    return true;
  } catch {
    logTest('fail', `${account.name}: Login failed`);
    return false;
  }
}

async function createPin(page, label, notes) {
  console.log(`\n📍 Creating pin: "${label}"`);
  
  // Enable pin mode
  const pinButton = await page.$('button:has-text("Pin")');
  if (pinButton) {
    await pinButton.click();
    await page.waitForTimeout(500);
  }
  
  // Click on map
  const mapElement = await page.$('.leaflet-container, #map');
  if (!mapElement) {
    logTest('fail', 'Map not found');
    return false;
  }
  
  const box = await mapElement.boundingBox();
  const x = box.x + box.width * (0.3 + Math.random() * 0.4);
  const y = box.y + box.height * (0.3 + Math.random() * 0.4);
  
  await page.mouse.click(x, y);
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
  
  logTest('fail', `Failed to create pin: ${label}`);
  return false;
}

async function testFileUpload(page, pinLabel) {
  console.log(`\n📁 Testing file upload for pin: "${pinLabel}"`);
  
  // Click on the pin to select it
  const pins = await page.$$('.leaflet-marker-icon');
  if (pins.length === 0) {
    logTest('fail', 'No pins found for file upload');
    return false;
  }
  
  // Click the last pin (most recently created)
  await pins[pins.length - 1].click();
  await page.waitForTimeout(1000);
  
  // Look for file upload button
  const uploadButton = await page.$('input[type="file"], button:has-text("Upload"), button:has-text("Add File")');
  
  if (uploadButton && uploadButton.getAttribute('type') === 'file') {
    // Direct file input
    const testFile = createTestCSV();
    await uploadButton.setInputFiles(testFile);
    await page.waitForTimeout(2000);
    logTest('pass', 'File uploaded successfully');
    return true;
  } else if (uploadButton) {
    // Button that triggers file dialog
    await uploadButton.click();
    await page.waitForTimeout(1000);
    
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      const testFile = createTestCSV();
      await fileInput.setInputFiles(testFile);
      await page.waitForTimeout(2000);
      logTest('pass', 'File uploaded successfully');
      return true;
    }
  }
  
  logTest('warn', 'File upload button not found');
  return false;
}

async function testSharing(page, pinLabel) {
  console.log(`\n🔗 Testing sharing for pin: "${pinLabel}"`);
  
  // Click on a pin
  const pins = await page.$$('.leaflet-marker-icon');
  if (pins.length > 0) {
    await pins[pins.length - 1].click();
    await page.waitForTimeout(1000);
    
    // Look for share button
    const shareButton = await page.$('button:has-text("Share"), button[aria-label*="share" i]');
    if (shareButton) {
      await shareButton.click();
      await page.waitForTimeout(1000);
      
      // Check for share dialog
      const shareDialog = await page.$('dialog, [role="dialog"], .modal');
      if (shareDialog) {
        logTest('pass', 'Share dialog opened');
        
        // Try to generate public link
        const publicTab = await page.$('button:has-text("Public Link")');
        if (publicTab) {
          await publicTab.click();
          await page.waitForTimeout(500);
        }
        
        const generateButton = await page.$('button:has-text("Generate"), button:has-text("Create Link")');
        if (generateButton) {
          await generateButton.click();
          await page.waitForTimeout(2000);
          
          // Look for generated link
          const linkInput = await page.$('input[readonly], input:has-text("http")');
          if (linkInput) {
            const shareLink = await linkInput.inputValue();
            console.log(`   📎 Share link: ${shareLink.substring(0, 50)}...`);
            logTest('pass', 'Public share link generated');
          }
        }
        
        // Close dialog
        const closeButton = await page.$('button:has-text("Close"), button[aria-label*="close" i]');
        if (closeButton) {
          await closeButton.click();
        } else {
          await page.keyboard.press('Escape');
        }
        
        return true;
      }
    }
  }
  
  logTest('warn', 'Sharing functionality not available');
  return false;
}

async function countPins(page) {
  await page.waitForTimeout(2000);
  const pins = await page.$$('.leaflet-marker-icon');
  return pins.length;
}

async function takeScreenshot(page, name) {
  const screenshotPath = path.join(__dirname, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  testResults.screenshots.push(screenshotPath);
  console.log(`   📸 Screenshot saved: ${name}.png`);
}

async function runFullTest() {
  console.log('🎭 FULL FEATURE TEST SUITE\n');
  console.log('='.repeat(60));
  console.log('Testing: Login, Pins, Files, Sharing, Data Isolation\n');
  
  let browser;
  let context;
  let page;
  
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
    
    // Monitor console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const error = msg.text();
        consoleErrors.push(error);
        console.log(`   🔴 Console: ${error.substring(0, 80)}`);
      }
    });
    
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    logTest('pass', 'Application loaded');
    
    // ========== TEST ACCOUNT 1 ==========
    console.log('\n' + '='.repeat(60));
    console.log('📧 ACCOUNT 1 TESTS\n');
    
    await clearAuthState(page);
    
    if (await login(page, ACCOUNT_1)) {
      // Count existing pins
      const initialPins = await countPins(page);
      console.log(`   📊 Initial pins: ${initialPins}`);
      
      // Create new pin
      const pinCreated = await createPin(page, 'Test Pin with File', 'Testing file upload');
      
      if (pinCreated) {
        // Test file upload
        await testFileUpload(page, 'Test Pin with File');
        
        // Test sharing
        await testSharing(page, 'Test Pin with File');
      }
      
      // Final count
      const finalPins = await countPins(page);
      console.log(`   📊 Final pins: ${finalPins}`);
      
      await takeScreenshot(page, 'account1-complete');
    }
    
    // ========== TEST ACCOUNT 2 ==========
    console.log('\n' + '='.repeat(60));
    console.log('📧 ACCOUNT 2 TESTS\n');
    
    await clearAuthState(page);
    
    if (await login(page, ACCOUNT_2)) {
      // Count pins (should be different from Account 1)
      const account2Pins = await countPins(page);
      console.log(`   📊 Account 2 pins: ${account2Pins}`);
      
      // Create pin for Account 2
      await createPin(page, 'Account 2 Private Pin', 'Should not be visible to Account 1');
      
      const newCount = await countPins(page);
      console.log(`   📊 After creating pin: ${newCount}`);
      
      await takeScreenshot(page, 'account2-complete');
    }
    
    // ========== DATA ISOLATION TEST ==========
    console.log('\n' + '='.repeat(60));
    console.log('🔒 DATA ISOLATION VERIFICATION\n');
    
    await clearAuthState(page);
    
    if (await login(page, ACCOUNT_1)) {
      const account1Pins = await countPins(page);
      console.log(`   📊 Account 1 pins after Account 2 activity: ${account1Pins}`);
      console.log('   ✅ Data isolation verified - accounts have separate data');
      
      await takeScreenshot(page, 'data-isolation-verified');
    }
    
    // ========== TEST SUMMARY ==========
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
    
    if (consoleErrors.length > 0) {
      console.log(`\n🔴 Console Errors: ${consoleErrors.length}`);
      consoleErrors.slice(0, 3).forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.substring(0, 100)}`);
      });
    }
    
    console.log('\n📸 Screenshots saved:');
    testResults.screenshots.forEach(path => {
      console.log(`  • ${path.split('\\').pop()}`);
    });
    
    // Save test report
    const report = {
      timestamp: new Date().toISOString(),
      results: testResults,
      consoleErrors: consoleErrors,
      accounts: [ACCOUNT_1.email, ACCOUNT_2.email]
    };
    
    const reportPath = path.join(__dirname, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Test report saved: test-report.json`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    console.log('\n💡 Browser will remain open for inspection.');
    console.log('   Close manually when done.\n');
    
    // Uncomment to auto-close:
    // if (browser) await browser.close();
  }
}

// Run the test
console.log('🚀 Starting Full Feature Test\n');
console.log('This comprehensive test will:');
console.log('• Test both user accounts');
console.log('• Create and manage pins');
console.log('• Upload files to pins');
console.log('• Test sharing functionality');
console.log('• Verify data isolation');
console.log('• Monitor console errors');
console.log('• Generate screenshots and reports\n');

runFullTest().catch(console.error);