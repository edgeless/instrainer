import { midiToFreq, freqToCents, freqToMidi, midiToNoteName, getGrade, getTimingGrade, getCombinedGrade, detectPitch } from '../../src/lib/utils/pitch';
import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('pitch utils', () => {
  test('midiToFreq converts MIDI note to frequency', () => {
    assert.strictEqual(Math.round(midiToFreq(69)), 440);
    assert.strictEqual(Math.round(midiToFreq(60)), 262);
  });

  test('freqToCents calculates difference in cents', () => {
    const target = 440;
    assert.strictEqual(freqToCents(440, target), 0);
    assert.strictEqual(Math.round(freqToCents(466.16, target)!), 100);
  });

  test('freqToMidi converts frequency to nearest MIDI note', () => {
    assert.strictEqual(freqToMidi(440), 69);
    assert.strictEqual(freqToMidi(261.63), 60);
  });

  test('midiToNoteName converts MIDI note to name (Bass notation)', () => {
    // Standard SPN + 1 octave shift as per project convention
    assert.strictEqual(midiToNoteName(28), 'E1');
    assert.strictEqual(midiToNoteName(40), 'E2');
    assert.strictEqual(midiToNoteName(69), 'A4');
  });

  test('getGrade determines pitch grade based on cents and tolerance', () => {
    const tolerance = 20;
    // perfect <= 10, good <= 20, ok <= 40
    assert.strictEqual(getGrade(0, tolerance), 'perfect');
    assert.strictEqual(getGrade(5, tolerance), 'perfect');
    assert.strictEqual(getGrade(10, tolerance), 'perfect');
    assert.strictEqual(getGrade(15, tolerance), 'good');
    assert.strictEqual(getGrade(20, tolerance), 'good');
    assert.strictEqual(getGrade(30, tolerance), 'ok');
    assert.strictEqual(getGrade(40, tolerance), 'ok');
    assert.strictEqual(getGrade(45, tolerance), 'miss');
  });

  test('getTimingGrade determines timing grade', () => {
    assert.strictEqual(getTimingGrade(30), 'perfect');
    assert.strictEqual(getTimingGrade(70), 'good');
    assert.strictEqual(getTimingGrade(150), 'ok');
    assert.strictEqual(getTimingGrade(250), 'miss');
  });

  test('getCombinedGrade averages two grades', () => {
    assert.strictEqual(getCombinedGrade('perfect', 'perfect'), 'perfect');
    assert.strictEqual(getCombinedGrade('perfect', 'good'), 'good');
    assert.strictEqual(getCombinedGrade('good', 'ok'), 'ok');
    assert.strictEqual(getCombinedGrade('miss', 'perfect'), 'ok');
  });

  test('detectPitch returns -1 for low volume', () => {
    const mockAnalyser = {
      getFloatTimeDomainData: (buf: Float32Array) => {
        buf.fill(0);
      }
    } as any;
    const buf = new Float32Array(2048);
    assert.strictEqual(detectPitch(mockAnalyser, buf, 44100), -1);
  });
});
