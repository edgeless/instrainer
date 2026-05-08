import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { playerState, getDisplayBeat, getOriginalBeats, getTotalBeats } from '../../src/lib/stores/player.svelte';

describe('getOriginalBeats', () => {
  beforeEach(() => {
    playerState.song = {
      name: 'Test',
      bpm: 60,
      notes: []
    };
  });

  test('returns 0 when there are no notes', () => {
    playerState.song.notes = [];
    assert.strictEqual(getOriginalBeats(), 0);
  });

  test('calculates correct beats based on last note', () => {
    playerState.song.notes = [
      { name: 'C2', midi: 28, string: 'E', fret: 0, beat: 0, dur: 1 },
      { name: 'D2', midi: 30, string: 'E', fret: 2, beat: 1, dur: 2 },
      { name: 'E2', midi: 32, string: 'E', fret: 4, beat: 3, dur: 1.5 },
    ];
    // Last note: beat 3, dur 1.5 -> total 4.5
    assert.strictEqual(getOriginalBeats(), 4.5);
  });
});

describe('getTotalBeats', () => {
  beforeEach(() => {
    playerState.repeatCount = 1;
    playerState.song = {
      name: 'Test',
      bpm: 60,
      notes: [
        { name: 'C2', midi: 28, string: 'E', fret: 0, beat: 0, dur: 4 }
      ]
    };
  });

  test('returns original beats when repeatCount is 1', () => {
    playerState.repeatCount = 1;
    assert.strictEqual(getTotalBeats(), 4);
  });

  test('multiplies original beats by repeatCount', () => {
    playerState.repeatCount = 3;
    assert.strictEqual(getTotalBeats(), 12);
  });
});

describe('getDisplayBeat', () => {
  let originalPerformanceNow: typeof performance.now;

  beforeEach(() => {
    originalPerformanceNow = performance.now;
    // Reset player state to a known baseline
    playerState.isPlaying = false;
    playerState.isRecording = false;
    playerState.isFreeMode = false;
    playerState.currentBeat = 0;
    playerState.playbackStartTimeMs = null;
    playerState.song = {
      name: 'Test',
      bpm: 60, // 1 beat per second
      notes: []
    };
  });

  afterEach(() => {
    performance.now = originalPerformanceNow;
  });

  test('returns currentBeat when not playing or recording', () => {
    playerState.currentBeat = 42;
    assert.strictEqual(getDisplayBeat(), 42);
  });

  test('returns currentBeat when playing but playbackStartTimeMs is null', () => {
    playerState.isPlaying = true;
    playerState.currentBeat = 5;
    assert.strictEqual(getDisplayBeat(), 5);
  });

  test('calculates correct beat in normal mode (with 4-beat count-in offset)', () => {
    playerState.isPlaying = true;
    // Mock performance.now to return exactly 10000ms
    performance.now = () => 10000;

    // Set start time to 8000ms. Elapsed = 2000ms.
    // BPM = 60 -> 1 beat per second.
    // 2000ms = 2 beats elapsed.
    // Normal mode formula: elapsedBeats - 4.
    // Expect: 2 - 4 = -2
    playerState.playbackStartTimeMs = 8000;

    const displayBeat = getDisplayBeat();
    assert.strictEqual(displayBeat, -2);
  });

  test('calculates correct beat in free mode (no count-in offset)', () => {
    playerState.isFreeMode = true;
    playerState.isPlaying = true;

    performance.now = () => 10000;

    // Set start time to 5000ms. Elapsed = 5000ms.
    // BPM = 60 -> 1 beat per second.
    // 5000ms = 5 beats elapsed.
    // Free mode formula: elapsedBeats.
    // Expect: 5
    playerState.playbackStartTimeMs = 5000;

    const displayBeat = getDisplayBeat();
    assert.strictEqual(displayBeat, 5);
  });
});
