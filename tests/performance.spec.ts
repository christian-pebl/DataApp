import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('measure homepage load performance', async ({ page }) => {
    const startTime = Date.now();

    // Track performance metrics
    const metrics: any = {};

    // Listen to console logs for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console error: ${msg.text()}`);
      }
    });

    // Navigate to the page
    await page.goto('http://localhost:9002/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    // Collect Web Vitals and other performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      return {
        // Page load timings
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,

        // Network timings
        dns: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcp: navigation.connectEnd - navigation.connectStart,
        request: navigation.responseStart - navigation.requestStart,
        response: navigation.responseEnd - navigation.responseStart,

        // Paint timings
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,

        // Resource counts
        resourceCount: performance.getEntriesByType('resource').length,

        // Total transfer size (approximate)
        totalTransferSize: performance.getEntriesByType('resource').reduce((acc: number, r: any) => acc + (r.transferSize || 0), 0),
      };
    });

    // Get resource breakdown
    const resourceBreakdown = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const breakdown = {
        scripts: { count: 0, size: 0 },
        stylesheets: { count: 0, size: 0 },
        images: { count: 0, size: 0 },
        fonts: { count: 0, size: 0 },
        other: { count: 0, size: 0 },
      };

      resources.forEach(r => {
        const name = r.name.toLowerCase();
        const size = r.transferSize || 0;

        if (name.includes('.js')) {
          breakdown.scripts.count++;
          breakdown.scripts.size += size;
        } else if (name.includes('.css')) {
          breakdown.stylesheets.count++;
          breakdown.stylesheets.size += size;
        } else if (name.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)/)) {
          breakdown.images.count++;
          breakdown.images.size += size;
        } else if (name.match(/\.(woff|woff2|ttf|eot)/)) {
          breakdown.fonts.count++;
          breakdown.fonts.size += size;
        } else {
          breakdown.other.count++;
          breakdown.other.size += size;
        }
      });

      return breakdown;
    });

    // Print results
    console.log('\n📊 PERFORMANCE METRICS - Homepage');
    console.log('=====================================');
    console.log(`Total Load Time: ${loadTime}ms`);
    console.log(`DOM Interactive: ${performanceMetrics.domInteractive.toFixed(0)}ms`);
    console.log(`DOM Content Loaded: ${performanceMetrics.domContentLoaded.toFixed(0)}ms`);
    console.log(`Load Complete: ${performanceMetrics.loadComplete.toFixed(0)}ms`);
    console.log(`First Paint: ${performanceMetrics.firstPaint.toFixed(0)}ms`);
    console.log(`First Contentful Paint: ${performanceMetrics.firstContentfulPaint.toFixed(0)}ms`);
    console.log(`\n📦 RESOURCE BREAKDOWN`);
    console.log(`Total Resources: ${performanceMetrics.resourceCount}`);
    console.log(`Total Transfer Size: ${(performanceMetrics.totalTransferSize / 1024).toFixed(0)} KB`);
    console.log(`\nScripts: ${resourceBreakdown.scripts.count} files, ${(resourceBreakdown.scripts.size / 1024).toFixed(0)} KB`);
    console.log(`Stylesheets: ${resourceBreakdown.stylesheets.count} files, ${(resourceBreakdown.stylesheets.size / 1024).toFixed(0)} KB`);
    console.log(`Images: ${resourceBreakdown.images.count} files, ${(resourceBreakdown.images.size / 1024).toFixed(0)} KB`);
    console.log(`Fonts: ${resourceBreakdown.fonts.count} files, ${(resourceBreakdown.fonts.size / 1024).toFixed(0)} KB`);
    console.log(`Other: ${resourceBreakdown.other.count} files, ${(resourceBreakdown.other.size / 1024).toFixed(0)} KB`);

    // Basic assertion
    expect(loadTime).toBeLessThan(30000); // Should load within 30 seconds
  });

  test('measure map-drawing page load performance', async ({ page }) => {
    const startTime = Date.now();

    // Navigate to the map page
    // Changed from 'networkidle' to 'load' - networkidle waits for no network activity for 500ms
    // which may never happen if there are polling requests or continuous data loading
    await page.goto('http://localhost:9002/map-drawing', { waitUntil: 'load', timeout: 60000 });
    const loadTime = Date.now() - startTime;

    // Collect performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        resourceCount: performance.getEntriesByType('resource').length,
        totalTransferSize: performance.getEntriesByType('resource').reduce((acc: number, r: any) => acc + (r.transferSize || 0), 0),
      };
    });

    // Get resource breakdown
    const resourceBreakdown = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const breakdown = {
        scripts: { count: 0, size: 0 },
        stylesheets: { count: 0, size: 0 },
        images: { count: 0, size: 0 },
        other: { count: 0, size: 0 },
      };

      resources.forEach(r => {
        const name = r.name.toLowerCase();
        const size = r.transferSize || 0;

        if (name.includes('.js')) {
          breakdown.scripts.count++;
          breakdown.scripts.size += size;
        } else if (name.includes('.css')) {
          breakdown.stylesheets.count++;
          breakdown.stylesheets.size += size;
        } else if (name.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)/)) {
          breakdown.images.count++;
          breakdown.images.size += size;
        } else {
          breakdown.other.count++;
          breakdown.other.size += size;
        }
      });

      return breakdown;
    });

    // Print results
    console.log('\n📊 PERFORMANCE METRICS - Map Drawing Page');
    console.log('=========================================');
    console.log(`Total Load Time: ${loadTime}ms`);
    console.log(`DOM Interactive: ${performanceMetrics.domInteractive.toFixed(0)}ms`);
    console.log(`DOM Content Loaded: ${performanceMetrics.domContentLoaded.toFixed(0)}ms`);
    console.log(`Load Complete: ${performanceMetrics.loadComplete.toFixed(0)}ms`);
    console.log(`First Paint: ${performanceMetrics.firstPaint.toFixed(0)}ms`);
    console.log(`First Contentful Paint: ${performanceMetrics.firstContentfulPaint.toFixed(0)}ms`);
    console.log(`\n📦 RESOURCE BREAKDOWN`);
    console.log(`Total Resources: ${performanceMetrics.resourceCount}`);
    console.log(`Total Transfer Size: ${(performanceMetrics.totalTransferSize / 1024).toFixed(0)} KB`);
    console.log(`\nScripts: ${resourceBreakdown.scripts.count} files, ${(resourceBreakdown.scripts.size / 1024).toFixed(0)} KB`);
    console.log(`Stylesheets: ${resourceBreakdown.stylesheets.count} files, ${(resourceBreakdown.stylesheets.size / 1024).toFixed(0)} KB`);
    console.log(`Images: ${resourceBreakdown.images.count} files, ${(resourceBreakdown.images.size / 1024).toFixed(0)} KB`);
    console.log(`Other: ${resourceBreakdown.other.count} files, ${(resourceBreakdown.other.size / 1024).toFixed(0)} KB`);

    // Basic assertion
    expect(loadTime).toBeLessThan(60000); // Should load within 60 seconds
  });
});
