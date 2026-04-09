<script lang="ts">
  import { scoreState } from '$lib/stores/score.svelte';
  import { playerState } from '$lib/stores/player.svelte';

  function hideResult() {
    scoreState.showResultOverlay = false;
  }

  let graded = $derived(scoreState.noteResults.filter((r) => r && r.grade));
  let maxScore = $derived(playerState.song.notes.length * 30);
  let totalScore = $derived(
    scoreState.noteResults.reduce((sum, r) => {
      if (!r || r.grade === 'miss' || r.avgCents === null) return sum;
      return sum + Math.max(0, 30 - Math.abs(r.avgCents));
    }, 0)
  );
  let displayScore = $derived(Math.round(totalScore));
  let scorePercent = $derived(maxScore > 0 ? (totalScore / maxScore) * 100 : 0);
  let scoreText = $derived(`${displayScore}(${scorePercent.toFixed(1)}%)`);

  let withCents = $derived(graded.filter((r) => r?.avgCents !== null));
  let avgDev = $derived(withCents.length > 0 ? withCents.reduce((s, r) => s + Math.abs(r!.avgCents as number), 0) / withCents.length : 0);
  let missCount = $derived(scoreState.noteResults.filter((r) => r && r.grade === 'miss').length);

  let gradeLetter = $derived.by(() => {
    if (scorePercent >= 95 && avgDev < 10) return 'S';
    if (scorePercent >= 85 && avgDev < 15) return 'A';
    if (scorePercent >= 75 && avgDev < 20) return 'B+';
    if (scorePercent >= 65) return 'B';
    if (scorePercent >= 50) return 'C';
    return 'D';
  });

  let gradeMsg = $derived.by(() => {
    if (gradeLetter === 'S') return 'PERFECT INTONATION';
    if (gradeLetter === 'A') return 'EXCELLENT';
    if (gradeLetter === 'B+') return 'GREAT INTONATION';
    if (gradeLetter === 'B') return 'GOOD';
    if (gradeLetter === 'C') return 'NEEDS PRACTICE';
    return 'KEEP TRYING!';
  });
</script>

<div class="overlay {scoreState.showResultOverlay ? 'show' : ''}">
  <div class="result-card">
    {#if playerState.isFreeMode}
      <div class="rc-title">FREE SESSION ANALYSIS</div>
      <div class="rc-sub">フリー採点 — セッション統計</div>
      <div class="rc-score-big">
        <div class="rc-num" style="font-size: 56px;">
          {#if scoreState.freeModeStats.stability !== null}
            {Math.round(scoreState.freeModeStats.stability * 100)}<span style="font-size: 32px;">%</span>
          {:else}
            —
          {/if}
        </div>
        <div class="rc-grade">STABILITY SCORE</div>
      </div>
      <div class="rc-stats">
        <div class="rc-stat">
          <div class="rc-sv" style="color:var(--accent2)">
            {#if scoreState.freeModeStats.avgDev !== null}
              {(scoreState.freeModeStats.avgDev > 0 ? '+' : '')}{Math.round(scoreState.freeModeStats.avgDev)}¢
            {:else}
              —¢
            {/if}
          </div>
          <div class="rc-sl">AVG DEVIATION</div>
        </div>
        <div class="rc-stat">
          <div class="rc-sv" style="color:var(--accent)">
            {scoreState.freeModeStats.sampleCount}
          </div>
          <div class="rc-sl">VALID SAMPLES</div>
        </div>
        <div class="rc-stat">
          <div class="rc-sv" style="color:var(--warn)">
            {scoreState.freeModeStats.excludedSamples}
          </div>
          <div class="rc-sl">EXCLUDED (SLIDE)</div>
        </div>
      </div>
    {:else}
      <div class="rc-title">ANALYSIS</div>
      <div class="rc-sub">{playerState.song.name} — 録音済み</div>
      <div class="rc-score-big">
        <div class="rc-num" style="font-size: 56px;">{scoreText}</div>
        <div class="rc-grade">GRADE: {gradeLetter} — {gradeMsg}</div>
      </div>
      <div class="rc-stats">
        <div class="rc-stat">
          <div class="rc-sv" style="color:var(--accent2)">{scorePercent.toFixed(1)}%</div>
          <div class="rc-sl">ACCURACY</div>
        </div>
        <div class="rc-stat">
          <div class="rc-sv" style="color:var(--warn)">±{Math.round(avgDev)}¢</div>
          <div class="rc-sl">AVG DEV</div>
        </div>
        <div class="rc-stat">
          <div class="rc-sv" style="color:var(--danger)">{missCount}</div>
          <div class="rc-sl">MISSED</div>
        </div>
      </div>
      <div class="rc-breakdown">
        <div class="rc-blbl">NOTE INTONATION BREAKDOWN</div>
        <div>
          {#if playerState.song.notes.length > 0}
            {#each playerState.song.notes as note, i}
              {@const r = scoreState.noteResults[i]}
              {#if r && r.avgCents !== null}
                {@const abs = Math.abs(r.avgCents)}
                {@const pct = Math.max(5, Math.min(100, 100 - abs * 1.5))}
                {@const col = r.grade === 'perfect' ? 'var(--accent2)' : r.grade === 'good' ? 'var(--accent)' : r.grade === 'ok' ? 'var(--warn)' : 'var(--danger)'}
                {@const sign = r.avgCents > 0 ? '+' : ''}
                <div class="rc-brow">
                  <span class="rc-bnote">{note.name}</span>
                  <div class="rc-bbar"><div class="rc-bfill" style="width:{pct}%;background:{col}"></div></div>
                  <span class="rc-bcent" style="color:{col}">{sign}{Math.round(r.avgCents)}¢</span>
                </div>
              {/if}
            {/each}
          {:else}
            <div style="color:var(--muted);font-size:11px;font-family:'Space Mono',monospace">データなし</div>
          {/if}
        </div>
      </div>
    {/if}
    <button class="btn-close" onclick={hideResult}>CLOSE — CONTINUE PRACTICE</button>
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
.result-card {
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  padding: 28px; width: 520px; max-width: 92vw; max-height: 85vh; overflow-y: auto;
}
.rc-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 4px; color: var(--accent); }
.rc-sub { font-size: 10px; color: var(--muted); font-family: 'Space Mono', monospace; margin-bottom: 20px; }
.rc-score-big { text-align: center; padding: 20px; background: var(--panel2); border-radius: 8px; margin-bottom: 16px; }
.rc-num { font-family: 'Bebas Neue', sans-serif; font-size: 88px; line-height: 1; background: linear-gradient(135deg, var(--accent2), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.rc-grade { font-family: 'Space Mono', monospace; font-size: 12px; color: var(--accent); letter-spacing: 3px; }
.rc-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px; }
.rc-stat { background: var(--panel2); border: 1px solid var(--border); border-radius: 4px; padding: 10px; text-align: center; }
.rc-sv { font-family: 'Bebas Neue', sans-serif; font-size: 26px; }
.rc-sl { font-size: 9px; color: var(--muted); font-family: 'Space Mono', monospace; margin-top: 2px; }
.rc-breakdown { margin-bottom: 16px; }
.rc-blbl { font-size: 9px; letter-spacing: 3px; color: var(--muted); font-family: 'Space Mono', monospace; margin-bottom: 8px; }
.rc-brow { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 11px; }
.rc-bnote { font-family: 'Space Mono', monospace; width: 36px; color: var(--text); font-size: 10px; }
.rc-bbar { flex: 1; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
.rc-bfill { height: 100%; border-radius: 3px; }
.rc-bcent { font-family: 'Space Mono', monospace; font-size: 9px; width: 56px; text-align: right; }
.btn-close {
  width: 100%; padding: 10px; background: transparent;
  border: 1px solid var(--accent); color: var(--accent);
  font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 2px;
  border-radius: 4px; cursor: pointer; transition: all 0.2s;
}
.btn-close:hover { background: var(--accent); color: var(--bg); }
</style>
