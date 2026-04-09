<script lang="ts">
  import { scoreState } from '$lib/stores/score.svelte';
  import { playerState } from '$lib/stores/player.svelte';

  let stats = $derived(scoreState.freeModeStats);

  let i18n = $derived.by(() => {
    const isJa = typeof navigator !== 'undefined' && navigator.language?.startsWith('ja');
    return {
      title: isJa ? "フリーセッション統計" : "FREE SESSION STATS",
      avgDev: isJa ? "平均偏差" : "AVG DEVIATION",
      stability: isJa ? "ピッチ安定度" : "STABILITY",
      samples: isJa ? "有効サンプル数" : "VALID SAMPLES",
      excluded: isJa ? "スライド除外" : "SLIDE EXCLUDED",
      info: isJa ? "全演奏区間の平均値です (スライド区間を除く)" : "Session average (excl. slides)",
      noData: isJa ? "データなし" : "NO DATA",
    };
  });
</script>

<div class="free-score-panel">
  <div class="sp-title">{i18n.title}</div>

  <div class="sp-meters">
    <div class="sp-meter">
      <div class="sp-mlbl">{i18n.avgDev}</div>
      <div class="sp-mval" class:warn={stats.avgDev && Math.abs(stats.avgDev) > playerState.tolerance}>
        {stats.avgDev !== null ? (stats.avgDev > 0 ? '+' : '') + Math.round(stats.avgDev) + '¢' : '—¢'}
      </div>
      <div class="sp-bar">
        <div class="sp-fill" style="width:{stats.avgDev !== null ? Math.min(100, Math.abs(stats.avgDev) * 2) : 0}%; background: {stats.avgDev && Math.abs(stats.avgDev) > playerState.tolerance ? 'var(--warn)' : 'var(--accent2)'}"></div>
      </div>
    </div>

    <div class="sp-meter">
      <div class="sp-mlbl">{i18n.stability}</div>
      <div class="sp-mval good">{stats.stability !== null ? Math.round(stats.stability * 100) + '%' : '—%'}</div>
      <div class="sp-bar">
        <div class="sp-fill" style="width:{stats.stability !== null ? stats.stability * 100 : 0}%; background:var(--accent)"></div>
      </div>
    </div>
  </div>

  <div class="sample-info-grid">
    <div class="sample-info">
      <span class="lbl">{i18n.samples}:</span>
      <span class="val">{stats.sampleCount}</span>
    </div>
    <div class="sample-info">
      <span class="lbl">{i18n.excluded}:</span>
      <span class="val warn" style="color:var(--warn)">{stats.excludedSamples}</span>
    </div>
  </div>

  <div class="info-footer">
    {i18n.info}
  </div>
</div>

<style>
  .free-score-panel { padding: 12px; background: var(--panel); display: flex; flex-direction: column; gap: 12px; height: 100%; }
  .sp-title { font-size: 9px; letter-spacing: 3px; color: var(--muted); font-family: 'Space Mono', monospace; }

  .sp-meters { display: flex; flex-direction: column; gap: 10px; }
  .sp-meter { background: var(--panel2); border: 1px solid var(--border); border-radius: 4px; padding: 12px; }
  .sp-mlbl { font-size: 9px; color: var(--muted); font-family: 'Space Mono', monospace; letter-spacing: 1px; margin-bottom: 4px; }
  .sp-mval { font-family: 'Bebas Neue', sans-serif; font-size: 32px; line-height: 1; color: var(--text); }
  .sp-mval.good { color: var(--accent2); }
  .sp-mval.warn { color: var(--warn); }

  .sp-bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; margin-top: 8px; }
  .sp-fill { height: 100%; border-radius: 2px; transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1); }

  .sample-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: auto; }
  .sample-info {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    display: flex;
    justify-content: space-between;
    padding: 8px;
    background: rgba(255,255,255,0.02);
    border-radius: 4px;
    color: var(--muted);
  }
  .val { color: var(--accent2); }

  .info-footer {
    font-size: 8px;
    color: var(--muted);
    text-align: center;
    letter-spacing: 1px;
    font-family: 'Space Mono', monospace;
  }
</style>
