<script lang="ts">
  import MicPermission from '$lib/components/MicPermission.svelte';
  import PitchMonitor from '$lib/components/PitchMonitor.svelte';
  import { playerState, setSong } from '$lib/stores/player.svelte';
  import { audioState, requestMic } from '$lib/stores/audio.svelte';
  import { scoreState } from '$lib/stores/score.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    (window as any).__states = { audioState, playerState, scoreState, setSong, requestMic };
  });
</script>

<svelte:head>
  <title>Tuner - Fretless Bass Trainer</title>
  <meta name="description" content="A simple, full-screen pitch monitor and tuner for bass." />
</svelte:head>

<MicPermission />

<main class="tuner-container">
  <PitchMonitor class="tuner-full" />
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
    background-color: var(--bg);
  }

  :global(.tuner-full) {
    flex: 1 !important;
    border: none !important; /* 全画面の場合は不要な境界線を消す */
  }
</style>
