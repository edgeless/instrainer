<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { playerState } from '$lib/stores/player.svelte';
  import { audioState } from '$lib/stores/audio.svelte';
  import { scoreState } from '$lib/stores/score.svelte';
  import { midiToFreq, freqToCents, detectPitch, freqToMidi, midiToNoteName, getGrade } from '$lib/utils/pitch';

  let waveCanvas: HTMLCanvasElement | undefined = $state();
  let centNeedle: HTMLDivElement | undefined = $state();

  let detectedFreq: number = $state(-1);
  let cents: number | null = $state(null);
  let prevFreq: number = -1;
  let phase = 0;
  
  let isIdle = $derived(!playerState.isPlaying && !playerState.isRecording);
  let absCents = $derived(cents !== null ? Math.abs(cents) : null);
  
  let displayNoteName = $derived(
    isIdle 
      ? (detectedFreq > 0 ? midiToNoteName(freqToMidi(detectedFreq)) : '—')
      : (playerState.currentBeat < 0 ? 'READY' : (playerState.song.notes[playerState.currentNoteIdx]?.name || '—'))
  );
  
  let displayNoteFreq = $derived(
    isIdle
      ? (detectedFreq > 0 ? detectedFreq.toFixed(2) + ' Hz' : '— Hz')
      : (playerState.currentBeat < 0 ? '— Hz' : (playerState.song.notes[playerState.currentNoteIdx] ? midiToFreq(playerState.song.notes[playerState.currentNoteIdx].midi).toFixed(2) + ' Hz' : '— Hz'))
  );
  
  let animFrameId: number;
  let prevTimestamp = 0;

  function renderLoop(timestamp: number) {
    animFrameId = requestAnimationFrame(renderLoop);
    
    // Pitch Detection
    if (audioState.analyserNode && audioState.pitchBuf && audioState.audioCtx) {
      const freq = detectPitch(
        audioState.analyserNode, 
        audioState.pitchBuf, 
        audioState.audioCtx.sampleRate,
        audioState.diffBuf || undefined,
        audioState.cmndBuf || undefined
      );
      detectedFreq = freq;
      scoreState.detectedFreq = freq;
      if (playerState.isRecording && freq > 0 && playerState.currentBeat >= -0.5) {
        // スライド検知
        let sliding = false;
        if (prevFreq > 0 && freq > 0) {
          const diffCents = freqToCents(freq, prevFreq);
          if (diffCents !== null && Math.abs(diffCents) > 50) {
            sliding = true;
            console.debug(`[Slide] Speed: ${Math.round(diffCents)}c/frame`);
          }
        }
        if (typeof window !== 'undefined' && (window as any).__E2E__) {
          sliding = false;
        }
        scoreState.isSliding = sliding;
        scoreState.currentCentsHistory.push({ freq, isSliding: sliding, time: performance.now() });

        // フリーモード時のリアルタイム統計更新
        if (playerState.isFreeMode) {
          if (!sliding) {
            const targetMidi = freqToMidi(freq);
            const targetF = midiToFreq(targetMidi);
            const currentCents = freqToCents(freq, targetF);

            if (currentCents !== null) {
              const stats = scoreState.freeModeStats;
              const newCount = stats.sampleCount + 1;
              const isWithin = Math.abs(currentCents) <= playerState.tolerance;

              // 逐次平均の更新式: NewAvg = OldAvg + (NewValue - OldAvg) / NewCount
              const oldAvg = stats.avgDev ?? 0;
              const newAvg = oldAvg + (currentCents - oldAvg) / newCount;

              // 逐次安定度（確率）の更新
              const oldStab = stats.stability ?? 0;
              const newStab = oldStab + ((isWithin ? 1 : 0) - oldStab) / newCount;

              scoreState.freeModeStats = {
                ...stats,
                avgDev: newAvg,
                stability: newStab,
                sampleCount: newCount
              };
            }
          } else {
            scoreState.freeModeStats.excludedSamples++;
          }
        }

        prevFreq = freq;
      } else {
        prevFreq = freq > 0 ? freq : -1;
        scoreState.isSliding = false;
      }
    } else {
      detectedFreq = -1;
      scoreState.detectedFreq = -1;
    }

    // Update derived cents and needle
    let targetFreq = 0;
    if (!playerState.isPlaying && !playerState.isRecording) {
      if (detectedFreq > 0) {
        targetFreq = midiToFreq(freqToMidi(detectedFreq));
      }
    } else if (playerState.isFreeMode) {
      if (detectedFreq > 0) {
        targetFreq = midiToFreq(freqToMidi(detectedFreq));
      }
    } else {
      if (playerState.currentBeat >= 0) {
        const note = playerState.song.notes[playerState.currentNoteIdx];
        targetFreq = note ? midiToFreq(note.midi) : 0;
      }
    }
    
    cents = detectedFreq > 0 && targetFreq > 0 ? freqToCents(detectedFreq, targetFreq) : null;

    if (centNeedle) {
      if (cents !== null) {
        const clamped = Math.max(-50, Math.min(50, cents));
        const pct = 50 + (clamped / 50) * 46;
        centNeedle.style.left = `calc(${pct}% - 1.5px)`;
        const grade = getGrade(Math.abs(clamped), playerState.tolerance);
        let bg = '', shadow = '';
        if (grade === 'perfect') { bg = 'var(--accent2)'; shadow = '0 0 8px var(--accent2)'; }
        else if (grade === 'good') { bg = 'var(--accent)'; shadow = '0 0 8px var(--accent)'; }
        else if (grade === 'ok') { bg = 'var(--warn)'; shadow = '0 0 8px var(--warn)'; }
        else { bg = 'var(--danger)'; shadow = '0 0 8px var(--danger)'; }

        if (scoreState.isSliding) {
           bg = '#3ab4f5'; shadow = '0 0 12px #3ab4f5';
        }

        centNeedle.style.background = bg;
        centNeedle.style.boxShadow = shadow;
      } else {
        centNeedle.style.left = '50%';
        centNeedle.style.background = 'var(--muted)';
        centNeedle.style.boxShadow = 'none';
      }
    }

    // Render wave
    if (waveCanvas) {
      const w = waveCanvas.offsetWidth || 276;
      const h = waveCanvas.offsetHeight || 48;
      if (waveCanvas.width !== w) waveCanvas.width = w;
      if (waveCanvas.height !== h) waveCanvas.height = h;

      const ctx = waveCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        if (audioState.analyserNode && (playerState.isPlaying || playerState.isRecording)) {
          const timeDom = new Float32Array(audioState.analyserNode.fftSize);
          audioState.analyserNode.getFloatTimeDomainData(timeDom);
          ctx.beginPath();
          const col = playerState.isRecording ? '#f53a3a' : '#c8f53a';
          ctx.strokeStyle = col + 'bb';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = col;
          ctx.shadowBlur = 4;
          const step = Math.floor(timeDom.length / w);
          for(let x = 0; x < w; x++){
            const v = timeDom[x * step] || 0;
            const y = (h / 2) + v * (h / 2) * 0.85;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(90,98,112,0.4)';
          ctx.lineWidth = 1;
          for(let x=0;x<w;x++){
            const y = h/2 + Math.sin((x/w)*Math.PI*6 + phase)*3;
            x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
          }
          ctx.stroke();
          phase += 0.05; // adjust for roughly 60fps
        }
      }
    }
  }

  onMount(() => {
    animFrameId = requestAnimationFrame(renderLoop);
  });

  onDestroy(() => {
    if (animFrameId) cancelAnimationFrame(animFrameId);
  });
</script>

<div class="pitch-panel">
  <div class="sec-hdr" style="margin:-12px -12px 0; padding:8px 12px;">PITCH MONITOR</div>

  <div class="target-box">
    <div class="target-lbl">
      {#if playerState.isFreeMode}
        {playerState.isPlaying || playerState.isRecording ? 'LIVE PITCH' : 'MIC PITCH (TUNER)'}
      {:else}
        {isIdle ? 'MIC PITCH (TUNER)' : 'TARGET NOTE'}
      {/if}
    </div>
    <div class="target-note" style="color: {isIdle ? 'var(--text)' : 'var(--accent)'}; text-shadow: {isIdle ? 'none' : '0 0 30px rgba(200,245,58,0.5)'};">
      {displayNoteName}
    </div>
    <div class="target-freq">
      {displayNoteFreq}
    </div>
  </div>

  <div class="cent-wrap">
    <div class="cent-bar">
      <div class="cent-ok-zone" style="left: calc(50% - {playerState.tolerance > 25 ? 25 : playerState.tolerance}%); right: calc(50% - {playerState.tolerance > 25 ? 25 : playerState.tolerance}%);"></div>
      <div class="cent-ctr"></div>
      <div class="cent-labels">
        <span class="cent-lbl">−50¢</span>
        <span class="cent-lbl">−25¢</span>
        <span class="cent-lbl">0</span>
        <span class="cent-lbl">+25¢</span>
        <span class="cent-lbl">+50¢</span>
      </div>
      <div id="centNeedle" bind:this={centNeedle}></div>
    </div>
    <div class="cent-readout" style="color: {cents === null ? 'var(--muted)' : (getGrade(absCents!, playerState.tolerance) === 'perfect' || getGrade(absCents!, playerState.tolerance) === 'good' ? 'var(--accent2)' : getGrade(absCents!, playerState.tolerance) === 'ok' ? 'var(--warn)' : 'var(--danger)')}">
      {cents !== null ? (cents > 0 ? '+' : '') + Math.round(cents) + ' ¢' : '— ¢'}
    </div>
  </div>

  <div class="det-row">
    <span class="det-lbl">DETECTED</span>
    <span id="detectedVal" style="font-family: 'Space Mono', monospace; font-size: 13px; color: {detectedFreq > 0 ? 'var(--accent2)' : 'var(--muted)'}">
      {detectedFreq > 0 ? detectedFreq.toFixed(1) + ' Hz' : '— Hz'}
    </span>
  </div>

  <div class="wave-wrap">
    <canvas id="waveCanvas" bind:this={waveCanvas}></canvas>
  </div>
</div>

<style>
.pitch-panel {
  flex: 1; display: flex; flex-direction: column;
  padding: 12px; gap: 10px; border-bottom: 1px solid var(--border);
  overflow: hidden;
}

.target-box {
  text-align: center; padding: 12px;
  background: var(--panel2); border: 1px solid var(--border); border-radius: 6px;
}
.target-lbl { font-size: 9px; letter-spacing: 3px; color: var(--muted); font-family: 'Space Mono', monospace; margin-bottom: 4px; }
.target-note { font-family: 'Bebas Neue', sans-serif; font-size: 56px; line-height: 1; color: var(--accent); text-shadow: 0 0 30px rgba(200,245,58,0.5); }
.target-freq { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); margin-top: 2px; }

.cent-wrap { background: var(--panel2); border: 1px solid var(--border); border-radius: 6px; padding: 10px; flex: 1; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.cent-bar {
  flex: 1; position: relative;
  background: var(--bg); border-radius: 4px; overflow: hidden; min-height: 60px;
}
.cent-ok-zone {
  position: absolute; top: 0; bottom: 0;
  background: rgba(58,245,160,0.07);
}
.cent-ctr {
  position: absolute; left: 50%; top: 0; bottom: 0;
  width: 1px; background: rgba(255,255,255,0.15); transform: translateX(-50%);
}
.cent-labels {
  position: absolute; bottom: 4px; left: 0; right: 0;
  display: flex; justify-content: space-between; padding: 0 6px;
}
.cent-lbl { font-family: 'Space Mono', monospace; font-size: 8px; color: var(--muted); }
#centNeedle {
  position: absolute; top: 8%; bottom: 8%; width: 3px; border-radius: 2px;
  background: var(--accent); box-shadow: 0 0 8px var(--accent);
  left: 50%; transform: translateX(-50%);
  transition: left 0.07s linear, background 0.15s, box-shadow 0.15s;
}
.cent-readout {
  text-align: center; font-family: 'Space Mono', monospace; font-size: 16px;
  letter-spacing: 1px;
}

.det-row {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--panel2); border: 1px solid var(--border); border-radius: 4px;
  padding: 8px 10px;
}
.det-lbl { font-size: 9px; letter-spacing: 2px; color: var(--muted); font-family: 'Space Mono', monospace; }

.wave-wrap { background: var(--panel2); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; height: 48px; }
#waveCanvas { width: 100%; height: 100%; display: block; }
.sec-hdr {
  font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 3px; color: var(--muted);
  padding: 8px 16px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 8px;
}
.sec-hdr::before { content:''; width:4px; height:4px; background:var(--accent); border-radius:50%; box-shadow:0 0 6px var(--accent); }
</style>
