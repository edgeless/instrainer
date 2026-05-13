import { describe, it } from 'node:test';
import assert from 'node:assert';
import { scoreState, resetScore, calculateScorePercentages, type NoteResult } from '../../src/lib/stores/score.svelte';

describe('resetScore', () => {
  it('resets scoreState to default values', () => {
    scoreState.noteResults = [{ grade: 'perfect', avgCents: 0 } as any];
    scoreState.recordedSamples = [{ noteIdx: 0, loopIdx: 0, samples: [] }];
    scoreState.currentCentsHistory = [{ freq: 440, isSliding: false, time: 0 }];
    scoreState.isSliding = true;

    resetScore();

    assert.deepStrictEqual(scoreState.noteResults, []);
    assert.deepStrictEqual(scoreState.recordedSamples, []);
    assert.deepStrictEqual(scoreState.currentCentsHistory, []);
    assert.strictEqual(scoreState.isSliding, false);
  });
});

describe('calculateScorePercentages', () => {
  it('calculates correct percentages for perfect notes', () => {
    const noteResults: NoteResult[] = [
      { grade: 'perfect', pitchGrade: 'perfect', timingGrade: 'perfect', avgCents: 0, timingDiffMs: 0 },
      { grade: 'perfect', pitchGrade: 'perfect', timingGrade: 'perfect', avgCents: 0, timingDiffMs: 0 },
    ];

    const percentages = calculateScorePercentages(noteResults, 2, 15);
    assert.strictEqual(percentages.pitchPercent, 100);
    assert.strictEqual(percentages.timingPercent, 100);
    assert.strictEqual(percentages.overallPercent, 100);
  });

  it('calculates correct percentages for miss notes', () => {
    const noteResults: NoteResult[] = [
      { grade: 'miss', pitchGrade: 'miss', timingGrade: 'miss', avgCents: null, timingDiffMs: null },
    ];

    const percentages = calculateScorePercentages(noteResults, 1, 15);
    assert.strictEqual(percentages.pitchPercent, 0);
    assert.strictEqual(percentages.timingPercent, 0);
    assert.strictEqual(percentages.overallPercent, 0);
  });
});
