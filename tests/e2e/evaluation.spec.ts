import { test, expect, type Browser } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * E2E Accuracy Evaluation Tests (Strict UI-Based Validation)
 * 
 * This suite validates the pitch and timing accuracy as presented in the final ResultOverlay.
 * Target Timing Accuracy is dynamically calculated: ((Notes - 1) * 80) / Notes
 * This assumes the first note is used for calibration (score 0) and others average 80%+.
 */

test.describe('E2E Evaluation Suite', () => {
  let browserInstance: Browser;

  test.beforeAll(async ({ browser }) => {
    browserInstance = browser;
    const tempPage = await browserInstance.newPage();
    await tempPage.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    
    const detectedSampleRate = await tempPage.evaluate(async () => {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      const rate = ctx.sampleRate;
      await ctx.close();
      return rate;
    });
    console.log(`[E2E] System Sample Rate: ${detectedSampleRate}Hz`);
    await tempPage.close();

    try {
      console.log(`[E2E] Re-generating test assets at ${detectedSampleRate}Hz...`);
      const scriptPath = path.resolve('tests/assets/generate_test_audio.py');
      const assetsDir = path.resolve('tests/assets');
      // Python3 を使用して資産を生成。Windows環境では 'python' の場合もあるため、
      // 一般的な 'python' または 'python3' を試行する。
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      execSync(`${pythonCmd} "${scriptPath}" ${detectedSampleRate}`, { stdio: 'inherit', cwd: assetsDir });
    } catch (e) {
      console.error('[E2E] Failed to generate assets:', e);
    }
  });

  async function runEvalTest(audioFileName: string) {
    const page = await browserInstance.newPage();
    
    page.on('console', msg => {
      if (msg.text().includes('[Timing]')) console.log(`BROWSER: ${msg.text()}`);
    });

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => (window as any).__states !== undefined);

    await page.evaluate(() => {
      const { setSong, audioState, scoreState, playerState } = (window as any).__states;
      if (setSong) setSong('eval_song');
      playerState.tolerance = 500; 
      audioState.latencyCompensationMs = 0;
      (scoreState as any).maxHistory = 5000;
    });

    const wavBase64 = fs.readFileSync(path.resolve(`tests/assets/${audioFileName}`)).toString('base64');
    await page.evaluate(async ({ wavBase64 }) => {
      const { audioState } = (window as any).__states;
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioState.audioCtx) audioState.audioCtx = new AC();
      if (audioState.audioCtx.state === 'suspended') await audioState.audioCtx.resume();
      
      const bytes = new Uint8Array(atob(wavBase64).split('').map(c => c.charCodeAt(0)));
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
        const targetFreq = 65.4; 
        const start = performance.now();
        while (performance.now() - start < 8000) {
          const pbStart = playerState.playbackStartTimeMs;
          const f = scoreState.detectedFreq;
          if (pbStart && f > targetFreq * 0.9 && f < targetFreq * 1.1) {
            const match = scoreState.currentCentsHistory.find((h: any) => h.freq > targetFreq * 0.9 && h.freq < targetFreq * 1.1);
            if (match) {
              // YINアルゴリズムの物理的遅延（C2/65.4Hzの場合、波形3周期分で約45.8ms）を考慮してキャリブレーション
              audioState.latencyCompensationMs = (match.time - 45.8) - (pbStart + 4000);
              playerState.tolerance = 15; 
              return;
            }
          }
          await new Promise(r => setTimeout(r, 16));
        }
      });
    }

    await expect(page.locator(".overlay.show")).toBeVisible({ timeout: 45000 });

    const getAcc = async (label: string) => {
      const text = await page.locator(`.rc-stat:has-text("${label}") .rc-sv`).innerText();
      return parseFloat(text.replace('%', ''));
    };

    const pitchAcc = await getAcc('PITCH ACCURACY');
    const timingAcc = await getAcc('TIMING ACCURACY');

    // 動的にしきい値を計算
    const notesCount = await page.evaluate(() => (window as any).__states.playerState.song.notes.length);
    const dynamicThreshold = ((notesCount - 1) * 80) / notesCount;

    await page.close();
    return { pitchAcc, timingAcc, dynamicThreshold };
  }

  test('perfect audio file evaluates successfully', async () => {
    const res = await runEvalTest('c_major_perfect.wav');
    console.log(`[UI RESULT] perfect: Pitch=${res.pitchAcc}%, Timing=${res.timingAcc}% (Threshold: ${res.dynamicThreshold}%)`);
    
    expect(res.pitchAcc).toBeGreaterThan(80);
    expect(res.timingAcc).toBeGreaterThan(res.dynamicThreshold); 
  });

  test('bad pitch is correctly penalized', async () => {
    const res = await runEvalTest('c_major_bad_pitch.wav');
    console.log(`[UI RESULT] bad_pitch: Pitch=${res.pitchAcc}%, Timing=${res.timingAcc}%`);
    expect(res.pitchAcc).toBeLessThan(60); 
  });

  test('bad timing is correctly penalized', async () => {
    const res = await runEvalTest('c_major_bad_timing.wav');
    console.log(`[UI RESULT] bad_timing: Pitch=${res.pitchAcc}%, Timing=${res.timingAcc}%`);
    expect(res.timingAcc).toBeLessThan(60);
  });

  test('silent audio results in zero score', async () => {
    const res = await runEvalTest('silent.wav');
    console.log(`[UI RESULT] silence: Pitch=${res.pitchAcc}%, Timing=${res.timingAcc}%`);
    expect(res.pitchAcc).toBe(0);
    expect(res.timingAcc).toBe(0);
  });
});
