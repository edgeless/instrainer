<script lang="ts">
  import { audioState, requestMic } from '$lib/stores/audio.svelte';
</script>

<div class="mic-overlay {audioState.micGranted ? 'hide' : ''}">
  <div class="mic-icon">🎙️</div>
  <div class="mic-title">MICROPHONE ACCESS</div>
  <div class="mic-sub">フレットレスベースの音程を検出するためにマイクへのアクセスが必要です。<br>ベースをマイクに近づけて演奏してください。</div>
  <button class="btn-mic" onclick={() => requestMic()}>マイクを有効にする</button>
  {#if audioState.micError}
    <div class="mic-err" style="display: block;">{audioState.micError}</div>
  {/if}
</div>

<style>
.mic-overlay {
  display: flex; position: fixed; inset: 0;
  background: rgba(0,0,0,0.9); z-index: 300;
  align-items: center; justify-content: center; flex-direction: column; gap: 16px;
  text-align: center;
}
.mic-overlay.hide { display: none; }
.mic-icon { font-size: 48px; margin-bottom: 8px; }
.mic-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 4px; color: var(--accent); }
.mic-sub { font-size: 12px; color: var(--muted); font-family: 'Space Mono', monospace; max-width: 360px; line-height: 1.6; }
.btn-mic {
  background: var(--accent); color: var(--bg);
  border: none; padding: 12px 28px; border-radius: 4px;
  font-family: 'Space Mono', monospace; font-size: 12px; letter-spacing: 2px;
  cursor: pointer; font-weight: 700; margin-top: 8px;
  transition: all 0.2s;
}
.btn-mic:hover { background: var(--accent2); }
.mic-err { color: var(--danger); font-size: 11px; font-family: 'Space Mono', monospace; }
</style>
