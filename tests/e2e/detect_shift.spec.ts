import { test, expect } from '@playwright/test';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';

test('detect windows pitch shift', async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/');
  
  const detectedSampleRate = await page.evaluate(async () => {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const rate = ctx.sampleRate;
    await ctx.close();
    return rate;
  });
  console.log(`Sample Rate: ${detectedSampleRate}`);

  try {
    await page.reload();
    let hydrated = false;
    for (let i = 0; i < 60; i++) {
      hydrated = await page.evaluate(() => (window as any).__states !== undefined);
      if (hydrated) break;
      await page.waitForTimeout(500);
    }
    if (!hydrated) throw new Error("App failed to hydrate");
    
    await page.evaluate(async () => {
      const { requestMic } = (window as any).__states;
      (window as any).__E2E__ = true;
      await requestMic();
    });

    // Wait for signal to be detected
    let lastDeviation = null;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      const data = await page.evaluate(() => {
        const freq = (window as any).__states.scoreState.detectedFreq;
        if (!freq || freq <= 0) return null;
        return 1200 * Math.log2(freq / 440.0);
      });
      if (data !== null) {
        lastDeviation = data;
        console.log(`[${i}] Current Deviation: ${data} cents`);
      }
    }

    console.log(`FINAL Detected Deviation: ${lastDeviation} cents`);
  } finally {
    // No files to clean up
  }
});
