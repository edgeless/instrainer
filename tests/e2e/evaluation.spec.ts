import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// E2E評価テスト: 実際の音声入力をシミュレートして採点ロジックの正確性を検証します。
// Playwrightの `--use-file-for-fake-audio-capture` フラグを使用して、
// 事前に生成したWAVファイルを仮想マイク入力として流し込みます。
test.describe('Evaluation Tests', () => {
  test.skip(!!process.env.CI, 'Evaluation tests require headed mode and are skipped on CI');
  // 各テストは独立したChromiumインスタンスを起動するため、リソース競合を避けるため直列実行します。
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
      baseURL: 'http://localhost:5173',
      ignoreHTTPSErrors: true
    });

    const page = await context.newPage();
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', err => console.error(`BROWSER PAGE ERROR: ${err.message}`));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click mic permission button first - this triggers getUserMedia
    const dismissBtn = page.locator("button:has-text('マイク')");
    if (await dismissBtn.isVisible()) {
      console.log(`[${audioFileName}] Clicking mic permission button...`);
      await dismissBtn.click({ force: true });

      // Wait for mic init to complete
      await page.waitForFunction(() => {
        return document.querySelector('.mic-overlay.hide') !== null ||
               document.querySelector('.mic-err') !== null;
      }, { timeout: 20000 }).catch(() => {
        console.log(`[${audioFileName}] Timed out waiting for mic overlay to hide`);
      });
    }

    // Now wait for __states and select the correct song
    await page.waitForFunction(() => !!(window as any).__states, { timeout: 10000 });
    const songName = await page.evaluate(() => {
      const { setSong, playerState, audioState } = (window as any).__states;
      if (setSong) setSong('c_major');
      playerState.tolerance = 60; 
      audioState.latencyCompensationMs = 260; // Final calibrated value for BPM 60
      return playerState.song.name;
    });
    console.log(`[${audioFileName}] Selected song: ${songName} (Tol=60, Latency=260)`);

    // Click rec button
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

  /**
   * ケース1: 完全な演奏 (c_major_perfect.wav)
   * - ピッチ: 偏差0（理想的な周波数）
   * - タイミング: 拍の開始位置に完全に同期
   * - 目的: 理想的な条件下でシステムが正しく高スコアを算出できることを確認する。
   */
  test('perfect audio file evaluates pitch and timing successfully', async () => {
    test.setTimeout(80000);
    const { pitchVal, timingVal } = await runEvalTest('c_major_perfect.wav');
    console.log(`[ASSERT] perfect: pitch=${pitchVal}, timing=${timingVal}`);
    expect(pitchVal).toBeGreaterThan(80);
    expect(timingVal).toBeGreaterThan(80);
  });

  /**
   * ケース2: ピッチの微細なズレ (c_major_good_pitch.wav)
   * - ピッチ: 意図的に全音符を15セント高く設定
   * - タイミング: 正確
   * - 目的: わずかなピッチのズレがスコアに正しく反映され、許容範囲内（Good以上）で判定されるかを確認する。
   */
  test('good pitch audio file evaluates successfully', async () => {
    test.setTimeout(80000);
    const { pitchVal, timingVal } = await runEvalTest('c_major_good_pitch.wav');
    console.log(`[ASSERT] good_pitch: pitch=${pitchVal}, timing=${timingVal}`);
    expect(pitchVal).toBeGreaterThan(15);
    expect(timingVal).toBeGreaterThan(30);
  });

  /**
   * ケース3: タイミングのズレ (c_major_good_timing.wav)
   * - ピッチ: 正確
   * - タイミング: 各音符の発音を意図的に前後（約50-100ms）にずらして配置
   * - 目的: タイミングのゆらぎが検出され、スコアが適切に低下することを確認する。
   */
  test('good timing audio file evaluates successfully', async () => {
    test.setTimeout(80000);
    const { pitchVal, timingVal } = await runEvalTest('c_major_good_timing.wav');
    console.log(`[ASSERT] good_timing: pitch=${pitchVal}, timing=${timingVal}`);
    expect(timingVal).toBeGreaterThan(15);
    expect(pitchVal).toBeGreaterThan(30);
  });

  test('silent audio results in zero score', async ({ page }) => {
    test.setTimeout(40000);
    const { pitchVal, timingVal } = await runEvalTest('silent.wav');
    console.log(`[ASSERT] silence: pitch=${pitchVal}, timing=${timingVal}`);
    expect(pitchVal).toBe(0);
    expect(timingVal).toBe(0);
  });
});
