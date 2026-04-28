import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { playerState, getDisplayBeat } from '../../src/lib/stores/player.svelte';

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

  test('calculates correct beat in normal mode (with default 4-beat count-in offset)', () => {
    playerState.isPlaying = true;
    // Mock performance.now to return exactly 10000ms
    performance.now = () => 10000;

    // Set start time to 8000ms. Elapsed = 2000ms.
    // BPM = 60 -> 1 beat per second.
    // 2000ms = 2 beats elapsed.
    // Normal mode formula: elapsedBeats - 4 (default for 4/4 or missing timeSignature).
    // Expect: 2 - 4 = -2
    playerState.playbackStartTimeMs = 8000;

    const displayBeat = getDisplayBeat();
    assert.strictEqual(displayBeat, -2);
  });

  test('calculates correct beat in normal mode with 3-beat count-in (3/4 time signature)', () => {
    playerState.song.timeSignature = [3, 4];
    playerState.isPlaying = true;
    performance.now = () => 10000;

    // BPM = 60 -> 1 beat per second.
    // Set start time to 8000ms. Elapsed = 2000ms = 2 beats.
    // 3/4 mode formula: elapsedBeats - 3.
    // Expect: 2 - 3 = -1
    playerState.playbackStartTimeMs = 8000;

    const displayBeat = getDisplayBeat();
    assert.strictEqual(displayBeat, -1);
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
