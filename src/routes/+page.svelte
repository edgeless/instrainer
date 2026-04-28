<script lang="ts">
  import MicPermission from '$lib/components/MicPermission.svelte';
  import Header from '$lib/components/Header.svelte';
  import ScoreSection from '$lib/components/ScoreSection.svelte';
  import PitchMonitor from '$lib/components/PitchMonitor.svelte';
  import ScorePanel from '$lib/components/ScorePanel.svelte';
  import Transport from '$lib/components/Transport.svelte';
  import ResultOverlay from '$lib/components/ResultOverlay.svelte';
  import { playerState } from '$lib/stores/player.svelte';
  import { audioState } from '$lib/stores/audio.svelte';
  import { scoreState } from '$lib/stores/score.svelte';
  import FreeScoreArea from '$lib/components/FreeScoreArea.svelte';
  import FreeScorePanel from '$lib/components/FreeScorePanel.svelte';
  import { onMount } from 'svelte';

  let transportRef: ReturnType<typeof Transport> | undefined = $state(undefined);

  onMount(() => {
    if (typeof window !== 'undefined') {
      (window as any).__states = { audioState, playerState, scoreState };
    }
  });
</script>

<MicPermission />

<Header {transportRef} />

<div class="app">
  {#if playerState.isFreeMode}
    <FreeScoreArea />
  {:else}
    <ScoreSection />
  {/if}

  <aside class="right-panel">
    <PitchMonitor />
    {#if playerState.isFreeMode}
      <FreeScorePanel />
    {:else}
      <ScorePanel />
    {/if}
  </aside>

  <Transport bind:this={transportRef} />
</div>

<ResultOverlay />

<style>
.app {
  position: relative; z-index: 1;
  display: grid;
  grid-template-columns: 1fr 300px;
  grid-template-rows: 1fr auto;
  flex: 1;
  min-height: 0;
}

.right-panel {
  grid-column: 2; grid-row: 1;
  display: flex; flex-direction: column; overflow: hidden;
}

@media (max-width: 700px) {
  .app { grid-template-columns: 1fr; grid-template-rows: 320px 1fr auto; flex: 1; }
  :global(.score-section) { grid-column:1 !important; grid-row:1 !important; border-right:none !important; border-bottom: 1px solid var(--border) !important; }
  .right-panel { grid-column:1; grid-row:2; }
  :global(.transport) { grid-column:1 !important; grid-row:3 !important; flex-wrap: wrap; }
}
</style>
