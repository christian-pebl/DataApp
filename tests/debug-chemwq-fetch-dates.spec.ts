import { test, expect } from '@playwright/test';

test.describe('Debug CHEMWQ Fetch Dates Issue', () => {
  test('capture console logs when clicking Fetch Times button', async ({ page }) => {
    // Array to store all console messages
    const consoleMessages: Array<{ type: string; text: string; timestamp: number }> = [];
    const errors: Array<{ message: string; timestamp: number }> = [];

    // Capture all console messages
    page.on('console', (msg) => {
      const timestamp = Date.now();
      const type = msg.type();
      const text = msg.text();

      consoleMessages.push({ type, text, timestamp });

      // Log to test output in real-time
      console.log(`[${type.toUpperCase()}] ${text}`);
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      const timestamp = Date.now();
      errors.push({ message: error.message, timestamp });
      console.error(`[PAGE ERROR] ${error.message}`);
    });

    // Step 1: Navigate to home page
    console.log('\n🚀 Step 1: Navigating to home page...');
    await page.goto('http://localhost:9002/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Step 2: Login
    console.log('🔑 Step 2: Logging in...');

    // Look for email input field
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ timeout: 10000 });
    await emailInput.fill('christian@pebl-cic.co.uk');

    // Look for password input field
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill('mewslade');

    // Look for login button
    const loginButton = page.locator('button:has-text("Sign In"), button:has-text("Login"), button:has-text("Log In"), button[type="submit"]').first();
    await loginButton.click();

    console.log('⏳ Waiting for authentication...');
    await page.waitForTimeout(3000);

    // Take screenshot after login
    await page.screenshot({ path: 'tests/screenshots/chemwq-after-login.png', fullPage: true });
    console.log('📸 Screenshot saved: chemwq-after-login.png');

    // Step 3: Navigate to map-drawing page
    console.log('\n🗺️  Step 3: Navigating to map-drawing page...');
    await page.goto('http://localhost:9002/map-drawing', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for the page to be fully loaded
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(5000);

    // Take a screenshot of the initial state
    await page.screenshot({ path: 'tests/screenshots/chemwq-initial-state.png', fullPage: true });
    console.log('📸 Screenshot saved: chemwq-initial-state.png');

    // Step 4: Handle "Migrate Local Data" dialog if present
    console.log('\n🔄 Step 4: Checking for migration dialog...');

    try {
      const closeButton = page.locator('button:has-text("Close"), button:has-text("Keep Local Only")').first();
      if (await closeButton.isVisible({ timeout: 3000 })) {
        await closeButton.click();
        console.log('✅ Closed migration dialog');
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      console.log('ℹ️  No migration dialog found');
    }

    // Step 5: Select "Bideford Bay" project
    console.log('\n📋 Step 5: Selecting "Bideford Bay" project...');

    // Look for project selector/dropdown
    const projectSelector = page.locator('button:has-text("Bideford Bay"), select:has-text("Bideford Bay"), [role="combobox"]:has-text("project"), button:has-text("Project")').first();

    try {
      await projectSelector.waitFor({ timeout: 5000 });
      await projectSelector.click();
      console.log('✅ Clicked project selector');

      // Wait a bit for dropdown to open
      await page.waitForTimeout(1000);

      // Try to find and click Bideford Bay option
      const bidefordOption = page.locator('text="Bideford Bay"').first();
      if (await bidefordOption.isVisible({ timeout: 2000 })) {
        await bidefordOption.click();
        console.log('✅ Selected Bideford Bay project');
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('⚠️  Could not find project selector, assuming already on correct project');
    }

    await page.screenshot({ path: 'tests/screenshots/chemwq-project-selected.png', fullPage: true });
    console.log('📸 Screenshot saved: chemwq-project-selected.png');

    // Step 6: Open the "Project Data" panel to see file list
    console.log('\n📂 Step 6: Opening Project Data panel...');

    try {
      const projectDataButton = page.locator('button:has-text("Project Data")').first();
      if (await projectDataButton.isVisible({ timeout: 5000 })) {
        await projectDataButton.click();
        console.log('✅ Clicked Project Data button');
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('⚠️  Could not find Project Data button');
    }

    await page.screenshot({ path: 'tests/screenshots/chemwq-project-data-opened.png', fullPage: true });
    console.log('📸 Screenshot saved: chemwq-project-data-opened.png');

    // Step 7: Find and select "Alga License Area" in the list
    console.log('\n📍 Step 7: Looking for "Alga License Area" in the file list...');

    const areaSelectors = [
      'text="Alga License Area"',
      '[title="Alga License Area"]',
      'button:has-text("Alga License Area")',
      'div:has-text("Alga License Area")',
      'span:has-text("Alga License Area")'
    ];

    let areaFound = false;
    for (const selector of areaSelectors) {
      try {
        const area = page.locator(selector).first();
        if (await area.isVisible({ timeout: 3000 })) {
          await area.click();
          console.log(`✅ Clicked on Alga License Area (selector: ${selector})`);
          areaFound = true;
          await page.waitForTimeout(2000);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!areaFound) {
      console.log('⚠️  Could not find Alga License Area in the list');
      console.log('📝 Listing all visible text on page to help debug...');

      // Try to list all available areas/files
      const allText = await page.locator('body').textContent();
      if (allText && allText.includes('ALGA')) {
        console.log('✅ Found "ALGA" text on page');
      } else {
        console.log('❌ No "ALGA" text found on page');
      }
    }

    await page.screenshot({ path: 'tests/screenshots/chemwq-area-selected.png', fullPage: true });
    console.log('📸 Screenshot saved: chemwq-area-selected.png');

    // Step 8: Look for the "Fetch Times" button (between Merge and Table buttons, top right)
    console.log('\n🔍 Step 8: Looking for "Fetch Times" button...');

    // Try different selectors to find the button
    const possibleSelectors = [
      'button:has-text("Fetch Times")',
      'button:has-text("Fetch Date")',
      'button:has-text("Fetch")',
      '[data-testid*="fetch"]',
      'button:text-matches("fetch", "i")'
    ];

    let fetchButton = null;
    for (const selector of possibleSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 2000 })) {
          fetchButton = button;
          console.log(`✅ Found button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!fetchButton) {
      console.log('❌ Could not find "Fetch Times" button');
      console.log('📝 All buttons on page:');
      const buttons = await page.locator('button').all();
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text && text.trim()) {
          console.log(`  - "${text.trim()}"`);
        }
      }

      // Take screenshot showing current state
      await page.screenshot({ path: 'tests/screenshots/chemwq-no-button-found.png', fullPage: true });
      throw new Error('Fetch Times button not found');
    }

    // Clear console messages array to only capture logs from button click onwards
    consoleMessages.length = 0;
    errors.length = 0;

    console.log('\n🖱️  Clicking "Fetch Times" button...');
    await fetchButton.click();

    // Wait for any processing to complete
    console.log('⏳ Waiting for processing...');
    await page.waitForTimeout(5000);

    // Take a screenshot after clicking
    await page.screenshot({ path: 'tests/screenshots/chemwq-after-fetch.png', fullPage: true });
    console.log('📸 Screenshot saved: chemwq-after-fetch.png');

    // Report findings
    console.log('\n' + '='.repeat(80));
    console.log('📊 CONSOLE LOG ANALYSIS');
    console.log('='.repeat(80));

    if (consoleMessages.length === 0) {
      console.log('⚠️  No console messages captured during fetch operation');
    } else {
      console.log(`\n📝 Captured ${consoleMessages.length} console messages:\n`);

      // Group by type
      const byType = consoleMessages.reduce((acc, msg) => {
        acc[msg.type] = acc[msg.type] || [];
        acc[msg.type].push(msg);
        return acc;
      }, {} as Record<string, typeof consoleMessages>);

      Object.entries(byType).forEach(([type, messages]) => {
        console.log(`\n${type.toUpperCase()} (${messages.length} messages):`);
        console.log('-'.repeat(80));
        messages.forEach((msg, idx) => {
          console.log(`${idx + 1}. ${msg.text}`);
        });
      });
    }

    if (errors.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('❌ PAGE ERRORS');
      console.log('='.repeat(80));
      errors.forEach((error, idx) => {
        console.log(`${idx + 1}. ${error.message}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('🔍 Look for patterns in the logs above related to:');
    console.log('  - Date parsing errors');
    console.log('  - Format detection (DD/MM vs MM/DD)');
    console.log('  - CSV parsing issues');
    console.log('  - CHEMWQ file type detection');
    console.log('='.repeat(80) + '\n');

    // Don't fail the test, we just want to capture logs
    // expect(errors.length).toBe(0);
  });
});
