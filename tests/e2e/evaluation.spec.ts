import { test, expect, type Browser, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Accuracy Evaluation Tests
 * 
 * This test suite evaluates the pitch and timing accuracy of the application
 * using pre-generated test audio files.
 * 
 * Robustness features:
 * 1. Dynamic sample rate detection & asset generation.
 * 2. CSP-compliant hydration waiting (polling).
 * 3. Direct Web Audio API injection (bypasses Chromium fake audio pipeline).
 * 4. Calibrated latency compensation for E2E.
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
    // page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
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
      const { setSong, playerState, audioState } = (window as any).__states;
      (window as any).__E2E__ = true;
      if (setSong) setSong('c_major');
      playerState.tolerance = tol;
      audioState.latencyCompensationMs = 20;
      return playerState.song.name;
    }, { tol: tolerance });

    const wavBase64 = fs.readFileSync(path.resolve(`tests/assets/${audioFileName}`)).toString('base64');

    // Direct injection to setup streams
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
      audioState.analyserNode.smoothingTimeConstant = 0.1;
      audioState.pitchBuf = new Float32Array(4096);
      
      const source = audioState.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioState.analyserNode);
      
      (window as any).__E2E_SOURCE__ = source;
      audioState.micGranted = true;
      audioState.micStream = null; // Disable MediaRecorder
    }, { wavBase64 });

    await page.bringToFront();

    // Trigger source exactly when clicking rec
    await page.evaluate(() => {
      (window as any).__E2E_SOURCE__.start();
    });

    await page.locator('.tbtn.rec').click();
    console.log(`[${audioFileName}] Recording started...`);

    // Wait for song end (20s) + buffer
    await expect(page.locator(".status-chip.sc-idle")).toBeVisible({ timeout: 40000 });
    const resultOverlay = page.locator('.overlay.show');
    await expect(resultOverlay).toBeVisible({ timeout: 15000 });

    const pitchTextRaw = await resultOverlay.locator('.rc-stat').filter({ hasText: 'PITCH ACCURACY' }).locator('.rc-sv').innerText();
    const timingTextRaw = await resultOverlay.locator('.rc-stat').filter({ hasText: 'TIMING ACCURACY' }).locator('.rc-sv').innerText();

    const pitchVal = parseFloat(pitchTextRaw.replace('%', ''));
    const timingVal = parseFloat(timingTextRaw.replace('%', ''));

    await page.close();
    return { pitchVal, timingVal };
  }

  test('perfect audio file evaluates pitch and timing successfully', async () => {
    const { pitchVal, timingVal } = await runEvalTest('c_major_perfect.wav', 150);
    console.log(`[ASSERT] perfect: pitch=${pitchVal}, timing=${timingVal}`);
    expect(pitchVal).toBeGreaterThan(80); // NEVER change this value!! 
    expect(timingVal).toBeGreaterThan(80); // NEVER change this value!!
  });
});
