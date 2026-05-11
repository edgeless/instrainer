<script lang="ts">
  import MicPermission from '$lib/components/MicPermission.svelte';
  import PitchMonitor from '$lib/components/PitchMonitor.svelte';
  import { playerState, setSong } from '$lib/stores/player.svelte';
  import { audioState, requestMic } from '$lib/stores/audio.svelte';
  import { scoreState } from '$lib/stores/score.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    if (typeof window !== 'undefined') {
      (window as any).__states = { audioState, playerState, scoreState, setSong, requestMic };
    }
  });
</script>

<MicPermission />

<main class="tuner-container">
  <PitchMonitor />
</main>

<style>
  .tuner-container {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    width: 100vw;
    position: relative;
    z-index: 1;
    overflow: hidden;
  }

  :global(.tuner-container > .pitch-panel) {
    flex: 1;
    border: none; /* 全画面の場合は不要な境界線を消す */
  }
</style>
