import { SONGS, type Song } from '$lib/utils/songs';

export const playerState = $state({
  currentSongKey: 'c_major',
  song: SONGS['c_major'] as Song,
  currentNoteIdx: 0,
  currentBeat: -4,
  isPlaying: false,
  isRecording: false,
  tolerance: 20, // cents
  metronomeOn: false,
  status: 'idle' as 'idle' | 'play' | 'rec',
  repeatCount: 1,   // リピート回数（1 = 繰り返しなし）
  currentLoop: 1,   // 現在のループ番号（1始まり）
});

export function setSong(key: string) {
  if (SONGS[key]) {
    playerState.currentSongKey = key;
    playerState.song = SONGS[key];
    playerState.currentNoteIdx = 0;
    playerState.currentBeat = -4;
    playerState.currentLoop = 1;
  }
}

/** 1回分（リピートなし）の総ビート数 */
export function getOriginalBeats() {
  const notes = playerState.song.notes;
  if (!notes || notes.length === 0) return 0;
  const lastNote = notes[notes.length - 1];
  return lastNote.beat + lastNote.dur;
}

/** リピートを含む全体の総ビート数 */
export function getTotalBeats() {
  return getOriginalBeats() * playerState.repeatCount;
}

export function getTotalDurationSeconds() {
  const totalBeats = getTotalBeats();
  return (totalBeats / playerState.song.bpm) * 60;
}
