const { chromium } = require('playwright');

async function captureLoginErrors() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleMessages = {
    errors: [],
    warnings: [],
    logs: [],
    info: [],
    networkErrors: []
  };
  
  // Capture console messages
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
      consoleMessages.errors.push(messageData);
      console.log('❌ ERROR:', text);
    } else if (type === 'warning') {
      consoleMessages.warnings.push(messageData);
      console.log('⚠️ WARNING:', text);
    }
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    consoleMessages.errors.push({
      type: 'pageerror',
      text: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    console.log('💥 PAGE ERROR:', error.message);
  });
  
  // Capture network errors
  page.on('requestfailed', request => {
    const failure = {
      url: request.url(),
      method: request.method(),
      failure: request.failure(),
      timestamp: new Date().toISOString()
    };
    consoleMessages.networkErrors.push(failure);
    console.log('🔴 REQUEST FAILED:', request.url());
  });
  
  // Monitor responses for errors
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`⚠️ HTTP ${response.status()}: ${response.url()}`);
      consoleMessages.networkErrors.push({
        type: 'http-error',
        status: response.status(),
        url: response.url(),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  console.log('\n🚀 Testing Login Flow...\n');
  
  try {
    // 1. Navigate to auth page
    console.log('1️⃣ Navigating to auth page...');
    await page.goto('http://localhost:9002/auth', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // 2. Check for auth form elements
    console.log('2️⃣ Checking for authentication elements...');
    
    // Look for email/password inputs
    const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i]');
    const passwordInput = await page.$('input[type="password"], input[name="password"]');
    const signInButton = await page.$('button:has-text("Sign"), button:has-text("Log")');
    const googleButton = await page.$('button:has-text("Google")');
    
    console.log('   Email input found:', !!emailInput);
    console.log('   Password input found:', !!passwordInput);
    console.log('   Sign in button found:', !!signInButton);
    console.log('   Google OAuth button found:', !!googleButton);
    
    // 3. Try to fill in the form (if it exists)
    if (emailInput && passwordInput) {
      console.log('\n3️⃣ Attempting to fill login form...');
      await emailInput.fill('test@example.com');
      await passwordInput.fill('testpassword123');
      
      // Wait for any validation errors
      await page.waitForTimeout(1000);
    }
    
    // 4. Click on Google OAuth (if available) to trigger OAuth flow
    if (googleButton) {
      console.log('\n4️⃣ Clicking Google OAuth button...');
      
      // Set up promise to catch new page (OAuth popup)
      const newPagePromise = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);
      
      await googleButton.click();
      
      // Wait for OAuth redirect or popup
      const newPage = await newPagePromise;
      if (newPage) {
        console.log('   OAuth popup/redirect detected');
        await newPage.close();
      }
    }
    
    // 5. Wait and capture any async errors
    console.log('\n5️⃣ Waiting for async operations...');
    await page.waitForTimeout(3000);
    
    // 6. Take screenshot
    await page.screenshot({ path: 'login-flow-test.png', fullPage: true });
    
  } catch (error) {
    console.log('❌ Test error:', error.message);
    consoleMessages.errors.push({
      type: 'test-error',
      text: error.message,
      timestamp: new Date().toISOString()
    });
  }
  
  // Generate comprehensive report
  console.log('\n' + '='.repeat(80));
  console.log('📊 LOGIN FLOW ERROR ANALYSIS');
  console.log('='.repeat(80));
  
  console.log(`\n📈 Summary:`);
  console.log(`   Console Errors: ${consoleMessages.errors.length}`);
  console.log(`   Network Errors: ${consoleMessages.networkErrors.length}`);
  console.log(`   Warnings: ${consoleMessages.warnings.length}`);
  
  if (consoleMessages.errors.length > 0) {
    console.log('\n🔴 CONSOLE ERRORS:');
    consoleMessages.errors.forEach((error, i) => {
      console.log(`\n  ${i + 1}. ${error.text}`);
      if (error.url) console.log(`     Location: ${error.url}:${error.lineNumber}`);
    });
  }
  
  if (consoleMessages.networkErrors.length > 0) {
    console.log('\n🌐 NETWORK ERRORS:');
    consoleMessages.networkErrors.forEach((error, i) => {
      console.log(`\n  ${i + 1}. ${error.type || 'Request Failed'}`);
      console.log(`     URL: ${error.url}`);
      if (error.status) console.log(`     Status: ${error.status}`);
      if (error.failure) console.log(`     Reason: ${error.failure().errorText}`);
    });
  }
  
  if (consoleMessages.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    consoleMessages.warnings.forEach((warning, i) => {
      console.log(`\n  ${i + 1}. ${warning.text}`);
    });
  }
  
  // Save full report
  const fs = require('fs');
  fs.writeFileSync('login-errors-report.json', JSON.stringify(consoleMessages, null, 2));
  console.log('\n💾 Full report saved to login-errors-report.json');
  
  console.log('\n✅ Analysis complete. Keeping browser open for inspection...');
  console.log('Press Ctrl+C to close.\n');
  
  await page.waitForTimeout(300000);
  await browser.close();
}

captureLoginErrors().catch(console.error);