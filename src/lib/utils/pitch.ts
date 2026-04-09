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
export function detectPitch(analyserNode: AnalyserNode, pitchBuf: any, sampleRate: number): number {
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
  const minFreq = 30, maxFreq = 400;
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

// High-quality YIN for post-analysis (larger buffer) - although we aren't saving actual PCM samples in the HTML currently, 
// the original HTML just reused currentCentsHistory and didn't recalculate YIN HQ. Wait, original HTML had `detectPitchHQ` but it was never used in `runPostAnalysis()`.
// `runPostAnalysis()` only recalculated median of cents history! But let's keep it if needed.
export function detectPitchHQ(samples: number[], sr: number): number {
  const n = samples.length;
  const threshold = 0.08;
  const minFreq = 30, maxFreq = 400;
  const minLag = Math.floor(sr / maxFreq);
  const maxLag = Math.min(Math.floor(sr / minFreq), Math.floor(n / 2));

  let diff = new Float32Array(maxLag + 1);
  for (let tau = 1; tau <= maxLag; tau++) {
    let s = 0;
    for (let i = 0; i < n - maxLag; i++) {
      const d = samples[i] - samples[i + tau];
      s += d * d;
    }
    diff[tau] = s;
  }
  let cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;
  let runSum = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    runSum += diff[tau];
    cmnd[tau] = runSum === 0 ? 0 : (diff[tau] * tau) / runSum;
  }
  let tau = minLag;
  while (tau < maxLag) {
    if (cmnd[tau] < threshold) {
      // Search for local minimum
      while (tau + 1 < maxLag && cmnd[tau + 1] < cmnd[tau]) {
        tau++;
      }
      
      let exactTau = tau;
      if (tau > 0 && tau + 1 <= maxLag) {
        const a = cmnd[tau - 1], b = cmnd[tau], c = cmnd[tau + 1] || b;
        const denom = a - 2 * b + c;
        if (denom !== 0) exactTau += 0.5 * (a - c) / denom;
      }
      return sr / exactTau;
    }
    tau++;
  }
  let best = minLag, bestVal = cmnd[minLag];
  for (let t = minLag + 1; t <= maxLag; t++) {
    if (cmnd[t] < bestVal) {
      bestVal = cmnd[t];
      best = t;
    }
  }
  if (bestVal < 0.25) return sr / best;
  return -1;
}

export function freqToMidi(freq: number): number {
  if (freq <= 0) return 0;
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

export function midiToNoteName(midi: number): string {
  if (midi < 0) return '—';
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return notes[midi % 12] + (Math.floor(midi / 12) - 1);
}

export type Grade = 'perfect' | 'good' | 'ok' | 'miss';

export function getGrade(absCents: number, tolerance: number): Grade {
  if (absCents <= tolerance * 0.5) return 'perfect';
  if (absCents <= tolerance) return 'good';
  if (absCents <= tolerance * 2) return 'ok';
  return 'miss';
}
