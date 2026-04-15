import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Check the actual title from app.html
  await expect(page).toHaveTitle(/FRETLESS — Bass Practice Studio/);
});

test('loads the app and shows main layout elements', async ({ page }) => {
  await page.goto('/');

  // Check if .app container exists
  await expect(page.locator('.app')).toBeVisible();

  // Check if the transport component is visible (it's a div, not a footer)
  await expect(page.locator('div.transport').first()).toBeVisible();
});


test('transport components are correctly rendered and accessible', async ({ page }) => {
  await page.goto('/');

  // dismiss overlay
  const dismissBtn = page.locator("button:has-text('マイク')");
  if (await dismissBtn.isVisible()) {
    await dismissBtn.click();
  }

  // Check the initial state of the progress bar track
  const progFill = page.locator('#progFill');
  await expect(progFill).toBeAttached();

  // ensure smooth cursor is rendered and initially hidden or present in DOM
  const cursor = page.locator('#score-cursor');
  await expect(cursor).toBeAttached();

  // ensure the transport buttons are present
  await expect(page.locator(".tbtn:has-text('再生')")).toBeVisible();
  await expect(page.locator(".tbtn:has-text('録音')")).toBeVisible();
  await expect(page.locator(".tbtn[title='停止']")).toBeVisible();

  // ensure the volume control is present
  await expect(page.locator(".vol-ctrl[title='音量']")).toBeVisible();
});
