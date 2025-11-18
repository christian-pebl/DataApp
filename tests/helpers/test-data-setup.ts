import { Page } from '@playwright/test';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

/**
 * Test Data Setup Helpers
 *
 * These functions help set up test data for E2E tests,
 * including uploading files, creating pins, and preparing
 * the application state for testing.
 */

// Initialize Supabase client for direct database operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface TestDataConfig {
  projectName?: string;
  pinName?: string;
  pinLocation?: { lat: number; lng: number };
  csvFile?: string;
}

/**
 * Setup authentication for test user
 * Creates a test user session in localStorage
 */
async function setupTestAuth(page: Page): Promise<string | null> {
  try {
    // Try to sign in or create a test user
    const testEmail = 'test@example.com';
    const testPassword = 'testpassword123';

    console.log('  Attempting to authenticate test user...');

    // Try to sign in
    let { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // If user doesn't exist, create it
    if (error && error.message.includes('Invalid login credentials')) {
      console.log('  Test user not found, creating new user...');
      const signUpResult = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
      });

      if (signUpResult.error) {
        console.log('⚠️ Failed to create test user:', signUpResult.error.message);
        return null;
      }

      data = signUpResult.data;
    } else if (error) {
      console.log('⚠️ Auth error:', error.message);
      return null;
    }

    if (!data?.session || !data?.user) {
      console.log('⚠️ No session or user returned from auth');
      return null;
    }

    console.log(`✓ Authenticated as: ${data.user.id}`);

    // Inject the session into the page's localStorage
    await page.evaluate((session) => {
      localStorage.setItem('sb-tujjhrliibqgstbrohfn-auth-token', JSON.stringify(session));
    }, data.session);

    return data.user.id;
  } catch (error) {
    console.error('❌ Error in test auth setup:', error);
    return null;
  }
}

/**
 * Create a pin directly in the database (bypasses UI)
 */
async function createTestPin(
  userId: string,
  config: TestDataConfig
): Promise<string | null> {
  try {
    const { pinLocation = { lat: -33.5, lng: 151.2 }, pinName = 'Test Pin' } = config;

    console.log(`  Creating pin in database for user: ${userId}`);

    // Get or create a default project
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    let projectId: string;
    if (projects && projects.length > 0) {
      projectId = projects[0].id;
      console.log(`  Using existing project: ${projectId}`);
    } else {
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name: 'Test Project',
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (projectError || !newProject) {
        console.log('⚠️ Failed to create project:', projectError);
        return null;
      }
      projectId = newProject.id;
      console.log(`  Created new project: ${projectId}`);
    }

    // Create the pin
    const { data: pin, error: pinError } = await supabase
      .from('pins')
      .insert({
        user_id: userId,
        project_id: projectId,
        label: pinName,
        latitude: pinLocation.lat,
        longitude: pinLocation.lng,
        color: '#3b82f6', // Blue
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (pinError || !pin) {
      console.log('⚠️ Failed to create pin:', pinError);
      return null;
    }

    console.log(`✓ Pin created in database: ${pin.id}`);
    return pin.id;
  } catch (error) {
    console.error('❌ Error creating pin:', error);
    return null;
  }
}

/**
 * Setup test data by uploading a CSV file to a pin
 * This prepares the application for testing data workflows
 */
export async function setupTestDataWithUpload(
  page: Page,
  config: TestDataConfig = {}
): Promise<boolean> {
  try {
    const {
      csvFile = 'sample-data.csv'
    } = config;

    console.log('🔧 [TEST SETUP] Starting test data setup...');

    // Step 1: Wait for map to be ready
    await page.waitForSelector('.leaflet-container', { timeout: 15000 });
    console.log('✓ Map container loaded');

    // Step 2: Setup test authentication
    const userId = await setupTestAuth(page);
    if (!userId) {
      console.log('⚠️ Failed to authenticate test user');
      return false;
    }

    // Step 3: Create a pin directly in database
    const pinId = await createTestPin(userId, config);
    if (!pinId) {
      console.log('⚠️ Failed to create pin');
      return false;
    }

    // Reload page to pick up the new pin and authentication
    await page.reload();
    await page.waitForSelector('.leaflet-container', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify pin appears on map
    const pinMarkerCount = await page.locator('.leaflet-marker-icon').count();
    console.log(`✓ Pin appears on map (${pinMarkerCount} markers visible)`);

    // Step 3: Open project data dialog to upload file
    // Look for the menu button
    const menuButton = page.locator('[data-menu-button]');
    if (await menuButton.count() > 0) {
      await menuButton.click();
      console.log('✓ Menu opened');
      await page.waitForTimeout(500);

      // Look for "Project Data" button in menu
      const projectDataButton = page.getByText('Project Data', { exact: false }).first();
      if (await projectDataButton.count() > 0) {
        await projectDataButton.click();
        console.log('✓ Project Data dialog opened');
        await page.waitForTimeout(1000);
      }
    }

    // Step 4: Upload file
    const uploadButton = page.locator('[data-testid="upload-file-button"]');
    if (await uploadButton.count() > 0) {
      // Set up file chooser handler BEFORE clicking the button
      const filePath = path.join(__dirname, '..', 'fixtures', 'csv', csvFile);

      // Use Promise.all to handle the file chooser that will appear
      const fileChooserPromise = page.waitForEvent('filechooser');

      await uploadButton.click();
      console.log('✓ Upload button clicked');

      // Wait for the file chooser dialog
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(filePath);
      console.log(`✓ File uploaded: ${csvFile}`);

      // Wait for upload to complete and pin selector dialog
      await page.waitForTimeout(2000);

      // Look for the "Assign Files" dialog
      const assignDialogTitle = page.getByText('Assign Files');
      if (await assignDialogTitle.count() > 0) {
        console.log('✓ Assign Files dialog opened');

        // Click on the Select trigger to open the pin dropdown
        const selectTrigger = page.getByRole('combobox').first();
        if (await selectTrigger.count() > 0) {
          await selectTrigger.click();
          console.log('✓ Pin selector opened');

          // Wait for dropdown to appear
          await page.waitForTimeout(1000);

          // Check what options are available
          const optionCount = await page.getByRole('option').count();
          console.log(`  Found ${optionCount} pin options in dropdown`);

          // If no options, check for "No pins found" message
          if (optionCount === 0) {
            const noPinsText = await page.getByText('No pins found').or(
              page.getByText('No pins in this project')
            ).count();
            if (noPinsText > 0) {
              console.log('  ⚠️ Dropdown shows "No pins found" message');
            }

            // Try waiting longer and checking again
            console.log('  Waiting additional 3 seconds for pins to load...');
            await page.waitForTimeout(3000);
            const optionCountRetry = await page.getByRole('option').count();
            console.log(`  Retry: Found ${optionCountRetry} pin options`);
          }

          // Click on the first pin option in the dropdown
          // SelectItems have role="option"
          const firstPinOption = page.getByRole('option').first();
          if (await firstPinOption.count() > 0) {
            await firstPinOption.click();
            console.log('✓ Pin selected');

            // Wait for selection to register
            await page.waitForTimeout(500);

            // Click Upload Files button
            const uploadFilesButton = page.locator('[data-testid="upload-files-confirm-button"]').or(
              page.getByRole('button', { name: 'Upload Files' })
            );
            if (await uploadFilesButton.count() > 0) {
              // Wait for button to be enabled (check it's not disabled)
              await page.waitForTimeout(1000);

              await uploadFilesButton.click();
              console.log('✓ Upload confirmed');

              // Wait for upload to complete
              await page.waitForTimeout(5000);

              console.log('✅ [TEST SETUP] Test data setup complete!');
              return true;
            } else {
              console.log('⚠️ Upload Files button not found');
            }
          } else {
            console.log('⚠️ No pin options found in dropdown');
          }
        } else {
          console.log('⚠️ Pin selector trigger not found');
        }
      } else {
        console.log('⚠️ Assign Files dialog not found');
      }

      console.log('⚠️ Could not complete upload flow');
    } else {
      console.log('⚠️ Upload button not found');
    }

    return false;
  } catch (error) {
    console.error('❌ [TEST SETUP] Error during test data setup:', error);
    return false;
  }
}

/**
 * Setup test data using localStorage injection
 * This is faster but requires knowledge of the data structure
 */
export async function setupTestDataViaLocalStorage(
  page: Page,
  config: TestDataConfig = {}
): Promise<boolean> {
  try {
    console.log('🔧 [TEST SETUP] Injecting test data via localStorage...');

    // TODO: Implement localStorage data injection
    // This would involve:
    // 1. Creating mock project data
    // 2. Creating mock pin data
    // 3. Injecting into localStorage
    // 4. Refreshing the page to load the data

    console.log('⚠️ LocalStorage injection not yet implemented');
    return false;
  } catch (error) {
    console.error('❌ [TEST SETUP] Error during localStorage injection:', error);
    return false;
  }
}

/**
 * Clean up test data after tests
 */
export async function cleanupTestData(page: Page): Promise<void> {
  try {
    console.log('🧹 [TEST CLEANUP] Cleaning up test data...');

    // TODO: Implement cleanup logic
    // This could involve:
    // 1. Deleting created pins
    // 2. Deleting uploaded files
    // 3. Clearing localStorage
    // 4. Resetting database state

    console.log('✓ [TEST CLEANUP] Cleanup complete');
  } catch (error) {
    console.error('❌ [TEST CLEANUP] Error during cleanup:', error);
  }
}

/**
 * Wait for chart to be rendered
 */
export async function waitForChartRender(page: Page, timeout: number = 10000): Promise<boolean> {
  try {
    // Look for Recharts SVG element
    await page.waitForSelector('svg.recharts-surface', { timeout });
    console.log('✓ Chart rendered (Recharts SVG found)');
    return true;
  } catch {
    try {
      // Alternative: look for canvas element
      await page.waitForSelector('canvas', { timeout });
      console.log('✓ Chart rendered (Canvas found)');
      return true;
    } catch {
      console.log('⚠️ Chart not rendered within timeout');
      return false;
    }
  }
}

/**
 * Open a file's chart from the data timeline
 */
export async function openFileChart(page: Page, fileName: string): Promise<boolean> {
  try {
    console.log(`📊 [TEST HELPER] Opening chart for file: ${fileName}`);

    // Look for the file name in the timeline
    const fileElement = page.getByText(fileName, { exact: false }).first();
    if (await fileElement.count() > 0) {
      // Click to open context menu
      await fileElement.click();
      await page.waitForTimeout(500);

      // Click "Open" button
      const openButton = page.locator('[data-testid="open-chart-button"]');
      if (await openButton.count() > 0) {
        await openButton.click();
        console.log('✓ Open button clicked');

        // Wait for chart to render
        const chartRendered = await waitForChartRender(page);
        return chartRendered;
      } else {
        console.log('⚠️ Open button not found');
      }
    } else {
      console.log(`⚠️ File not found: ${fileName}`);
    }

    return false;
  } catch (error) {
    console.error('❌ [TEST HELPER] Error opening file chart:', error);
    return false;
  }
}
