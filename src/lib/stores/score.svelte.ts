export type NoteResult = {
  grade: 'perfect' | 'good' | 'ok' | 'miss';
  avgCents: number | null;
  rawCents?: number[];
};

export type RecordedSample = {
  noteIdx: number;
  samples: { freq: number, isSliding: boolean }[];
};

export const scoreState = $state<{
  noteResults: (NoteResult | null)[];
  recordedSamples: RecordedSample[];
  currentCentsHistory: { freq: number, isSliding: boolean }[];
  showResultOverlay: boolean;
  isSliding: boolean;
  detectedFreq: number;
  freeModeStats: {
    avgDev: number | null;
    stability: number | null;
    sampleCount: number;
    excludedSamples: number;
  };
}>({
  noteResults: [],
  recordedSamples: [],
  currentCentsHistory: [],
  showResultOverlay: false,
  isSliding: false,
  detectedFreq: -1,
  freeModeStats: {
    avgDev: null,
    stability: null,
    sampleCount: 0,
    excludedSamples: 0
  }
});

export function resetScore() {
  scoreState.noteResults = [];
  scoreState.recordedSamples = [];
  scoreState.currentCentsHistory = [];
  scoreState.isSliding = false;
  scoreState.freeModeStats = {
    avgDev: null,
    stability: null,
    sampleCount: 0,
    excludedSamples: 0
  };
}
