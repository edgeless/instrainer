import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  midiToFreq,
  freqToCents,
  freqToMidi,
  midiToNoteName,
  getGrade,
  getTimingGrade,
  getCombinedGrade,

  detectPitch
} from '../../src/lib/utils/pitch';

describe('pitch utils', () => {
  test('midiToFreq converts MIDI note to frequency', () => {
    // A4 = 69 = 440Hz
    assert.strictEqual(Math.round(midiToFreq(69)), 440);
    // C4 = 60
    assert.strictEqual(Math.round(midiToFreq(60)), 262);
    // A3 = 57 = 220Hz
    assert.strictEqual(Math.round(midiToFreq(57)), 220);
  });

  test('freqToCents calculates difference in cents', () => {
    // Same frequency = 0 cents
    assert.strictEqual(freqToCents(440, 440), 0);
    // One octave up = 1200 cents
    assert.strictEqual(freqToCents(880, 440), 1200);
    // One octave down = -1200 cents
    assert.strictEqual(freqToCents(220, 440), -1200);
    // Invalid inputs
    assert.strictEqual(freqToCents(0, 440), null);
    assert.strictEqual(freqToCents(440, 0), null);
    assert.strictEqual(freqToCents(-1, 440), null);
  });

  test('freqToMidi converts frequency to nearest MIDI note', () => {
    assert.strictEqual(freqToMidi(440), 69);
    assert.strictEqual(freqToMidi(441), 69);
    assert.strictEqual(freqToMidi(261.63), 60);
    assert.strictEqual(freqToMidi(0), 0);
  });

  test('midiToNoteName converts MIDI note to name (Bass notation)', () => {
    // Based on AGENTS.md and c_major.json
    // Standard C4 is MIDI 60.
    // In bass notation (Written Pitch), MIDI 36 is C3.
    // Our implementation: notes[36%12] + Math.floor(36/12) = C3

    assert.strictEqual(midiToNoteName(36), 'C3');
    assert.strictEqual(midiToNoteName(48), 'C4');
    assert.strictEqual(midiToNoteName(28), 'E2');

    assert.strictEqual(midiToNoteName(-1), '—');
  });

  test('getGrade determines pitch grade based on cents and tolerance', () => {
    const tolerance = 20;
    assert.strictEqual(getGrade(0, tolerance), 'perfect');
    assert.strictEqual(getGrade(10, tolerance), 'perfect');
    assert.strictEqual(getGrade(15, tolerance), 'good');
    assert.strictEqual(getGrade(20, tolerance), 'good');
    assert.strictEqual(getGrade(30, tolerance), 'ok');
    assert.strictEqual(getGrade(40, tolerance), 'ok');
    assert.strictEqual(getGrade(41, tolerance), 'miss');
  });

  test('getTimingGrade determines timing grade', () => {
    assert.strictEqual(getTimingGrade(20), 'perfect');
    assert.strictEqual(getTimingGrade(50), 'perfect');
    assert.strictEqual(getTimingGrade(75), 'good');
    assert.strictEqual(getTimingGrade(100), 'good');
    assert.strictEqual(getTimingGrade(150), 'ok');
    assert.strictEqual(getTimingGrade(200), 'ok');
    assert.strictEqual(getTimingGrade(250), 'miss');
  });

  test('getCombinedGrade averages two grades', () => {
    assert.strictEqual(getCombinedGrade('perfect', 'perfect'), 'perfect');
    assert.strictEqual(getCombinedGrade('perfect', 'good'), 'good'); // (3+2)/2 = 2.5 -> 2 (good)
    assert.strictEqual(getCombinedGrade('good', 'ok'), 'ok'); // (2+1)/2 = 1.5 -> 1 (ok)
    assert.strictEqual(getCombinedGrade('miss', 'perfect'), 'ok'); // (0+3)/2 = 1.5 -> 1 (ok)
    assert.strictEqual(getCombinedGrade('miss', 'miss'), 'miss');
  });


  test('detectPitch detects pitch with mocked AnalyserNode', () => {
    const sr = 44100;
    const freq = 220; // A3
    // detectPitch expects pitchBuf to be at least large enough for maxLag
    // maxLag = sampleRate / 30 = 44100 / 30 = 1470
    const pitchBuf = new Float32Array(2048);

    const mockAnalyser = {
      getFloatTimeDomainData: (buf: Float32Array) => {
        for (let i = 0; i < buf.length; i++) {
          buf[i] = Math.sin(2 * Math.PI * freq * i / sr);
        }
      }
    } as unknown as AnalyserNode;

    const detected = detectPitch(mockAnalyser, pitchBuf, sr);
    assert.ok(Math.abs(detected - freq) < 1);
  });

  test('detectPitch returns -1 for low volume', () => {
    const sr = 44100;
    const pitchBuf = new Float32Array(1024);

    const mockAnalyser = {
      getFloatTimeDomainData: (buf: Float32Array) => {
        buf.fill(0.001); // Very low volume
      }
    } as unknown as AnalyserNode;

    const detected = detectPitch(mockAnalyser, pitchBuf, sr);
    assert.strictEqual(detected, -1);
  });
});
