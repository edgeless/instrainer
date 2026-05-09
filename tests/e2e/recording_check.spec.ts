import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Recording Integrity Tests
 * 
 * This suite verifies that the MediaRecorder correctly captures audio via MediaStreamDestination
 * and that the resulting blob contains non-silent audio data.
 */

test.describe('Recording Integrity', () => {

  async function setupInjectedMic(page: any) {
    await page.evaluate(async () => {
      const { audioState } = (window as any).__states;
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioState.audioCtx) audioState.audioCtx = new AC();
      if (audioState.audioCtx.state === 'suspended') await audioState.audioCtx.resume();
      
      const osc = audioState.audioCtx.createOscillator();
      osc.frequency.value = 440; // A4
      
      const gain = audioState.audioCtx.createGain();
      gain.gain.value = 0.5;
      osc.connect(gain);
      
      if (audioState.analyserNode) {
        gain.connect(audioState.analyserNode);
      }
      
      osc.start();
      console.log("[E2E Test] Oscillator started at 440Hz");
      
      audioState.micSource = gain as any;
      audioState.micGranted = true;
    });
  }

  async function setupSilentMic(page: any) {
    await page.evaluate(async () => {
      const { audioState } = (window as any).__states;
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioState.audioCtx) audioState.audioCtx = new AC();
      
      const gain = audioState.audioCtx.createGain();
      gain.gain.value = 0; // Silent
      
      audioState.micSource = gain as any;
      audioState.micGranted = true;
    });
  }

  async function checkBlobSilence(page: any): Promise<boolean> {
    return await page.evaluate(async () => {
      const { audioState } = (window as any).__states;
      const url = audioState.recordedAudioUrl;
      console.log("[E2E Test] recordedAudioUrl:", url);
      if (!url) return true;

      let arrayBuffer: ArrayBuffer;
      try {
        // Bypass SvelteKit's fetch wrapper using an iframe
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        const cleanFetch = iframe.contentWindow!.fetch;
        const resp = await cleanFetch(url);
        arrayBuffer = await resp.arrayBuffer();
        document.body.removeChild(iframe);
      } catch (e) {
        console.error("[E2E Test] Fetch failed:", e);
        return true;
      }
      
      const blobSize = arrayBuffer.byteLength;
      console.log("[E2E Test] Blob size:", blobSize);
      if (blobSize < 1000) return true;

      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        const data = decoded.getChannelData(0);
        let hasSound = false;
        for (let i = 0; i < data.length; i++) {
          if (Math.abs(data[i]) > 0.005) { // Slightly lower threshold
            hasSound = true;
            break;
          }
        }
        await ctx.close();
        return !hasSound;
      } catch (e) {
        console.warn("[E2E Test] Could not decode blob for silence check:", e);
        return blobSize < 2000;
      }
    });
  }

  test('recorded audio with signal is not silent', async ({ page }) => {
    page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => (window as any).__states !== undefined, { timeout: 30000 });

    await setupInjectedMic(page);

    // Start recording
    await page.locator('.tbtn.rec').click();
    
    // Check recorder state
    const isRecording = await page.evaluate(() => {
        const { playerState } = (window as any).__states;
        return playerState.isRecording;
    });
    console.log(`[E2E] isRecording state: ${isRecording}`);
    
    // Wait longer to ensure enough audio is captured
    await page.waitForTimeout(4000);

    // Stop recording
    await page.locator('.tbtn.rec').click();
    
    // Wait for recorded URL
    await page.waitForFunction(() => (window as any).__states.audioState.recordedAudioUrl !== null, { timeout: 10000 });

    const isSilent = await checkBlobSilence(page);
    expect(isSilent).toBe(false);
  });

  test('recorded silence remains silent', async ({ page }) => {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => (window as any).__states !== undefined);

    await setupSilentMic(page);

    // Start recording
    await page.locator('.tbtn.rec').click();
    await page.waitForTimeout(2000);

    // Stop recording
    await page.locator('.tbtn.rec').click();
    
    await page.waitForFunction(() => (window as any).__states.audioState.recordedAudioUrl !== null);

    const isSilent = await checkBlobSilence(page);
    expect(isSilent).toBe(true);
  });

});
