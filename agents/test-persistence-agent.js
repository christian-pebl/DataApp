const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Load test credentials
const testCredentials = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../test-credentials.json'), 'utf8')
);

/**
 * TEST PERSISTENCE AGENT
 * Purpose: Test file upload persistence across sessions
 */
class TestPersistenceAgent {
  constructor() {
    this.testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      passed: 0,
      failed: 0
    };
    this.browser = null;
  }

  async setup() {
    this.browser = await chromium.launch({
      headless: false,
      slowMo: 100
    });
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runTest(name, testFn) {
    console.log(`\n🧪 Running: ${name}`);
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      
      this.testResults.tests.push({
        name,
        status: 'PASSED',
        duration
      });
      this.testResults.passed++;
      
      console.log(`  ✅ PASSED (${duration}ms)`);
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.testResults.tests.push({
        name,
        status: 'FAILED',
        error: error.message,
        duration
      });
      this.testResults.failed++;
      
      console.log(`  ❌ FAILED: ${error.message}`);
      return false;
    }
  }

  async loginUser(page, userEmail) {
    const user = testCredentials.testUsers.find(u => u.email === userEmail);
    if (!user) throw new Error(`User ${userEmail} not found in test credentials`);
    
    await page.goto('http://localhost:9002/auth');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to map
    await page.waitForURL('**/map-drawing', { timeout: 10000 });
    console.log(`    Logged in as ${user.email}`);
  }

  async logout(page) {
    // Try to find logout button
    const menuButton = page.locator('button:has-text("Menu")').first();
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(500);
    }
    
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out")').first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForURL('**/auth', { timeout: 5000 });
      console.log('    Logged out successfully');
    }
  }

  async createPin(page, label = 'Test Pin') {
    // Click on map to create pin
    const map = page.locator('#map');
    await map.click({ position: { x: 400, y: 300 } });
    
    // Wait for pin dialog
    await page.waitForSelector('input[placeholder*="label" i], input[placeholder*="name" i]', { timeout: 5000 });
    
    // Fill in pin details
    const labelInput = page.locator('input[placeholder*="label" i], input[placeholder*="name" i]').first();
    await labelInput.fill(label);
    
    // Save pin
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveButton.click();
    
    await page.waitForTimeout(1000);
    console.log(`    Created pin: ${label}`);
    
    return label;
  }

  async uploadFile(page, pinLabel) {
    // Click on the pin
    const pinMarker = page.locator(`[title="${pinLabel}"], [aria-label="${pinLabel}"]`).first();
    if (await pinMarker.isVisible()) {
      await pinMarker.click();
    } else {
      // Try clicking on map near where we created it
      const map = page.locator('#map');
      await map.click({ position: { x: 400, y: 300 } });
    }
    
    await page.waitForTimeout(500);
    
    // Click upload button
    const uploadButton = page.locator('button:has-text("Upload data")').first();
    if (!await uploadButton.isVisible()) {
      // Open data dropdown first
      const dataButton = page.locator('button:has-text("Data")').first();
      await dataButton.click();
      await page.waitForTimeout(500);
    }
    
    // Set up file chooser
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('button:has-text("Upload data")').first().click();
    
    const fileChooser = await fileChooserPromise;
    
    // Create a test CSV file
    const testFileName = `test-${Date.now()}.csv`;
    const testFilePath = path.join(__dirname, testFileName);
    fs.writeFileSync(testFilePath, 'id,name,value\n1,Test,100\n2,Data,200');
    
    await fileChooser.setFiles(testFilePath);
    
    // Wait for upload to complete
    await page.waitForTimeout(3000);
    
    // Clean up test file
    fs.unlinkSync(testFilePath);
    
    console.log(`    Uploaded file: ${testFileName}`);
    return testFileName;
  }

  async checkFileExists(page, pinLabel, fileName) {
    // Click on the pin
    const pinMarker = page.locator(`[title="${pinLabel}"], [aria-label="${pinLabel}"]`).first();
    if (await pinMarker.isVisible()) {
      await pinMarker.click();
    } else {
      const map = page.locator('#map');
      await map.click({ position: { x: 400, y: 300 } });
    }
    
    await page.waitForTimeout(500);
    
    // Open explore data dropdown
    const exploreButton = page.locator('button:has-text("Explore data")').first();
    if (await exploreButton.isVisible()) {
      await exploreButton.click();
      await page.waitForTimeout(500);
    }
    
    // Check if file is in the list
    const fileItem = page.locator(`text=${fileName}`).first();
    const exists = await fileItem.isVisible({ timeout: 3000 }).catch(() => false);
    
    console.log(`    File "${fileName}" ${exists ? 'exists ✓' : 'NOT FOUND ✗'}`);
    return exists;
  }

  async runAllTests() {
    console.log('🚀 FILE PERSISTENCE TEST SUITE STARTING...\n');
    console.log('=' * 50);
    
    await this.setup();
    
    // Test 1: Basic File Persistence
    await this.runTest('Basic File Persistence', async () => {
      const context = await this.browser.newContext();
      const page = await context.newPage();
      
      // Login
      await this.loginUser(page, 'christiannberger@gmail.com');
      
      // Create pin and upload file
      const pinLabel = `Persistence Test ${Date.now()}`;
      await this.createPin(page, pinLabel);
      const fileName = await this.uploadFile(page, pinLabel);
      
      // Verify file appears
      const existsBefore = await this.checkFileExists(page, pinLabel, fileName);
      if (!existsBefore) throw new Error('File not visible after upload');
      
      // Logout
      await this.logout(page);
      
      // Login again
      await this.loginUser(page, 'christiannberger@gmail.com');
      
      // Check if file still exists
      const existsAfter = await this.checkFileExists(page, pinLabel, fileName);
      if (!existsAfter) throw new Error('File disappeared after logout/login');
      
      await context.close();
    });
    
    // Test 2: Multi-User Isolation
    await this.runTest('Multi-User File Isolation', async () => {
      const context1 = await this.browser.newContext();
      const context2 = await this.browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      // User 1 creates pin with file
      await this.loginUser(page1, 'christiannberger@gmail.com');
      const pinLabel = `Isolation Test ${Date.now()}`;
      await this.createPin(page1, pinLabel);
      const fileName = await this.uploadFile(page1, pinLabel);
      
      // User 2 logs in and checks
      await this.loginUser(page2, 'christian@pebl-cic.co.uk');
      
      // User 2 should NOT see User 1's file
      const user2Sees = await this.checkFileExists(page2, pinLabel, fileName);
      if (user2Sees) throw new Error('User 2 can see User 1 files - isolation failed!');
      
      // User 1 should still see their file
      const user1StillSees = await this.checkFileExists(page1, pinLabel, fileName);
      if (!user1StillSees) throw new Error('User 1 cannot see their own file');
      
      await context1.close();
      await context2.close();
    });
    
    // Test 3: Multiple Files on Same Pin
    await this.runTest('Multiple Files Per Pin', async () => {
      const context = await this.browser.newContext();
      const page = await context.newPage();
      
      await this.loginUser(page, 'christiannberger@gmail.com');
      
      const pinLabel = `Multi-File Test ${Date.now()}`;
      await this.createPin(page, pinLabel);
      
      // Upload 3 files
      const files = [];
      for (let i = 1; i <= 3; i++) {
        const fileName = await this.uploadFile(page, pinLabel);
        files.push(fileName);
        await page.waitForTimeout(1000);
      }
      
      // Logout and login
      await this.logout(page);
      await this.loginUser(page, 'christiannberger@gmail.com');
      
      // Check all files persist
      for (const fileName of files) {
        const exists = await this.checkFileExists(page, pinLabel, fileName);
        if (!exists) throw new Error(`File ${fileName} did not persist`);
      }
      
      await context.close();
    });
    
    await this.teardown();
    
    // Generate report
    this.generateReport();
  }
  
  generateReport() {
    console.log('\n' + '=' * 50);
    console.log('TEST RESULTS SUMMARY');
    console.log('=' * 50);
    console.log(`Total Tests: ${this.testResults.tests.length}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`Success Rate: ${(this.testResults.passed / this.testResults.tests.length * 100).toFixed(1)}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\nFailed Tests:');
      this.testResults.tests
        .filter(t => t.status === 'FAILED')
        .forEach(t => {
          console.log(`  - ${t.name}: ${t.error}`);
        });
    }
    
    // Save report
    const reportPath = path.join(__dirname, '../test-persistence-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
    console.log('\n📄 Full report saved to test-persistence-report.json');
    
    // Exit with appropriate code
    process.exit(this.testResults.failed > 0 ? 1 : 0);
  }
}

// Run the test agent
const agent = new TestPersistenceAgent();
agent.runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});