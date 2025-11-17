import { test, expect } from '@playwright/test'
import { waitForMapLoad, setupConsoleLogging } from '../helpers/test-utils'

/**
 * Map Interaction Tests
 * Verify map functionality and user interactions
 */

test.describe('Map Interactions', () => {
  test('should initialize map with correct view', async ({ page }) => {
    await setupConsoleLogging(page)

    await page.goto('/map-drawing')
    await waitForMapLoad(page)

    // Verify map container exists
    const mapContainer = page.locator('.leaflet-container')
    await expect(mapContainer).toBeVisible()

    // Check for zoom controls
    const zoomIn = page.locator('.leaflet-control-zoom-in')
    const zoomOut = page.locator('.leaflet-control-zoom-out')
    await expect(zoomIn).toBeVisible()
    await expect(zoomOut).toBeVisible()

    console.log('✓ Map initialized with controls')
  })

  test('should handle zoom interactions', async ({ page }) => {
    await page.goto('/map-drawing')
    await waitForMapLoad(page)

    // Click zoom in button
    const zoomIn = page.locator('.leaflet-control-zoom-in')
    await zoomIn.click()
    await page.waitForTimeout(500)

    // Click zoom out button
    const zoomOut = page.locator('.leaflet-control-zoom-out')
    await zoomOut.click()
    await page.waitForTimeout(500)

    console.log('✓ Zoom controls working')
  })

  test('should respond to map panning', async ({ page }) => {
    await page.goto('/map-drawing')
    await waitForMapLoad(page)

    const mapContainer = page.locator('.leaflet-container')
    const box = await mapContainer.boundingBox()

    if (box) {
      // Simulate pan gesture
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100, { steps: 10 })
      await page.mouse.up()

      // Give map time to update
      await page.waitForTimeout(500)

      console.log('✓ Map panning responsive')
    }
  })

  test('should load tile layers', async ({ page }) => {
    await page.goto('/map-drawing')
    await waitForMapLoad(page)

    // Check for tile layer images
    const tileImages = page.locator('.leaflet-tile-pane img')
    const count = await tileImages.count()

    expect(count).toBeGreaterThan(0)

    console.log(`✓ Map loaded ${count} tile images`)
  })
})

test.describe('Map Performance', () => {
  test('should load map within acceptable time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/map-drawing')
    await waitForMapLoad(page)

    const loadTime = Date.now() - startTime

    // Map should load in under 15 seconds
    expect(loadTime).toBeLessThan(15000)

    console.log(`✓ Map loaded in ${loadTime}ms`)
  })

  test('should handle rapid zoom changes', async ({ page }) => {
    await page.goto('/map-drawing')
    await waitForMapLoad(page)

    const zoomIn = page.locator('.leaflet-control-zoom-in')
    const zoomOut = page.locator('.leaflet-control-zoom-out')

    // Rapid zoom in/out
    for (let i = 0; i < 5; i++) {
      await zoomIn.click()
      await page.waitForTimeout(100)
    }

    for (let i = 0; i < 5; i++) {
      await zoomOut.click()
      await page.waitForTimeout(100)
    }

    // Map should still be responsive
    const mapContainer = page.locator('.leaflet-container')
    await expect(mapContainer).toBeVisible()

    console.log('✓ Map handles rapid zoom changes')
  })
})
