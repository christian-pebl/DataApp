const fs = require('fs');
const path = require('path');

/**
 * Load test credentials from the JSON file
 * @returns {Object} Test credentials object
 */
function loadTestCredentials() {
  const credentialsPath = path.join(__dirname, 'test-credentials.json');
  
  if (!fs.existsSync(credentialsPath)) {
    throw new Error('Test credentials file not found. Please create test-credentials.json');
  }
  
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  return credentials;
}

/**
 * Get a specific test user by ID or email
 * @param {string|number} identifier - User ID or email
 * @returns {Object} User credentials
 */
function getTestUser(identifier) {
  const credentials = loadTestCredentials();
  
  if (typeof identifier === 'number') {
    return credentials.testUsers.find(user => user.id === identifier);
  } else if (typeof identifier === 'string') {
    return credentials.testUsers.find(user => user.email === identifier);
  }
  
  return null;
}

/**
 * Get all test users
 * @returns {Array} Array of test users
 */
function getAllTestUsers() {
  const credentials = loadTestCredentials();
  return credentials.testUsers;
}

/**
 * Login helper for Playwright tests
 * @param {Object} page - Playwright page object
 * @param {Object} user - User credentials object
 */
async function loginWithUser(page, user) {
  console.log(`🔐 Logging in as: ${user.email}`);
  
  // Navigate to auth page
  await page.goto('http://localhost:9002/auth', {
    waitUntil: 'networkidle'
  });
  
  // Fill in credentials
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  
  // Click sign in
  const signInButton = page.locator('button:has-text("Sign in"), button:has-text("Sign In"), button[type="submit"]').first();
  await signInButton.click();
  
  // Wait for navigation
  await page.waitForURL('**/map-drawing', { timeout: 10000 });
  
  console.log(`✅ Successfully logged in as: ${user.email}`);
}

/**
 * Logout helper for Playwright tests
 * @param {Object} page - Playwright page object
 */
async function logout(page) {
  console.log('🔓 Logging out...');
  
  // Look for logout button/menu
  const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out")');
  
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  } else {
    // Try menu approach
    const menuButton = page.locator('[aria-label="Menu"], button:has-text("Menu")');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.locator('button:has-text("Logout"), button:has-text("Sign out")').click();
    }
  }
  
  // Wait for redirect to auth page
  await page.waitForURL('**/auth', { timeout: 10000 });
  
  console.log('✅ Successfully logged out');
}

/**
 * Switch between test users
 * @param {Object} page - Playwright page object
 * @param {Object} fromUser - Current user
 * @param {Object} toUser - User to switch to
 */
async function switchUser(page, fromUser, toUser) {
  console.log(`🔄 Switching from ${fromUser.email} to ${toUser.email}`);
  
  await logout(page);
  await loginWithUser(page, toUser);
  
  console.log(`✅ Successfully switched to ${toUser.email}`);
}

module.exports = {
  loadTestCredentials,
  getTestUser,
  getAllTestUsers,
  loginWithUser,
  logout,
  switchUser
};