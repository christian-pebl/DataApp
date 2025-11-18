import { test, expect } from '@playwright/test';
import { setupTestDataWithUpload, waitForChartRender } from '../helpers/test-data-setup';

/**
 * eDNA Visualization Performance Tests
 *
 * Tests the performance of complex data visualizations:
 * - _hapl files: Heatmaps + Rarefaction curves
 * - _nmax files: Presence/absence heatmaps
 *
 * Measures rendering time, interaction responsiveness, and identifies bottlenecks
 */

test.describe('eDNA Visualization Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map-drawing');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.leaflet-container', { timeout: 15000 });
  });

  test('measure _hapl file heatmap rendering performance', async ({ page }) => {
    console.log('\n🧪 Testing: _hapl Heatmap Rendering Performance\n');

    const metrics = {
      setupTime: 0,
      heatmapRenderTime: 0,
      interactionTime: 0,
      totalTime: 0,
    };

    const testStart = Date.now();

    // Step 1: Upload _hapl file
    console.log('Step 1: Uploading _hapl file...');
    const setupStart = Date.now();

    await setupTestDataWithUpload(page, {
      csvFile: 'NORF_EDNAS_ALL_2411_Hapl.csv'
    });

    metrics.setupTime = Date.now() - setupStart;
    console.log(`✓ Setup completed in ${metrics.setupTime}ms`);

    // Step 2: Measure heatmap rendering
    console.log('\nStep 2: Measuring heatmap render time...');
    const renderStart = Date.now();

    // Wait for heatmap SVG to appear
    try {
      await page.waitForSelector('svg', { timeout: 20000 });
      metrics.heatmapRenderTime = Date.now() - renderStart;
      console.log(`✓ Heatmap rendered in ${metrics.heatmapRenderTime}ms`);

      // Count heatmap cells
      const cells = await page.locator('rect[data-species]').or(page.locator('rect.heatmap-cell')).count();
      console.log(`  Found ${cells} heatmap cells`);
    } catch (error) {
      console.log('⚠️ Heatmap SVG not found within timeout');
      metrics.heatmapRenderTime = Date.now() - renderStart;
    }

    // Step 3: Test interaction (hover on cell)
    console.log('\nStep 3: Testing heatmap interaction...');
    const interactionStart = Date.now();

    const firstCell = page.locator('rect').first();
    if (await firstCell.count() > 0) {
      await firstCell.hover();
      await page.waitForTimeout(200); // Wait for tooltip
      metrics.interactionTime = Date.now() - interactionStart;
      console.log(`✓ Interaction completed in ${metrics.interactionTime}ms`);
    } else {
      console.log('⚠️ No heatmap cells found for interaction test');
    }

    metrics.totalTime = Date.now() - testStart;

    // Log performance summary
    console.log('\n📊 _hapl Heatmap Performance Metrics:');
    console.log(`   Setup Time:          ${metrics.setupTime}ms`);
    console.log(`   Heatmap Render:      ${metrics.heatmapRenderTime}ms`);
    console.log(`   Interaction:         ${metrics.interactionTime}ms`);
    console.log(`   Total Time:          ${metrics.totalTime}ms`);
    console.log('');

    // Performance assertions
    expect(metrics.totalTime).toBeLessThan(90000); // Total under 90s
    if (metrics.heatmapRenderTime > 0) {
      expect(metrics.heatmapRenderTime).toBeLessThan(10000); // Heatmap render under 10s
    }

    await page.screenshot({
      path: 'test-reports/screenshots/hapl-heatmap-performance.png',
      fullPage: true
    });
  });

  test('measure _hapl file rarefaction curve rendering performance', async ({ page }) => {
    console.log('\n🧪 Testing: _hapl Rarefaction Curve Performance\n');

    const metrics = {
      setupTime: 0,
      switchToRarefactionTime: 0,
      curveRenderTime: 0,
      confidenceIntervalRenderTime: 0,
      totalTime: 0,
    };

    const testStart = Date.now();

    // Step 1: Upload _hapl file
    console.log('Step 1: Uploading _hapl file...');
    const setupStart = Date.now();

    await setupTestDataWithUpload(page, {
      csvFile: 'NORF_EDNAS_ALL_2411_Hapl.csv'
    });

    metrics.setupTime = Date.now() - setupStart;
    console.log(`✓ Setup completed in ${metrics.setupTime}ms`);

    // Step 2: Switch to rarefaction view
    console.log('\nStep 2: Switching to rarefaction view...');
    const switchStart = Date.now();

    const rarefactionButton = page.getByRole('button', { name: /rarefaction/i }).or(
      page.getByText('Rarefaction', { exact: false })
    ).first();

    if (await rarefactionButton.count() > 0) {
      await rarefactionButton.click();
      await page.waitForTimeout(1000);
      metrics.switchToRarefactionTime = Date.now() - switchStart;
      console.log(`✓ Switched to rarefaction in ${metrics.switchToRarefactionTime}ms`);
    } else {
      console.log('⚠️ Rarefaction button not found');
    }

    // Step 3: Measure rarefaction curve rendering
    console.log('\nStep 3: Measuring rarefaction curve render...');
    const curveStart = Date.now();

    try {
      // Wait for Recharts SVG (rarefaction uses Recharts)
      await page.waitForSelector('svg.recharts-surface', { timeout: 15000 });
      metrics.curveRenderTime = Date.now() - curveStart;
      console.log(`✓ Rarefaction curve rendered in ${metrics.curveRenderTime}ms`);

      // Check for confidence interval areas
      const areas = await page.locator('.recharts-area').count();
      console.log(`  Found ${areas} area elements (confidence intervals)`);

      if (areas > 0) {
        metrics.confidenceIntervalRenderTime = metrics.curveRenderTime;
        console.log('✓ Confidence intervals rendered');
      }
    } catch (error) {
      console.log('⚠️ Rarefaction curve not rendered within timeout');
      metrics.curveRenderTime = Date.now() - curveStart;
    }

    metrics.totalTime = Date.now() - testStart;

    // Log performance summary
    console.log('\n📊 _hapl Rarefaction Curve Performance Metrics:');
    console.log(`   Setup Time:                ${metrics.setupTime}ms`);
    console.log(`   Switch to Rarefaction:     ${metrics.switchToRarefactionTime}ms`);
    console.log(`   Curve Render:              ${metrics.curveRenderTime}ms`);
    console.log(`   Confidence Intervals:      ${metrics.confidenceIntervalRenderTime}ms`);
    console.log(`   Total Time:                ${metrics.totalTime}ms`);
    console.log('');

    // Performance assertions
    expect(metrics.totalTime).toBeLessThan(90000); // Total under 90s
    if (metrics.curveRenderTime > 0) {
      expect(metrics.curveRenderTime).toBeLessThan(8000); // Curve render under 8s
    }

    await page.screenshot({
      path: 'test-reports/screenshots/hapl-rarefaction-performance.png',
      fullPage: true
    });
  });

  test('measure _nmax file heatmap rendering performance', async ({ page }) => {
    console.log('\n🧪 Testing: _nmax Presence/Absence Heatmap Performance\n');

    const metrics = {
      setupTime: 0,
      heatmapRenderTime: 0,
      densityToggleTime: 0,
      totalTime: 0,
    };

    const testStart = Date.now();

    // Step 1: Upload _nmax file
    console.log('Step 1: Uploading _nmax file...');
    const setupStart = Date.now();

    await setupTestDataWithUpload(page, {
      csvFile: 'NORF_EDNAS_ALL_2411_nmax.csv'
    });

    metrics.setupTime = Date.now() - setupStart;
    console.log(`✓ Setup completed in ${metrics.setupTime}ms`);

    // Step 2: Measure heatmap rendering
    console.log('\nStep 2: Measuring nmax heatmap render time...');
    const renderStart = Date.now();

    try {
      await page.waitForSelector('svg', { timeout: 20000 });
      metrics.heatmapRenderTime = Date.now() - renderStart;
      console.log(`✓ nmax heatmap rendered in ${metrics.heatmapRenderTime}ms`);

      // Count cells
      const cells = await page.locator('rect').count();
      console.log(`  Found ${cells} presence/absence cells`);
    } catch (error) {
      console.log('⚠️ nmax heatmap not rendered within timeout');
      metrics.heatmapRenderTime = Date.now() - renderStart;
    }

    // Step 3: Test density view toggle (if available)
    console.log('\nStep 3: Testing density view toggle...');
    const toggleStart = Date.now();

    const densityCheckbox = page.getByText('Density').or(
      page.getByLabel('Density')
    ).first();

    if (await densityCheckbox.count() > 0) {
      await densityCheckbox.click();
      await page.waitForTimeout(1000); // Wait for re-render
      metrics.densityToggleTime = Date.now() - toggleStart;
      console.log(`✓ Density toggle completed in ${metrics.densityToggleTime}ms`);
    } else {
      console.log('⚠️ Density toggle not found');
    }

    metrics.totalTime = Date.now() - testStart;

    // Log performance summary
    console.log('\n📊 _nmax Heatmap Performance Metrics:');
    console.log(`   Setup Time:          ${metrics.setupTime}ms`);
    console.log(`   Heatmap Render:      ${metrics.heatmapRenderTime}ms`);
    console.log(`   Density Toggle:      ${metrics.densityToggleTime}ms`);
    console.log(`   Total Time:          ${metrics.totalTime}ms`);
    console.log('');

    // Performance assertions
    expect(metrics.totalTime).toBeLessThan(90000); // Total under 90s
    if (metrics.heatmapRenderTime > 0) {
      expect(metrics.heatmapRenderTime).toBeLessThan(10000); // Heatmap render under 10s
    }

    await page.screenshot({
      path: 'test-reports/screenshots/nmax-heatmap-performance.png',
      fullPage: true
    });
  });

  test('measure saved plot save and load performance', async ({ page }) => {
    console.log('\n🧪 Testing: Saved Plot Save/Load Performance\n');

    const metrics = {
      setupTime: 0,
      openChartTime: 0,
      savePlotTime: 0,
      loadPlotTime: 0,
      totalTime: 0,
    };

    const testStart = Date.now();

    // Step 1: Upload file and open chart
    console.log('Step 1: Setting up chart for saving...');
    const setupStart = Date.now();

    await setupTestDataWithUpload(page, {
      csvFile: 'NORF_CHEM_ALL_2411.csv'
    });

    metrics.setupTime = Date.now() - setupStart;
    console.log(`✓ Setup completed in ${metrics.setupTime}ms`);

    // Wait for chart to render
    await page.waitForTimeout(3000);
    metrics.openChartTime = Date.now() - setupStart;

    // Step 2: Save plot
    console.log('\nStep 2: Saving plot...');
    const saveStart = Date.now();

    const saveButton = page.getByRole('button', { name: /save.*plot/i }).or(
      page.locator('[data-testid="save-plot"]')
    ).or(
      page.getByText('Save Plot')
    ).first();

    if (await saveButton.count() > 0) {
      await saveButton.click();
      await page.waitForTimeout(2000); // Wait for save operation
      metrics.savePlotTime = Date.now() - saveStart;
      console.log(`✓ Plot saved in ${metrics.savePlotTime}ms`);
    } else {
      console.log('⚠️ Save plot button not found');
    }

    // Step 3: Load saved plot (navigate away and back)
    console.log('\nStep 3: Loading saved plot...');
    const loadStart = Date.now();

    // Close current dialog/chart
    const closeButton = page.getByRole('button', { name: /close/i }).or(
      page.locator('[aria-label="Close"]')
    ).first();

    if (await closeButton.count() > 0) {
      await closeButton.click();
      await page.waitForTimeout(500);
    }

    // Look for "Saved Plots" or "Load Plot" button
    const loadPlotButton = page.getByRole('button', { name: /load.*plot|saved.*plot/i }).or(
      page.getByText('Saved Plots')
    ).first();

    if (await loadPlotButton.count() > 0) {
      await loadPlotButton.click();
      await page.waitForTimeout(1000);

      // Click on first saved plot
      const firstPlot = page.getByRole('button').or(page.locator('[role="option"]')).first();
      if (await firstPlot.count() > 0) {
        await firstPlot.click();
        await page.waitForTimeout(2000); // Wait for chart to load
        metrics.loadPlotTime = Date.now() - loadStart;
        console.log(`✓ Plot loaded in ${metrics.loadPlotTime}ms`);
      }
    } else {
      console.log('⚠️ Load plot functionality not found');
    }

    metrics.totalTime = Date.now() - testStart;

    // Log performance summary
    console.log('\n📊 Saved Plot Performance Metrics:');
    console.log(`   Setup Time:          ${metrics.setupTime}ms`);
    console.log(`   Open Chart:          ${metrics.openChartTime}ms`);
    console.log(`   Save Plot:           ${metrics.savePlotTime}ms`);
    console.log(`   Load Plot:           ${metrics.loadPlotTime}ms`);
    console.log(`   Total Time:          ${metrics.totalTime}ms`);
    console.log('');

    // Performance assertions
    expect(metrics.totalTime).toBeLessThan(120000); // Total under 2 minutes
    if (metrics.savePlotTime > 0) {
      expect(metrics.savePlotTime).toBeLessThan(5000); // Save under 5s
    }
    if (metrics.loadPlotTime > 0) {
      expect(metrics.loadPlotTime).toBeLessThan(8000); // Load under 8s
    }

    await page.screenshot({
      path: 'test-reports/screenshots/saved-plot-performance.png',
      fullPage: true
    });
  });
});
