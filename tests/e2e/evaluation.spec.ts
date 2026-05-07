import { test, expect, type Browser, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Accuracy Evaluation Tests (Strict Negative Testing)
 * 
 * 1. Perfect audio must score > 80% (actually ~100%).
 * 2. Bad Pitch (+100c) must score < 60% (actually ~12.5% due to 1st note calibration).
 * 3. Bad Timing (+500ms) must score < 60% (actually ~12.5%).
 * 4. Silent must score 0%.
 * 
 * OK Threshold: 15 cents (Strict)
 */

test.describe('Evaluation Tests', () => {
  let browserInstance: Browser;

  test.beforeAll(async ({ browser }) => {
    browserInstance = browser;
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

    try {
      console.log(`[E2E] Re-generating test assets at ${detectedSampleRate}Hz...`);
      const scriptPath = path.resolve('tests/assets/generate_test_audio.py');
      const assetsDir = path.resolve('tests/assets');
      execSync(`python3 "${scriptPath}" ${detectedSampleRate}`, { stdio: 'inherit', cwd: assetsDir });
    } catch (e) {
      console.error('[E2E] Failed to generate assets:', e);
    }
  });

  async function runEvalTest(audioFileName: string) {
    const page = await browserInstance.newPage();
    page.on('console', msg => {
      if (msg.text().includes('[Timing]')) console.log(`BROWSER: ${msg.text()}`);
    });

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });

    let hydrated = false;
    for (let i = 0; i < 60; i++) {
      hydrated = await page.evaluate(() => (window as any).__states !== undefined);
      if (hydrated) break;
      await page.waitForTimeout(500);
    }

    await page.evaluate(() => {
      const { setSong, audioState, scoreState, playerState } = (window as any).__states;
      if (setSong) setSong('eval_song');
      playerState.tolerance = 500; // 初期キャッチ用に広げる
      audioState.latencyCompensationMs = 0;
      (scoreState as any).maxHistory = 5000;
    });

    const wavBase64 = fs.readFileSync(path.resolve(`tests/assets/${audioFileName}`)).toString('base64');

    await page.evaluate(async ({ wavBase64 }) => {
      const { audioState } = (window as any).__states;
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioState.audioCtx) audioState.audioCtx = new AC();
      if (audioState.audioCtx.state === 'suspended') await audioState.audioCtx.resume();
      
      const binaryString = atob(wavBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const audioBuffer = await audioState.audioCtx.decodeAudioData(bytes.buffer);
      
      audioState.analyserNode = audioState.audioCtx.createAnalyser();
      audioState.analyserNode.fftSize = 4096;
      audioState.pitchBuf = new Float32Array(4096);
      
      const source = audioState.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioState.analyserNode);
      (window as any).__E2E_SOURCE__ = source;
      audioState.micGranted = true;
    }, { wavBase64 });

    await page.evaluate(() => { (window as any).__E2E_SOURCE__.start(); });
    await page.locator('.tbtn.rec').click();

    if (audioFileName !== 'silent.wav') {
      await page.evaluate(async () => {
        const { scoreState, audioState, playerState } = (window as any).__states;
        const targetFreq = 65.4; // C2
        const start = performance.now();
        while (performance.now() - start < 8000) {
          const pbStart = playerState.playbackStartTimeMs;
          const f = scoreState.detectedFreq;
          if (pbStart && f > targetFreq * 0.9 && f < targetFreq * 1.1) {
            const match = scoreState.currentCentsHistory.find((h: any) => h.freq > targetFreq * 0.9 && h.freq < targetFreq * 1.1);
            if (match) {
              audioState.latencyCompensationMs = match.time - (pbStart + 4000);
              playerState.tolerance = 15; // ユーザー要望の厳格な基準（15セント）
              return;
            }
          }
          await new Promise(r => setTimeout(r, 16));
        }
      });
    }

    await expect(page.locator(".status-chip.sc-idle")).toBeVisible({ timeout: 45000 });
    const evaluationResult = await page.evaluate(() => {
      const { scoreState, playerState } = (window as any).__states;
      const results = scoreState.noteResults;
      const notesCount = playerState.song.notes.length;
      let pitchScored = 0, timingScored = 0;
      results.forEach((r: any) => {
        if (r) {
          if (r.pitchGrade && r.pitchGrade !== 'miss') pitchScored++;
          if (r.timingGrade && r.timingGrade !== 'miss') timingScored++;
        }
      });
      return { pitchAcc: (pitchScored / notesCount) * 100, timingAcc: (timingScored / notesCount) * 100 };
    });

    await page.close();
    return evaluationResult;
  }

  test('perfect audio file evaluates successfully (Pitch > 80, Timing > 80)', async () => {
    const res = await runEvalTest('c_major_perfect.wav');
    console.log(`[RESULT] perfect: Pitch=${res.pitchAcc}%, Timing=${res.timingAcc}%`);
    expect(res.pitchAcc).toBeGreaterThan(80);
    expect(res.timingAcc).toBeGreaterThan(80);
  });

  test('bad pitch audio file is correctly penalized (Pitch < 60)', async () => {
    const res = await runEvalTest('c_major_bad_pitch.wav');
    console.log(`[RESULT] bad_pitch: Pitch=${res.pitchAcc}%, Timing=${res.timingAcc}%`);
    expect(res.pitchAcc).toBeLessThan(60); 
  });

  test('bad timing audio file is correctly penalized (Timing < 60)', async () => {
    const res = await runEvalTest('c_major_bad_timing.wav');
    console.log(`[RESULT] bad_timing: Pitch=${res.pitchAcc}%, Timing=${res.timingAcc}%`);
    expect(res.timingAcc).toBeLessThan(60);
  });

  test('silent audio results in zero score', async () => {
    const res = await runEvalTest('silent.wav');
    console.log(`[RESULT] silence: Pitch=${res.pitchAcc}%, Timing=${res.timingAcc}%`);
    expect(res.pitchAcc).toBe(0);
    expect(res.timingAcc).toBe(0);
  });
});
