import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { scoreState, resetScore, calculateScorePercentages, saveScoreHistory, loadScoreHistory, type NoteResult } from '../../src/lib/stores/score.svelte';

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

describe('score history persistence', () => {
  let originalLocalStorage: any;
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    const mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      clear: () => {
        store = {};
      }
    };
    originalLocalStorage = (global as any).localStorage;
    (global as any).localStorage = mockLocalStorage;
  });

  afterEach(() => {
    if (originalLocalStorage) {
      (global as any).localStorage = originalLocalStorage;
    } else {
      delete (global as any).localStorage;
    }
  });

  describe('saveScoreHistory', () => {
    it('handles invalid JSON in existing history gracefully', () => {
      const songKey = 'test-song';
      // Setup invalid JSON
      (global as any).localStorage.setItem(`score_history_${songKey}`, '{invalid-json');

      const newScore = {
        overallPercent: 95,
        pitchPercent: 90,
        timingPercent: 100
      };

      // Suppress console.error for this test
      const originalConsoleError = console.error;
      console.error = () => {};

      try {
        saveScoreHistory(songKey, newScore);
      } finally {
        console.error = originalConsoleError;
      }

      // Read back to verify it recovered and saved the new score
      const savedData = JSON.parse((global as any).localStorage.getItem(`score_history_${songKey}`));
      assert.strictEqual(Array.isArray(savedData), true);
      assert.strictEqual(savedData.length, 1);
      assert.strictEqual(savedData[0].overallPercent, 95);
      assert.strictEqual(savedData[0].pitchPercent, 90);
      assert.strictEqual(savedData[0].timingPercent, 100);
      assert.ok(savedData[0].timestamp > 0);
    });
  });

  describe('loadScoreHistory', () => {
    it('handles invalid JSON gracefully and returns an empty array', () => {
      const songKey = 'test-song-2';
      // Setup invalid JSON
      (global as any).localStorage.setItem(`score_history_${songKey}`, '[not, valid json]');

      // Suppress console.error for this test
      const originalConsoleError = console.error;
      console.error = () => {};

      let result;
      try {
        result = loadScoreHistory(songKey);
      } finally {
        console.error = originalConsoleError;
      }

      assert.deepStrictEqual(result, []);
    });
  });
});
