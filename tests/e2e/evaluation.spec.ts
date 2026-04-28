import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// End-to-End tests simulating actual audio recording.
test.describe('Evaluation Tests', () => {

  const runEvalTest = async (page: any, audioFileName: string) => {
    // Note: We cannot change launchOptions per test easily with test.use if we want different files.
    // However, we can try to use a single "perfect" file for a generic test, 
    // or we can stick to manual launch but fix why it's failing.
    
    // Let's try to fix the manual launch by ensuring we wait for the page to be fully ready 
    // and checking for any errors.
    
    const audioFile = path.resolve(__dirname, `../assets/${audioFileName}`).replace(/\\/g, '/');
    const browserInstance = await chromium.launch({
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${audioFile}`,
        '--autoplay-policy=no-user-gesture-required'
      ]
    });

    const context = await browserInstance.newContext({
      permissions: ['microphone'],
      baseURL: 'http://localhost:5173'
    });

    const testPage = await context.newPage();
    testPage.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    testPage.on('pageerror', err => console.error(`BROWSER ERROR: ${err.message}`));

    await testPage.goto('/');
    await testPage.waitForLoadState('networkidle');

    // Reset latency compensation for E2E tests as loopback has some latency (~100ms in headless)
    await testPage.evaluate(() => {
      if ((window as any).__states && (window as any).__states.audioState) {
        (window as any).__states.audioState.latencyCompensationMs = 100;
      }
    });

    const dismissBtn = testPage.locator("button:has-text('マイク')");
    if (await dismissBtn.isVisible()) {
      console.log(`[${audioFileName}] Clicking mic permission button...`);
      await dismissBtn.click({ force: true });

      // Wait for state to update - increase timeout to 20s
      await testPage.waitForFunction(() => {
        return document.querySelector('.mic-overlay.hide') !== null || 
               document.querySelector('.mic-err') !== null;
      }, { timeout: 20000 }).catch(() => {
        console.log(`[${audioFileName}] Timed out waiting for mic overlay to hide`);
      });

      const micError = await testPage.evaluate(() => {
        const err = document.querySelector('.mic-err');
        return err ? err.textContent : null;
      });
      if (micError) {
        console.error(`[${audioFileName}] Mic Error from UI:`, micError);
      }
    }

    console.log(`[${audioFileName}] Triggering recording...`);
    await testPage.evaluate(() => {
       const rec = document.querySelector('.tbtn.rec') as HTMLElement;
       if (rec) rec.click();
       else console.error("Rec button not found!");
    });

    try {
        await expect(testPage.locator(".status-chip.sc-rec")).toBeVisible({ timeout: 15000 });
        console.log(`[${audioFileName}] Recording started...`);

        // C_major scale takes roughly 15 seconds to complete. Waiting up to 30s for completion.
        await expect(testPage.locator(".status-chip.sc-idle")).toBeVisible({ timeout: 40000 });
        console.log(`[${audioFileName}] Recording finished, awaiting results...`);

        // Give it a moment to process runPostAnalysis
        await testPage.waitForTimeout(2000);

        const isOverlayOpen = await testPage.evaluate(() => {
            const overlay = document.querySelector('.overlay');
            return overlay && overlay.classList.contains('show');
        });

        if (!isOverlayOpen) {
           await testPage.evaluate(() => {
              const res = document.querySelector(".btn-result") as HTMLElement;
              if (res) res.click();
           });
        }

        const resultOverlay = testPage.locator('.overlay.show');
        await expect(resultOverlay).toBeVisible({ timeout: 15000 });

        const pitchTextRaw = await resultOverlay.locator('.rc-stat').filter({ hasText: 'PITCH ACCURACY' }).locator('.rc-sv').innerText();
        const timingTextRaw = await resultOverlay.locator('.rc-stat').filter({ hasText: 'TIMING ACCURACY' }).locator('.rc-sv').innerText();

        const pitchVal = parseFloat(pitchTextRaw);
        const timingVal = parseFloat(timingTextRaw);

        console.log(`[${audioFileName}] Results: Pitch=${pitchVal}, Timing=${timingVal}`);

        await browserInstance.close();
        return { pitchVal, timingVal };
    } catch(e) {
        console.error(`[${audioFileName}] Evaluation error details:`, e);
        await testPage.screenshot({ path: `failure-${audioFileName}.png` });
        await browserInstance.close();
        return { pitchVal: 0, timingVal: 0 };
    }
  };

  test('perfect audio file evaluates pitch and timing successfully', async ({ page }) => {
    test.setTimeout(80000);
    const { pitchVal, timingVal } = await runEvalTest(page, 'c_major_perfect.wav');
    expect(pitchVal).toBeGreaterThan(60);
    expect(timingVal).toBeGreaterThan(60);
  });

  test('good pitch audio file evaluates successfully', async ({ page }) => {
    test.setTimeout(80000);
    const { pitchVal, timingVal } = await runEvalTest(page, 'c_major_good_pitch.wav');
    expect(pitchVal).toBeGreaterThan(30);
    expect(pitchVal).toBeLessThan(100);
    expect(timingVal).toBeGreaterThan(60);
  });

  test('good timing audio file evaluates successfully', async ({ page }) => {
    test.setTimeout(80000);
    const { pitchVal, timingVal } = await runEvalTest(page, 'c_major_good_timing.wav');
    expect(timingVal).toBeGreaterThan(30);
    expect(timingVal).toBeLessThan(100);
    expect(pitchVal).toBeGreaterThan(60);
  });

});
