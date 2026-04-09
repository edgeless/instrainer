<script lang="ts">
  import { playerState } from '$lib/stores/player.svelte';
  import { scoreState } from '$lib/stores/score.svelte';
  import { freqToMidi, midiToNoteName } from '$lib/utils/pitch';

  let noteName = $derived(scoreState.detectedFreq > 0 ? midiToNoteName(freqToMidi(scoreState.detectedFreq)) : '—');

  let i18n = $derived.by(() => {
    const isJa = typeof navigator !== 'undefined' && navigator.language?.startsWith('ja');
    return {
      title: isJa ? "フリー採点モード" : "FREE RATING MODE",
      subtitle: isJa ? "譜面なし・自由演奏" : "NO SCORE • PLAY FREELY",
      hint: isJa ? "演奏を開始すると、ピッチの正確さが測定されます" : "Start playing to measure your pitch accuracy",
      pitch: isJa ? "検出された音名" : "DETECTED PITCH"
    };
  });
</script>

<div class="free-area">
  <div class="bg-decoration"></div>

  <div class="content">
    <div class="mode-badge">{i18n.title}</div>
    <h1>{i18n.subtitle}</h1>
    <p class="hint">{i18n.hint}</p>

    <div class="pitch-display">
      <div class="pitch-lbl">{i18n.pitch}</div>
      <div class="pitch-val" class:active={scoreState.detectedFreq > 0}>{noteName}</div>
    </div>
  </div>

  {#if playerState.isRecording}
    <div class="rec-overlay">
      <div class="rec-dot"></div>
      RECORDING SESSION...
    </div>
  {/if}
</div>

<style>
  .free-area {
    flex: 1;
    display: flex;
    align-items: center; justify-content: center;
    background: #0a0c0f;
    position: relative;
    overflow: hidden;
    color: var(--text);
    border-right: 1px solid var(--border);
  }

  .bg-decoration {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 50%, rgba(200,245,58,0.03) 0%, transparent 70%);
    pointer-events: none;
  }

  .content {
    text-align: center;
    z-index: 2;
  }

  .mode-badge {
    display: inline-block;
    padding: 4px 12px;
    background: rgba(200,245,58,0.1);
    border: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 20px;
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    letter-spacing: 2px;
    margin-bottom: 16px;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(200,245,58,0.2); }
    70% { box-shadow: 0 0 0 10px rgba(200,245,58,0); }
    100% { box-shadow: 0 0 0 0 rgba(200,245,58,0); }
  }

  h1 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 48px;
    letter-spacing: 4px;
    margin: 0;
    color: #fff;
    text-shadow: 0 0 20px rgba(255,255,255,0.1);
  }

  .hint {
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    color: var(--muted);
    margin-top: 8px;
  }

  .pitch-display {
    margin-top: 40px;
    padding: 20px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border);
    border-radius: 12px;
    min-width: 200px;
  }

  .pitch-lbl {
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 2px;
    margin-bottom: 8px;
    font-family: 'Space Mono', monospace;
  }

  .pitch-val {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 72px;
    line-height: 1;
    color: var(--muted);
    transition: all 0.2s;
  }

  .pitch-val.active {
    color: var(--accent2);
    text-shadow: 0 0 30px rgba(58,245,160,0.4);
    transform: scale(1.1);
  }

  .rec-overlay {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: var(--danger);
    background: rgba(0,0,0,0.5);
    padding: 6px 12px;
    border-radius: 4px;
    border: 1px solid var(--danger);
  }

  .rec-dot {
    width: 8px;
    height: 8px;
    background: var(--danger);
    border-radius: 50%;
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
</style>
