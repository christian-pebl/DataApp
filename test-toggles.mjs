import { chromium } from 'playwright';

async function testMasterToggles() {
  console.log('🎭 Launching browser...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log(`📝 Console: ${text}`);
  });

  // Capture errors
  page.on('pageerror', error => {
    console.error(`❌ Page Error: ${error}`);
  });

  try {
    console.log('🌐 Navigating to http://localhost:9002/map-drawing\n');
    await page.goto('http://localhost:9002/map-drawing', { waitUntil: 'networkidle' });

    console.log('⏳ Waiting for page to load...\n');
    await page.waitForTimeout(3000);

    // Find and click the active project to expand it
    console.log('📂 Looking for Active Project section...\n');
    const activeProjectButton = page.locator('text=Active Project').first();

    if (await activeProjectButton.isVisible()) {
      console.log('✅ Found Active Project button, clicking to expand...\n');
      await activeProjectButton.click();
      await page.waitForTimeout(1000);
    }

    // Find the master label toggle (Eye icon)
    console.log('🔍 Looking for master label toggle button...\n');
    const labelToggleButton = page.locator('button:has(svg)').filter({ hasText: '' }).nth(1); // Adjust selector as needed

    // Take screenshot before
    await page.screenshot({ path: 'before-toggle.png' });
    console.log('📸 Screenshot saved: before-toggle.png\n');

    // Click the master label toggle
    console.log('👆 Clicking master label toggle...\n');
    await page.locator('[class*="border-accent"] button').nth(1).click(); // First toggle button after Project Data

    await page.waitForTimeout(2000);

    // Take screenshot after
    await page.screenshot({ path: 'after-toggle.png' });
    console.log('📸 Screenshot saved: after-toggle.png\n');

    console.log('\n📋 Summary of Console Logs:');
    console.log('=' + '='.repeat(60));
    const relevantLogs = consoleLogs.filter(log =>
      log.includes('Toggle All') ||
      log.includes('🏷️') ||
      log.includes('📍') ||
      log.includes('projectId') ||
      log.includes('visible')
    );

    if (relevantLogs.length === 0) {
      console.log('⚠️  No relevant console logs found!');
      console.log('   This suggests the handler might not be firing.');
    } else {
      relevantLogs.forEach(log => console.log(`   ${log}`));
    }
    console.log('=' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Error during test:', error.message);
  } finally {
    console.log('\n⏸️  Pausing for 5 seconds so you can see the result...');
    await page.waitForTimeout(5000);

    await browser.close();
    console.log('✅ Test complete!');
  }
}

testMasterToggles();
