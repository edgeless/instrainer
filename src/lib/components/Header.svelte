<script lang="ts">
  import { playerState, setSong } from '$lib/stores/player.svelte';
  import { audioState, requestMic, setOutputDevice } from '$lib/stores/audio.svelte';
  import { SONGS } from '$lib/utils/songs';

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

  let audioInputs = $derived(audioState.devices.filter(d => d.kind === 'audioinput'));
  let audioOutputs = $derived(audioState.devices.filter(d => d.kind === 'audiooutput'));
</script>

<header>
  <div class="logo">FRETLESS<span>BASS PRACTICE STUDIO</span></div>
  <div class="header-right">
    {#if audioInputs.length > 0}
      <select class="device-sel" value={audioState.selectedInputId} onchange={onInputDeviceChange} title="🎤 Input">
        {#each audioInputs as device, i}
          <option value={device.deviceId}>{device.label || `入力デバイス ${i+1}`}</option>
        {/each}
      </select>
    {/if}
    {#if audioOutputs.length > 0}
      <select class="device-sel" value={audioState.selectedOutputId} onchange={onOutputDeviceChange} title="🔊 Output">
        {#each audioOutputs as device, i}
          <option value={device.deviceId}>{device.label || `出力デバイス ${i+1}`}</option>
        {/each}
      </select>
    {/if}
    <select class="song-sel" value={playerState.currentSongKey} onchange={onSongChange}>
      {#each Object.entries(SONGS) as [key, s]}
        <option value={key}>{s.name}</option>
      {/each}
    </select>
    <div class="bpm-box">
      BPM <input type="number" bind:value={playerState.song.bpm} onwheel={onBpmWheel} min="10" max="300" class="bpm-input" title="スクロールで変更" disabled={playerState.status !== 'idle'} />
    </div>
    <button 
      class="btn-sm {playerState.metronomeOn ? 'active' : ''}" 
      onclick={toggleMetronome}
    >
      ♩ CLICK
    </button>
  </div>
</header>

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
select.song-sel, select.device-sel {
  background: var(--panel2); border: 1px solid var(--border); color: var(--text);
  padding: 6px 10px; border-radius: 4px; font-family: 'Space Mono', monospace; font-size: 11px; cursor: pointer;
}
select.device-sel { max-width: 140px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; }
.bpm-box { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted); border: 1px solid var(--border); padding: 4px 10px; border-radius: 4px; display: flex; align-items: center; gap: 6px; height: 30px; box-sizing: border-box; }
.bpm-input { background: rgba(0,0,0,0.2); border: 1px solid transparent; color: var(--accent); font-family: inherit; font-size: 11px; font-weight: bold; width: 40px; padding: 2px 4px; border-radius: 2px; outline: none; -moz-appearance: textfield; transition: opacity 0.2s; }
.bpm-input:focus { border-color: var(--accent); }
.bpm-input:disabled { opacity: 0.5; cursor: not-allowed; }
.bpm-input::-webkit-outer-spin-button, .bpm-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.btn-sm {
  background: transparent; border: 1px solid var(--border); color: var(--muted);
  padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-family: 'Space Mono', monospace;
  transition: all 0.2s;
}
.btn-sm:hover, .btn-sm.active { border-color: var(--accent); color: var(--accent); background: rgba(200,245,58,0.06); }
</style>
