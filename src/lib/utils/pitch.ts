// MIDI to Frequency conversion
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Frequency to Cents comparison against target
export function freqToCents(detected: number, target: number): number | null {
  if (detected <= 0 || target <= 0) return null;
  return 1200 * Math.log2(detected / target);
}

// YIN Pitch Detection (fast mode: small window)
export function detectPitch(analyserNode: AnalyserNode, pitchBuf: Float32Array | any, sampleRate: number): number {
  if (!analyserNode) return -1;
  analyserNode.getFloatTimeDomainData(pitchBuf);
  const buf = pitchBuf;
  const n = buf.length;

  // RMS Volume Noise Gate
  let rms = 0;
  for (let i = 0; i < n; i++) {
    rms += buf[i] * buf[i];
  }
  rms = Math.sqrt(rms / n);
  if (rms < 0.015) {
    return -1;
  }

  const threshold = 0.12;
  const minFreq = 30, maxFreq = 1200;
  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.floor(sampleRate / minFreq);

  // Difference function
  let diff = new Float32Array(maxLag + 1);
  for (let tau = 0; tau <= maxLag; tau++) {
    let s = 0;
    for (let i = 0; i < n - maxLag; i++) {
      const d = buf[i] - buf[i + tau];
      s += d * d;
    }
    diff[tau] = s;
  }

  // Cumulative mean normalized difference
  let cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;
  let runSum = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    runSum += diff[tau];
    cmnd[tau] = runSum === 0 ? 0 : (diff[tau] * tau) / runSum;
  }

  // Find first dip below threshold
  let tau = minLag;
  while (tau < maxLag) {
    if (cmnd[tau] < threshold) {
      // Search for the local minimum within this dip
      while (tau + 1 < maxLag && cmnd[tau + 1] < cmnd[tau]) {
        tau++;
      }
      
      // Parabolic interpolation
      let exactTau = tau;
      if (tau > 0 && tau + 1 <= maxLag) {
        const a = cmnd[tau - 1], b = cmnd[tau], c = cmnd[tau + 1] || b;
        const denom = a - 2 * b + c;
        if (denom !== 0) exactTau += 0.5 * (a - c) / denom;
      }
      return sampleRate / exactTau;
    }
    tau++;
  }

  // fallback: global minimum in range
  let best = minLag, bestVal = cmnd[minLag];
  for (let t = minLag + 1; t <= maxLag; t++) {
    if (cmnd[t] < bestVal) {
      bestVal = cmnd[t];
      best = t;
    }
  }
  if (bestVal < 0.35) return sampleRate / best;
  return -1;
}

export function freqToMidi(freq: number): number {
  if (freq <= 0) return 0;
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

export function midiToNoteName(midi: number): string {
  if (midi < 0) return '—';
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  // Bass notation (Written Pitch) is 1 octave higher than Scientific Pitch Notation.
  // Standard C4 is MIDI 60. In this app, MIDI 60 is C5.
  return notes[midi % 12] + Math.floor(midi / 12);
}

export type Grade = 'perfect' | 'good' | 'ok' | 'miss';

export function getGrade(absCents: number, tolerance: number): Grade {
  if (absCents <= tolerance * 0.5) return 'perfect';
  if (absCents <= tolerance) return 'good';
  if (absCents <= tolerance * 2) return 'ok';
  return 'miss';
}

export function getTimingGrade(absDiffMs: number): Grade {
  if (absDiffMs <= 50) return 'perfect';
  if (absDiffMs <= 100) return 'good';
  if (absDiffMs <= 200) return 'ok';
  return 'miss';
}

export function getCombinedGrade(pitchGrade: Grade, timingGrade: Grade): Grade {
  const gradeValue = { perfect: 3, good: 2, ok: 1, miss: 0 };
  const valueToGrade = ['miss', 'ok', 'good', 'perfect'] as Grade[];

  const pitchVal = gradeValue[pitchGrade];
  const timingVal = gradeValue[timingGrade];

  const avg = Math.floor((pitchVal + timingVal) / 2);
  return valueToGrade[avg];
}
