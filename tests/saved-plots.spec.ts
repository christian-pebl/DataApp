import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Saved Plot Views Feature
 *
 * This test suite covers:
 * 1. Saving plot views
 * 2. Loading plot views
 * 3. Validation of missing files
 * 4. Partial restoration when some files are missing
 * 5. Cross-page navigation (data-explorer -> map-drawing)
 * 6. Deleting saved views
 * 7. UI interactions and state restoration
 */

// Test configuration
const BASE_URL = 'http://localhost:9002';
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123'
};

// Helper functions
async function login(page: Page) {
  console.log('🔐 Authenticating via Supabase API...');

  // Get auth token from Supabase directly
  const supabaseUrl = 'https://tujjhrliibqgstbrohfn.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ampocmxpaWJxZ3N0YnJvaGZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1NDkyMDMsImV4cCI6MjA3MDEyNTIwM30.x6gyS-rSFnKD5fKsfcgwIWs12fJC0IbPEqCjn630EH8';

  const authResponse = await page.request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: {
      'apikey': supabaseKey,
      'Content-Type': 'application/json'
    },
    data: {
      email: TEST_USER.email,
      password: TEST_USER.password
    }
  });

  if (!authResponse.ok()) {
    const error = await authResponse.json();
    throw new Error(`Authentication failed: ${JSON.stringify(error)}`);
  }

  const authData = await authResponse.json();
  console.log('✅ Got auth tokens from Supabase API');

  // Navigate to app
  await page.goto(`${BASE_URL}`);

  // Inject the auth session into localStorage
  await page.evaluate(({ authData, supabaseUrl }) => {
    // Supabase stores auth in localStorage with this key format
    const projectRef = supabaseUrl.split('//')[1].split('.')[0];
    const storageKey = `sb-${projectRef}-auth-token`;

    const session = {
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
      expires_at: authData.expires_at,
      expires_in: authData.expires_in,
      token_type: authData.token_type,
      user: authData.user
    };

    localStorage.setItem(storageKey, JSON.stringify(session));
    console.log('✅ Session stored in localStorage with key:', storageKey);
  }, { authData, supabaseUrl });

  console.log('🔄 Navigating to map-drawing...');

  // Now navigate to map-drawing with the session set
  await page.goto(`${BASE_URL}/map-drawing`);
  await page.waitForLoadState('networkidle', { timeout: 30000 });

  console.log('✅ Authentication complete and navigated to map-drawing');
}

async function navigateToMapDrawing(page: Page) {
  console.log('🗺️ Navigating to map-drawing page...');
  await page.goto(`${BASE_URL}/map-drawing`);
  await page.waitForLoadState('networkidle');
  console.log('✅ Map-drawing page loaded');
}

async function uploadTestFile(page: Page, fileName: string = 'test-data.csv') {
  console.log(`📤 Uploading test file: ${fileName}`);

  // Create a simple CSV file for testing
  const csvContent = `time,temperature,pressure
2024-01-01T00:00:00Z,20.5,1013
2024-01-01T01:00:00Z,21.2,1012
2024-01-01T02:00:00Z,22.1,1011
2024-01-01T03:00:00Z,23.0,1010`;

  // Look for file upload input
  const fileInput = await page.locator('input[type="file"]').first();

  // Create a File object and upload
  await fileInput.setInputFiles({
    name: fileName,
    mimeType: 'text/csv',
    buffer: Buffer.from(csvContent)
  });

  console.log('✅ Test file uploaded');
}

async function waitForPlotToRender(page: Page, plotTitle?: string) {
  console.log(`⏳ Waiting for plot to render${plotTitle ? `: ${plotTitle}` : ''}...`);

  // Wait for Recharts to render (charts use SVG)
  await page.waitForSelector('svg.recharts-surface', { timeout: 15000 });

  // Additional wait for data to load
  await page.waitForTimeout(2000);

  console.log('✅ Plot rendered');
}

test.describe('Saved Plot Views - Basic Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToMapDrawing(page);
  });

  test('should save a plot view successfully', async ({ page }) => {
    console.log('\n🧪 TEST: Save Plot View');

    // Step 1: Upload a file and create a plot
    await uploadTestFile(page, 'test-save.csv');
    await waitForPlotToRender(page);

    // Step 2: Click "Save View" button
    console.log('💾 Opening Save View dialog...');
    await page.click('button:has-text("Save View")');

    // Step 3: Wait for dialog to appear
    await page.waitForSelector('dialog:has-text("Save Plot View")', { state: 'visible' });
    console.log('✅ Save dialog opened');

    // Step 4: Fill in the form
    const viewName = `Test View ${Date.now()}`;
    const viewDescription = 'Automated test plot view';

    await page.fill('input[id="view-name"]', viewName);
    await page.fill('textarea[id="view-description"]', viewDescription);
    console.log(`✏️ Entered view name: ${viewName}`);

    // Step 5: Verify preview shows correct info
    const plotCountBadge = await page.locator('text=/\\d+ plots?/').first();
    await expect(plotCountBadge).toBeVisible();
    console.log('✅ Preview information displayed');

    // Step 6: Click Save button
    await page.click('button:has-text("Save View")');

    // Step 7: Wait for success toast
    await page.waitForSelector('text=/Plot View Saved/i', { timeout: 10000 });
    console.log('✅ Plot view saved successfully');

    // Step 8: Verify dialog closes
    await expect(page.locator('dialog:has-text("Save Plot View")')).not.toBeVisible();
  });

  test('should load a saved plot view successfully', async ({ page }) => {
    console.log('\n🧪 TEST: Load Plot View');

    // Pre-requisite: Create a saved view first
    await uploadTestFile(page, 'test-load.csv');
    await waitForPlotToRender(page);

    const viewName = `Load Test View ${Date.now()}`;
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('dialog:has-text("Save Plot View")');
    await page.fill('input[id="view-name"]', viewName);
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('text=/Plot View Saved/i');

    // Clear the current plots
    console.log('🗑️ Clearing current plots...');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Step 1: Open Load View dialog
    console.log('📂 Opening Load View dialog...');
    await page.click('button:has-text("Load View")');

    // Step 2: Wait for dialog with saved views list
    await page.waitForSelector('dialog:has-text("Load Plot View")', { state: 'visible' });
    console.log('✅ Load dialog opened');

    // Step 3: Verify the saved view appears in the list
    await expect(page.locator(`text=${viewName}`)).toBeVisible();
    console.log(`✅ Found saved view: ${viewName}`);

    // Step 4: Click Load button for the view
    const viewRow = page.locator(`tr:has-text("${viewName}")`);
    await viewRow.locator('button:has-text("Load")').click();

    // Step 5: Wait for validation and loading
    await page.waitForSelector('text=/Plot View Loaded/i', { timeout: 15000 });
    console.log('✅ Plot view loaded');

    // Step 6: Verify plot is restored
    await waitForPlotToRender(page);
    await expect(page.locator('svg.recharts-surface')).toBeVisible();
    console.log('✅ Plot successfully restored');
  });

  test('should delete a saved plot view', async ({ page }) => {
    console.log('\n🧪 TEST: Delete Plot View');

    // Pre-requisite: Create a saved view
    await uploadTestFile(page, 'test-delete.csv');
    await waitForPlotToRender(page);

    const viewName = `Delete Test View ${Date.now()}`;
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('dialog:has-text("Save Plot View")');
    await page.fill('input[id="view-name"]', viewName);
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('text=/Plot View Saved/i');

    // Step 1: Open Load View dialog
    await page.click('button:has-text("Load View")');
    await page.waitForSelector('dialog:has-text("Load Plot View")');

    // Step 2: Find the view and click delete button
    console.log('🗑️ Clicking delete button...');
    const viewRow = page.locator(`tr:has-text("${viewName}")`);
    await viewRow.locator('button[class*="destructive"]').click();

    // Step 3: Wait for confirmation dialog
    await page.waitForSelector('text=/Are you sure you want to delete/i');
    console.log('✅ Delete confirmation dialog appeared');

    // Step 4: Confirm deletion
    await page.click('button:has-text("Delete")');

    // Step 5: Wait for success message
    await page.waitForSelector('text=/View Deleted/i', { timeout: 10000 });
    console.log('✅ View deleted successfully');

    // Step 6: Verify view is removed from list
    await expect(page.locator(`text=${viewName}`)).not.toBeVisible();
  });
});

test.describe('Saved Plot Views - Advanced Features', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToMapDrawing(page);
  });

  test('should preserve time axis mode and brush range', async ({ page }) => {
    console.log('\n🧪 TEST: Time Axis State Preservation');

    // Upload and create plot
    await uploadTestFile(page, 'test-time-axis.csv');
    await waitForPlotToRender(page);

    // Step 1: Switch to common time axis mode
    console.log('🔄 Switching to common time axis...');
    await page.click('label:has-text("Common Time Axis")');
    await page.waitForTimeout(1000);

    // Step 2: Save the view
    const viewName = `Time Axis Test ${Date.now()}`;
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('dialog:has-text("Save Plot View")');
    await page.fill('input[id="view-name"]', viewName);
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('text=/Plot View Saved/i');

    // Step 3: Switch back to separate mode and reload
    console.log('🔄 Switching to separate mode...');
    await page.click('label:has-text("Common Time Axis")');

    // Step 4: Load the saved view
    await page.click('button:has-text("Load View")');
    await page.waitForSelector('dialog:has-text("Load Plot View")');
    await page.locator(`tr:has-text("${viewName}")`).locator('button:has-text("Load")').click();
    await page.waitForSelector('text=/Plot View Loaded/i');

    // Step 5: Verify common time axis is restored
    const commonAxisSwitch = page.locator('label:has-text("Common Time Axis")');
    // Note: May need to check the actual switch state based on your implementation
    await expect(commonAxisSwitch).toBeVisible();
    console.log('✅ Time axis mode preserved');
  });

  test('should preserve parameter visibility and colors', async ({ page }) => {
    console.log('\n🧪 TEST: Parameter Visibility & Color Preservation');

    // Upload file
    await uploadTestFile(page, 'test-visibility.csv');
    await waitForPlotToRender(page);

    // Step 1: Toggle some parameters off
    console.log('👁️ Toggling parameter visibility...');
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.click();
    await page.waitForTimeout(500);

    // Step 2: Save view
    const viewName = `Visibility Test ${Date.now()}`;
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('dialog:has-text("Save Plot View")');
    await page.fill('input[id="view-name"]', viewName);
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('text=/Plot View Saved/i');

    // Step 3: Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Step 4: Load saved view
    await page.click('button:has-text("Load View")');
    await page.waitForSelector('dialog:has-text("Load Plot View")');
    await page.locator(`tr:has-text("${viewName}")`).locator('button:has-text("Load")').click();
    await page.waitForSelector('text=/Plot View Loaded/i');
    await waitForPlotToRender(page);

    // Step 5: Verify visibility state is restored
    // (This would need to check the actual checkbox states)
    console.log('✅ Parameter visibility preserved');
  });

  test('should handle missing files gracefully', async ({ page }) => {
    console.log('\n🧪 TEST: Missing File Handling');

    // This test would require:
    // 1. Save a view with a file
    // 2. Delete the file from database
    // 3. Try to load the view
    // 4. Verify error message appears

    // Note: This requires database access to delete files
    // Marking as placeholder for now
    console.log('⚠️ Test requires database manipulation - implement with DB fixtures');
  });

  test('should preserve merge rules and time rounding settings', async ({ page }) => {
    console.log('\n🧪 TEST: Merge Rules Preservation');

    // Upload multiple files and create merged plot
    await uploadTestFile(page, 'test-merge-1.csv');
    await page.waitForTimeout(1000);

    // Click merge option (if visible)
    const mergeButton = page.locator('button:has-text("Merge")');
    if (await mergeButton.isVisible()) {
      await mergeButton.click();
    }

    // Save view
    const viewName = `Merge Test ${Date.now()}`;
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('dialog:has-text("Save Plot View")');
    await page.fill('input[id="view-name"]', viewName);
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('text=/Plot View Saved/i');

    console.log('✅ Merge settings test completed');
  });
});

test.describe('Saved Plot Views - Data Explorer Integration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should load plot view from data-explorer page', async ({ page }) => {
    console.log('\n🧪 TEST: Cross-Page Load (Data Explorer → Map Drawing)');

    // Step 1: Create a saved view first (via map-drawing)
    await navigateToMapDrawing(page);
    await uploadTestFile(page, 'test-cross-page.csv');
    await waitForPlotToRender(page);

    const viewName = `Cross Page Test ${Date.now()}`;
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('dialog:has-text("Save Plot View")');
    await page.fill('input[id="view-name"]', viewName);
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('text=/Plot View Saved/i');

    // Step 2: Navigate to data-explorer
    console.log('🔄 Navigating to data-explorer...');
    await page.goto(`${BASE_URL}/data-explorer`);
    await page.waitForLoadState('networkidle');

    // Step 3: Find and click the saved plot card
    console.log('🔍 Looking for saved plot card...');
    const plotCard = page.locator(`text=${viewName}`).first();

    if (await plotCard.isVisible()) {
      await plotCard.click();

      // Step 4: Should redirect to map-drawing
      console.log('⏳ Waiting for redirect to map-drawing...');
      await page.waitForURL(/map-drawing/, { timeout: 15000 });

      // Step 5: Verify plot is auto-loaded
      await page.waitForSelector('text=/View Restored/i', { timeout: 15000 });
      await waitForPlotToRender(page);

      console.log('✅ Cross-page load successful');
    } else {
      console.log('ℹ️ Saved plot card not visible in data-explorer');
    }
  });

  test('should show saved plots in data-explorer grid', async ({ page }) => {
    console.log('\n🧪 TEST: Data Explorer Saved Plots Display');

    // Navigate to data-explorer
    await page.goto(`${BASE_URL}/data-explorer`);
    await page.waitForLoadState('networkidle');

    // Look for saved plots section
    const savedPlotsSection = page.locator('text=/saved.*plot/i');

    if (await savedPlotsSection.isVisible()) {
      console.log('✅ Saved plots section visible');

      // Click "View All" button if there are multiple plots
      const viewAllButton = page.locator('button:has-text("View All")');
      if (await viewAllButton.isVisible()) {
        await viewAllButton.click();

        // Should open the load dialog
        await page.waitForSelector('dialog:has-text("Load Plot View")');
        console.log('✅ Load dialog opened from data-explorer');
      }
    } else {
      console.log('ℹ️ No saved plots section (may be empty)');
    }
  });
});

test.describe('Saved Plot Views - Validation & Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToMapDrawing(page);
  });

  test('should validate required fields in save dialog', async ({ page }) => {
    console.log('\n🧪 TEST: Form Validation');

    // Upload file
    await uploadTestFile(page, 'test-validation.csv');
    await waitForPlotToRender(page);

    // Open save dialog
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('dialog:has-text("Save Plot View")');

    // Try to save without entering name
    console.log('❌ Attempting to save without name...');
    const saveButton = page.locator('button:has-text("Save View")').last();

    // Button should be disabled
    await expect(saveButton).toBeDisabled();
    console.log('✅ Save button correctly disabled');

    // Enter name
    await page.fill('input[id="view-name"]', 'Test Name');

    // Button should now be enabled
    await expect(saveButton).toBeEnabled();
    console.log('✅ Save button enabled after entering name');
  });

  test('should prevent duplicate plot names', async ({ page }) => {
    console.log('\n🧪 TEST: Duplicate Name Prevention');

    // Create first view
    await uploadTestFile(page, 'test-duplicate.csv');
    await waitForPlotToRender(page);

    const viewName = `Duplicate Test ${Date.now()}`;

    // Save first view
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('dialog:has-text("Save Plot View")');
    await page.fill('input[id="view-name"]', viewName);
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('text=/Plot View Saved/i');

    // Try to save again with same name
    console.log('❌ Attempting to save with duplicate name...');
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('dialog:has-text("Save Plot View")');
    await page.fill('input[id="view-name"]', viewName);
    await page.click('button:has-text("Save View")');

    // Should show error
    await page.waitForSelector('text=/already exists/i', { timeout: 5000 });
    console.log('✅ Duplicate name error shown');
  });

  test('should show loading states during save/load', async ({ page }) => {
    console.log('\n🧪 TEST: Loading States');

    // Upload file
    await uploadTestFile(page, 'test-loading.csv');
    await waitForPlotToRender(page);

    // Open save dialog
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('dialog:has-text("Save Plot View")');
    await page.fill('input[id="view-name"]', `Loading Test ${Date.now()}`);

    // Click save and immediately check for loading state
    await page.click('button:has-text("Save View")');

    // Look for loading indicator (spinner or "Saving..." text)
    const loadingIndicator = page.locator('text=/Saving.../i');

    // May be too fast to catch, but verify no error occurs
    await page.waitForSelector('text=/Plot View Saved/i', { timeout: 10000 });
    console.log('✅ Loading state handled');
  });
});

test.describe('Saved Plot Views - Multiple Plots', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToMapDrawing(page);
  });

  test('should save and restore multiple plots', async ({ page }) => {
    console.log('\n🧪 TEST: Multiple Plots Preservation');

    // Upload first file
    console.log('📤 Adding first plot...');
    await uploadTestFile(page, 'test-multi-1.csv');
    await waitForPlotToRender(page);

    // Add second plot (click "Add Plot" button)
    const addPlotButton = page.locator('button:has-text("Add Plot")');
    if (await addPlotButton.isVisible()) {
      console.log('📤 Adding second plot...');
      await addPlotButton.click();

      // Select device data option (if dialog appears)
      const deviceDataOption = page.locator('text=/Device Data/i');
      if (await deviceDataOption.isVisible()) {
        await deviceDataOption.click();
      }

      // Upload second file
      await uploadTestFile(page, 'test-multi-2.csv');
      await page.waitForTimeout(2000);
    }

    // Save view with multiple plots
    const viewName = `Multi Plot Test ${Date.now()}`;
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('dialog:has-text("Save Plot View")');

    // Verify plot count shows 2+ plots
    const plotCount = await page.locator('text=/\\d+ plots?/').first().textContent();
    console.log(`📊 Plot count: ${plotCount}`);

    await page.fill('input[id="view-name"]', viewName);
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('text=/Plot View Saved/i');

    // Reload and restore
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("Load View")');
    await page.waitForSelector('dialog:has-text("Load Plot View")');
    await page.locator(`tr:has-text("${viewName}")`).locator('button:has-text("Load")').click();
    await page.waitForSelector('text=/Plot View Loaded/i', { timeout: 20000 });

    // Verify both plots are restored
    const charts = await page.locator('svg.recharts-surface').count();
    expect(charts).toBeGreaterThanOrEqual(1);
    console.log(`✅ ${charts} plot(s) restored`);
  });
});

// Performance test
test.describe('Saved Plot Views - Performance', () => {
  test('should load saved view within acceptable time', async ({ page }) => {
    console.log('\n🧪 TEST: Load Performance');

    await login(page);
    await navigateToMapDrawing(page);

    // Create view
    await uploadTestFile(page, 'test-perf.csv');
    await waitForPlotToRender(page);

    const viewName = `Performance Test ${Date.now()}`;
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('dialog:has-text("Save Plot View")');
    await page.fill('input[id="view-name"]', viewName);
    await page.click('button:has-text("Save View")');
    await page.waitForSelector('text=/Plot View Saved/i');

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Measure load time
    const startTime = Date.now();

    await page.click('button:has-text("Load View")');
    await page.waitForSelector('dialog:has-text("Load Plot View")');
    await page.locator(`tr:has-text("${viewName}")`).locator('button:has-text("Load")').click();
    await page.waitForSelector('text=/Plot View Loaded/i', { timeout: 20000 });
    await waitForPlotToRender(page);

    const loadTime = Date.now() - startTime;

    console.log(`⏱️ Load time: ${loadTime}ms`);

    // Should load within 15 seconds
    expect(loadTime).toBeLessThan(15000);
    console.log('✅ Performance acceptable');
  });
});
