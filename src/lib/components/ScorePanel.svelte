<script lang="ts">
  import { scoreState } from '$lib/stores/score.svelte';
  import { playerState } from '$lib/stores/player.svelte';

  let stats = $derived.by(() => {
    let gradedCount = 0;
    let scoredCount = 0;
    let centsSum = 0;
    let centsCount = 0;
    let timingSum = 0;
    let timingCount = 0;

    for (const r of scoreState.noteResults) {
      if (r && r.grade) {
        gradedCount++;
        if (r.grade !== 'miss') {
          scoredCount++;
        }
        if (r.avgCents !== null) {
          centsSum += Math.abs(r.avgCents);
          centsCount++;
        }
        if (r.timingDiffMs !== null && r.timingDiffMs !== undefined) {
          timingSum += Math.abs(r.timingDiffMs);
          timingCount++;
        }
      }
    }

    return {
      acc: gradedCount > 0 ? Math.round((scoredCount / gradedCount) * 100) : null,
      avgDev: centsCount > 0 ? Math.round(centsSum / centsCount) : null,
      avgTimingDev: timingCount > 0 ? Math.round(timingSum / timingCount) : null
    };
  });

  let acc = $derived(stats.acc);
  let avgDev = $derived(stats.avgDev);
  let avgTimingDev = $derived(stats.avgTimingDev);
</script>

<div class="score-panel">
  <div class="sp-title">SESSION SCORE</div>
  <div class="sp-meters" style="grid-template-columns: 1fr 1fr 1fr; gap: 4px;">
    <div class="sp-meter">
      <div class="sp-mlbl">ACCURACY</div>
      <div class="sp-mval good" style="font-size:20px;">{acc !== null ? acc + '%' : '—%'}</div>
      <div class="sp-bar"><div class="sp-fill" style="width:{acc !== null ? acc : 0}%;background:var(--accent2)"></div></div>
    </div>
    <div class="sp-meter">
      <div class="sp-mlbl">PITCH DEV</div>
      <div class="sp-mval warn" style="font-size:20px;">{avgDev !== null ? '±' + avgDev + '¢' : '—¢'}</div>
      <div class="sp-bar"><div class="sp-fill" style="width:{avgDev !== null ? Math.min(100, avgDev * 2) : 0}%;background:var(--warn)"></div></div>
    </div>
    <div class="sp-meter">
      <div class="sp-mlbl">TIME DEV</div>
      <div class="sp-mval warn" style="font-size:20px;">{avgTimingDev !== null ? '±' + avgTimingDev + 'ms' : '—ms'}</div>
      <div class="sp-bar"><div class="sp-fill" style="width:{avgTimingDev !== null ? Math.min(100, avgTimingDev / 2) : 0}%;background:var(--warn)"></div></div>
    </div>
  </div>
  
  <div class="sp-title" style="margin-bottom:6px;">NOTE HISTORY</div>
  <div class="dot-row">
    {#each playerState.song.notes as note, i}
      {@const r = scoreState.noteResults[i]}
      {@const cls = r 
          ? {perfect:'nd-p', good:'nd-g', ok:'nd-o', miss:'nd-m'}[r.grade]
          : 'nd-e'}
      {@const outline = i === playerState.currentNoteIdx && (playerState.isPlaying || playerState.isRecording) 
          ? 'outline:2px solid var(--accent);' 
          : ''}
      <div class="ndot {cls}" style={outline} title={note.name}></div>
    {/each}
  </div>
  
  <div class="legend">
    <span>●<span style="color:var(--accent)"> PERF</span></span>
    <span>●<span style="color:var(--accent2)"> GOOD</span></span>
    <span>●<span style="color:var(--warn)"> OK</span></span>
    <span>●<span style="color:var(--danger)"> MISS</span></span>
  </div>
</div>

<style>
.score-panel { padding: 12px; background: var(--panel); }
.sp-title { font-size: 9px; letter-spacing: 3px; color: var(--muted); font-family: 'Space Mono', monospace; margin-bottom: 8px; }
.sp-meters { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
.sp-meter { background: var(--panel2); border: 1px solid var(--border); border-radius: 4px; padding: 8px; }
.sp-mlbl { font-size: 9px; color: var(--muted); font-family: 'Space Mono', monospace; letter-spacing: 1px; margin-bottom: 2px; }
.sp-mval { font-family: 'Bebas Neue', sans-serif; font-size: 26px; line-height: 1; }
.sp-mval.good { color: var(--accent2); }
.sp-mval.warn { color: var(--warn); }
.sp-bar { height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; margin-top: 4px; }
.sp-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }

.dot-row { display: flex; gap: 3px; flex-wrap: wrap; margin-bottom: 6px; }
.ndot { width: 8px; height: 8px; border-radius: 50%; }
.nd-p { background: var(--accent); }
.nd-g { background: var(--accent2); }
.nd-o { background: var(--warn); }
.nd-m { background: var(--danger); }
.nd-e { background: var(--border); }

.legend { display: flex; gap: 8px; font-size: 9px; color: var(--muted); font-family: 'Space Mono', monospace; }
</style>
