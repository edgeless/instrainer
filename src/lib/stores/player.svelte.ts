import { SONGS, type Song } from '$lib/utils/songs';
import { browser } from '$app/environment';

interface PlayerState {
  currentSongKey: string;
  song: Song;
  currentNoteIdx: number;
  currentBeat: number;
  isPlaying: boolean;
  isRecording: boolean;
  tolerance: number;
  metronomeOn: boolean;
  status: 'idle' | 'play' | 'rec';
  repeatCount: number;
  currentLoop: number;
  importedSong: Song | null;
  isFreeMode: boolean;
  playbackStartTimeMs: number | null;
  isDemoPlaying: boolean;
}

// 初期化時に localStorage からインポート曲を読み込む
let initialImported: Song | null = null;
if (browser) {
  const saved = localStorage.getItem('imported_song');
  if (saved) {
    try {
      initialImported = JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load imported song", e);
    }
  }
}

export const playerState = $state<PlayerState>({
  currentSongKey: initialImported ? 'imported' : 'c_major',
  song: (initialImported || SONGS['c_major']) as Song,
  currentNoteIdx: 0,
  currentBeat: -4,
  isPlaying: false,
  isRecording: false,
  tolerance: 20, // cents
  metronomeOn: false,
  status: 'idle',
  repeatCount: 1,
  currentLoop: 1,
  importedSong: initialImported,
  isFreeMode: false,
  playbackStartTimeMs: null,
  isDemoPlaying: false,
});

export function setSong(arg: string | Song) {
  if (typeof arg === 'string') {
    if (SONGS[arg]) {
      playerState.currentSongKey = arg;
      playerState.song = SONGS[arg];
    } else if (arg === 'imported' && playerState.importedSong) {
      playerState.currentSongKey = 'imported';
      playerState.song = playerState.importedSong;
    }
  } else {
    // Song オブジェクトが直接渡された場合
    playerState.currentSongKey = 'imported';
    playerState.song = arg;
    playerState.importedSong = arg;
    if (browser) {
      localStorage.setItem('imported_song', JSON.stringify(arg));
    }
  }
  
  playerState.currentNoteIdx = 0;
  playerState.currentBeat = -4;
  playerState.currentLoop = 1;
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

/**
 * 現在の再生時間から表示用のビート位置を計算して返す。
 * 再生中でない場合は現在のビート位置を返す。
 *
 * 注意：この関数は呼び出し時点の `performance.now()` に基づくスナップショットを返すため、
 * Svelte の `$derived` や `$effect` でリアクティブな値として使用しないこと。
 * 毎フレーム更新が必要な場合は `requestAnimationFrame` ループ内で呼び出すこと。
 */
export function getDisplayBeat() {
  if (playerState.isPlaying || playerState.isRecording) {
    if (playerState.playbackStartTimeMs !== null) {
      const now = performance.now();
      const elapsedMs = now - playerState.playbackStartTimeMs;
      const secPerBeat = 60 / playerState.song.bpm;

      if (playerState.isFreeMode) {
        return elapsedMs / (secPerBeat * 1000);
      } else {
        // TODO: 4拍固定になっているため、4/4拍子以外(3/4等)では不整合が起きる。
        // 今後 playerState.song.timeSignature[0] を参照するよう修正が必要。
        return (elapsedMs / (secPerBeat * 1000)) - 4; // offset by 4 for count-in
      }
    }
  }
  return playerState.currentBeat;
}
