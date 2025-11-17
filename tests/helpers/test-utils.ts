import { Page } from '@playwright/test'

/**
 * Test Utility Functions
 * Reusable helpers for E2E tests
 */

/**
 * Wait for map to fully load and stabilize
 */
export async function waitForMapLoad(page: Page, timeout: number = 10000) {
  // Wait for Leaflet container
  await page.waitForSelector('.leaflet-container', { timeout })

  // Give map time to fully initialize
  await page.waitForTimeout(1000)

  console.log('✓ Map loaded and stabilized')
}

/**
 * Take a screenshot with timestamp
 */
export async function takeScreenshotWithTimestamp(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = `test-reports/screenshots/${name}-${timestamp}.png`

  await page.screenshot({
    path,
    fullPage: true,
  })

  console.log(`✓ Screenshot saved: ${path}`)
  return path
}

/**
 * Log console messages from the page
 */
export async function setupConsoleLogging(page: Page) {
  const messages: string[] = []

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`
    messages.push(text)

    // Log errors and warnings
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(text)
    }
  })

  return messages
}

/**
 * Wait for network idle (no requests for specified time)
 */
export async function waitForNetworkIdle(page: Page, timeout: number = 500) {
  await page.waitForLoadState('networkidle', { timeout: timeout * 2 })
  console.log('✓ Network idle')
}

/**
 * Check for JavaScript errors on page
 */
export async function checkForJSErrors(page: Page): Promise<string[]> {
  const errors: string[] = []

  page.on('pageerror', error => {
    errors.push(error.message)
    console.error('Page error:', error.message)
  })

  return errors
}

/**
 * Click element with retry logic
 */
export async function clickWithRetry(
  page: Page,
  selector: string,
  maxAttempts: number = 3
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await page.click(selector, { timeout: 5000 })
      console.log(`✓ Clicked ${selector}`)
      return
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error
      }
      console.log(`Retry ${attempt}/${maxAttempts} for ${selector}`)
      await page.waitForTimeout(1000)
    }
  }
}

/**
 * Fill form field with validation
 */
export async function fillFormField(
  page: Page,
  selector: string,
  value: string
) {
  await page.fill(selector, value)
  const actualValue = await page.inputValue(selector)

  if (actualValue !== value) {
    throw new Error(`Form field ${selector} has value "${actualValue}", expected "${value}"`)
  }

  console.log(`✓ Filled ${selector} with "${value}"`)
}

/**
 * Wait for element and verify visibility
 */
export async function waitAndVerifyVisible(
  page: Page,
  selector: string,
  timeout: number = 5000
) {
  const element = page.locator(selector)
  await element.waitFor({ state: 'visible', timeout })
  await expect(element).toBeVisible()

  console.log(`✓ Element ${selector} is visible`)
  return element
}
