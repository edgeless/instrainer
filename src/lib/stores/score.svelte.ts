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
  freq: number;
  time: number;
  isSliding: boolean;
};

import { playerState } from '$lib/stores/player.svelte';

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
  pitchAccuracy: number;
  timingAccuracy: number;
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
  },
  get pitchAccuracy() {
    const totalNotes = playerState.song.notes.length;
    if (totalNotes === 0) return 0;
    const maxScore = totalNotes * 30;
    const totalScore = this.noteResults.reduce((sum, r) => {
      if (!r || r.avgCents === null) return sum;
      const g = r.pitchGrade || r.grade;
      if (g === 'perfect') return sum + 30;
      if (g === 'good') return sum + 20;
      if (g === 'ok') return sum + 10;
      return sum;
    }, 0);
    return totalScore / maxScore;
  },
  get timingAccuracy() {
    const totalNotes = playerState.song.notes.length;
    if (totalNotes === 0) return 0;
    const maxScore = totalNotes * 30;
    const totalScore = this.noteResults.reduce((sum, r) => {
      if (!r || r.timingDiffMs === null || r.timingDiffMs === undefined) return sum;
      const g = r.timingGrade || r.grade;
      if (g === 'perfect') return sum + 30;
      if (g === 'good') return sum + 20;
      if (g === 'ok') return sum + 10;
      return sum;
    }, 0);
    return totalScore / maxScore;
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
