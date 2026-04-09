<script lang="ts">
  import { playerState, getTotalBeats, getOriginalBeats, getTotalDurationSeconds } from '$lib/stores/player.svelte';
  import { scoreState, resetScore } from '$lib/stores/score.svelte';
  import { audioState, playClick } from '$lib/stores/audio.svelte';
  import { midiToFreq, freqToCents, getGrade } from '$lib/utils/pitch';

  let beatInterval: any = null;

  function fmtTime(sec: number) {
    const isNeg = sec < 0;
    const absSec = Math.abs(sec);
    const m = Math.floor(absSec / 60);
    const s = Math.floor(absSec % 60);
    return `${isNeg ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
  }

  // Derived progress values
  let progressPct = $derived(
    getTotalBeats() ? (playerState.currentBeat / getTotalBeats()) * 100 : 0
  );
  let posSec = $derived(
    (playerState.currentBeat / playerState.song.bpm) * 60
  );

  function scheduleBeat() {
    if (!playerState.isPlaying && !playerState.isRecording) return;
    const secPerBeat = 60 / playerState.song.bpm;
    const totalBeats = getTotalBeats();
    const originalBeats = getOriginalBeats();

    function tick() {
      if (!playerState.isPlaying && !playerState.isRecording) return;
      if (playerState.currentBeat >= totalBeats) {
        if (playerState.isRecording) stopRecord();
        else pausePlay();
        return;
      }

      // 現在のループ番号を計算
      if (playerState.currentBeat >= 0 && originalBeats > 0) {
        playerState.currentLoop = Math.floor(playerState.currentBeat / originalBeats) + 1;
      }

      if (audioState.audioCtx) {
        if (playerState.currentBeat < 0) {
          playClick(playerState.currentBeat === -4);
        } else if (playerState.metronomeOn) {
          // リピート時は元のビート位置に対して小節頭を判定
          const beatInLoop = originalBeats > 0 ? playerState.currentBeat % originalBeats : playerState.currentBeat;
          const beatsPerMeasure = (playerState.song.timeSignature ?? [4, 4])[0];
          playClick(beatInLoop % beatsPerMeasure === 0);
        }
      }

      // リピート時のノートインデックス計算（元の曲内のビート位置で判定）
      const beatInLoop = originalBeats > 0 ? playerState.currentBeat % originalBeats : playerState.currentBeat;
      let targetNoteIdx = 0;
      for (let i = 0; i < playerState.song.notes.length; i++) {
        if (playerState.song.notes[i].beat <= beatInLoop) {
          targetNoteIdx = i;
        } else {
          break;
        }
      }

      const prevNoteIdx = playerState.currentNoteIdx;
      if (targetNoteIdx !== prevNoteIdx) {
        if (playerState.isRecording && scoreState.currentCentsHistory.length > 0) {
          scoreState.recordedSamples.push({
            noteIdx: prevNoteIdx,
            samples: [...scoreState.currentCentsHistory]
          });
          gradeNote(prevNoteIdx, scoreState.currentCentsHistory);
          scoreState.currentCentsHistory = [];
        }
        playerState.currentNoteIdx = targetNoteIdx;
      }

      playerState.currentBeat++;
      beatInterval = setTimeout(tick, secPerBeat * 1000);
    }
    tick();
  }

  function gradeNote(idx: number, centsHistory: number[]) {
    if (!centsHistory || centsHistory.length === 0) return;
    const note = playerState.song.notes[idx];
    const targetF = midiToFreq(note.midi);
    const centsArr = centsHistory.filter(f => f > 0).map(f => freqToCents(f, targetF) as number);
    if (centsArr.length === 0) {
      scoreState.noteResults[idx] = { grade: 'miss', avgCents: null };
      return;
    }
    const sorted = [...centsArr].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const grade = getGrade(Math.abs(median), playerState.tolerance);
    scoreState.noteResults[idx] = { grade, avgCents: median, rawCents: centsArr };
  }

  function runPostAnalysis() {
    for (let i = 0; i < scoreState.recordedSamples.length; i++) {
      const rs = scoreState.recordedSamples[i];
      const note = playerState.song.notes[rs.noteIdx];
      if (!note) continue;
      const targetF = midiToFreq(note.midi);
      const centsArr = rs.samples.filter(f => f > 0).map(f => freqToCents(f, targetF) as number);
      if (centsArr.length === 0) {
        scoreState.noteResults[rs.noteIdx] = { grade: 'miss', avgCents: null };
        continue;
      }
      const s = [...centsArr].sort((a, b) => a - b);
      const trim = Math.floor(s.length * 0.1);
      const trimmed = s.slice(trim, s.length - trim);
      const mean = trimmed.length ? trimmed.reduce((a, b) => a + b, 0) / trimmed.length : s[Math.floor(s.length / 2)];
      const grade = getGrade(Math.abs(mean), playerState.tolerance);
      scoreState.noteResults[rs.noteIdx] = { grade, avgCents: mean, rawCents: centsArr };
    }
  }

  function startPlay() {
    if (!audioState.audioCtx) return;
    playerState.isPlaying = true;
    playerState.status = 'play';
    scheduleBeat();
  }

  function pausePlay() {
    playerState.isPlaying = false;
    if (beatInterval) clearTimeout(beatInterval);
    playerState.status = 'idle';
  }

  export function stopAll() {
    playerState.isPlaying = false;
    playerState.isRecording = false;
    if (beatInterval) clearTimeout(beatInterval);
    playerState.currentNoteIdx = 0;
    playerState.currentBeat = -4;
    playerState.currentLoop = 1;
    playerState.status = 'idle';
  }

  function seekStart() {
    const wasPlaying = playerState.isPlaying;
    const wasRec = playerState.isRecording;
    stopAll();
    if (wasPlaying) startPlay();
    if (wasRec) startRecord();
  }

  function togglePlay() {
    if (playerState.isRecording) return;
    if (playerState.isPlaying) pausePlay();
    else startPlay();
  }

  function toggleRecord() {
    if (playerState.isRecording) stopRecord();
    else startRecord();
  }

  function startRecord() {
    if (!audioState.audioCtx) return;
    playerState.isRecording = true;
    playerState.isPlaying = true;
    playerState.currentNoteIdx = 0;
    playerState.currentBeat = -4;
    playerState.currentLoop = 1;
    resetScore();
    playerState.status = 'rec';
    scheduleBeat();
  }

  function stopRecord() {
    if (scoreState.currentCentsHistory.length > 0) {
      scoreState.recordedSamples.push({
        noteIdx: playerState.currentNoteIdx,
        samples: [...scoreState.currentCentsHistory]
      });
      scoreState.currentCentsHistory = [];
    }
    playerState.isRecording = false;
    playerState.isPlaying = false;
    if (beatInterval) clearTimeout(beatInterval);
    playerState.status = 'idle';
    runPostAnalysis();
    setTimeout(() => {
      scoreState.showResultOverlay = true;
    }, 500);
  }

  function seekBar(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const totalBeats = getTotalBeats();
    const originalBeats = getOriginalBeats();
    const targetBeat = Math.floor(pct * totalBeats);
    playerState.currentBeat = targetBeat;

    // リピート時のループ番号とループ内ビート位置を計算
    if (originalBeats > 0) {
      playerState.currentLoop = Math.floor(targetBeat / originalBeats) + 1;
      const beatInLoop = targetBeat % originalBeats;
      playerState.currentNoteIdx = 0;
      for (let i = 0; i < playerState.song.notes.length; i++) {
        if (playerState.song.notes[i].beat <= beatInLoop) {
          playerState.currentNoteIdx = i;
        } else {
          break;
        }
      }
    }
  }
</script>

<div class="transport">
  <button class="tbtn" title="先頭" onclick={seekStart}>⏮</button>
  <button class="tbtn" onclick={togglePlay}>{playerState.isPlaying && !playerState.isRecording ? '⏸' : '▶'}</button>
  <button class="tbtn rec {playerState.isRecording ? 'on' : ''}" onclick={toggleRecord}>⏺</button>
  <button class="tbtn" title="停止" onclick={stopAll}>⏹</button>

  <div class="prog-wrap">
    <div class="prog-lbls">
      <span>{fmtTime(posSec)}</span>
      <span>{fmtTime(getTotalDurationSeconds())}</span>
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="prog-track" onclick={seekBar}>
      <div id="progFill" style="width: {Math.min(100, Math.max(0, progressPct))}%"></div>
    </div>
  </div>

  <div class="tol-ctrl">
    TOL
    <input type="range" min="5" max="50" bind:value={playerState.tolerance} />
    <span>{playerState.tolerance}¢</span>
  </div>

  {#if playerState.status === 'play'}
    <div class="status-chip sc-play">PLAYING</div>
  {:else if playerState.status === 'rec'}
    <div class="status-chip sc-rec">REC ●</div>
  {:else}
    <div class="status-chip sc-idle">IDLE</div>
  {/if}

  <button class="btn-result {scoreState.noteResults.length > 0 ? 'has-result' : ''}" onclick={() => {
    if(scoreState.noteResults.length > 0) scoreState.showResultOverlay = true;
    else alert('まず録音してください。REC ボタンを押して演奏後、停止すると分析できます。');
  }}>RESULT</button>
</div>

<style>
.transport {
  grid-column: 1 / 3; grid-row: 2;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: rgba(10,12,15,0.97);
}
.tbtn {
  width: 40px; height: 40px; border-radius: 50%;
  border: 1px solid var(--border); background: var(--panel2);
  color: var(--text); font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s; flex-shrink: 0;
}
.tbtn:hover { border-color: var(--accent); color: var(--accent); }
.tbtn.rec { border-color: var(--danger); color: var(--danger); background: rgba(245,58,58,0.08); }
.tbtn.rec.on { background: var(--danger); color: white; box-shadow: 0 0 16px rgba(245,58,58,0.4); }
.tbtn.rec.on::after {
  content: ''; position: absolute; inset: -4px; border-radius: 50%;
  border: 2px solid var(--danger); animation: rp 1s ease-in-out infinite;
}
@keyframes rp { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:0;transform:scale(1.3)} }
.tbtn.rec { position: relative; }

.prog-wrap { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.prog-lbls { display: flex; justify-content: space-between; font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); }
.prog-track { height: 4px; background: var(--border); border-radius: 2px; cursor: pointer; position: relative; }
#progFill {
  height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, var(--accent2), var(--accent));
  position: relative; transition: width 0.1s linear;
}
#progFill::after { content:''; position:absolute; right:-5px; top:-3px; width:10px; height:10px; border-radius:50%; background:var(--accent); box-shadow:0 0 6px var(--accent); }

.tol-ctrl { display: flex; align-items: center; gap: 6px; font-family: 'Space Mono', monospace; font-size: 9px; color: var(--muted); white-space: nowrap; }
.tol-ctrl input[type=range] {
  -webkit-appearance: none; width: 70px; height: 3px;
  background: var(--border); border-radius: 2px; outline: none; cursor: pointer;
}
.tol-ctrl input::-webkit-slider-thumb {
  -webkit-appearance: none; width: 11px; height: 11px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 5px var(--accent);
}

.status-chip {
  font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 2px;
  padding: 5px 10px; border-radius: 20px; border: 1px solid; white-space: nowrap;
}
.sc-idle { border-color: var(--muted); color: var(--muted); }
.sc-play { border-color: var(--accent2); color: var(--accent2); background: rgba(58,245,160,0.06); }
.sc-rec  { border-color: var(--danger); color: var(--danger); background: rgba(245,58,58,0.06); }

.btn-result {
  background: transparent; border: 1px solid var(--border); color: var(--muted);
  padding: 0 14px; height: 40px; border-radius: 4px; font-family: 'Space Mono', monospace;
  font-size: 10px; letter-spacing: 2px; cursor: pointer; transition: all 0.2s; white-space: nowrap;
}
.btn-result:hover { border-color: var(--accent); color: var(--accent); }
.btn-result.has-result { border-color: var(--accent2); color: var(--accent2); background: rgba(58,245,160,0.06); }
</style>
