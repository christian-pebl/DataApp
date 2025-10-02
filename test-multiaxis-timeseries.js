/**
 * Test Script for Multi-Axis Time Series Feature
 * Tests the new multi-axis toggle functionality in PinChartDisplay.tsx
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Configuration
const APP_URL = 'http://localhost:9002';
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');

// Test credentials - using existing account
const TEST_ACCOUNT = {
  email: 'christian@pebl-cic.co.uk',
  password: 'Mewslade123@'
};

// Console and error tracking
const testLogs = {
  consoleErrors: [],
  consoleWarnings: [],
  pageErrors: [],
  networkErrors: [],
  allConsole: []
};

const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

function log(icon, message) {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`[${timestamp}] ${icon} ${message}`);
}

function logTest(status, message) {
  const icons = { pass: '✅', fail: '❌', warn: '⚠️' };
  log(icons[status] || '•', message);

  if (status === 'pass') testResults.passed.push(message);
  else if (status === 'fail') testResults.failed.push(message);
  else testResults.warnings.push(message);
}

async function takeScreenshot(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  const filepath = path.join(SCREENSHOT_DIR, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  log('📸', `Screenshot saved: ${filepath}`);
  return filepath;
}

async function waitForElement(page, selector, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function testMultiAxisTimeSeries() {
  console.log('🎭 Multi-Axis Time Series Feature Test');
  console.log('='.repeat(70));
  console.log('Testing: PinChartDisplay.tsx multi-axis toggle functionality\n');

  let browser;
  let page;

  try {
    // Launch browser
    log('🚀', 'Launching browser...');
    browser = await chromium.launch({
      headless: false,
      slowMo: 500 // Slow down for visibility
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
    });

    page = await context.newPage();

    // Setup console monitoring
    page.on('console', msg => {
      const log = {
        type: msg.type(),
        text: msg.text(),
        time: new Date().toISOString()
      };

      testLogs.allConsole.push(log);

      if (msg.type() === 'error') {
        testLogs.consoleErrors.push(log);
        console.log(`🔴 Console Error: ${msg.text()}`);
      } else if (msg.type() === 'warning') {
        testLogs.consoleWarnings.push(log);
      }
    });

    page.on('pageerror', error => {
      testLogs.pageErrors.push({
        message: error.message,
        stack: error.stack,
        time: new Date().toISOString()
      });
      console.log(`❌ Page Error: ${error.message}`);
    });

    // Monitor network for failed requests
    page.on('response', response => {
      if (!response.ok() && response.status() !== 304) {
        testLogs.networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          time: new Date().toISOString()
        });
      }
    });

    // ========== STEP 1: Navigate to App ==========
    console.log('\n' + '='.repeat(70));
    console.log('📍 STEP 1: Navigate to Application\n');

    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    logTest('pass', 'Application loaded');
    await takeScreenshot(page, 'step1-initial-load');

    // Check for immediate console errors
    await page.waitForTimeout(2000);
    if (testLogs.consoleErrors.length > 0) {
      logTest('warn', `${testLogs.consoleErrors.length} console errors on initial load`);
    } else {
      logTest('pass', 'No console errors on initial load');
    }

    // ========== STEP 2: Login ==========
    console.log('\n' + '='.repeat(70));
    console.log('🔐 STEP 2: Login to Application\n');

    const isLoginPage = page.url().includes('/auth') || await page.$('input[type="email"]') !== null;

    if (isLoginPage) {
      log('📝', 'Attempting login...');

      await page.fill('input[type="email"]', TEST_ACCOUNT.email);
      await page.fill('input[type="password"]', TEST_ACCOUNT.password);

      const signInButton = await page.$('button:has-text("Sign in")');
      if (signInButton) {
        await signInButton.click();
        await page.waitForTimeout(3000);

        if (!page.url().includes('/auth')) {
          logTest('pass', 'Successfully logged in');
        } else {
          logTest('warn', 'Still on auth page - may need verification');
        }
      }
    } else {
      logTest('pass', 'Already logged in or no auth required');
    }

    await takeScreenshot(page, 'step2-after-login');

    // ========== STEP 3: Navigate to Map/Drawing Page ==========
    console.log('\n' + '='.repeat(70));
    console.log('🗺️  STEP 3: Navigate to Map Drawing Page\n');

    // Try to navigate to map-drawing page
    const mapUrl = APP_URL + '/map-drawing';
    await page.goto(mapUrl, { waitUntil: 'networkidle', timeout: 30000 });
    logTest('pass', 'Navigated to map-drawing page');

    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'step3-map-drawing-page');

    // Check for any console errors after navigation
    if (testLogs.consoleErrors.length > 0) {
      logTest('warn', `${testLogs.consoleErrors.length} total console errors detected`);
    }

    // ========== STEP 4: Look for Pins and Data ==========
    console.log('\n' + '='.repeat(70));
    console.log('📊 STEP 4: Check for Existing Pins with Data\n');

    // Look for pins on the map
    const pins = await page.$$('.leaflet-marker-icon');
    log('📍', `Found ${pins.length} pin(s) on the map`);

    if (pins.length > 0) {
      logTest('pass', `Found ${pins.length} existing pins`);

      // Click on the first pin to open its data
      log('🖱️', 'Clicking on first pin...');
      await pins[0].click();
      await page.waitForTimeout(2000);

      await takeScreenshot(page, 'step4-pin-clicked');

      // Look for "Explore data" button or similar
      const exploreButtons = [
        'button:has-text("Explore data")',
        'button:has-text("View data")',
        'button:has-text("Chart")',
        'button:has-text("Data")'
      ];

      let exploreButton = null;
      for (const selector of exploreButtons) {
        exploreButton = await page.$(selector);
        if (exploreButton) {
          log('✨', `Found button: ${selector}`);
          break;
        }
      }

      if (exploreButton) {
        logTest('pass', 'Found data exploration button');
        await exploreButton.click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, 'step4-explore-data-clicked');
      } else {
        logTest('warn', 'Could not find data exploration button');
      }
    } else {
      logTest('warn', 'No pins found - need to create a pin with data first');
    }

    // ========== STEP 5: Look for Time Series Chart ==========
    console.log('\n' + '='.repeat(70));
    console.log('📈 STEP 5: Check for Time Series Chart Component\n');

    // Check if chart component is rendered
    const chartExists = await page.$('.recharts-wrapper') !== null;

    if (chartExists) {
      logTest('pass', 'Time series chart component found (recharts-wrapper)');

      // Look for the multi-axis toggle switch
      const switches = await page.$$('[role="switch"]');
      log('🔍', `Found ${switches.length} switch element(s)`);

      // Look for multi-axis specific elements
      const multiAxisText = await page.$('text="Multi"');
      const singleAxisText = await page.$('text="Single"');

      if (multiAxisText && singleAxisText) {
        logTest('pass', 'Multi-axis toggle UI found (Single/Multi labels)');
        await takeScreenshot(page, 'step5-multiaxis-toggle-visible');

        // ========== STEP 6: Test Multi-Axis Toggle ==========
        console.log('\n' + '='.repeat(70));
        console.log('🔄 STEP 6: Test Multi-Axis Toggle Functionality\n');

        // Find the switch between Single and Multi labels
        const toggleSwitch = await page.$('div:has(> span:text("Single")) + div:has([role="switch"])');

        if (toggleSwitch || switches.length > 0) {
          const switchToClick = toggleSwitch || switches[switches.length - 1];

          // Test toggling to multi-axis mode
          log('🖱️', 'Clicking multi-axis toggle...');
          await switchToClick.click();
          await page.waitForTimeout(2000);

          await takeScreenshot(page, 'step6-multiaxis-enabled');

          // Check for any errors after toggle
          const errorsBeforeToggle = testLogs.consoleErrors.length;
          await page.waitForTimeout(1000);
          const errorsAfterToggle = testLogs.consoleErrors.length;

          if (errorsAfterToggle > errorsBeforeToggle) {
            logTest('fail', `Toggle caused ${errorsAfterToggle - errorsBeforeToggle} new console error(s)`);
          } else {
            logTest('pass', 'Multi-axis toggle activated without errors');
          }

          // Check if chart re-rendered
          const chartStillExists = await page.$('.recharts-wrapper') !== null;
          if (chartStillExists) {
            logTest('pass', 'Chart still rendering after toggle');
          } else {
            logTest('fail', 'Chart disappeared after toggle');
          }

          // Toggle back to single axis
          log('🖱️', 'Toggling back to single axis...');
          await switchToClick.click();
          await page.waitForTimeout(2000);

          await takeScreenshot(page, 'step6-single-axis-restored');

          if (testLogs.consoleErrors.length === errorsAfterToggle) {
            logTest('pass', 'Toggle back to single axis without errors');
          } else {
            logTest('fail', 'Errors occurred when toggling back');
          }
        } else {
          logTest('fail', 'Could not find multi-axis toggle switch');
        }
      } else {
        logTest('fail', 'Multi-axis toggle labels not found');
      }
    } else {
      logTest('warn', 'Time series chart not found - may need data with time column');
    }

    // ========== STEP 7: Check for Multi-Axis Specific Elements ==========
    console.log('\n' + '='.repeat(70));
    console.log('🎨 STEP 7: Check for Multi-Axis Visual Elements\n');

    // Look for multiple Y-axes
    const yAxes = await page.$$('.recharts-yAxis');
    log('📊', `Found ${yAxes.length} Y-axis element(s)`);

    if (yAxes.length > 1) {
      logTest('pass', `Multiple Y-axes rendered (${yAxes.length})`);
    } else if (yAxes.length === 1) {
      logTest('pass', 'Single Y-axis mode (expected when toggle is off)');
    } else {
      logTest('warn', 'No Y-axis elements found');
    }

    // Check for warning message about too many parameters
    const warningMessage = await page.$('text=/Multi-axis works best with 4 or fewer parameters/i');
    if (warningMessage) {
      logTest('pass', 'Warning message for too many parameters displayed');
    }

    // Check for axis position indicators (L/R badges)
    const axisBadges = await page.$$('span:has-text("L"), span:has-text("R")');
    if (axisBadges.length > 0) {
      logTest('pass', `Axis position indicators found (${axisBadges.length})`);
    }

    await takeScreenshot(page, 'step7-multiaxis-visual-check');

    // ========== STEP 8: Test Table View Toggle ==========
    console.log('\n' + '='.repeat(70));
    console.log('📋 STEP 8: Test Table View Toggle\n');

    const tableSwitches = await page.$$('[role="switch"]');
    if (tableSwitches.length > 0) {
      // First switch should be chart/table toggle
      log('🖱️', 'Clicking table view toggle...');
      await tableSwitches[0].click();
      await page.waitForTimeout(2000);

      const tableExists = await page.$('table') !== null;
      if (tableExists) {
        logTest('pass', 'Table view rendered successfully');
        await takeScreenshot(page, 'step8-table-view');

        // Toggle back to chart
        await tableSwitches[0].click();
        await page.waitForTimeout(2000);
        logTest('pass', 'Toggled back to chart view');
      } else {
        logTest('warn', 'Table view not found after toggle');
      }
    }

    // ========== FINAL: Analyze All Errors ==========
    console.log('\n' + '='.repeat(70));
    console.log('🔍 ERROR ANALYSIS\n');

    console.log(`Total Console Logs: ${testLogs.allConsole.length}`);
    console.log(`❌ Console Errors: ${testLogs.consoleErrors.length}`);
    console.log(`⚠️  Console Warnings: ${testLogs.consoleWarnings.length}`);
    console.log(`💥 Page Errors: ${testLogs.pageErrors.length}`);
    console.log(`🌐 Network Errors: ${testLogs.networkErrors.length}`);

    if (testLogs.consoleErrors.length > 0) {
      console.log('\n🔴 Console Errors:');
      testLogs.consoleErrors.forEach((err, i) => {
        console.log(`  ${i + 1}. [${err.time.substring(11, 19)}] ${err.text}`);
      });
    }

    if (testLogs.pageErrors.length > 0) {
      console.log('\n💥 Page Errors:');
      testLogs.pageErrors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.message}`);
        if (err.stack) {
          console.log(`     Stack: ${err.stack.substring(0, 200)}`);
        }
      });
    }

    if (testLogs.networkErrors.length > 0) {
      console.log('\n🌐 Network Errors:');
      testLogs.networkErrors.forEach((err, i) => {
        console.log(`  ${i + 1}. [${err.status}] ${err.url}`);
      });
    }

    // ========== TEST SUMMARY ==========
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST RESULTS SUMMARY\n');

    console.log(`✅ Passed: ${testResults.passed.length}`);
    testResults.passed.forEach(test => console.log(`   • ${test}`));

    if (testResults.failed.length > 0) {
      console.log(`\n❌ Failed: ${testResults.failed.length}`);
      testResults.failed.forEach(test => console.log(`   • ${test}`));
    }

    if (testResults.warnings.length > 0) {
      console.log(`\n⚠️  Warnings: ${testResults.warnings.length}`);
      testResults.warnings.forEach(test => console.log(`   • ${test}`));
    }

    // Save detailed logs
    const logsPath = path.join(__dirname, 'multiaxis-test-logs.json');
    fs.writeFileSync(logsPath, JSON.stringify({
      testResults,
      testLogs,
      timestamp: new Date().toISOString()
    }, null, 2));
    console.log(`\n📝 Detailed logs saved: ${logsPath}`);

    // Final screenshot
    await takeScreenshot(page, 'final-state');

    // Overall result
    console.log('\n' + '='.repeat(70));
    if (testResults.failed.length === 0) {
      console.log('🎉 ALL TESTS PASSED!');
    } else {
      console.log('⚠️  SOME TESTS FAILED - Review errors above');
    }
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ TEST CRASHED:', error.message);
    console.error(error.stack);
    if (page) {
      await takeScreenshot(page, 'crash-state');
    }
  } finally {
    console.log('\n💡 Browser will remain open for manual inspection.');
    console.log('   Close it manually when done.\n');

    // Uncomment to auto-close:
    // if (browser) await browser.close();
  }
}

// Run the test
console.log('🚀 Starting Multi-Axis Time Series Test\n');
console.log('This test will:');
console.log('• Navigate to the map-drawing page');
console.log('• Check for console errors throughout');
console.log('• Find and test the multi-axis toggle feature');
console.log('• Verify chart rendering in both modes');
console.log('• Take screenshots of all states');
console.log('• Monitor for any runtime errors\n');
console.log('Press Ctrl+C to stop.\n');

testMultiAxisTimeSeries().catch(console.error);
