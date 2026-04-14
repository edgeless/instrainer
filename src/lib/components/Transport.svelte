<script lang="ts">
  import { onDestroy } from 'svelte';
  import { playerState, getTotalBeats, getOriginalBeats, getTotalDurationSeconds, getDisplayBeat } from '$lib/stores/player.svelte';
  import { scoreState, resetScore } from '$lib/stores/score.svelte';
  import { audioState, playClick, playDemoNote, stopDemoNotes } from '$lib/stores/audio.svelte';
  import { midiToFreq, freqToCents, freqToMidi, getGrade, getTimingGrade, getCombinedGrade } from '$lib/utils/pitch';

  let beatInterval: any = null;

  onDestroy(() => {
    // Note: audioState is a module-level singleton. Revoking the URL here
    // is safe for this SPA, but if routed out, setting it to null avoids
    // leaving a stale URL reference for other components.
    if (audioState.recordedAudioUrl) {
      URL.revokeObjectURL(audioState.recordedAudioUrl);
      audioState.recordedAudioUrl = null;
    }
  });

  let downloadFilename = $state('recording.webm');

  function fmtTime(sec: number) {
    const isNeg = sec < 0;
    const absSec = Math.abs(sec);
    const m = Math.floor(absSec / 60);
    const s = Math.floor(absSec % 60);
    return `${isNeg ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
  }


  // Display beat for continuous progress
  let displayBeat = $state(0);
  let animationFrameId: number;

  $effect(() => {
    if (playerState.isPlaying || playerState.isRecording) {
      function updateDisplay() {
        displayBeat = getDisplayBeat();
        animationFrameId = requestAnimationFrame(updateDisplay);
      }
      animationFrameId = requestAnimationFrame(updateDisplay);

      return () => {
        cancelAnimationFrame(animationFrameId);
      };
    } else {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      displayBeat = getDisplayBeat();
    }
  });

  // Derived progress values
  let progressPct = $derived(
    getTotalBeats() ? (displayBeat / getTotalBeats()) * 100 : 0
  );
  let posSec = $derived(
    playerState.isFreeMode
      ? (displayBeat < 0 ? 0 : (displayBeat / playerState.song.bpm) * 60) // フリーモード時も song.bpm に合わせる (tick と整合性を取る)
      : (displayBeat / playerState.song.bpm) * 60
  );

  function scheduleBeat() {
    if (!playerState.isPlaying && !playerState.isRecording) return;
    const secPerBeat = 60 / playerState.song.bpm;
    const totalBeats = getTotalBeats();
    const originalBeats = getOriginalBeats();

    function tick() {
      if (!playerState.isPlaying && !playerState.isRecording) return;
      if (!playerState.isFreeMode && playerState.currentBeat >= totalBeats) {
        if (playerState.isRecording) stopRecord().catch(e => console.error("Error stopping record:", e));
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
      let targetNoteIdx = playerState.currentNoteIdx;

      // インデックスが範囲外、またはビートが現在のノートより前の場合は最初から（シークやループ時、曲の変更時）
      if (targetNoteIdx >= playerState.song.notes.length || playerState.song.notes[targetNoteIdx]?.beat > beatInLoop) {
        targetNoteIdx = 0;
      }
      // ビートが進んでいる間、インデックスを進める
      while (
        targetNoteIdx + 1 < playerState.song.notes.length &&
        playerState.song.notes[targetNoteIdx + 1].beat <= beatInLoop
      ) {
        targetNoteIdx++;
      }

      const isFree = playerState.isFreeMode;
      const prevNoteIdx = playerState.currentNoteIdx;
      if (!isFree && targetNoteIdx !== prevNoteIdx) {
        if (playerState.isRecording && scoreState.currentCentsHistory.length > 0) {
          scoreState.recordedSamples.push({
            noteIdx: prevNoteIdx,
            loopIdx: playerState.currentLoop,
            samples: [...scoreState.currentCentsHistory]
          });
          gradeNote(prevNoteIdx, [...scoreState.currentCentsHistory]);
          scoreState.currentCentsHistory = [];
        }
        playerState.currentNoteIdx = targetNoteIdx;
      }

      // Play demo note if needed
      if (playerState.isDemoPlaying && !isFree && playerState.currentBeat >= 0) {
        // 次の tick までの間に鳴る音符をすべて拾う（小数ビート対応）
        let checkIdx = playerState.currentNoteIdx;
        while (checkIdx < playerState.song.notes.length) {
          const note = playerState.song.notes[checkIdx];
          if (note.beat >= beatInLoop + 1) break; // 次のビート以降なら終了

          if (note.beat >= beatInLoop) {
            const durationSec = note.dur * (60 / playerState.song.bpm);
            const delaySec = (note.beat - beatInLoop) * (60 / playerState.song.bpm);
            playDemoNote(note.midi, durationSec, delaySec);
          }
          checkIdx++;
        }
      }

      playerState.currentBeat++;

      // Calculate absolute time for next beat to prevent timing drift
      if (playerState.playbackStartTimeMs !== null) {
        let expectedNextBeatTimeMs;
        if (playerState.isFreeMode) {
          expectedNextBeatTimeMs = playerState.playbackStartTimeMs + (playerState.currentBeat * secPerBeat * 1000);
        } else {
          expectedNextBeatTimeMs = playerState.playbackStartTimeMs + ((playerState.currentBeat + 4) * secPerBeat * 1000);
        }

        const now = performance.now();
        const delayMs = Math.max(0, expectedNextBeatTimeMs - now);
        beatInterval = setTimeout(tick, delayMs);
      } else {
        beatInterval = setTimeout(tick, secPerBeat * 1000);
      }
    }
    tick();
  }

  function gradeNote(idx: number, centsHistory: { freq: number, isSliding: boolean, time: number }[]) {
    if (!centsHistory || centsHistory.length === 0) return;
    const note = playerState.song.notes[idx];
    const targetF = midiToFreq(note.midi);

    let validSamples = centsHistory.filter(h => h.freq > 0 && !h.isSliding);
    const totalCount = centsHistory.filter(h => h.freq > 0).length;

    if (validSamples.length === 0 && totalCount > 0) {
      console.warn(`[Analysis] Note ${idx} (${note.name}): All samples were marked as sliding. Falling back to all samples.`);
      validSamples = centsHistory.filter(h => h.freq > 0);
    }

    const centsArr = validSamples.map(h => freqToCents(h.freq, targetF) as number);
    console.log(`[Analysis] Note ${idx}: total=${totalCount}, valid=${validSamples.length}, excluded=${totalCount - validSamples.length}`);

    if (centsArr.length === 0) {
      scoreState.noteResults[idx] = { grade: 'miss', combinedGrade: 'miss', pitchGrade: 'miss', timingGrade: 'miss', avgCents: null, timingDiffMs: null };
      return;
    }
    const sorted = [...centsArr].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const pitchGrade = getGrade(Math.abs(median), playerState.tolerance);

    let timingGrade: 'miss' | 'ok' | 'good' | 'perfect' = 'miss';
    let timingDiffMs: number | null = null;

    if (playerState.playbackStartTimeMs !== null && validSamples.length > 0) {
      const firstSampleTime = validSamples[0].time;
      const originalBeats = getOriginalBeats();
      const currentLoopOffset = (playerState.currentLoop - 1) * originalBeats;
      const expectedNoteTimeMs = playerState.playbackStartTimeMs + ((note.beat + currentLoopOffset) * (60 / playerState.song.bpm) * 1000);

      timingDiffMs = firstSampleTime - expectedNoteTimeMs;
      timingGrade = getTimingGrade(Math.abs(timingDiffMs));
    }

    const combinedGrade = getCombinedGrade(pitchGrade, timingGrade);

    scoreState.noteResults[idx] = { grade: combinedGrade, combinedGrade, pitchGrade, timingGrade, avgCents: median, timingDiffMs, rawCents: centsArr };
  }

  function finalizeFreeModeSession() {
    const history = scoreState.currentCentsHistory;
    if (history.length === 0) return;

    let validHistory = history.filter(h => h.freq > 0 && !h.isSliding);
    const totalHistory = history.filter(h => h.freq > 0);

    if (validHistory.length === 0 && totalHistory.length > 0) {
      console.warn("[Free] All samples were marked as sliding. Falling back to all samples.");
      validHistory = totalHistory;
    }

    const excludedCount = history.filter(h => h.freq > 0).length - validHistory.length;
    console.log(`[Free] Finalizing: total=${totalHistory.length}, valid=${validHistory.length}, excluded=${excludedCount}`);

    const allCents = validHistory.map(h => {
      const targetF = midiToFreq(freqToMidi(h.freq));
      return freqToCents(h.freq, targetF);
    }).filter(c => c !== null) as number[];

    if (allCents.length === 0) {
      scoreState.freeModeStats = {
        avgDev: null,
        stability: null,
        sampleCount: 0,
        excludedSamples: excludedCount
      };
      return;
    }

    const avg = allCents.reduce((a, b) => a + b, 0) / allCents.length;
    let inToleranceCount = 0;

    allCents.forEach(c => {
      if (Math.abs(c) <= playerState.tolerance) {
        inToleranceCount++;
      }
    });

    scoreState.freeModeStats = {
      avgDev: avg,
      stability: inToleranceCount / allCents.length,
      sampleCount: allCents.length,
      excludedSamples: excludedCount
    };
  }

  function runPostAnalysis() {
    console.log(`[Analysis] Running post-analysis for ${scoreState.recordedSamples.length} notes`);
    for (let i = 0; i < scoreState.recordedSamples.length; i++) {
      const rs = scoreState.recordedSamples[i];
      const note = playerState.song.notes[rs.noteIdx];
      if (!note) continue;
      const targetF = midiToFreq(note.midi);

      const samples = rs.samples as { freq: number, isSliding: boolean, time: number }[];
      let validSamples = samples.filter(h => h.freq > 0 && !h.isSliding);
      const totalCount = samples.filter(h => h.freq > 0).length;

      if (validSamples.length === 0 && totalCount > 0) {
        console.warn(`[Analysis] Post: Note ${rs.noteIdx} (${note.name}) has 0 valid samples. Falling back.`);
        validSamples = samples.filter(h => h.freq > 0);
      }

      const centsArr = validSamples.map(h => freqToCents(h.freq, targetF) as number);

      if (centsArr.length === 0) {
        scoreState.noteResults[rs.noteIdx] = { grade: 'miss', combinedGrade: 'miss', pitchGrade: 'miss', timingGrade: 'miss', avgCents: null, timingDiffMs: null };
        continue;
      }
      const s = [...centsArr].sort((a, b) => a - b);
      const trim = Math.floor(s.length * 0.1);
      const trimmed = s.slice(trim, s.length - trim);
      const mean = trimmed.length ? trimmed.reduce((a, b) => a + b, 0) / trimmed.length : s[Math.floor(s.length / 2)];
      const pitchGrade = getGrade(Math.abs(mean), playerState.tolerance);

      let timingGrade: 'miss' | 'ok' | 'good' | 'perfect' = 'miss';
      let timingDiffMs: number | null = null;

      if (playerState.playbackStartTimeMs !== null && validSamples.length > 0) {
        const firstSampleTime = validSamples[0].time;
        // In post analysis, calculate expected time
        const originalBeats = getOriginalBeats();
        const loopOffset = (rs.loopIdx - 1) * originalBeats;
        const expectedNoteTimeMs = playerState.playbackStartTimeMs + ((note.beat + loopOffset) * (60 / playerState.song.bpm) * 1000);
        timingDiffMs = firstSampleTime - expectedNoteTimeMs;
        timingGrade = getTimingGrade(Math.abs(timingDiffMs));
      }

      const combinedGrade = getCombinedGrade(pitchGrade, timingGrade);

      scoreState.noteResults[rs.noteIdx] = { grade: combinedGrade, combinedGrade, pitchGrade, timingGrade, avgCents: mean, timingDiffMs, rawCents: centsArr };
    }
  }

  let playbackAudio: HTMLAudioElementWithSink | null = null;
  let playbackAudioSource: MediaElementAudioSourceNode | null = null;
  let lastLoadedAudioUrl: string | null = null;

  function cleanupPlaybackAudio() {
    if (playbackAudio) {
      playbackAudio.pause();
      playbackAudio.removeAttribute('src');
      playbackAudio.load();
      playbackAudio = null;
    }
    if (playbackAudioSource) {
      playbackAudioSource.disconnect();
      playbackAudioSource = null;
    }
  }

  function startPlay() {
    if (!audioState.audioCtx) return;
    playerState.isPlaying = true;
    playerState.status = 'play';

    // Set playbackStartTimeMs based on currentBeat
    // Note: In startPlay, this value represents the theoretical start time of the song
    // calculated backwards from the current position. This is primarily used to drive
    // the continuous displayBeat animation. This differs slightly from startRecord
    // where it strictly anchors the expected timing for grading.
    const secPerBeat = 60 / playerState.song.bpm;
    if (playerState.isFreeMode) {
      playerState.playbackStartTimeMs = performance.now() - (playerState.currentBeat * secPerBeat * 1000);
    } else {
      playerState.playbackStartTimeMs = performance.now() - ((playerState.currentBeat + 4) * secPerBeat * 1000);
    }

    if (audioState.recordedAudioUrl) {
      if (!playbackAudio) {
        playbackAudio = new Audio(audioState.recordedAudioUrl) as HTMLAudioElementWithSink;
        lastLoadedAudioUrl = audioState.recordedAudioUrl;
        // 出力デバイスのルーティングのためにWeb Audio APIに接続
        playbackAudioSource = audioState.audioCtx.createMediaElementSource(playbackAudio);
        playbackAudioSource.connect(audioState.audioCtx.destination);
      } else if (lastLoadedAudioUrl !== audioState.recordedAudioUrl) {
        playbackAudio.src = audioState.recordedAudioUrl;
        lastLoadedAudioUrl = audioState.recordedAudioUrl;
      }

      if (typeof playbackAudio.setSinkId === 'function' && audioState.selectedOutputId) {
         playbackAudio.setSinkId(audioState.selectedOutputId).catch(() => {});
      }

      // 再生位置を現在のビートの経過時間に合わせる
      const offsetSeconds = Math.max(0, playerState.currentBeat * secPerBeat);
      playbackAudio.currentTime = offsetSeconds;

      // カウントイン中 (-4 〜 -1 ビート) の場合は遅延させて再生する
      if (playerState.currentBeat < 0) {
        const delaySeconds = Math.abs(playerState.currentBeat) * secPerBeat;
        setTimeout(() => {
          if (playerState.isPlaying && playbackAudio) {
            playbackAudio.currentTime = 0;
            playbackAudio.play().catch(e => console.warn("Audio play failed:", e));
          }
        }, delaySeconds * 1000);
      } else {
        playbackAudio.play().catch(e => console.warn("Audio play failed:", e));
      }
    }

    scheduleBeat();
  }

  function pausePlay() {
    playerState.isPlaying = false;
    if (beatInterval) clearTimeout(beatInterval);
    playerState.status = 'idle';
    stopDemoNotes();
    if (playbackAudio) {
      playbackAudio.pause();
    }
  }

  export function stopAll() {
    playerState.isPlaying = false;
    playerState.isRecording = false;
    playerState.isDemoPlaying = false;
    if (beatInterval) clearTimeout(beatInterval);
    stopDemoNotes();
    playerState.currentNoteIdx = 0;
    playerState.currentBeat = -4;
    playerState.currentLoop = 1;
    playerState.status = 'idle';
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    cleanupPlaybackAudio();
  }

  function seekStart() {
    const wasPlaying = playerState.isPlaying;
    const wasRec = playerState.isRecording;
    stopAll();
    if (wasPlaying) startPlay();
    if (wasRec) startRecord();
  }

  function togglePlay() {
    if (playerState.isRecording || playerState.isDemoPlaying) return;
    if (playerState.isPlaying) pausePlay();
    else startPlay();
  }

  export function toggleDemoPlay() {
    if (playerState.isRecording || (playerState.isPlaying && !playerState.isDemoPlaying)) return;
    if (playerState.isDemoPlaying) {
      playerState.isDemoPlaying = false;
      pausePlay();
    } else {
      playerState.isDemoPlaying = true;
      startPlay();
    }
  }

  async function toggleRecord() {
    if (playerState.isDemoPlaying) return;
    if (playerState.isRecording) {
      try {
        await stopRecord();
      } catch (e) {
        console.error("Error stopping record:", e);
      }
    } else {
      startRecord();
    }
  }

  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: BlobPart[] = [];
  let recordStopPromise: Promise<void> | null = null;
  let recordStopResolver: (() => void) | null = null;

  function startRecord() {
    if (!audioState.audioCtx) return;
    cleanupPlaybackAudio();
    playerState.isRecording = true;
    playerState.isPlaying = true;
    playerState.currentNoteIdx = 0;
    resetScore();
    playerState.status = 'rec';

    // 音声の録音設定
    if (audioState.micStream) {
      // 以前の録音URLがあれば破棄
      if (audioState.recordedAudioUrl) {
        URL.revokeObjectURL(audioState.recordedAudioUrl);
        audioState.recordedAudioUrl = null;
      }
      recordedChunks = [];
      try {
        mediaRecorder = new MediaRecorder(audioState.micStream);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunks.push(e.data);
        };
        recordStopPromise = new Promise((resolve) => {
          recordStopResolver = resolve;
        });
        mediaRecorder.onstop = () => {
          const mimeType = mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(recordedChunks, { type: mimeType });
          audioState.recordedAudioUrl = URL.createObjectURL(blob);

          let ext = 'webm';
          if (mimeType.includes('mp4')) ext = 'mp4';
          else if (mimeType.includes('ogg')) ext = 'ogg';

          downloadFilename = `Fretless_Practice_${playerState.song.name}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;

          if (recordStopResolver) {
            recordStopResolver();
            recordStopResolver = null;
          }
        };
        mediaRecorder.start();
      } catch (e) {
        console.warn("MediaRecorder start failed:", e);
      }
    }

    const secPerBeat = 60 / playerState.song.bpm;

    if (playerState.isFreeMode) {
      playerState.currentBeat = 0; // フリーモードは即時開始
      playerState.playbackStartTimeMs = performance.now();
    } else {
      playerState.currentBeat = -4;
      playerState.playbackStartTimeMs = performance.now() + (4 * secPerBeat * 1000);
    }
    scheduleBeat();
  }

  async function stopRecord() {
    let waitPromise = null;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      waitPromise = recordStopPromise;
      mediaRecorder.stop();
    }

    if (waitPromise) {
      await waitPromise;
    }

    if (playerState.isFreeMode) {
      finalizeFreeModeSession();
      scoreState.currentCentsHistory = [];
    } else if (scoreState.currentCentsHistory.length > 0) {
      scoreState.recordedSamples.push({
        noteIdx: playerState.currentNoteIdx,
        loopIdx: playerState.currentLoop,
        samples: [...scoreState.currentCentsHistory]
      });
      scoreState.currentCentsHistory = [];
    }
    playerState.isRecording = false;
    playerState.isPlaying = false;
    if (beatInterval) clearTimeout(beatInterval);
    playerState.status = 'idle';
    if (!playerState.isFreeMode) runPostAnalysis();

    // UI state change might need a tick, but audio blob is ready
    if (!playerState.isFreeMode) {
      scoreState.showResultOverlay = true;
    }
  }

  function seekBar(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const totalBeats = getTotalBeats();
    const originalBeats = getOriginalBeats();
    const targetBeat = Math.floor(pct * totalBeats);
    playerState.currentBeat = targetBeat;

    // Update playbackStartTimeMs if we are playing or recording
    if (playerState.isPlaying || playerState.isRecording) {
      const secPerBeat = 60 / playerState.song.bpm;
      if (playerState.isFreeMode) {
        playerState.playbackStartTimeMs = performance.now() - (targetBeat * secPerBeat * 1000);
      } else {
        playerState.playbackStartTimeMs = performance.now() - ((targetBeat + 4) * secPerBeat * 1000);
      }
    }

    // リピート時のループ番号とループ内ビート位置を計算
    if (originalBeats > 0) {
      playerState.currentLoop = Math.floor(targetBeat / originalBeats) + 1;
      const beatInLoop = targetBeat % originalBeats;
      let targetNoteIdx = 0;
      while (
        targetNoteIdx + 1 < playerState.song.notes.length &&
        playerState.song.notes[targetNoteIdx + 1].beat <= beatInLoop
      ) {
        targetNoteIdx++;
      }
      playerState.currentNoteIdx = targetNoteIdx;
    }
  }
</script>

<div class="transport">
  <button class="tbtn" title="先頭に戻る" onclick={seekStart}>⏮</button>
  <button class="tbtn with-text" title="再生 (評価なしの練習モード)" onclick={togglePlay} disabled={playerState.isDemoPlaying}>
    <span class="icon">{playerState.isPlaying && !playerState.isRecording ? '⏸' : '▶'}</span>
    <span class="lbl">{playerState.isPlaying && !playerState.isRecording ? '一時停止' : '再生'}</span>
  </button>
  <button class="tbtn rec with-text {playerState.isRecording ? 'on' : ''}" title="録音 (採点・記録モード)" onclick={toggleRecord} disabled={playerState.isDemoPlaying}>
    <span class="icon">⏺</span>
    <span class="lbl">録音</span>
  </button>
  <button class="tbtn" title="停止" onclick={stopAll}>⏹</button>

  {#if audioState.recordedAudioUrl}
    <a href={audioState.recordedAudioUrl} download={downloadFilename} class="tbtn dl-btn" title="録音データをダウンロード">⬇</a>
  {/if}

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
    <div class="status-chip sc-play">再生中</div>
  {:else if playerState.status === 'rec'}
    <div class="status-chip sc-rec">録音中 ●</div>
  {:else}
    <div class="status-chip sc-idle">待機中</div>
  {/if}

  <button class="btn-result {(playerState.isFreeMode ? scoreState.freeModeStats.sampleCount > 0 : scoreState.noteResults.length > 0) ? 'has-result' : ''}" onclick={() => {
    if (playerState.isFreeMode ? scoreState.freeModeStats.sampleCount > 0 : scoreState.noteResults.length > 0) {
      scoreState.showResultOverlay = true;
    } else {
      alert('まず録音してください。REC ボタンを押して演奏後、停止すると分析できます。');
    }
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
  width: 40px; height: 40px; border-radius: 20px;
  border: 1px solid var(--border); background: var(--panel2);
  color: var(--text); font-size: 14px;
  display: flex; align-items: center; justify-content: center; gap: 4px;
  cursor: pointer; transition: all 0.2s; flex-shrink: 0;
  text-decoration: none;
}
.tbtn.with-text {
  width: auto;
  padding: 0 14px 0 10px;
}
.tbtn .lbl {
  font-size: 11px; font-weight: bold;
}
.tbtn:hover { border-color: var(--accent); color: var(--accent); }
.dl-btn { border-color: var(--accent2); color: var(--accent2); background: rgba(58,245,160,0.06); }
.dl-btn:hover { background: var(--accent2); color: var(--bg); }
.tbtn.rec { border-color: var(--danger); color: var(--danger); background: rgba(245,58,58,0.08); }
.tbtn.rec.on { background: var(--danger); color: white; box-shadow: 0 0 16px rgba(245,58,58,0.4); }
.tbtn.rec.on::after {
  content: ''; position: absolute; inset: -4px; border-radius: inherit;
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
  position: relative;
}
#progFill::after { content:''; position:absolute; right:-5px; top:-3px; width:10px; height:10px; border-radius:50%; background:var(--accent); box-shadow:0 0 6px var(--accent); }

.tol-ctrl { display: flex; align-items: center; gap: 6px; font-family: 'Space Mono', monospace; font-size: 9px; color: var(--muted); white-space: nowrap; }
.tol-ctrl input[type=range] {
  -webkit-appearance: none; appearance: none; width: 70px; height: 3px;
  background: var(--border); border-radius: 2px; outline: none; cursor: pointer;
}
.tol-ctrl input::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 11px; height: 11px; border-radius: 50%;
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
