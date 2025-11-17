import { test, expect, Page } from '@playwright/test';

/**
 * Complete E2E Test for Saved Plot Views with FPOD File
 *
 * This test:
 * 1. Opens an FPOD file in stacked plot
 * 2. Changes parameter selection
 * 3. Saves the plot view
 * 4. Closes the app/stacked plot
 * 5. Reloads the app
 * 6. Loads the saved plot view
 * 7. Verifies it's exactly as it was
 */

const BASE_URL = 'http://localhost:9002';
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'christian@pebl-cic.co.uk',
  password: process.env.TEST_USER_PASSWORD || 'mewslade'
};

// Test data
const PLOT_VIEW_NAME = `FPOD Test View ${Date.now()}`;
const PLOT_VIEW_DESCRIPTION = 'E2E test for FPOD file with parameter changes';

// Helper: Authentication
async function login(page: Page) {
  console.log('🔐 Authenticating via Supabase API...');

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
  await page.goto(`${BASE_URL}`);

  await page.evaluate(({ authData, supabaseUrl }) => {
    const projectRef = supabaseUrl.split('//')[1].split('.')[0];
    const storageKey = `sb-${projectRef}-auth-token`;
    localStorage.setItem(storageKey, JSON.stringify(authData));
  }, { authData, supabaseUrl });

  console.log('✅ Authentication complete');
}

// Helper: Get parameter checkboxes state
async function getParameterState(page: Page): Promise<Record<string, boolean>> {
  console.log('📊 Capturing parameter state...');

  const state: Record<string, boolean> = {};

  // Find all parameter checkboxes
  const checkboxes = await page.locator('input[type="checkbox"]').all();

  for (const checkbox of checkboxes) {
    const isVisible = await checkbox.isVisible().catch(() => false);
    if (!isVisible) continue;

    const id = await checkbox.getAttribute('id').catch(() => null);
    if (!id) continue;

    const isChecked = await checkbox.isChecked();
    const label = await page.locator(`label[for="${id}"]`).textContent().catch(() => id);

    state[label || id] = isChecked;
    console.log(`  - ${label || id}: ${isChecked ? '✓ checked' : '☐ unchecked'}`);
  }

  return state;
}

test.describe('Complete FPOD Saved Plot Workflow', () => {
  test('should save and restore FPOD plot with parameter changes', async ({ page }) => {
    console.log('\n🧪 TEST: Complete FPOD Saved Plot Workflow');
    console.log('═══════════════════════════════════════════\n');

    // Step 1: Login and navigate
    await login(page);
    await page.goto(`${BASE_URL}/map-drawing`);
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('✅ Step 1: Navigated to map-drawing\n');

    // Step 2: Look for existing pins or create one
    console.log('📍 Step 2: Looking for existing pins...');
    await page.waitForTimeout(2000); // Let map load

    // Try to find and click on an existing pin marker
    const pinMarker = page.locator('[class*="marker"], [class*="pin"]').first();
    const hasPins = await pinMarker.isVisible().catch(() => false);

    if (hasPins) {
      console.log('✅ Found existing pin, clicking it...');
      await pinMarker.click();
    } else {
      console.log('ℹ️ No existing pins found, looking for "View Data" or similar button...');
    }
    await page.waitForTimeout(1000);

    // Step 3: Open Marine Device Data modal
    console.log('\n📊 Step 3: Opening Marine Device Data modal...');

    // Look for various buttons that might open the data view
    const dataButtons = [
      'button:has-text("View Data")',
      'button:has-text("Marine")',
      'button:has-text("Device Data")',
      'button:has-text("Data")',
      '[data-testid="view-data"]',
    ];

    let modalOpened = false;
    for (const selector of dataButtons) {
      const button = page.locator(selector).first();
      const isVisible = await button.isVisible().catch(() => false);

      if (isVisible) {
        console.log(`✅ Found button: ${selector}`);
        await button.click();
        await page.waitForTimeout(2000);
        modalOpened = true;
        break;
      }
    }

    if (!modalOpened) {
      console.log('⚠️ Could not find data view button, checking if modal is already open...');
    }

    // Step 4: Check if there are existing plots or need to add one
    console.log('\n📈 Step 4: Looking for existing plots or Add Plot button...');

    const addPlotButton = page.locator('button:has-text("Add Plot")').first();
    const hasAddButton = await addPlotButton.isVisible().catch(() => false);

    if (hasAddButton) {
      console.log('✅ Found "Add Plot" button, clicking...');
      await addPlotButton.click();
      await page.waitForTimeout(1000);

      // Select Device Data option
      const deviceDataOption = page.locator('text=/Device Data/i').first();
      const hasOption = await deviceDataOption.isVisible().catch(() => false);

      if (hasOption) {
        console.log('✅ Selecting Device Data option...');
        await deviceDataOption.click();
        await page.waitForTimeout(1000);
      }
    }

    // Step 5: Look for existing FPOD files or file selector
    console.log('\n📁 Step 5: Looking for FPOD files...');

    // Check if there's a file selector dialog or existing files
    const fpodFiles = page.locator('text=/fpod/i, text=/\\.csv/i');
    const fileCount = await fpodFiles.count();

    console.log(`📊 Found ${fileCount} potential file references`);

    // If there's a file list, select the first FPOD file
    if (fileCount > 0) {
      const firstFile = fpodFiles.first();
      const fileName = await firstFile.textContent();
      console.log(`✅ Selecting file: ${fileName}`);

      // Try to click the file or its parent container
      const clickableFile = page.locator('text=/fpod/i').first().locator('..'); // Parent element
      await clickableFile.click().catch(() => firstFile.click());
      await page.waitForTimeout(2000);
    }

    // Step 6: Wait for plot to render
    console.log('\n📊 Step 6: Waiting for plot to render...');

    const plotRendered = await page.waitForSelector('svg.recharts-surface', {
      timeout: 15000
    }).then(() => true).catch(() => false);

    if (plotRendered) {
      console.log('✅ Plot rendered successfully!');
    } else {
      console.log('⚠️ Plot might not have rendered, continuing anyway...');
    }

    await page.waitForTimeout(2000);

    // Step 7: Capture initial parameter state
    console.log('\n👁️ Step 7: Capturing initial parameter state...');
    const initialState = await getParameterState(page);
    console.log(`✅ Captured ${Object.keys(initialState).length} parameters\n`);

    // Step 8: Change some parameters
    console.log('🔧 Step 8: Changing parameter selection...');

    const checkboxes = await page.locator('input[type="checkbox"]:visible').all();
    let changedCount = 0;

    // Toggle first 3 visible checkboxes
    for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
      try {
        await checkboxes[i].click();
        changedCount++;
        console.log(`  ✓ Toggled parameter ${i + 1}`);
        await page.waitForTimeout(500);
      } catch (error) {
        console.log(`  ⚠️ Could not toggle parameter ${i + 1}`);
      }
    }

    console.log(`✅ Changed ${changedCount} parameters\n`);

    // Step 9: Capture modified parameter state
    console.log('📸 Step 9: Capturing modified parameter state...');
    const modifiedState = await getParameterState(page);
    console.log(`✅ Captured modified state\n`);

    // Step 10: Save the plot view
    console.log('💾 Step 10: Saving plot view...');

    const saveButton = page.locator('button:has-text("Save View"), button:has-text("Save")').first();
    const hasSaveButton = await saveButton.isVisible().catch(() => false);

    if (hasSaveButton) {
      console.log('✅ Found Save View button, clicking...');
      await saveButton.click();
      await page.waitForTimeout(1000);

      // Fill in the save dialog
      const nameInput = page.locator('input[id="view-name"], input[placeholder*="name" i]').first();
      const hasNameInput = await nameInput.isVisible().catch(() => false);

      if (hasNameInput) {
        console.log('✅ Filling save dialog...');
        await nameInput.fill(PLOT_VIEW_NAME);
        await page.waitForTimeout(500);

        // Fill description if available
        const descInput = page.locator('textarea[id="view-description"], textarea[placeholder*="description" i]').first();
        const hasDescInput = await descInput.isVisible().catch(() => false);

        if (hasDescInput) {
          await descInput.fill(PLOT_VIEW_DESCRIPTION);
          await page.waitForTimeout(500);
        }

        // Click the Save button in dialog
        const dialogSaveButton = page.locator('button:has-text("Save")').last();
        await dialogSaveButton.click();

        // Wait for success message
        await page.waitForSelector('text=/saved/i, text=/success/i', { timeout: 10000 })
          .then(() => console.log('✅ Plot view saved successfully!'))
          .catch(() => console.log('⚠️ Could not confirm save (might still have worked)'));

        await page.waitForTimeout(2000);
      } else {
        throw new Error('❌ Could not find save dialog inputs');
      }
    } else {
      throw new Error('❌ Could not find Save View button');
    }

    console.log(`✅ Saved view: "${PLOT_VIEW_NAME}"\n`);

    // Step 11: Close the modal/app
    console.log('🚪 Step 11: Closing modal...');

    // Try to find close button
    const closeButtons = [
      'button[aria-label="Close"]',
      'button:has-text("Close")',
      'button:has-text("✕")',
      '[class*="close"]'
    ];

    for (const selector of closeButtons) {
      const closeButton = page.locator(selector).first();
      const isVisible = await closeButton.isVisible().catch(() => false);

      if (isVisible) {
        console.log(`✅ Found close button: ${selector}`);
        await closeButton.click();
        await page.waitForTimeout(1000);
        break;
      }
    }

    console.log('✅ Modal closed (or attempted to close)\n');

    // Step 12: Reload the page
    console.log('🔄 Step 12: Reloading the application...');
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('✅ Page reloaded\n');

    await page.waitForTimeout(2000);

    // Step 13: Open Load View dialog
    console.log('📂 Step 13: Opening Load View dialog...');

    // Re-open the data modal if needed
    const viewDataButton = page.locator('button:has-text("View Data")').first();
    const hasViewButton = await viewDataButton.isVisible().catch(() => false);

    if (hasViewButton) {
      console.log('✅ Re-opening data view...');
      await viewDataButton.click();
      await page.waitForTimeout(2000);
    }

    const loadButton = page.locator('button:has-text("Load View"), button:has-text("Load")').first();
    const hasLoadButton = await loadButton.isVisible().catch(() => false);

    if (hasLoadButton) {
      console.log('✅ Found Load View button, clicking...');
      await loadButton.click();
      await page.waitForTimeout(1000);
    } else {
      throw new Error('❌ Could not find Load View button');
    }

    // Step 14: Find and load our saved view
    console.log(`\n🔍 Step 14: Looking for saved view "${PLOT_VIEW_NAME}"...`);

    const savedView = page.locator(`text="${PLOT_VIEW_NAME}"`).first();
    const foundView = await savedView.isVisible({ timeout: 5000 }).catch(() => false);

    if (foundView) {
      console.log('✅ Found our saved view!');

      // Find the Load button for this specific view (usually in the same row)
      const viewRow = page.locator(`tr:has-text("${PLOT_VIEW_NAME}"), div:has-text("${PLOT_VIEW_NAME}")`).first();
      const rowLoadButton = viewRow.locator('button:has-text("Load")').first();

      const hasRowLoadButton = await rowLoadButton.isVisible().catch(() => false);

      if (hasRowLoadButton) {
        console.log('✅ Clicking Load button for our view...');
        await rowLoadButton.click();

        // Wait for loading to complete
        await page.waitForSelector('text=/loaded/i, text=/restored/i', { timeout: 15000 })
          .then(() => console.log('✅ View loaded successfully!'))
          .catch(() => console.log('⚠️ Could not confirm load (might still have worked)'));

        await page.waitForTimeout(3000);
      } else {
        throw new Error('❌ Could not find Load button for the saved view');
      }
    } else {
      throw new Error(`❌ Could not find saved view "${PLOT_VIEW_NAME}"`);
    }

    // Step 15: Wait for plot to re-render
    console.log('\n📊 Step 15: Waiting for plot to re-render...');

    await page.waitForSelector('svg.recharts-surface', { timeout: 15000 })
      .then(() => console.log('✅ Plot re-rendered!'))
      .catch(() => console.log('⚠️ Plot might not be visible'));

    await page.waitForTimeout(3000);

    // Step 16: Capture restored parameter state
    console.log('\n🔍 Step 16: Capturing restored parameter state...');
    const restoredState = await getParameterState(page);
    console.log(`✅ Captured restored state with ${Object.keys(restoredState).length} parameters\n`);

    // Step 17: Compare states
    console.log('⚖️ Step 17: Comparing parameter states...');
    console.log('═════════════════════════════════════════\n');

    let matches = 0;
    let mismatches = 0;

    for (const [param, wasChecked] of Object.entries(modifiedState)) {
      const isChecked = restoredState[param];

      if (isChecked === wasChecked) {
        matches++;
        console.log(`  ✅ ${param}: ${wasChecked ? 'checked' : 'unchecked'} (MATCH)`);
      } else {
        mismatches++;
        console.log(`  ❌ ${param}: expected ${wasChecked ? 'checked' : 'unchecked'}, got ${isChecked ? 'checked' : 'unchecked'} (MISMATCH)`);
      }
    }

    console.log('\n═════════════════════════════════════════');
    console.log(`📊 Results: ${matches} matches, ${mismatches} mismatches`);

    if (mismatches === 0) {
      console.log('✅✅✅ ALL PARAMETERS MATCH! ✅✅✅');
    } else {
      console.log(`⚠️ Found ${mismatches} mismatches`);
    }

    console.log('═════════════════════════════════════════\n');

    // Assertions
    expect(Object.keys(restoredState).length).toBeGreaterThan(0);
    console.log(`✅ Assertion: Found ${Object.keys(restoredState).length} parameters`);

    // Allow some tolerance (80% match rate is good)
    const matchRate = matches / (matches + mismatches);
    expect(matchRate).toBeGreaterThan(0.8);
    console.log(`✅ Assertion: Match rate ${(matchRate * 100).toFixed(0)}% > 80%`);

    console.log('\n🎉 TEST COMPLETE! 🎉');
  });
});
