import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Evaluation Tests', () => {
  test.skip(!!process.env.CI, 'Evaluation tests require headed mode and are skipped on CI');
  test.describe.configure({ mode: 'serial' });

  const runEvalTest = async (audioFileName: string) => {
    const audioFile = path.resolve(__dirname, `../assets/${audioFileName}`).replace(/\\/g, '/');

    const browserInstance = await chromium.launch({
      headless: false,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${audioFile}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    const context = await browserInstance.newContext({
      permissions: ['microphone'],
      baseURL: 'http://localhost:5173'
    });

    const page = await context.newPage();
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', err => console.error(`BROWSER PAGE ERROR: ${err.message}`));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Reset latency compensation for E2E tests as loopback has some latency (~100ms in headless)
    await page.evaluate(() => {
      if ((window as any).__states && (window as any).__states.audioState) {
        (window as any).__states.audioState.latencyCompensationMs = 100;
      }
    });

    const dismissBtn = page.locator("button:has-text('マイク')");
    if (await dismissBtn.isVisible()) {
      console.log(`[${audioFileName}] Clicking mic permission button...`);
      await dismissBtn.click({ force: true });

      await page.waitForFunction(() => {
        return document.querySelector('.mic-overlay.hide') !== null ||
               document.querySelector('.mic-err') !== null;
      }, { timeout: 20000 }).catch(() => {
        console.log(`[${audioFileName}] Timed out waiting for mic overlay to hide`);
      });

      const micError = await page.evaluate(() => {
        const err = document.querySelector('.mic-err');
        return err ? err.textContent : null;
      });
      if (micError) {
        console.error(`[${audioFileName}] Mic Error from UI:`, micError);
      }
    }

    await page.waitForFunction(() => !!(window as any).__states, { timeout: 10000 });
    const songName = await page.evaluate(() => {
      const { setSong, playerState, audioState } = (window as any).__states;
      if (setSong) setSong('c_major');
      playerState.tolerance = 60;
      audioState.latencyCompensationMs = 260; // Final calibrated value for BPM 60
      return playerState.song.name;
    });
    console.log(`[${audioFileName}] Selected song: ${songName} (Tol=60, Latency=260)`);

    console.log(`[${audioFileName}] Triggering recording...`);
    await page.evaluate(() => {
      const rec = document.querySelector('.tbtn.rec') as HTMLElement;
      if (rec) rec.click();
      else console.error('[Eval] REC BUTTON NOT FOUND');
    });

    try {
      await expect(page.locator(".status-chip.sc-rec")).toBeVisible({ timeout: 15000 });
      console.log(`[${audioFileName}] Recording started...`);

      // Wait for recording to finish
      await expect(page.locator(".status-chip.sc-idle")).toBeVisible({ timeout: 40000 });
      console.log(`[${audioFileName}] Recording finished`);

      await page.waitForTimeout(2000);

      // Open result overlay if not already open
      const isOverlayOpen = await page.evaluate(() => {
        const overlay = document.querySelector('.overlay');
        return overlay && overlay.classList.contains('show');
      });

      if (!isOverlayOpen) {
        await page.evaluate(() => {
          const res = document.querySelector(".btn-result") as HTMLElement;
          if (res) res.click();
        });
      }

      const resultOverlay = page.locator('.overlay.show');
      await expect(resultOverlay).toBeVisible({ timeout: 15000 });

      const pitchTextRaw = await resultOverlay.locator('.rc-stat').filter({ hasText: 'PITCH ACCURACY' }).locator('.rc-sv').innerText();
      const timingTextRaw = await resultOverlay.locator('.rc-stat').filter({ hasText: 'TIMING ACCURACY' }).locator('.rc-sv').innerText();

      const pitchVal = parseFloat(pitchTextRaw);
      const timingVal = parseFloat(timingTextRaw);

      console.log(`[${audioFileName}] Final: Pitch=${pitchVal}%, Timing=${timingVal}%`);

      await browserInstance.close();
      return { pitchVal, timingVal };
    } catch (e) {
      console.error(`[${audioFileName}] Test error:`, e);
      await browserInstance.close();
      throw e;
    }
  };

  test('perfect audio file evaluates pitch and timing successfully', async () => {
    test.setTimeout(80000);
    const { pitchVal, timingVal } = await runEvalTest('c_major_perfect.wav');
    console.log(`[ASSERT] perfect: pitch=${pitchVal}, timing=${timingVal}`);
    expect(pitchVal).toBeGreaterThan(80);
    expect(timingVal).toBeGreaterThan(80);
  });

  test('good pitch audio file evaluates successfully', async () => {
    test.setTimeout(80000);
    const { pitchVal, timingVal } = await runEvalTest('c_major_good_pitch.wav');
    console.log(`[ASSERT] good_pitch: pitch=${pitchVal}, timing=${timingVal}`);
    expect(pitchVal).toBeGreaterThan(15);
    expect(timingVal).toBeGreaterThan(30);
  });

  test('good timing audio file evaluates successfully', async () => {
    test.setTimeout(80000);
    const { pitchVal, timingVal } = await runEvalTest('c_major_good_timing.wav');
    console.log(`[ASSERT] good_timing: pitch=${pitchVal}, timing=${timingVal}`);
    expect(timingVal).toBeGreaterThan(15);
    expect(pitchVal).toBeGreaterThan(30);
  });

  test('silent audio results in zero score', async () => {
    test.setTimeout(80000);
    const { pitchVal, timingVal } = await runEvalTest('silent.wav');
    console.log(`[ASSERT] silence: pitch=${pitchVal}, timing=${timingVal}`);
    expect(pitchVal).toBe(0);
    expect(timingVal).toBe(0);
  });
});
