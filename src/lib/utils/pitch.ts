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
export function detectPitch(
  analyserNode: AnalyserNode, 
  pitchBuf: Float32Array, 
  sampleRate: number,
  diffBuf?: Float32Array,
  cmndBuf?: Float32Array
): number {
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
  const rmsThreshold = 0.015;
  if (rms < rmsThreshold) {
    return -1;
  }

  const threshold = 0.12;
  const minFreq = 30, maxFreq = 1200;
  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.floor(sampleRate / minFreq);

  // Difference function
  // maxLag is at most sampleRate / 30. For 44.1k, it's 1470.
  // Using pre-allocated buffers if provided to avoid GC.
  let diff = diffBuf || new Float32Array(maxLag + 1);
  for (let tau = 0; tau <= maxLag; tau++) {
    let s = 0;
    for (let i = 0; i < n - maxLag; i++) {
      const d = buf[i] - buf[i + tau];
      s += d * d;
    }
    diff[tau] = s;
  }

  // Cumulative mean normalized difference
  let cmnd = cmndBuf || new Float32Array(maxLag + 1);
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

export function keyToDroneFreq(key: string | undefined): number | null {
  if (!key) return null;

  // キー文字列からルート音を抽出（例: "C-7" -> "C", "Eb" -> "Eb", "F#" -> "F#"）
  const match = key.match(/^[A-G][#b]?/);
  if (!match) return null;
  const rootNote = match[0];

  // C1 (MIDI 24) をベースとする（ドローン音は低めに設定）
  const noteOffsets: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11
  };

  const offset = noteOffsets[rootNote];
  if (offset === undefined) return null;

  // C2 (MIDI 36) ～ B2 (MIDI 47) をドローン音の基準オクターブとする
  // (C1の32Hz付近はスマホ等のスピーカーで聞こえづらいため)
  const baseMidi = 36;
  const droneMidi = baseMidi + offset;

  return midiToFreq(droneMidi);
}

export function midiToNoteName(midi: number): string {
  if (midi < 0) return '—';
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  // Bass notation (Written Pitch) is 1 octave higher than Scientific Pitch Notation.
  // Standard C4 is MIDI 60. In this app, MIDI 60 is C5.
  return notes[midi % 12] + Math.floor(midi / 12);
}

export type Grade = 'perfect' | 'good' | 'ok' | 'miss';

/**
 * イントネーションの正確さを判定します。
 * ユーザー要望に基づき、OK判定を15セント以内とする非常に厳しいプロフェッショナル基準を適用。
 */
export function getGrade(absCents: number, tolerance: number): Grade {
  if (absCents <= tolerance * 0.4) return 'perfect'; // < 6c
  if (absCents <= tolerance * 0.7) return 'good';    // < 10.5c
  if (absCents <= tolerance) return 'ok';           // < 15c
  return 'miss';
}

/**
 * タイミングの判定グレードを返します。
 * 
 * 注意: ResultOverlay.svelte でのスコア計算では 100ms を 0点としています。
 * そのため、'good' (50-100ms) 判定であっても、スコアとしては低い値（0%〜50%）になります。
 * これは、プロフェッショナルな練習においては 100ms 以上のズレは「精度点としては不合格」
 * という厳格な評価方針に基づいています。
 */
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
