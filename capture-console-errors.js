const { chromium } = require('playwright');

async function captureConsoleErrors() {
  const browser = await chromium.launch({ 
    headless: false, // Show browser to see what's happening
    devtools: true  // Open devtools
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect all console messages
  const consoleMessages = {
    errors: [],
    warnings: [],
    logs: [],
    info: []
  };
  
  // Listen to console events
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();
    
    const messageData = {
      type,
      text,
      url: location.url,
      lineNumber: location.lineNumber,
      columnNumber: location.columnNumber,
      timestamp: new Date().toISOString()
    };
    
    if (type === 'error') {
      consoleMessages.errors.push(messageData);
      console.log('❌ ERROR:', text);
    } else if (type === 'warning') {
      consoleMessages.warnings.push(messageData);
      console.log('⚠️ WARNING:', text);
    } else if (type === 'log') {
      consoleMessages.logs.push(messageData);
      console.log('📝 LOG:', text);
    } else if (type === 'info') {
      consoleMessages.info.push(messageData);
      console.log('ℹ️ INFO:', text);
    }
  });
  
  // Listen to page errors (uncaught exceptions)
  page.on('pageerror', error => {
    consoleMessages.errors.push({
      type: 'pageerror',
      text: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    console.log('💥 PAGE ERROR:', error.message);
  });
  
  // Listen to request failures
  page.on('requestfailed', request => {
    consoleMessages.errors.push({
      type: 'requestfailed',
      url: request.url(),
      method: request.method(),
      failure: request.failure(),
      timestamp: new Date().toISOString()
    });
    console.log('🔴 REQUEST FAILED:', request.url(), request.failure());
  });
  
  console.log('\n🚀 Navigating to auth page...\n');
  
  try {
    // Navigate to the auth page
    await page.goto('http://localhost:9002/auth', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('✅ Page loaded successfully\n');
    
    // Wait a bit to capture any delayed console messages
    await page.waitForTimeout(3000);
    
    // Try to interact with the login form to trigger more potential errors
    console.log('🔍 Checking for login elements...\n');
    
    // Check if there are any auth-related buttons or forms
    const authButtons = await page.$$('button');
    console.log(`Found ${authButtons.length} buttons on the page\n`);
    
    // Take a screenshot for reference
    await page.screenshot({ path: 'auth-page-console-check.png', fullPage: true });
    
    // Wait a bit more for any async operations
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.log('❌ Navigation error:', error.message);
    consoleMessages.errors.push({
      type: 'navigation',
      text: error.message,
      timestamp: new Date().toISOString()
    });
  }
  
  // Generate report
  console.log('\n' + '='.repeat(80));
  console.log('📊 CONSOLE ERROR REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n📈 Summary:`);
  console.log(`   Errors: ${consoleMessages.errors.length}`);
  console.log(`   Warnings: ${consoleMessages.warnings.length}`);
  console.log(`   Logs: ${consoleMessages.logs.length}`);
  console.log(`   Info: ${consoleMessages.info.length}`);
  
  if (consoleMessages.errors.length > 0) {
    console.log('\n🔴 DETAILED ERRORS:');
    console.log('-'.repeat(80));
    consoleMessages.errors.forEach((error, index) => {
      console.log(`\nError ${index + 1}:`);
      console.log(`  Type: ${error.type}`);
      console.log(`  Message: ${error.text}`);
      if (error.url) console.log(`  URL: ${error.url}`);
      if (error.lineNumber) console.log(`  Line: ${error.lineNumber}`);
      if (error.stack) console.log(`  Stack: ${error.stack}`);
    });
  }
  
  if (consoleMessages.warnings.length > 0) {
    console.log('\n⚠️ DETAILED WARNINGS:');
    console.log('-'.repeat(80));
    consoleMessages.warnings.forEach((warning, index) => {
      console.log(`\nWarning ${index + 1}:`);
      console.log(`  Message: ${warning.text}`);
      if (warning.url) console.log(`  URL: ${warning.url}`);
    });
  }
  
  // Save the full report to a file
  const fs = require('fs');
  fs.writeFileSync('console-errors-report.json', JSON.stringify(consoleMessages, null, 2));
  console.log('\n💾 Full report saved to console-errors-report.json');
  
  console.log('\n⏸️ Keeping browser open for manual inspection...');
  console.log('Press Ctrl+C to close when done.\n');
  
  // Keep browser open for manual inspection
  await page.waitForTimeout(300000); // 5 minutes
  
  await browser.close();
}

captureConsoleErrors().catch(console.error);