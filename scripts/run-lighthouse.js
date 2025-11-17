const lighthouse = require('lighthouse').default;
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

async function runLighthouse(url = 'http://localhost:9002') {
  console.log(`\n🔍 Running Lighthouse audit on ${url}...\n`);

  // Launch Chrome
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu'],
  });

  const options = {
    logLevel: 'info',
    output: ['html', 'json'],
    port: chrome.port,
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  };

  try {
    // Run Lighthouse
    const runnerResult = await lighthouse(url, options);

    // Save HTML report
    const reportHtml = runnerResult.report[0];
    const htmlPath = path.join(__dirname, '..', 'test-reports', 'lighthouse-report.html');
    fs.writeFileSync(htmlPath, reportHtml);
    console.log(`✅ HTML report saved to: ${htmlPath}`);

    // Save JSON report
    const reportJson = runnerResult.report[1];
    const jsonPath = path.join(__dirname, '..', 'test-reports', 'lighthouse-report.json');
    fs.writeFileSync(jsonPath, reportJson);
    console.log(`✅ JSON report saved to: ${jsonPath}`);

    // Extract scores
    const lhr = runnerResult.lhr;
    const scores = {
      performance: Math.round(lhr.categories.performance.score * 100),
      accessibility: Math.round(lhr.categories.accessibility.score * 100),
      bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
      seo: Math.round(lhr.categories.seo.score * 100),
    };

    // Log scores
    console.log('\n📊 Lighthouse Scores:\n');
    console.log(`Performance:     ${scores.performance}/100`);
    console.log(`Accessibility:   ${scores.accessibility}/100`);
    console.log(`Best Practices:  ${scores.bestPractices}/100`);
    console.log(`SEO:             ${scores.seo}/100`);

    // Log key metrics
    const metrics = lhr.audits.metrics.details.items[0];
    console.log('\n⚡ Performance Metrics:\n');
    console.log(`First Contentful Paint:    ${Math.round(metrics.firstContentfulPaint)}ms`);
    console.log(`Largest Contentful Paint:  ${Math.round(metrics.largestContentfulPaint)}ms`);
    console.log(`Time to Interactive:       ${Math.round(metrics.interactive)}ms`);
    console.log(`Speed Index:               ${Math.round(metrics.speedIndex)}ms`);
    console.log(`Total Blocking Time:       ${Math.round(metrics.totalBlockingTime)}ms`);
    console.log(`Cumulative Layout Shift:   ${metrics.cumulativeLayoutShift.toFixed(3)}\n`);

    // Save summary
    const summary = {
      url,
      timestamp: new Date().toISOString(),
      scores,
      metrics: {
        firstContentfulPaint: Math.round(metrics.firstContentfulPaint),
        largestContentfulPaint: Math.round(metrics.largestContentfulPaint),
        timeToInteractive: Math.round(metrics.interactive),
        speedIndex: Math.round(metrics.speedIndex),
        totalBlockingTime: Math.round(metrics.totalBlockingTime),
        cumulativeLayoutShift: metrics.cumulativeLayoutShift,
      },
    };

    const summaryPath = path.join(__dirname, '..', 'test-reports', 'lighthouse-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`✅ Summary saved to: ${summaryPath}\n`);

    return summary;
  } catch (error) {
    console.error('❌ Lighthouse audit failed:', error.message);
    throw error;
  } finally {
    await chrome.kill();
  }
}

// Run if called directly
if (require.main === module) {
  const url = process.argv[2] || 'http://localhost:9002';
  runLighthouse(url)
    .then(() => {
      console.log('✅ Lighthouse audit complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Lighthouse audit failed:', error);
      process.exit(1);
    });
}

module.exports = { runLighthouse };
