import { test, expect } from '@playwright/test';

test.describe('Tuner Only Screen', () => {
  test('has correct title', async ({ page }) => {
    await page.goto('/tuner');
    await expect(page).toHaveTitle(/Tuner - Fretless Bass Trainer/);
  });

  test('loads the app and shows tuner layout elements exclusively', async ({ page }) => {
    await page.goto('/tuner');

    // Check if the main tuner container exists
    await expect(page.locator('.tuner-container')).toBeVisible();

    // Check if PitchMonitor is rendered with the specific full-screen class
    await expect(page.locator('.pitch-panel.tuner-full')).toBeVisible();

    // Verify that the main app layout elements are NOT present
    await expect(page.locator('.app')).toHaveCount(0);
    await expect(page.locator('header.hdr')).toHaveCount(0);
    await expect(page.locator('div.transport')).toHaveCount(0);
    await expect(page.locator('div.score-wrap')).toHaveCount(0);
  });

  test('mic permission overlay is present and dismissible', async ({ page }) => {
    await page.goto('/tuner');

    const micOverlay = page.locator('.mic-overlay');
    await expect(micOverlay).toBeVisible();
    await expect(page.locator('.mic-title')).toHaveText('MICROPHONE ACCESS');

    // Dismiss overlay
    const dismissBtn = page.locator('.btn-mic');
    if (await dismissBtn.isVisible()) {
      // Note: we might need to handle browser dialogs if it actually asks for permission in tests,
      // but the `playwright.config.ts` likely grants mic permission automatically.
      await dismissBtn.click();
    }

    // After clicking, the overlay should be hidden (class 'hide' is added)
    await expect(micOverlay).toHaveClass(/hide/);
  });
});
