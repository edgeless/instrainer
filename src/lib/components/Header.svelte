<script lang="ts">
  import { playerState, setSong } from '$lib/stores/player.svelte';
  import { audioState, requestMic, setOutputDevice } from '$lib/stores/audio.svelte';
  import { SONGS } from '$lib/utils/songs';
  import { parseIRealURI } from '$lib/utils/ireal';
  import type Transport from './Transport.svelte';
  import AIGeneratorModal from './AIGeneratorModal.svelte';

  let { transportRef } = $props<{ transportRef: ReturnType<typeof Transport> | undefined }>();

  function onSongChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    setSong(select.value);
  }

  function toggleMetronome() {
    playerState.metronomeOn = !playerState.metronomeOn;
  }

  function onInputDeviceChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    requestMic(select.value);
  }

  function onOutputDeviceChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    setOutputDevice(select.value);
  }

  function onBpmWheel(e: WheelEvent) {
    if (!playerState.song || playerState.status !== 'idle') return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const step = e.shiftKey ? 10 : 1;
    let newBpm = playerState.song.bpm + (delta * step);
    playerState.song.bpm = Math.max(10, Math.min(300, newBpm));
  }

  function onRepeatWheel(e: WheelEvent) {
    if (playerState.status !== 'idle') return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    playerState.repeatCount = Math.max(1, Math.min(99, playerState.repeatCount + delta));
  }

  function onImportIReal() {
    const uri = window.prompt(i18n.importPrompt);
    if (uri) {
      const song = parseIRealURI(uri);
      if (song) {
        setSong(song);
      } else {
        alert(i18n.importError);
      }
    }
  }

  let i18n = $derived.by(() => {
    const isJa = typeof navigator !== 'undefined' && navigator.language?.startsWith('ja');
    return {
      importTitle: isJa ? "iReal Pro からインポート" : "Import from iReal Pro",
      importPrompt: isJa ? "iReal Pro の 'irealb://' URLを貼り付けてください:" : "Please paste the iReal Pro 'irealb://' URL:",
      importError: isJa ? "URLの解析に失敗しました。正しいURLか確認してください。" : "Failed to parse the URL. Please make sure it's a valid iReal Pro URL.",
      scrollHint: isJa ? "スクロールで変更" : "Scroll to change",
      clickBtn: isJa ? "♩ メトロノーム" : "♩ CLICK",
      inputDev: isJa ? "入力デバイス" : "Input Device",
      outputDev: isJa ? "出力デバイス" : "Output Device",
      repeat: isJa ? "リピート" : "Repeat",
      bpm: isJa ? "テンポ" : "BPM",
      freeMode: isJa ? "フリー採点" : "FREE MODE",
    };
  });

  let audioInputs = $derived(audioState.devices.filter(d => d.kind === 'audioinput'));
  let audioOutputs = $derived(audioState.devices.filter(d => d.kind === 'audiooutput'));

  let isAIModalOpen = $state(false);

  function onDemoToggle() {
    if (transportRef && typeof transportRef.toggleDemoPlay === 'function') {
      transportRef.toggleDemoPlay();
    }
  }

  $effect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('player_song_key', playerState.currentSongKey);
      localStorage.setItem('player_bpm', playerState.song.bpm.toString());
      localStorage.setItem('player_repeat', playerState.repeatCount.toString());
    }
  });
</script>

<header>
  <div class="logo">FRETLESS<span>BASS PRACTICE STUDIO</span></div>
  <div class="header-right">
    {#if audioInputs.length > 0}
      <select class="device-sel" value={audioState.selectedInputId} onchange={onInputDeviceChange} title="🎤 {i18n.inputDev}">
        {#each audioInputs as device, i}
          <option value={device.deviceId}>{device.label || `${i18n.inputDev} ${i+1}`}</option>
        {/each}
      </select>
    {/if}
    {#if audioOutputs.length > 0}
      <select class="device-sel" value={audioState.selectedOutputId} onchange={onOutputDeviceChange} title="🔊 {i18n.outputDev}">
        {#each audioOutputs as device, i}
          <option value={device.deviceId}>{device.label || `${i18n.outputDev} ${i+1}`}</option>
        {/each}
      </select>
    {/if}
    <div class="song-box">
      <select class="song-sel" value={playerState.currentSongKey} onchange={onSongChange} disabled={playerState.isFreeMode}>
        {#each Object.entries(SONGS) as [key, s]}
          <option value={key}>{s.name}</option>
        {/each}
        {#if playerState.importedSong}
          <option value="imported">✨ {playerState.importedSong.name}</option>
        {/if}
      </select>
      <button
        class="btn-demo {playerState.isDemoPlaying ? 'active' : ''}"
        onclick={onDemoToggle}
        disabled={playerState.isFreeMode || (playerState.isPlaying && !playerState.isDemoPlaying) || playerState.isRecording}
        title="デモ再生"
      >
        {playerState.isDemoPlaying ? '⏹ STOP' : '▶ DEMO'}
      </button>
      <button class="btn-import" onclick={onImportIReal} title={i18n.importTitle} disabled={playerState.isFreeMode}>
        IRB
      </button>
      <button class="btn-ai" onclick={() => isAIModalOpen = true} title="AIで曲を生成" disabled={playerState.isFreeMode || playerState.status !== 'idle'}>
        ✨ AI
      </button>
    </div>
    <div class="bpm-box" role="spinbutton" tabindex="-1" onwheel={onRepeatWheel} title={i18n.scrollHint}>
      {i18n.repeat} <span class="bpm-val {playerState.status !== 'idle' || playerState.isFreeMode ? 'disabled' : ''}">{playerState.repeatCount}</span>
    </div>
    <div class="bpm-box">
      {i18n.bpm} <input type="number" bind:value={playerState.song.bpm} onwheel={onBpmWheel} min="10" max="300" class="bpm-input" title={i18n.scrollHint} disabled={playerState.status !== 'idle' || playerState.isFreeMode} />
    </div>
    <button
      class="btn-sm {playerState.isFreeMode ? 'active free' : ''}"
      onclick={() => playerState.isFreeMode = !playerState.isFreeMode}
      disabled={playerState.status !== 'idle'}
    >
      {i18n.freeMode}
    </button>
    <button 
      class="btn-sm {playerState.metronomeOn ? 'active' : ''}" 
      onclick={toggleMetronome}
    >
      {i18n.clickBtn}
    </button>
  </div>
</header>

<AIGeneratorModal bind:isOpen={isAIModalOpen} />

<style>
header {
  position: relative; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: rgba(10,12,15,0.95);
}
.logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 5px; color: var(--accent); text-shadow: 0 0 20px rgba(200,245,58,0.4); }
.logo span { color: var(--muted); font-size: 10px; letter-spacing: 3px; display: block; margin-top: -3px; font-family: 'Space Mono', monospace; }
.header-right { display: flex; align-items: center; gap: 12px; }

.song-box { display: flex; align-items: center; gap: 12px; }
.btn-demo {
  background: var(--panel2); color: var(--accent); border: 1px solid var(--border); padding: 6px 10px; border-radius: 4px;
  font-family: 'Bebas Neue', sans-serif; font-size: 14px; cursor: pointer; transition: all 0.2s;
  height: 30px; display: flex; align-items: center; justify-content: center; min-width: 65px;
}
.btn-demo:hover { border-color: var(--accent); background: rgba(200,245,58,0.1); }
.btn-demo.active { background: var(--accent); color: #000; }
.btn-demo:disabled { opacity: 0.5; cursor: not-allowed; border-color: var(--border); background: var(--panel2); color: var(--muted); }

.btn-import, .btn-ai {
  background: var(--accent); color: #000; border: none; padding: 6px 8px; border-radius: 4px;
  font-family: 'Bebas Neue', sans-serif; font-size: 14px; cursor: pointer; transition: all 0.2s;
  height: 30px; display: flex; align-items: center; justify-content: center;
}
.btn-ai {
  background: var(--accent2);
}
.btn-ai:disabled { opacity: 0.5; cursor: not-allowed; background: var(--panel2); color: var(--muted); }
.btn-import:hover, .btn-ai:hover:not(:disabled) { background: #fff; transform: scale(1.05); }

select.song-sel, select.device-sel {
  background: var(--panel2); border: 1px solid var(--border); color: var(--text);
  padding: 6px 10px; border-radius: 4px; font-family: 'Space Mono', monospace; font-size: 11px; cursor: pointer;
  height: 30px; box-sizing: border-box;
}
select.device-sel { max-width: 140px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; }
.bpm-box { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted); border: 1px solid var(--border); padding: 4px 10px; border-radius: 4px; display: flex; align-items: center; gap: 6px; height: 30px; box-sizing: border-box; }
.bpm-input { background: rgba(0,0,0,0.2); border: 1px solid transparent; color: var(--accent); font-family: inherit; font-size: 11px; font-weight: bold; width: 40px; padding: 2px 4px; border-radius: 2px; outline: none; -moz-appearance: textfield; appearance: textfield; transition: opacity 0.2s; }
.bpm-input:focus { border-color: var(--accent); }
.bpm-input:disabled { opacity: 0.5; cursor: not-allowed; }
.bpm-input::-webkit-outer-spin-button, .bpm-input::-webkit-inner-spin-button { -webkit-appearance: none; appearance: none; margin: 0; }
.bpm-val { color: var(--accent); font-weight: bold; min-width: 20px; text-align: center; }
.bpm-val.disabled { opacity: 0.5; }
.btn-sm {
  background: transparent; border: 1px solid var(--border); color: var(--muted);
  padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-family: 'Space Mono', monospace;
  transition: all 0.2s; height: 30px; display: flex; align-items: center; box-sizing: border-box;
}
.btn-sm:hover, .btn-sm.active { border-color: var(--accent); color: var(--accent); background: rgba(200,245,58,0.06); }
.btn-sm.active.free { border-color: var(--accent2); color: var(--accent2); background: rgba(58,245,160,0.1); box-shadow: 0 0 10px rgba(58,245,160,0.2); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
