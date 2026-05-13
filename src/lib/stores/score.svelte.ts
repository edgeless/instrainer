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
  loopIdx: number;
  samples: { freq: number, isSliding: boolean, time: number }[];
};

export const scoreState = $state<{
  noteResults: (NoteResult | null)[];
  recordedSamples: RecordedSample[];
  currentCentsHistory: { freq: number, isSliding: boolean, time: number }[];
  showResultOverlay: boolean;
  showHistoryOverlay: boolean;
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
  showHistoryOverlay: false,
  isSliding: false,
  detectedFreq: -1,
  freeModeStats: {
    avgDev: null,
    stability: null,
    sampleCount: 0,
    excludedSamples: 0
  }
});

export type ScorePercentages = {
  pitchPercent: number;
  timingPercent: number;
  overallPercent: number;
};

export function calculateScorePercentages(
  noteResults: (NoteResult | null)[],
  notesLength: number,
  tolerance: number
): ScorePercentages {
  if (notesLength === 0) return { pitchPercent: 0, timingPercent: 0, overallPercent: 0 };

  const maxPitchScore = notesLength * tolerance;
  const maxTimingScore = notesLength * 50;

  let totalPitchScore = 0;
  let totalTimingScore = 0;

  for (const r of noteResults) {
    if (r && r.pitchGrade !== 'miss' && r.avgCents !== null) {
      totalPitchScore += Math.max(0, tolerance - Math.abs(r.avgCents));
    }
    if (r && r.timingGrade !== 'miss' && r.timingDiffMs !== null && r.timingDiffMs !== undefined) {
      totalTimingScore += Math.max(0, 100 - Math.abs(r.timingDiffMs));
    }
  }

  const pitchPercent = maxPitchScore > 0 ? (totalPitchScore / maxPitchScore) * 100 : 0;
  const timingPercent = maxTimingScore > 0 ? (totalTimingScore / (notesLength * 100)) * 100 : 0;
  const overallPercent = (pitchPercent + timingPercent) / 2;

  return { pitchPercent, timingPercent, overallPercent };
}

export type ScoreHistoryEntry = {
  timestamp: number;
  overallPercent: number;
  pitchPercent: number;
  timingPercent: number;
};

export function saveScoreHistory(songKey: string, percentages: ScorePercentages) {
  if (typeof localStorage === 'undefined') return;
  const key = `score_history_${songKey}`;
  const existing = localStorage.getItem(key);
  let history: ScoreHistoryEntry[] = [];
  if (existing) {
    try {
      history = JSON.parse(existing);
    } catch (e) {
      console.error('Failed to parse score history', e);
    }
  }
  history.push({
    timestamp: Date.now(),
    overallPercent: percentages.overallPercent,
    pitchPercent: percentages.pitchPercent,
    timingPercent: percentages.timingPercent
  });
  localStorage.setItem(key, JSON.stringify(history));
}

export function loadScoreHistory(songKey: string): ScoreHistoryEntry[] {
  if (typeof localStorage === 'undefined') return [];
  const key = `score_history_${songKey}`;
  const existing = localStorage.getItem(key);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch (e) {
      console.error('Failed to parse score history', e);
    }
  }
  return [];
}

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
