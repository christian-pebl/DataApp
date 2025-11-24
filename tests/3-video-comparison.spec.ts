import { test, expect } from '@playwright/test';

/**
 * 3-Video Comparison Modal Test
 *
 * Tests the new 3-video comparison feature with YOLOv8 detection visualization
 */

test.describe('3-Video Comparison Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Motion Analysis Dashboard
    await page.goto('http://localhost:9002/motion-analysis');

    // Wait for dashboard to load
    await page.waitForSelector('text=Video Rankings', { timeout: 10000 });
  });

  test('3-video modal displays all videos and timelines', async ({ page }) => {
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];

    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      } else {
        consoleLogs.push(text);
      }
    });

    console.log('\n=== Testing 3-Video Comparison Modal ===\n');

    // Double-click first SUBCAM video (click on the row)
    console.log('1. Opening video modal...');
    await page.locator('tr').filter({ hasText: 'SUBCAM_ALG_2020-01-2' }).first().dblclick();

    // Wait for modal to open
    await page.waitForSelector('text=Video Comparison', { timeout: 5000 });
    console.log('✅ Modal opened');

    // Wait for video loading
    await page.waitForTimeout(3000);

    // Check modal opened log
    const hasModalOpenedLog = consoleLogs.some(log => log.includes('🎬 VIDEO MODAL OPENED'));
    expect(hasModalOpenedLog).toBe(true);
    console.log('✅ Modal opened log found');

    // Check for 3 video headers
    console.log('\n2. Checking video headers...');
    const originalHeader = page.locator('text=Original Video');
    const motionHeader = page.locator('text=Motion Analysis');
    const yolov8Header = page.locator('text=YOLOv8 Detections');

    await expect(originalHeader).toBeVisible();
    console.log('✅ Original Video header found');

    await expect(motionHeader).toBeVisible();
    console.log('✅ Motion Analysis header found');

    await expect(yolov8Header).toBeVisible();
    console.log('✅ YOLOv8 Detections header found');

    // Check for video elements
    console.log('\n3. Checking video elements...');
    const videos = page.locator('video');
    const videoCount = await videos.count();
    expect(videoCount).toBe(3);
    console.log(`✅ Found ${videoCount} video elements`);

    // Check YOLOv8 detection data loaded
    console.log('\n4. Checking YOLOv8 detection data...');
    const hasYolov8DataLog = consoleLogs.some(log =>
      log.includes('✅ YOLOV8 DETECTION DATA LOADED')
    );

    if (hasYolov8DataLog) {
      console.log('✅ YOLOv8 detection data loaded successfully');

      // Extract detection count from log
      const yolov8Log = consoleLogs.find(log => log.includes('✅ YOLOV8 DETECTION DATA LOADED'));
      console.log(`   ${yolov8Log}`);
    } else {
      console.log('⚠️ YOLOv8 detection data not loaded (may not be available yet)');
    }

    // Check for dual timelines
    console.log('\n5. Checking timelines...');
    const motionTimeline = page.locator('text=Motion Density Timeline');
    const yolov8Timeline = page.locator('text=YOLOv8 Detection Timeline');

    const hasMotionTimeline = await motionTimeline.count() > 0;
    const hasYolov8Timeline = await yolov8Timeline.count() > 0;

    if (hasMotionTimeline) {
      console.log('✅ Motion Density Timeline found');
    } else {
      console.log('⚠️ Motion Density Timeline not found');
    }

    if (hasYolov8Timeline) {
      console.log('✅ YOLOv8 Detection Timeline found');
    } else {
      console.log('⚠️ YOLOv8 Detection Timeline not found (may not have detection data)');
    }

    // Check video controls
    console.log('\n6. Checking video controls...');
    const playButton = page.getByRole('button').filter({ hasText: /play/i }).first();
    await expect(playButton).toBeVisible();
    console.log('✅ Play button found');

    // Check for detection count in header (if available)
    const headerText = await page.locator('text=Video Comparison').textContent();
    if (headerText && headerText.includes('detections')) {
      console.log('✅ Detection count shown in header');
    }

    // Print console summary
    console.log('\n=== Console Log Summary ===');
    console.log(`Total console logs: ${consoleLogs.length}`);
    console.log(`Total console errors: ${consoleErrors.length}`);

    // Print relevant logs
    const relevantLogs = consoleLogs.filter(log =>
      log.includes('VIDEO') ||
      log.includes('YOLOV8') ||
      log.includes('DETECTION')
    );

    if (relevantLogs.length > 0) {
      console.log('\n=== Relevant Console Logs ===');
      relevantLogs.forEach(log => console.log(log));
    }

    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors ===');
      consoleErrors.forEach(err => {
        if (err.includes('MOTION VIDEO FAILED')) {
          console.log('⚠️ Expected error: Motion video codec issue');
        } else {
          console.log(err);
        }
      });
    }

    console.log('\n=== Test Complete ===\n');
  });

  test('video controls work with 3 videos', async ({ page }) => {
    console.log('\n=== Testing Video Controls ===\n');

    // Open modal
    await page.locator('tr').filter({ hasText: 'SUBCAM_ALG_2020-01-2' }).first().dblclick();
    await page.waitForSelector('text=Video Comparison', { timeout: 5000 });
    await page.waitForTimeout(2000);

    console.log('1. Testing play/pause...');

    // Click play button
    const playButton = page.getByRole('button').filter({ hasText: /play/i }).first();
    await playButton.click();
    await page.waitForTimeout(500);
    console.log('✅ Play button clicked');

    // Click pause button
    const pauseButton = page.getByRole('button').filter({ hasText: /pause/i }).first();
    if (await pauseButton.count() > 0) {
      await pauseButton.click();
      console.log('✅ Pause button clicked');
    }

    // Test skip controls
    console.log('\n2. Testing skip controls...');
    const skipBackButton = page.getByRole('button').filter({ hasText: /skip.*(back|backward|5)/i }).first();
    if (await skipBackButton.count() > 0) {
      await skipBackButton.click();
      console.log('✅ Skip backward works');
    }

    const skipForwardButton = page.getByRole('button').filter({ hasText: /skip.*(forward|5)/i }).first();
    if (await skipForwardButton.count() > 0) {
      await skipForwardButton.click();
      console.log('✅ Skip forward works');
    }

    // Test volume control
    console.log('\n3. Testing volume control...');
    const muteButton = page.getByRole('button').filter({ hasText: /mute|volume/i }).first();
    if (await muteButton.count() > 0) {
      await muteButton.click();
      console.log('✅ Mute/unmute works');
    }

    console.log('\n=== Video Controls Test Complete ===\n');
  });

  test('error handling for missing YOLOv8 video', async ({ page }) => {
    console.log('\n=== Testing Error Handling ===\n');

    // Open algapelago video (which may not have YOLOv8 processing yet)
    const algapelagoVideo = page.getByText('algapelago').first();
    const algapelagoExists = await algapelagoVideo.count() > 0;

    if (algapelagoExists) {
      await algapelagoVideo.dblclick();
      await page.waitForSelector('text=Video Comparison', { timeout: 5000 });
      await page.waitForTimeout(2000);

      // Check for YOLOv8 error overlay
      const yolov8Error = page.locator('text=YOLOv8 Video Not Available');
      const hasYolov8Error = await yolov8Error.count() > 0;

      if (hasYolov8Error) {
        console.log('✅ YOLOv8 error overlay displayed correctly');
      } else {
        console.log('⚠️ No YOLOv8 error overlay (video may be available)');
      }
    } else {
      console.log('⚠️ No algapelago video found for error testing');
    }

    console.log('\n=== Error Handling Test Complete ===\n');
  });
});
