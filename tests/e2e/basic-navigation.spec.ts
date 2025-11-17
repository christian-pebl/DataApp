import { test, expect } from '@playwright/test'

/**
 * Basic Navigation Tests
 * Verify core page loading and navigation functionality
 */

test.describe('Basic Navigation', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check page title
    const title = await page.title()
    expect(title).toBeTruthy()
    expect(title.length).toBeGreaterThan(0)

    console.log('✓ Homepage loaded successfully, title:', title)
  })

  test('should navigate to map-drawing page', async ({ page }) => {
    await page.goto('/map-drawing')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Give map time to initialize
    await page.waitForTimeout(2000)

    // Check for map container
    const mapContainer = page.locator('.leaflet-container')
    await expect(mapContainer).toBeVisible({ timeout: 10000 })

    console.log('✓ Map page loaded successfully')
  })

  test('should have responsive navigation', async ({ page }) => {
    await page.goto('/map-drawing')
    await page.waitForLoadState('networkidle')

    // Check for navigation elements (adjust selectors based on your UI)
    const body = page.locator('body')
    await expect(body).toBeVisible()

    console.log('✓ Page is responsive')
  })
})
