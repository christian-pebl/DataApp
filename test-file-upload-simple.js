const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Load test credentials
const testCredentials = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'test-credentials.json'), 'utf8')
);

async function testFileUpload() {
  console.log('🧪 Testing File Upload and Persistence\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Browser Error:', msg.text());
    } else if (msg.text().includes('file') || msg.text().includes('File') || msg.text().includes('pin')) {
      console.log('📝 Browser Log:', msg.text());
    }
  });
  
  try {
    // Step 1: Login
    console.log('1️⃣ Logging in...');
    const user = testCredentials.testUsers[0];
    await page.goto('http://localhost:9002/auth');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/map-drawing', { timeout: 10000 });
    console.log('   ✅ Logged in successfully\n');
    
    // Wait for map to load
    await page.waitForTimeout(3000);
    
    // Step 2: Click on map to create a pin
    console.log('2️⃣ Creating a pin...');
    const map = page.locator('.leaflet-container').first();
    await map.click({ position: { x: 400, y: 300 } });
    
    // Wait for popup/dialog
    await page.waitForTimeout(1000);
    
    // Look for label input
    const labelInput = page.locator('input[placeholder*="label" i], input[placeholder*="name" i], input[placeholder*="Label" i]').first();
    if (await labelInput.isVisible()) {
      const pinLabel = `Test Pin ${Date.now()}`;
      await labelInput.fill(pinLabel);
      console.log(`   📍 Pin label: ${pinLabel}`);
      
      // Save the pin
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Add"), button:has-text("Create")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        console.log('   ✅ Pin created\n');
        await page.waitForTimeout(2000);
      }
    }
    
    // Step 3: Click on the pin we just created
    console.log('3️⃣ Selecting the pin...');
    await map.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(1000);
    
    // Step 4: Look for upload button
    console.log('4️⃣ Looking for upload option...');
    
    // First try to find and click Data button
    const dataButton = page.locator('button:has-text("Data")').first();
    if (await dataButton.isVisible()) {
      console.log('   📊 Found Data button, clicking...');
      await dataButton.click();
      await page.waitForTimeout(500);
    }
    
    // Look for upload button
    const uploadButton = page.locator('button:has-text("Upload data"), button:has-text("Upload")').first();
    if (await uploadButton.isVisible()) {
      console.log('   📤 Found Upload button\n');
      
      // Step 5: Upload a file
      console.log('5️⃣ Uploading file...');
      
      // Create test CSV file
      const testFileName = `test-data-${Date.now()}.csv`;
      const testFilePath = path.join(__dirname, testFileName);
      const csvContent = 'id,name,value,timestamp\n1,Test,100,2025-01-09\n2,Data,200,2025-01-09\n3,Sample,300,2025-01-09';
      fs.writeFileSync(testFilePath, csvContent);
      console.log(`   📄 Created test file: ${testFileName}`);
      
      // Set up file chooser
      const fileChooserPromise = page.waitForEvent('filechooser');
      await uploadButton.click();
      
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(testFilePath);
      console.log('   ⏳ Uploading...');
      
      // Wait for upload to complete
      await page.waitForTimeout(5000);
      
      // Clean up test file
      fs.unlinkSync(testFilePath);
      
      console.log('   ✅ File upload completed\n');
      
      // Step 6: Check if file appears in the list
      console.log('6️⃣ Checking if file appears in UI...');
      
      // Look for explore data button
      const exploreButton = page.locator('button:has-text("Explore data")').first();
      if (await exploreButton.isVisible()) {
        const buttonText = await exploreButton.textContent();
        console.log(`   📊 Explore button shows: ${buttonText}`);
        
        // Click to open dropdown
        await exploreButton.click();
        await page.waitForTimeout(1000);
        
        // Check for file in list
        const fileInList = await page.locator(`text=${testFileName}`).isVisible();
        if (fileInList) {
          console.log(`   ✅ File "${testFileName}" is visible in the list!\n`);
        } else {
          console.log(`   ❌ File "${testFileName}" NOT found in the list\n`);
        }
      }
      
      // Step 7: Logout
      console.log('7️⃣ Logging out...');
      await page.keyboard.press('Escape'); // Close any dialogs
      await page.waitForTimeout(500);
      
      const menuButton = page.locator('button:has-text("Menu")').first();
      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(500);
        
        const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out")').first();
        if (await logoutButton.isVisible()) {
          await logoutButton.click();
          await page.waitForURL('**/auth', { timeout: 5000 });
          console.log('   ✅ Logged out\n');
        }
      }
      
      // Step 8: Login again
      console.log('8️⃣ Logging in again...');
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/map-drawing', { timeout: 10000 });
      console.log('   ✅ Logged in again\n');
      
      // Wait for everything to load
      await page.waitForTimeout(5000);
      
      // Step 9: Check if pin and file persist
      console.log('9️⃣ Checking persistence...');
      
      // Click on the pin location
      await map.click({ position: { x: 400, y: 300 } });
      await page.waitForTimeout(1000);
      
      // Check for data button
      if (await dataButton.isVisible()) {
        await dataButton.click();
        await page.waitForTimeout(500);
        
        // Check explore button
        if (await exploreButton.isVisible()) {
          const buttonText = await exploreButton.textContent();
          console.log(`   📊 After re-login, Explore button shows: ${buttonText}`);
          
          if (buttonText.includes('0 file')) {
            console.log('   ❌ FILES DID NOT PERSIST - Shows 0 files');
          } else {
            console.log('   ✅ Files appear to have persisted');
            
            // Open dropdown to verify
            await exploreButton.click();
            await page.waitForTimeout(1000);
            
            const fileStillThere = await page.locator(`text=${testFileName}`).isVisible();
            if (fileStillThere) {
              console.log(`   ✅ SUCCESS: File "${testFileName}" persisted after logout/login!`);
            } else {
              console.log(`   ❌ FAIL: File "${testFileName}" is gone after logout/login`);
            }
          }
        }
      }
      
    } else {
      console.log('   ❌ Could not find upload button');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    console.log('\n🏁 Test complete. Browser will close in 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

// Run the test
testFileUpload().catch(console.error);