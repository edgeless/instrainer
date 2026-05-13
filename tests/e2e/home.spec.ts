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

test('auto-scrolls the score section during playback of long songs', async ({ page }) => {
  // Use fake UI for media stream to automatically bypass mic permission prompts at the browser level
  await page.goto('/');

  // Dismiss overlay if present
  const dismissBtn = page.locator("button:has-text('マイク')");
  if (await dismissBtn.isVisible()) {
    await dismissBtn.click({ force: true });
  }

  // Wait for React/Svelte hydration
  await page.waitForLoadState('networkidle');

  // Inject a mock song and directly fast-forward the player state to simulate playback crossing a row boundary.
  // This avoids flaky time-based audio playback in headless CI environments while still testing the auto-scroll Svelte effect logic.
  await page.evaluate(() => {
    // Inject a long song
    const song = {
        name: "Test Long Song",
        bpm: 120, 
        timeSignature: [4, 4],
        notes: [
            {"name":"C3", "midi":36, "string":"A", "fret":3, "beat":0, "dur":1},
            {"name":"C3", "midi":36, "string":"A", "fret":3, "beat":10, "dur":1},
            {"name":"C3", "midi":36, "string":"A", "fret":3, "beat":20, "dur":1},
            {"name":"C3", "midi":36, "string":"A", "fret":3, "beat":30, "dur":1},
        ]
    };
    const ps = (window as any).__states.playerState;
    ps.song = song;
    ps.currentSongKey = "test-long-song";
  });
  
  // Wait for score to render multiple rows
  await expect(page.locator('#score-row-0')).toBeVisible();
  await expect(page.locator('#score-row-1')).toBeVisible();

  const scoreArea = page.locator('.score-area').first();
  
  // Initial scroll top should be 0
  const initialScrollTop = await scoreArea.evaluate((el) => el.scrollTop);
  expect(initialScrollTop).toBe(0);

  // Directly mock the player state to think it's playing and it's at beat 18 (which is on row 1)
  await page.evaluate(() => {
    const ps = (window as any).__states.playerState;
    ps.status = 'playing';
    ps.isPlaying = true;
    
    // We mock the playback time directly
    // Since count-in is 4 beats (ps.song.timeSignature[0] = 4), beat 18 is 22 beats into playback
    // 22 beats at 120 bpm (2 beats per sec) = 11 seconds = 11000ms
    ps.playbackStartTimeMs = performance.now() - 11000;
  });

  // Because the updateCursor loop runs via requestAnimationFrame, it should pick up the new time,
  // calculate the new targetRowIdx (1), and trigger the Svelte effect to scroll.
  await expect(async () => {
    const scrollTop = await scoreArea.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  }).toPass({
    timeout: 5000, 
  });
});
