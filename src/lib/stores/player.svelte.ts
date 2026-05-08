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
let initialSongKey = 'c_major';
let initialBpm: number | null = null;
let initialRepeatCount = 1;
let initialTolerance = 20;

if (browser) {
  const saved = localStorage.getItem('imported_song');
  if (saved) {
    try {
      initialImported = JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load imported song", e);
    }
  }

  const savedKey = localStorage.getItem('player_song_key');
  if (savedKey) {
    if (savedKey === 'imported' && initialImported) {
      initialSongKey = 'imported';
    } else if (SONGS[savedKey]) {
      initialSongKey = savedKey;
    }
  } else if (initialImported) {
    initialSongKey = 'imported';
  }

  const savedBpm = localStorage.getItem('player_bpm');
  if (savedBpm) {
    const bpm = parseInt(savedBpm, 10);
    if (!isNaN(bpm) && bpm >= 10 && bpm <= 300) {
      initialBpm = bpm;
    }
  }

  const savedRepeat = localStorage.getItem('player_repeat');
  if (savedRepeat) {
    const repeat = parseInt(savedRepeat, 10);
    if (!isNaN(repeat) && repeat >= 1 && repeat <= 99) {
      initialRepeatCount = repeat;
    }
  }

  const savedTolerance = localStorage.getItem('player_tolerance');
  if (savedTolerance) {
    const tol = parseInt(savedTolerance, 10);
    if (!isNaN(tol) && tol >= 5 && tol <= 50) {
      initialTolerance = tol;
    }
  }
}

function calculateCountIn(song: Song) {
  return song.timeSignature?.[0] ?? 4;
}

const initialSong = (initialSongKey === 'imported' && initialImported ? initialImported : SONGS[initialSongKey]) as Song;
if (initialBpm) {
  initialSong.bpm = initialBpm;
}

export const playerState = $state<PlayerState>({
  currentSongKey: initialSongKey,
  song: initialSong,
  currentNoteIdx: 0,
  currentBeat: -calculateCountIn(initialSong),
  isPlaying: false,
  isRecording: false,
  tolerance: initialTolerance, // cents
  metronomeOn: false,
  status: 'idle',
  repeatCount: initialRepeatCount,
  currentLoop: 1,
  importedSong: initialImported,
  isFreeMode: false,
  playbackStartTimeMs: null,
  isDemoPlaying: false,
});

export function getCountInBeats() {
  return calculateCountIn(playerState.song);
}

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
  playerState.currentBeat = -getCountInBeats();
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
        const countIn = getCountInBeats();
        return (elapsedMs / (secPerBeat * 1000)) - countIn;
      }
    }
  }
  return playerState.currentBeat;
}
