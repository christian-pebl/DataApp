const { chromium } = require('playwright');

async function testRealLogin() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  const warnings = [];
  const networkErrors = [];
  const logs = [];
  
  // Capture ALL console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();
    
    const messageData = {
      type,
      text,
      url: location.url,
      lineNumber: location.lineNumber,
      timestamp: new Date().toISOString()
    };
    
    if (type === 'error') {
      errors.push(messageData);
      console.log('❌ CONSOLE ERROR:', text);
    } else if (type === 'warning') {
      warnings.push(messageData);
      console.log('⚠️ WARNING:', text);
    } else if (type === 'log') {
      logs.push(messageData);
      console.log('📝 LOG:', text);
    }
  });
  
  // Capture page errors (uncaught exceptions)
  page.on('pageerror', error => {
    errors.push({
      type: 'pageerror',
      text: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    console.log('💥 PAGE ERROR:', error.message);
  });
  
  // Capture network failures
  page.on('requestfailed', request => {
    const failure = {
      url: request.url(),
      method: request.method(),
      failure: request.failure(),
      timestamp: new Date().toISOString()
    };
    networkErrors.push(failure);
    console.log('🔴 REQUEST FAILED:', request.url(), request.failure().errorText);
  });
  
  // Monitor HTTP error responses
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`⚠️ HTTP ${response.status()}: ${response.url()}`);
      networkErrors.push({
        type: 'http-error',
        status: response.status(),
        url: response.url(),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  console.log('\n🚀 Starting Real Login Test with Active User...\n');
  
  try {
    // 1. Navigate to auth page
    console.log('1️⃣ Navigating to auth page...');
    await page.goto('http://localhost:9002/auth', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.waitForTimeout(2000);
    
    // 2. Find and fill email field
    console.log('2️⃣ Finding and filling email field...');
    const emailInput = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    await emailInput.fill('christiannberger@gmail.com');
    console.log('   ✅ Email entered');
    
    // 3. Find and fill password field
    console.log('3️⃣ Finding and filling password field...');
    const passwordInput = await page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill('Mewslade123@');
    console.log('   ✅ Password entered');
    
    // Wait a moment for any validation
    await page.waitForTimeout(1000);
    
    // 4. Find and click sign in button
    console.log('4️⃣ Looking for sign in button...');
    const signInButton = await page.locator('button:has-text("Sign in"), button:has-text("Sign In"), button:has-text("Log in"), button:has-text("Login"), button[type="submit"]').first();
    
    if (await signInButton.isVisible()) {
      console.log('   📍 Sign in button found, clicking...');
      
      // Set up navigation promise
      const navigationPromise = page.waitForNavigation({ 
        timeout: 15000,
        waitUntil: 'networkidle' 
      }).catch(e => {
        console.log('   ⚠️ Navigation timeout or error:', e.message);
        return null;
      });
      
      await signInButton.click();
      console.log('   ✅ Sign in button clicked');
      
      // Wait for navigation or timeout
      const result = await navigationPromise;
      if (result) {
        console.log('   ✅ Navigation completed to:', page.url());
      }
    } else {
      console.log('   ❌ Sign in button not found');
    }
    
    // 5. Wait for any async operations and errors
    console.log('\n5️⃣ Waiting for async operations and potential errors...');
    await page.waitForTimeout(5000);
    
    // 6. Check final state
    console.log('\n6️⃣ Checking final state...');
    const currentUrl = page.url();
    console.log('   Current URL:', currentUrl);
    
    if (currentUrl.includes('map-drawing')) {
      console.log('   ✅ Successfully redirected to map-drawing (logged in)');
    } else if (currentUrl.includes('auth')) {
      console.log('   ⚠️ Still on auth page (login may have failed)');
      
      // Check for error messages
      const errorMessages = await page.locator('.error, .alert, [role="alert"], .text-red-500, .text-destructive').allTextContents();
      if (errorMessages.length > 0) {
        console.log('   Error messages found:', errorMessages);
      }
    }
    
    // Take screenshot
    await page.screenshot({ path: 'real-login-test.png', fullPage: true });
    console.log('   📸 Screenshot saved as real-login-test.png');
    
  } catch (error) {
    console.log('❌ Test execution error:', error.message);
    errors.push({
      type: 'test-error',
      text: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
  
  // Generate report
  console.log('\n' + '='.repeat(80));
  console.log('📊 REAL LOGIN TEST - ERROR ANALYSIS REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n📈 Summary:`);
  console.log(`   Console Errors: ${errors.length}`);
  console.log(`   Network Errors: ${networkErrors.length}`);
  console.log(`   Warnings: ${warnings.length}`);
  console.log(`   Logs: ${logs.length}`);
  
  if (errors.length > 0) {
    console.log('\n🔴 CONSOLE ERRORS DETECTED:');
    console.log('-'.repeat(80));
    errors.forEach((error, i) => {
      console.log(`\nError ${i + 1}:`);
      console.log(`  Type: ${error.type}`);
      console.log(`  Message: ${error.text}`);
      if (error.url) console.log(`  Location: ${error.url}:${error.lineNumber}`);
      if (error.stack) console.log(`  Stack trace:\n${error.stack}`);
    });
  }
  
  if (networkErrors.length > 0) {
    console.log('\n🌐 NETWORK ERRORS:');
    console.log('-'.repeat(80));
    networkErrors.forEach((error, i) => {
      console.log(`\nNetwork Error ${i + 1}:`);
      console.log(`  Type: ${error.type || 'Request Failed'}`);
      console.log(`  URL: ${error.url}`);
      if (error.status) console.log(`  HTTP Status: ${error.status}`);
      if (error.failure) console.log(`  Failure: ${error.failure().errorText}`);
    });
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    console.log('-'.repeat(80));
    warnings.forEach((warning, i) => {
      console.log(`\nWarning ${i + 1}:`);
      console.log(`  Message: ${warning.text}`);
      if (warning.url) console.log(`  Location: ${warning.url}`);
    });
  }
  
  // Save detailed report
  const fs = require('fs');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      errors: errors.length,
      networkErrors: networkErrors.length,
      warnings: warnings.length,
      logs: logs.length
    },
    errors,
    networkErrors,
    warnings,
    logs
  };
  
  fs.writeFileSync('real-login-errors.json', JSON.stringify(report, null, 2));
  console.log('\n💾 Detailed report saved to real-login-errors.json');
  
  console.log('\n✅ Test complete. Browser will remain open for 30 seconds...');
  console.log('Press Ctrl+C to close immediately.\n');
  
  await page.waitForTimeout(30000);
  await browser.close();
}

testRealLogin().catch(console.error);