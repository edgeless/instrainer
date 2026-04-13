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
