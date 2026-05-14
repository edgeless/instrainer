<script lang="ts">
  import { scoreState, loadScoreHistory } from '$lib/stores/score.svelte';
  import { playerState } from '$lib/stores/player.svelte';

  function hideHistory() {
    scoreState.showHistoryOverlay = false;
  }

  let historyData = $derived(
    scoreState.showHistoryOverlay ? loadScoreHistory(playerState.currentSongKey) : []
  );

  let hasData = $derived(historyData.length > 0);

  // SVG dimensions
  const width = 600;
  const height = 250;
  const padding = { top: 20, right: 30, bottom: 40, left: 40 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  let maxPoints = $derived(historyData.length);

  function getX(index: number) {
    if (maxPoints <= 1) return padding.left + innerWidth / 2;
    return padding.left + (index / (maxPoints - 1)) * innerWidth;
  }

  function getY(percent: number) {
    // Map 0-100% to innerHeight (0% at bottom, 100% at top)
    return padding.top + innerHeight - (percent / 100) * innerHeight;
  }

  let overallPath = $derived(historyData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.overallPercent)}`).join(' '));
  let pitchPath = $derived(historyData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.pitchPercent)}`).join(' '));
  let timingPath = $derived(historyData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.timingPercent)}`).join(' '));

  function formatDate(timestamp: number) {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

</script>

<div class="overlay {scoreState.showHistoryOverlay ? 'show' : ''}">
  <div class="history-card">
    <div class="hc-title">SCORE HISTORY</div>
    <div class="hc-sub">{playerState.song.name} — 過去のスコア推移</div>

    {#if hasData}
      <div class="chart-container">
        <svg viewBox="0 0 {width} {height}" class="chart">
          <!-- Y-Axis Grid Lines -->
          {#each [0, 25, 50, 75, 100] as tick}
            <line
              x1={padding.left}
              y1={getY(tick)}
              x2={width - padding.right}
              y2={getY(tick)}
              class="grid-line"
            />
            <text x={padding.left - 5} y={getY(tick) + 3} class="axis-label y-axis">{tick}%</text>
          {/each}

          <!-- X-Axis Labels (show first, last, and maybe some in between) -->
          {#if maxPoints > 0}
            {#each historyData as d, i}
              {#if maxPoints <= 5 || i === 0 || i === maxPoints - 1 || i === Math.floor(maxPoints / 2)}
                <text x={getX(i)} y={height - 10} class="axis-label x-axis" text-anchor="middle">
                  {formatDate(d.timestamp)}
                </text>
                <!-- Small tick -->
                <line x1={getX(i)} y1={height - padding.bottom} x2={getX(i)} y2={height - padding.bottom + 5} class="grid-line" />
              {/if}
            {/each}
          {/if}

          <!-- Lines -->
          <path d={pitchPath} class="line pitch-line" fill="none" />
          <path d={timingPath} class="line timing-line" fill="none" />
          <path d={overallPath} class="line overall-line" fill="none" />

          <!-- Points -->
          {#each historyData as d, i}
            <circle cx={getX(i)} cy={getY(d.pitchPercent)} r="3" class="point pitch-point" />
            <circle cx={getX(i)} cy={getY(d.timingPercent)} r="3" class="point timing-point" />
            <circle cx={getX(i)} cy={getY(d.overallPercent)} r="4" class="point overall-point" />
          {/each}
        </svg>

        <div class="legend">
          <div class="legend-item"><span class="legend-color overall-color"></span> TOTAL</div>
          <div class="legend-item"><span class="legend-color pitch-color"></span> TONE</div>
          <div class="legend-item"><span class="legend-color timing-color"></span> RHYTHM</div>
        </div>
      </div>

      <div class="stats-summary">
        <div>Total Sessions: <span style="color: var(--accent);">{historyData.length}</span></div>
        <div>Best Score: <span style="color: var(--accent);">{Math.max(...historyData.map(d => d.overallPercent)).toFixed(1)}%</span></div>
      </div>
    {:else}
      <div class="empty-state">
        <p>履歴データがありません。</p>
        <p>曲を再生・録音して結果を保存してください。</p>
      </div>
    {/if}

    <button class="btn-close" onclick={hideHistory}>CLOSE</button>
  </div>
</div>

<style>
.overlay {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,0.88); z-index: 200;
  backdrop-filter: blur(10px);
  align-items: center; justify-content: center;
}
.overlay.show { display: flex; }
.history-card {
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  padding: 28px; width: 660px; max-width: 95vw; max-height: 85vh; overflow-y: auto;
}
.hc-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 4px; color: var(--accent); }
.hc-sub { font-size: 10px; color: var(--muted); font-family: 'Space Mono', monospace; margin-bottom: 20px; }

.chart-container {
  background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 10px; margin-bottom: 16px;
}
.chart { width: 100%; height: auto; display: block; overflow: visible; }
.grid-line { stroke: var(--border); stroke-width: 1; stroke-dasharray: 2 2; }
.axis-label { font-family: 'Space Mono', monospace; font-size: 10px; fill: var(--muted); }
.y-axis { text-anchor: end; }
.x-axis { text-anchor: middle; }

.line { stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.overall-line { stroke: var(--accent); stroke-width: 3; }
.pitch-line { stroke: var(--accent2); }
.timing-line { stroke: var(--warn); }

.point { stroke: var(--bg); stroke-width: 1.5; }
.overall-point { fill: var(--accent); }
.pitch-point { fill: var(--accent2); }
.timing-point { fill: var(--warn); }

.legend { display: flex; justify-content: center; gap: 20px; margin-top: 10px; font-family: 'Space Mono', monospace; font-size: 11px; color: var(--text); }
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-color { width: 12px; height: 12px; border-radius: 2px; display: inline-block; }
.overall-color { background: var(--accent); }
.pitch-color { background: var(--accent2); }
.timing-color { background: var(--warn); }

.stats-summary { display: flex; justify-content: space-between; font-family: 'Space Mono', monospace; font-size: 12px; color: var(--muted); margin-bottom: 20px; padding: 0 10px; }

.empty-state { text-align: center; color: var(--muted); font-family: 'Space Mono', monospace; font-size: 12px; padding: 40px 0; }
.empty-state p { margin-bottom: 8px; }

.btn-close {
  width: 100%; padding: 10px; background: transparent;
  border: 1px solid var(--accent); color: var(--accent);
  font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 2px;
  border-radius: 4px; cursor: pointer; transition: all 0.2s;
}
.btn-close:hover { background: var(--accent); color: var(--bg); }
</style>
