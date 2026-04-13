import type { Grade } from '$lib/utils/pitch';

export type NoteResult = {
  grade: Grade; // For backward compatibility/simplicity, this can be the combined grade or pitch grade
  combinedGrade?: Grade;
  pitchGrade?: Grade;
  timingGrade?: Grade;
  avgCents: number | null;
  timingDiffMs?: number | null;
  rawCents?: number[];
};

export type RecordedSample = {
  noteIdx: number;
  samples: { freq: number, isSliding: boolean, time: number }[];
};

export const scoreState = $state<{
  noteResults: (NoteResult | null)[];
  recordedSamples: RecordedSample[];
  currentCentsHistory: { freq: number, isSliding: boolean, time: number }[];
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
