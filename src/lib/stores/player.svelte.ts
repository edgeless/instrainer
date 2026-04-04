import { SONGS, type Song } from '$lib/utils/songs';

export const playerState = $state({
  currentSongKey: 'c_major',
  song: SONGS['c_major'] as Song,
  currentNoteIdx: 0,
  currentBeat: 0,
  isPlaying: false,
  isRecording: false,
  tolerance: 20, // cents
  metronomeOn: false,
  status: 'idle' // 'idle' | 'play' | 'rec'
});

export function setSong(key: string) {
  if (SONGS[key]) {
    playerState.currentSongKey = key;
    playerState.song = SONGS[key];
    playerState.currentNoteIdx = 0;
    playerState.currentBeat = 0;
  }
}

export function getTotalBeats() {
  const notes = playerState.song.notes;
  if (!notes || notes.length === 0) return 0;
  const lastNote = notes[notes.length - 1];
  return lastNote.beat + lastNote.dur;
}

export function getTotalDurationSeconds() {
  const totalBeats = getTotalBeats();
  return (totalBeats / playerState.song.bpm) * 60;
}
