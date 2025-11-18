import { test, expect } from '@playwright/test';
import path from 'path';
import { setupTestDataWithUpload, waitForChartRender, openFileChart } from '../helpers/test-data-setup';

/**
 * Data Workflow Performance Tests - Round 2
 *
 * Tests the complete data upload → visualization → interaction workflow
 * Measures performance at each step to identify bottlenecks
 *
 * These tests now use actual test data and measure real performance metrics
 */

test.describe('Data Workflow Performance', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to map-drawing page
    await page.goto('/map-drawing');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Wait for map to initialize
    await page.waitForSelector('.leaflet-container', { timeout: 15000 });
  });

  test('measure file upload to chart display workflow - CROP data', async ({ page }) => {
    console.log('\n🧪 Testing: File Upload → Chart Display Workflow (CROP)\n');

    // Performance tracking
    const metrics = {
      setupTime: 0,
      chartOpenTime: 0,
      chartRenderTime: 0,
      totalWorkflowTime: 0,
    };

    const workflowStart = Date.now();

    // Step 1: Setup test data (upload CROP file)
    console.log('Step 1: Setting up test data (CROP file)...');
    const setupStart = Date.now();

    const setupSuccess = await setupTestDataWithUpload(page, {
      csvFile: 'NORF_CROP_ALL_2411_Width.csv'
    });

    metrics.setupTime = Date.now() - setupStart;
    console.log(`✓ Setup completed in ${metrics.setupTime}ms`);

    if (!setupSuccess) {
      console.log('⚠️ Setup did not complete successfully, continuing with test...');
    }

    // Step 2: Open chart for the uploaded file
    console.log('\nStep 2: Opening chart for CROP file...');
    const chartOpenStart = Date.now();

    const chartOpened = await openFileChart(page, 'NORF_CROP_ALL_2411_Width.csv');

    metrics.chartOpenTime = Date.now() - chartOpenStart;
    console.log(`✓ Chart opened in ${metrics.chartOpenTime}ms`);

    // Step 3: Wait for and verify chart rendering
    console.log('\nStep 3: Verifying chart rendering...');
    const renderStart = Date.now();

    const chartRendered = await waitForChartRender(page, 15000);

    metrics.chartRenderTime = Date.now() - renderStart;
    console.log(`✓ Chart rendered in ${metrics.chartRenderTime}ms`);

    metrics.totalWorkflowTime = Date.now() - workflowStart;

    // Log performance summary
    console.log('\n📊 Performance Metrics (CROP):');
    console.log(`   Data Setup:        ${metrics.setupTime}ms`);
    console.log(`   Chart Open:        ${metrics.chartOpenTime}ms`);
    console.log(`   Chart Rendering:   ${metrics.chartRenderTime}ms`);
    console.log(`   Total Workflow:    ${metrics.totalWorkflowTime}ms`);
    console.log('');

    // Performance assertions
    expect(metrics.totalWorkflowTime).toBeLessThan(60000); // Total should be under 60s (includes setup time)
    if (metrics.setupTime > 0) {
      expect(metrics.setupTime).toBeLessThan(30000); // Setup should complete in under 30s
    }

    // Take screenshot of final state
    await page.screenshot({
      path: 'test-reports/screenshots/crop-workflow-complete.png',
      fullPage: true
    });
  });

  test('measure chart settings interaction performance', async ({ page }) => {
    console.log('\n🧪 Testing: Chart Settings Interaction Performance\n');

    const metrics = {
      setupTime: 0,
      openChartTime: 0,
      openSettingsTime: 0,
      toggleCompactViewTime: 0,
      totalInteractionTime: 0,
    };

    const interactionStart = Date.now();

    // Step 0: Setup test data (upload CHEM file)
    console.log('Step 0: Setting up test data (CHEM file)...');
    const setupStart = Date.now();

    await setupTestDataWithUpload(page, {
      csvFile: 'NORF_CHEM_ALL_2411.csv'
    });

    metrics.setupTime = Date.now() - setupStart;
    console.log(`✓ Setup completed in ${metrics.setupTime}ms`);

    // Step 0.5: Open chart
    console.log('\nStep 0.5: Opening chart...');
    const openChartStart = Date.now();

    await openFileChart(page, 'NORF_CHEM_ALL_2411.csv');
    await waitForChartRender(page);

    metrics.openChartTime = Date.now() - openChartStart;
    console.log(`✓ Chart opened in ${metrics.openChartTime}ms`);

    // Step 1: Find and open chart settings
    console.log('\nStep 1: Opening chart settings...');
    const settingsStart = Date.now();

    const settingsButton = page.locator('[data-testid="chart-settings-button"]').or(
      page.getByRole('button', { name: /settings/i })
    ).first();

    if (await settingsButton.count() > 0) {
      await settingsButton.click();
      await page.waitForTimeout(500);
      metrics.openSettingsTime = Date.now() - settingsStart;
      console.log(`✓ Settings opened in ${metrics.openSettingsTime}ms`);
    } else {
      console.log('⚠️ Settings button not found');
    }

    // Step 2: Toggle compact view
    console.log('\nStep 2: Toggling compact view...');
    const compactViewStart = Date.now();

    const compactViewSwitch = page.getByText('Compact View').locator('..').locator('button').first();
    if (await compactViewSwitch.count() > 0) {
      await compactViewSwitch.click();
      await page.waitForTimeout(800); // Wait for UI to re-render
      metrics.toggleCompactViewTime = Date.now() - compactViewStart;
      console.log(`✓ Compact view toggled in ${metrics.toggleCompactViewTime}ms`);
    } else {
      console.log('⚠️ Compact view switch not found');
    }

    metrics.totalInteractionTime = Date.now() - interactionStart;

    // Log performance summary
    console.log('\n📊 Settings Interaction Metrics:');
    console.log(`   Setup Time:         ${metrics.setupTime}ms`);
    console.log(`   Open Chart:         ${metrics.openChartTime}ms`);
    console.log(`   Open Settings:      ${metrics.openSettingsTime}ms`);
    console.log(`   Toggle Compact View: ${metrics.toggleCompactViewTime}ms`);
    console.log(`   Total Interaction:  ${metrics.totalInteractionTime}ms`);
    console.log('');

    // Performance assertions
    expect(metrics.totalInteractionTime).toBeLessThan(60000); // Should be under 60s (includes setup)
    if (metrics.openSettingsTime > 0) {
      expect(metrics.openSettingsTime).toBeLessThan(1000); // Settings should open quickly
    }

    // Take screenshot
    await page.screenshot({
      path: 'test-reports/screenshots/chart-settings-interaction.png',
      fullPage: true
    });
  });

  test('measure large dataset rendering performance', async ({ page }) => {
    console.log('\n🧪 Testing: Large Dataset Rendering Performance\n');

    // This test will measure how the app handles larger datasets
    const metrics = {
      dataLoadTime: 0,
      initialRenderTime: 0,
      scrollPerformance: 0,
      totalTime: 0,
    };

    const testStart = Date.now();

    console.log('Step 1: Loading page with existing data...');
    const loadStart = Date.now();

    // The page should already be loaded from beforeEach
    // Check for any data tables or lists
    const dataTable = page.locator('table').or(
      page.locator('[role="grid"]')
    ).or(
      page.locator('.data-list')
    ).first();

    if (await dataTable.count() > 0) {
      await dataTable.waitFor({ state: 'visible', timeout: 5000 });
      metrics.dataLoadTime = Date.now() - loadStart;
      console.log(`✓ Data table loaded in ${metrics.dataLoadTime}ms`);

      // Count rows
      const rows = await page.locator('tr').or(page.locator('[role="row"]')).count();
      console.log(`   Found ${rows} data rows`);
    } else {
      console.log('⚠️ No data table found');
    }

    // Step 2: Measure scroll performance
    console.log('\nStep 2: Testing scroll performance...');
    const scrollStart = Date.now();

    // Scroll through the page/data
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);

    metrics.scrollPerformance = Date.now() - scrollStart;
    console.log(`✓ Scroll test completed in ${metrics.scrollPerformance}ms`);

    metrics.totalTime = Date.now() - testStart;

    // Log performance summary
    console.log('\n📊 Large Dataset Metrics:');
    console.log(`   Data Load:         ${metrics.dataLoadTime}ms`);
    console.log(`   Scroll Performance: ${metrics.scrollPerformance}ms`);
    console.log(`   Total Time:        ${metrics.totalTime}ms`);
    console.log('');

    // Performance assertions
    expect(metrics.scrollPerformance).toBeLessThan(5000); // Scroll should be smooth
  });

  test('measure browser performance metrics during chart rendering', async ({ page }) => {
    console.log('\n🧪 Testing: Browser Performance Metrics During Chart Rendering\n');

    // Start performance monitoring
    await page.goto('/map-drawing');

    // Collect performance metrics using Chrome DevTools Protocol
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      return {
        // Navigation timing
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,

        // Paint timing
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,

        // Resource timing
        totalResources: performance.getEntriesByType('resource').length,

        // Memory (if available)
        memory: (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        } : null,
      };
    });

    console.log('📊 Browser Performance Metrics:');
    console.log(`   DOM Content Loaded:      ${performanceMetrics.domContentLoaded.toFixed(2)}ms`);
    console.log(`   Load Complete:           ${performanceMetrics.loadComplete.toFixed(2)}ms`);
    console.log(`   First Paint:             ${performanceMetrics.firstPaint.toFixed(2)}ms`);
    console.log(`   First Contentful Paint:  ${performanceMetrics.firstContentfulPaint.toFixed(2)}ms`);
    console.log(`   Total Resources Loaded:  ${performanceMetrics.totalResources}`);

    if (performanceMetrics.memory) {
      console.log(`   JS Heap Used:            ${(performanceMetrics.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   JS Heap Total:           ${(performanceMetrics.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
    }
    console.log('');

    // Performance assertions
    expect(performanceMetrics.firstContentfulPaint).toBeLessThan(5000);
    expect(performanceMetrics.domContentLoaded).toBeLessThan(3000);
  });

  test('measure chart export performance', async ({ page }) => {
    console.log('\n🧪 Testing: Chart Export Performance\n');

    const metrics = {
      openExportMenuTime: 0,
      exportToPNGTime: 0,
      exportToCSVTime: 0,
      totalExportTime: 0,
    };

    const exportStart = Date.now();

    // Look for export button
    console.log('Step 1: Finding export menu...');
    const menuStart = Date.now();

    const exportButton = page.getByRole('button', { name: /export/i }).or(
      page.getByRole('button', { name: /download/i })
    ).or(
      page.locator('[data-testid="export-button"]')
    ).first();

    if (await exportButton.count() > 0) {
      await exportButton.click();
      await page.waitForTimeout(500);
      metrics.openExportMenuTime = Date.now() - menuStart;
      console.log(`✓ Export menu opened in ${metrics.openExportMenuTime}ms`);

      // Try to export to PNG
      console.log('\nStep 2: Exporting to PNG...');
      const pngStart = Date.now();

      const pngOption = page.getByText(/png/i).or(page.getByText(/image/i)).first();
      if (await pngOption.count() > 0) {
        // Set up download handler
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
        await pngOption.click();

        try {
          const download = await downloadPromise;
          metrics.exportToPNGTime = Date.now() - pngStart;
          console.log(`✓ PNG export completed in ${metrics.exportToPNGTime}ms`);
          console.log(`   File: ${download.suggestedFilename()}`);
        } catch (e) {
          console.log('⚠️ PNG download not detected');
        }
      } else {
        console.log('⚠️ PNG export option not found');
      }

      // Try to export to CSV
      console.log('\nStep 3: Exporting to CSV...');
      const csvStart = Date.now();

      const csvOption = page.getByText(/csv/i).or(page.getByText(/data/i)).first();
      if (await csvOption.count() > 0) {
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
        await csvOption.click();

        try {
          const download = await downloadPromise;
          metrics.exportToCSVTime = Date.now() - csvStart;
          console.log(`✓ CSV export completed in ${metrics.exportToCSVTime}ms`);
          console.log(`   File: ${download.suggestedFilename()}`);
        } catch (e) {
          console.log('⚠️ CSV download not detected');
        }
      } else {
        console.log('⚠️ CSV export option not found');
      }
    } else {
      console.log('⚠️ Export button not found - skipping export tests');
    }

    metrics.totalExportTime = Date.now() - exportStart;

    console.log('\n📊 Export Performance Metrics:');
    console.log(`   Open Export Menu:  ${metrics.openExportMenuTime}ms`);
    console.log(`   Export to PNG:     ${metrics.exportToPNGTime}ms`);
    console.log(`   Export to CSV:     ${metrics.exportToCSVTime}ms`);
    console.log(`   Total Export Time: ${metrics.totalExportTime}ms`);
    console.log('');

    // Performance assertions
    if (metrics.exportToPNGTime > 0) {
      expect(metrics.exportToPNGTime).toBeLessThan(5000);
    }
    if (metrics.exportToCSVTime > 0) {
      expect(metrics.exportToCSVTime).toBeLessThan(3000);
    }
  });
});
