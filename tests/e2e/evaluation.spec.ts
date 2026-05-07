import { test, expect, type Browser, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Accuracy Evaluation Tests (Integrated Version)
 * 
 * 1. Direct Web Audio API injection for high-fidelity pitch.
 * 2. Dynamic calibration on Note 0 to eliminate procedural (Playwright click) lag.
 * 3. No __E2E__ flag usage (clean application code).
 */

test.describe('Evaluation Tests', () => {
  let browserInstance: Browser;

  test.beforeAll(async ({ browser }) => {
    browserInstance = browser;
    // Detect sample rate
    const tempPage = await browserInstance.newPage();
    await tempPage.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });
    const detectedSampleRate = await tempPage.evaluate(async () => {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      const rate = ctx.sampleRate;
      await ctx.close();
      return rate;
    });
    await tempPage.close();
    console.log(`[E2E] Detected Browser Sample Rate: ${detectedSampleRate}`);

    // Generate assets
    try {
      console.log(`[E2E] Re-generating test assets at ${detectedSampleRate}Hz...`);
      const scriptPath = path.resolve('tests/assets/generate_test_audio.py');
      const assetsDir = path.resolve('tests/assets');
      execSync(`python3 "${scriptPath}" ${detectedSampleRate}`, { stdio: 'inherit', cwd: assetsDir });
    } catch (e) {
      console.error('[E2E] Failed to generate assets:', e);
    }
  });

  async function runEvalTest(audioFileName: string, tolerance = 60) {
    const page = await browserInstance.newPage();
    page.on('console', msg => {
      if (msg.text().includes('[Timing]')) console.log(`BROWSER: ${msg.text()}`);
    });
    page.on('pageerror', err => console.log(`BROWSER [error]: ${err.message}`));

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });

    // Polling for hydration
    let hydrated = false;
    for (let i = 0; i < 60; i++) {
      hydrated = await page.evaluate(() => (window as any).__states !== undefined);
      if (hydrated) break;
      await page.waitForTimeout(500);
    }
    if (!hydrated) throw new Error("App hydration timed out");

    const songName = await page.evaluate(({ tol }) => {
      const { setSong, playerState, audioState, scoreState } = (window as any).__states;
      if (setSong) setSong('eval_song');
      playerState.tolerance = 500; // 初期キャッチ用に広げる
      audioState.latencyCompensationMs = 20;
      (scoreState as any).maxHistory = 5000;
      return playerState.song.name;
    }, { tol: tolerance });

    const wavBase64 = fs.readFileSync(path.resolve(`tests/assets/${audioFileName}`)).toString('base64');

    // Direct injection setup
    await page.evaluate(async ({ wavBase64 }) => {
      const { audioState } = (window as any).__states;
      if (!audioState.audioCtx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        audioState.audioCtx = new AC();
      }
      if (audioState.audioCtx.state === 'suspended') {
        await audioState.audioCtx.resume();
      }
      
      const binaryString = atob(wavBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBuffer = await audioState.audioCtx.decodeAudioData(bytes.buffer);
      
      audioState.analyserNode = audioState.audioCtx.createAnalyser();
      audioState.analyserNode.fftSize = 4096;
      audioState.analyserNode.smoothingTimeConstant = 0; // Disable smoothing for precision
      audioState.pitchBuf = new Float32Array(4096);
      
      const source = audioState.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioState.analyserNode);
      
      (window as any).__E2E_SOURCE__ = source;
      audioState.micGranted = true;
    }, { wavBase64 });

    await page.bringToFront();

    // Trigger source
    await page.evaluate(() => {
      (window as any).__E2E_SOURCE__.start();
    });

    // Record click
    await page.locator('.tbtn.rec').click();
    console.log(`[${audioFileName}] Recording started & Calibration initiated...`);

    // Dynamic Calibration Loop
    const calibrationResult = await page.evaluate(async () => {
      const { scoreState, audioState, playerState } = (window as any).__states;
      const targetFreq = 65.4; // MIDI 36 (C2)
      const start = performance.now();
      
      while (performance.now() - start < 10000) {
        const pbStart = playerState.playbackStartTimeMs;
        const f = scoreState.detectedFreq;

        if (pbStart && f > targetFreq * 0.9 && f < targetFreq * 1.1) {
          // Note 0 detection!
          // Note 0 expected at pbStart + 4s (count-in)
          const expectedStartTime = pbStart + 4000;
          
          // Find the exact history record for more precision
          const history = scoreState.currentCentsHistory;
          const match = history.find((h: any) => h.freq > targetFreq * 0.9 && h.freq < targetFreq * 1.1);
          
          if (match) {
            const drift = match.time - expectedStartTime;
            audioState.latencyCompensationMs = drift;
            playerState.tolerance = 60; // 判定を厳しく戻す
            return { drift, freq: f, time: match.time };
          }
        }
        await new Promise(r => setTimeout(r, 16));
      }
      return null;
    });

    if (calibrationResult) {
      console.log(`[${audioFileName}] Calibration done: Drift=${calibrationResult.drift.toFixed(1)}ms, Freq=${calibrationResult.freq.toFixed(1)}Hz`);
    } else {
      console.warn(`[${audioFileName}] Calibration failed! Using default latency.`);
    }

    // Wait for song end
    await expect(page.locator(".status-chip.sc-idle")).toBeVisible({ timeout: 40000 });
    const resultOverlay = page.locator('.overlay.show');
    await expect(resultOverlay).toBeVisible({ timeout: 15000 });

    // Collect accuracy
    const evaluationResult = await page.evaluate(() => {
      const { scoreState, playerState } = (window as any).__states;
      const results = scoreState.noteResults;
      const notesCount = playerState.song.notes.length;

      let pitchScored = 0;
      let timingScored = 0;

      results.forEach((r: any) => {
        if (r) {
          if (r.pitchGrade && r.pitchGrade !== 'miss') pitchScored++;
          if (r.timingGrade && r.timingGrade !== 'miss') timingScored++;
        }
      });

      return {
        pitchAcc: (pitchScored / notesCount) * 100,
        timingAcc: (timingScored / notesCount) * 100,
        notes: notesCount
      };
    });

    console.log(`[${audioFileName}] Accuracy: Pitch=${evaluationResult.pitchAcc.toFixed(1)}%, Timing=${evaluationResult.timingAcc.toFixed(1)}%`);

    await page.close();
    return { pitchVal: evaluationResult.pitchAcc, timingVal: evaluationResult.timingAcc };
  }

  test('perfect audio file evaluates pitch and timing successfully', async () => {
    const { pitchVal, timingVal } = await runEvalTest('c_major_perfect.wav', 60);
    console.log(`[ASSERT] perfect: pitch=${pitchVal}, timing=${timingVal}`);
    expect(pitchVal).toBeGreaterThan(80);
    expect(timingVal).toBeGreaterThan(80);
  });
});
