import { test, expect, chromium, type Browser } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Evaluation Tests', () => {
  test.skip(!!process.env.CI, 'Evaluation tests require headed mode and are skipped on CI');

  let browserInstance: Browser;

  test.beforeAll(async () => {
    browserInstance = await chromium.launch({
      headless: false,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    });
  });

  test.afterAll(async () => {
    await browserInstance.close();
  });

  async function runEvalTest(testCase: 'perfect' | 'good_pitch' | 'good_timing' | 'silent') {
    const context = await browserInstance.newContext({
      permissions: ['microphone'],
    });
    const page = await context.newPage();
    
    // Log browser console
    page.on('console', msg => {
      if (msg.type() === 'debug' || msg.type() === 'error') {
        console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
      }
    });

    await page.goto('http://localhost:5173/');
    
    // Wait for app initialization
    await page.waitForFunction(() => (window as any).__states !== undefined, { timeout: 10000 });

    // Setup Test Mode and Initial State
    await page.evaluate(async (mode) => {
      const { setSong, playerState, audioState, requestMic, initAudioCtx } = (window as any).__states;
      (window as any).__testMode = mode;

      setSong('c_major');
      playerState.song.bpm = 60;
      playerState.tolerance = 60;
      
      await requestMic();
      audioState.latencyCompensationMs = 50; 
    }, testCase);

    // Trigger Recording and Audio Scheduling simultaneously
    await page.evaluate(() => {
      const { startRecording, audioState, playerState, getCountInBeats } = (window as any).__states;
      const mode = (window as any).__testMode;

      startRecording();
      
      // アプリが確定させた基準時刻を読み取る
      const baseTimeMs = playerState.playbackStartTimeMs;
      const baseTime = baseTimeMs / 1000;
      const ctx = audioState.audioCtx;

      const notes = playerState.song.notes;
      const secPerBeat = 60 / playerState.song.bpm;
      const countIn = getCountInBeats();

      if (mode === 'silent') return;

      notes.forEach((note: any) => {
        let midiOffset = 0;
        let timeOffset = 0;
        
        if (mode === 'good_pitch') timeOffset = 0.2; // Correct Pitch, Bad Timing (200ms late)
        if (mode === 'good_timing') midiOffset = 0.8; // Correct Timing, Bad Pitch (80 cents off)

        const startTime = baseTime + (countIn + note.beat + timeOffset) * secPerBeat;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(440 * Math.pow(2, (note.midi + midiOffset - 69) / 12), startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
        gain.gain.linearRampToValueAtTime(0, startTime + note.dur * secPerBeat);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.connect(audioState.analyserNode);
        
        osc.start(startTime);
        osc.stop(startTime + note.dur * secPerBeat);
      });
    });

    // Wait for the song to finish
    await page.waitForTimeout(22000);

    // Stop Recording and wait for analysis
    await page.evaluate(async () => {
      const { stopRecording } = (window as any).__states;
      await stopRecording();
    });

    // Get Note Results for Debugging
    const noteResults = await page.evaluate(() => {
      const { scoreState } = (window as any).__states;
      return scoreState.noteResults.map((r: any, i: number) => ({
        idx: i,
        grade: r?.grade,
        timingDiffMs: r?.timingDiffMs
      }));
    });
    console.log(`[TEST DEBUG] FULL Results:`, JSON.stringify(noteResults));

    // Get Final Scores
    const results = await page.evaluate(() => {
      const { scoreState } = (window as any).__states;
      return {
        pitchVal: Math.round((scoreState.pitchAccuracy || 0) * 100),
        timingVal: Math.round((scoreState.timingAccuracy || 0) * 100)
      };
    });

    await context.close();
    return results;
  }

  test('perfect audio case', async () => {
    test.setTimeout(60000);
    const { pitchVal, timingVal } = await runEvalTest('perfect');
    console.log(`PERFECT CASE: Pitch=${pitchVal}%, Timing=${timingVal}%`);
    expect(pitchVal).toBeGreaterThanOrEqual(80);
    expect(timingVal).toBeGreaterThanOrEqual(80);
  });

  test('good pitch audio case', async () => {
    test.setTimeout(60000);
    const { pitchVal, timingVal } = await runEvalTest('good_pitch');
    console.log(`GOOD PITCH CASE: Pitch=${pitchVal}%, Timing=${timingVal}%`);
    expect(pitchVal).toBeGreaterThanOrEqual(80);
    expect(timingVal).toBeLessThanOrEqual(50);
  });

  test('good timing audio case', async () => {
    test.setTimeout(60000);
    const { pitchVal, timingVal } = await runEvalTest('good_timing');
    console.log(`GOOD TIMING CASE: Pitch=${pitchVal}%, Timing=${timingVal}%`);
    expect(pitchVal).toBeLessThanOrEqual(50);
    expect(timingVal).toBeGreaterThanOrEqual(80);
  });

  test('silent audio case', async () => {
    test.setTimeout(60000);
    const { pitchVal, timingVal } = await runEvalTest('silent');
    console.log(`SILENT CASE: Pitch=${pitchVal}%, Timing=${timingVal}%`);
    expect(pitchVal).toBe(0);
    expect(timingVal).toBe(0);
  });
});
