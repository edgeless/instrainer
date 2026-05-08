/**
 * Generate test WAV files for E2E evaluation tests.
 * Uses Buffer directly (no ArrayBuffer/DataView) for maximum compatibility.
 *
 * Usage: node generate_test_audio.cjs
 */

const fs = require('fs');
const path = require('path');

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Write a mono 16-bit PCM WAV file using Node.js Buffer directly.
 * @param {string} filename
 * @param {Int16Array} samples - 16-bit signed integer samples
 * @param {number} sampleRate
 */
function writeWav(filename, samples, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8); // 2
  const byteRate = sampleRate * blockAlign; // 88200
  const dataSize = samples.length * (bitsPerSample / 8);

  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');

  // fmt sub-chunk
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);              // sub-chunk1 size
  header.writeUInt16LE(1, 20);               // audio format (PCM)
  header.writeUInt16LE(numChannels, 22);     // num channels
  header.writeUInt32LE(sampleRate, 24);      // sample rate
  header.writeUInt32LE(byteRate, 28);        // byte rate
  header.writeUInt16LE(blockAlign, 32);      // block align
  header.writeUInt16LE(bitsPerSample, 34);   // bits per sample

  // data sub-chunk
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  // Write sample data
  const dataBuffer = Buffer.alloc(dataSize);
  for (let i = 0; i < samples.length; i++) {
    dataBuffer.writeInt16LE(samples[i], i * 2);
  }

  fs.writeFileSync(filename, Buffer.concat([header, dataBuffer]));
  const durationSec = samples.length / sampleRate;
  console.log(`  ✔ ${path.basename(filename)} (${samples.length} samples, ${durationSec.toFixed(2)}s)`);
}

// ---------- config ----------

const SAMPLE_RATE = 44100;
const BPM = 60;
const SEC_PER_BEAT = 60 / BPM;
const COUNT_IN_BEATS = 4;
const LATENCY_PADDING_SEC = 0.25; // 250ms matches app's default latencyCompensationMs

// Notes from c_major.json (Standard Bass Range: MIDI 36-48)
const C_MAJOR_MIDI = [
  { beat: 0,  dur: 1, midi: 36 },
  { beat: 1,  dur: 1, midi: 38 },
  { beat: 2,  dur: 1, midi: 40 },
  { beat: 3,  dur: 1, midi: 41 },
  { beat: 4,  dur: 1, midi: 43 },
  { beat: 5,  dur: 1, midi: 45 },
  { beat: 6,  dur: 1, midi: 47 },
  { beat: 7,  dur: 1, midi: 48 },
  { beat: 8,  dur: 1, midi: 47 },
  { beat: 9,  dur: 1, midi: 45 },
  { beat: 10, dur: 1, midi: 43 },
  { beat: 11, dur: 1, midi: 41 },
  { beat: 12, dur: 1, midi: 40 },
  { beat: 13, dur: 1, midi: 38 },
  { beat: 14, dur: 2, midi: 36 },
];

function generateSamples(notes) {
  const lastNote = notes[notes.length - 1];
  const totalBeats = lastNote.beat + lastNote.dur;
  const latencyPaddingSamples = Math.round(LATENCY_PADDING_SEC * SAMPLE_RATE);
  const totalSamples = latencyPaddingSamples + Math.round((COUNT_IN_BEATS + totalBeats) * SEC_PER_BEAT * SAMPLE_RATE) + SAMPLE_RATE;

  const buffer = new Int16Array(totalSamples); // all zeros initially

  for (const note of notes) {
    const freq = note.freqOverride || midiToFreq(note.midi);
    const beatOffset = note.beatOffset || 0;
    const startBeat = COUNT_IN_BEATS + note.beat + beatOffset;
    // 80% duration for a clear, stable melody
    const soundDur = note.dur * 0.8;
    const endBeat = startBeat + soundDur;

    const startSample = latencyPaddingSamples + Math.round(startBeat * SEC_PER_BEAT * SAMPLE_RATE);
    const endSample = latencyPaddingSamples + Math.round(endBeat * SEC_PER_BEAT * SAMPLE_RATE);

    for (let i = startSample; i < endSample && i < totalSamples; i++) {
      const t = (i - startSample) / SAMPLE_RATE;
      
      // Simple 2-harmonic sawtooth (fundamental + 1st harmonic)
      // Provides enough structure for YIN without too much noise
      let sample = Math.sin(2.0 * Math.PI * freq * t) + 
                   Math.sin(2.0 * Math.PI * freq * 2 * t) / 2;
      sample /= 1.2; 

      let envelope = 1.0;
      const attackSamples = 0.01 * SAMPLE_RATE; // 10ms attack
      const releaseSamples = 0.01 * SAMPLE_RATE; // 10ms release

      const elapsed = i - startSample;
      const remaining = endSample - i;

      if (elapsed < attackSamples) {
        envelope = elapsed / attackSamples;
      } else if (remaining < releaseSamples) {
        envelope = remaining / releaseSamples;
      }

      buffer[i] = Math.round(sample * envelope * 0.5 * 32767.0);
    }
  }

  return buffer;
}

// ---------- generate ----------

const outDir = __dirname;

console.log('Generating test WAV files...');
console.log(`  SR=${SAMPLE_RATE}Hz BPM=${BPM} padding=${LATENCY_PADDING_SEC*1000}ms`);

const perfectNotes = C_MAJOR_MIDI.map(n => ({ ...n }));
writeWav(path.join(outDir, 'c_major_perfect.wav'), generateSamples(perfectNotes), SAMPLE_RATE);

const goodPitchNotes = C_MAJOR_MIDI.map(n => ({
  ...n, freqOverride: midiToFreq(n.midi) * Math.pow(2, 15 / 1200)
}));
writeWav(path.join(outDir, 'c_major_good_pitch.wav'), generateSamples(goodPitchNotes), SAMPLE_RATE);

const goodTimingNotes = C_MAJOR_MIDI.map(n => ({
  ...n, beatOffset: 0.08 / SEC_PER_BEAT
}));
writeWav(path.join(outDir, 'c_major_good_timing.wav'), generateSamples(goodTimingNotes), SAMPLE_RATE);

writeWav(path.join(outDir, 'silent.wav'), new Int16Array(100000), SAMPLE_RATE);

// Verify header
console.log('\nVerifying c_major_perfect.wav:');
const raw = fs.readFileSync(path.join(outDir, 'c_major_perfect.wav'));
console.log(`  RIFF: ${raw.toString('ascii',0,4)}`);
console.log(`  Format: ${raw.readUInt16LE(20)} (1=PCM)`);
console.log(`  Channels: ${raw.readUInt16LE(22)}`);
console.log(`  SampleRate: ${raw.readUInt32LE(24)}`);
console.log(`  ByteRate: ${raw.readUInt32LE(28)} (expected: ${SAMPLE_RATE * 2})`);
console.log(`  BlockAlign: ${raw.readUInt16LE(32)}`);
console.log(`  BitsPerSample: ${raw.readUInt16LE(34)}`);
// Check samples around 3.25s mark (where first note starts)
const noteStartSample = Math.round((LATENCY_PADDING_SEC + COUNT_IN_BEATS * SEC_PER_BEAT) * SAMPLE_RATE);
const samples5 = [];
for (let i = 0; i < 5; i++) {
  samples5.push(raw.readInt16LE(44 + (noteStartSample + i) * 2));
}
console.log(`  Samples at note start (${noteStartSample}): [${samples5.join(', ')}]`);

console.log('\nDone!');
