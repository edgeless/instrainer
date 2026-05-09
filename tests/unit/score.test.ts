import { describe, test } from 'node:test';
import assert from 'node:assert';
import { scoreState, resetScore } from '../../src/lib/stores/score.svelte';

describe('resetScore', () => {
  test('resets scoreState to default values', () => {
    // 1. Populate scoreState with non-default values
    scoreState.noteResults = [{ grade: 'perfect', avgCents: 0 }];
    scoreState.recordedSamples = [{ noteIdx: 0, loopIdx: 0, samples: [] }];
    scoreState.currentCentsHistory = [{ freq: 440, isSliding: false, time: 100 }];
    scoreState.isSliding = true;
    scoreState.showResultOverlay = true;
    scoreState.detectedFreq = 220;
    scoreState.freeModeStats = {
      avgDev: 10,
      stability: 0.5,
      sampleCount: 100,
      excludedSamples: 5
    };

    // 2. Call resetScore
    resetScore();

    // 3. Assert that relevant fields are reset
    assert.strictEqual(scoreState.noteResults.length, 0);
    assert.strictEqual(scoreState.recordedSamples.length, 0);
    assert.strictEqual(scoreState.currentCentsHistory.length, 0);
    assert.strictEqual(scoreState.isSliding, false);
    assert.deepStrictEqual(scoreState.freeModeStats, {
      avgDev: null,
      stability: null,
      sampleCount: 0,
      excludedSamples: 0
    });

    // 4. Verify fields that are NOT reset by resetScore (as per current implementation)
    assert.strictEqual(scoreState.showResultOverlay, true);
    assert.strictEqual(scoreState.detectedFreq, 220);
  });
});
