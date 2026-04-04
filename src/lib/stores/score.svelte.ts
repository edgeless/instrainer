export type NoteResult = {
  grade: 'perfect' | 'good' | 'ok' | 'miss';
  avgCents: number | null;
  rawCents?: number[];
};

export type RecordedSample = {
  noteIdx: number;
  samples: number[];
};

export const scoreState = $state<{
  noteResults: (NoteResult | null)[];
  recordedSamples: RecordedSample[];
  currentCentsHistory: number[];
  showResultOverlay: boolean;
}>({
  noteResults: [],
  recordedSamples: [],
  currentCentsHistory: [],
  showResultOverlay: false
});

export function resetScore() {
  scoreState.noteResults = [];
  scoreState.recordedSamples = [];
  scoreState.currentCentsHistory = [];
}
