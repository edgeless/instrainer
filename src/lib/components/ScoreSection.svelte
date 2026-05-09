<script lang="ts">
  import { playerState, getOriginalBeats, getDisplayBeat } from '$lib/stores/player.svelte';
  import { scoreState } from '$lib/stores/score.svelte';
  
  let viewMode = $state('both');

  // 1行あたりの小節数
  const MEASURES_PER_ROW = 4;

  // 拍子記号の分子（小節内の拍数）を $derived で管理
  let beatsPerMeasure = $derived((playerState.song.timeSignature ?? [4, 4])[0]);

  // 全音階（ダイアトニック）に基づいた五線譜（ヘ音記号）上の位置。
  // 第5線（一番上の線）のA3を基準(0)とし、半音階の臨時記号はY座標に影響しない。
  const DIATONIC_POSITIONS: Record<string, number> = {
    'C1': 19, 'D1': 18, 'E1': 17, 'F1': 16, 'G1': 15, 'A1': 14, 'B1': 13,
    'C2': 12, 'D2': 11, 'E2': 10, 'F2': 9,  'G2': 8,  'A2': 7,  'B2': 6,
    'C3': 5,  'D3': 4,  'E3': 3,  'F3': 2,  'G3': 1,  'A3': 0,  'B3': -1,
    'C4': -2, 'D4': -3, 'E4': -4
  };

  const GRADE_COLORS: Record<string, string> = {
    perfect: 'var(--accent2)',
    good: 'var(--accent)',
    ok: 'var(--warn)',
    miss: 'var(--danger)'
  };

  function getNoteY(noteName: string, topY: number, lineSpacing: number) {
    const baseNote = noteName.replace(/[#b]/g, '');
    const offset = DIATONIC_POSITIONS[baseNote] ?? 6;
    return topY + offset * (lineSpacing / 2);
  }

  // 単一の出力先コンテナ
  let scoreContainer: HTMLDivElement | undefined = $state();
  let containerWidth = $state(600);

  /** 行のレイアウト情報を一括計算する */
  function getRowLayout(W: number, row: number) {
    const [timeSigNum] = playerState.song.timeSignature ?? [4, 4];
    const beatsPerMeasure = timeSigNum;
    const notes = playerState.song.notes;
    const totalBeats = getOriginalBeats();
    const totalMeasures = Math.ceil(totalBeats / beatsPerMeasure);

    const rowStartMeasure = row * MEASURES_PER_ROW;
    const rowEndMeasure = Math.min(rowStartMeasure + MEASURES_PER_ROW, totalMeasures);
    const rowMeasureCount = rowEndMeasure - rowStartMeasure;

    const rowStartBeat = rowStartMeasure * beatsPerMeasure;
    const rowEndBeat = rowEndMeasure * beatsPerMeasure;
    const rowBeats = rowEndBeat - rowStartBeat;

    const isFirstRow = row === 0;
    const startX = isFirstRow ? 62 : 24; // clefW=62
    const endX = W - 12;
    const usableW = endX - startX;

    type RowElement = { type: 'note'; beat: number; noteIdx: number }
                    | { type: 'bar';  beat: number; measureNum: number };

    const elements: RowElement[] = [];

    // 小節線（行内の区切り）
    for (let m = 1; m < rowMeasureCount; m++) {
      elements.push({
        type: 'bar',
        beat: rowStartBeat + m * beatsPerMeasure,
        measureNum: rowStartMeasure + m + 1
      });
    }

    // 音符
    notes.forEach((note, i) => {
      if (note.beat >= rowStartBeat && note.beat < rowEndBeat) {
        elements.push({ type: 'note', beat: note.beat, noteIdx: i });
      }
    });

    // ビート順でソート（同一ビートでは小節線を先に）
    elements.sort((a, b) => a.beat - b.beat || (a.type === 'bar' ? -1 : 1));

    // 最小間隔の定義
    const MIN_NOTE_NOTE = 28;
    const MIN_NOTE_BAR  = 32;
    const MIN_BAR_NOTE  = 32;

    function getMinGap(prev: RowElement, cur: RowElement): number {
      if (prev.type === 'note' && cur.type === 'note') return MIN_NOTE_NOTE;
      if (prev.type === 'note' && cur.type === 'bar')  return MIN_NOTE_BAR;
      if (prev.type === 'bar'  && cur.type === 'note') return MIN_BAR_NOTE;
      return 12;
    }

    const NOTE_X_OFFSET = 32;
    const layoutStart = startX + NOTE_X_OFFSET;
    const layoutEnd = endX - 32;
    const elPositions: number[] = [];

    elements.forEach((el, j) => {
      const idealX = startX + ((el.beat - rowStartBeat) / rowBeats) * usableW + NOTE_X_OFFSET;
      if (j === 0) {
        elPositions.push(Math.max(idealX, layoutStart));
      } else {
        const minX = elPositions[j - 1] + getMinGap(elements[j - 1], el);
        elPositions.push(Math.max(idealX, minX));
      }
    });

    // はみ出し時はスケーリング
    if (elPositions.length > 1) {
      const lastX = elPositions[elPositions.length - 1];
      if (lastX > layoutEnd) {
        const firstX = elPositions[0];
        const scale = (layoutEnd - firstX) / (lastX - firstX);
        for (let j = 1; j < elPositions.length; j++) {
          elPositions[j] = firstX + (elPositions[j] - firstX) * scale;
        }
      }
    }

    return { 
      rowStartMeasure, rowEndMeasure, rowMeasureCount, 
      rowStartBeat, rowEndBeat, rowBeats, 
      startX, endX, usableW,
      elements, elPositions
    };
  }

  const rowLayouts = $derived.by(() => {
    const W = containerWidth || 600;
    const [timeSigNum] = playerState.song.timeSignature ?? [4, 4];
    const totalBeats = getOriginalBeats();
    const totalMeasures = Math.ceil(totalBeats / timeSigNum);
    const totalRows = Math.ceil(totalMeasures / MEASURES_PER_ROW);

    const layouts = [];
    for (let row = 0; row < totalRows; row++) {
      layouts.push(getRowLayout(W, row));
    }
    return layouts;
  });

  // Smooth cursor animation
  let animationFrameId: number = 0;
  let cursorStyle = $state({ display: 'none', left: '0px', top: '0px', height: '0px' });

  $effect(() => {
    void rowLayouts;
    void viewMode;
    if (playerState.isPlaying || playerState.isRecording) {
      function updateCursor() {
        if (!scoreContainer) return;

        const displayBeat = getDisplayBeat();
        const originalBeats = getOriginalBeats();
        // Ignore negative beats (count-in)
        if (displayBeat < 0 || rowLayouts.length === 0 || originalBeats === 0) {
          cursorStyle.display = 'none';
          animationFrameId = requestAnimationFrame(updateCursor);
          return;
        }

        // Handle looping correctly
        const beatInLoop = displayBeat % originalBeats;

        // Find which row this beat belongs to
        let targetRowIdx = -1;
        for (let i = 0; i < rowLayouts.length; i++) {
          const isLastRow = i === rowLayouts.length - 1;
          if (beatInLoop >= rowLayouts[i].rowStartBeat &&
              (beatInLoop < rowLayouts[i].rowEndBeat || (isLastRow && beatInLoop <= rowLayouts[i].rowEndBeat))) {
            targetRowIdx = i;
            break;
          }
        }

        if (targetRowIdx !== -1) {
          const layout = rowLayouts[targetRowIdx];
          const rowEl = scoreContainer.querySelector(`#score-row-${targetRowIdx}`) as HTMLElement;

          if (rowEl) {
            // Find bounding X
            let x = layout.startX; // default fallback

            // elements are already sorted by beat
            let leftX = layout.startX;
            let rightX = layout.endX;
            let leftBeat = layout.rowStartBeat;
            let rightBeat = layout.rowEndBeat;

            for (let i = 0; i < layout.elements.length; i++) {
              if (layout.elements[i].beat <= beatInLoop) {
                leftX = layout.elPositions[i];
                leftBeat = layout.elements[i].beat;
              } else {
                rightX = layout.elPositions[i];
                rightBeat = layout.elements[i].beat;
                break;
              }
            }

            // Interpolate position
            const beatDiff = rightBeat - leftBeat;
            if (beatDiff > 0) {
              const progress = (beatInLoop - leftBeat) / beatDiff;
              x = leftX + (rightX - leftX) * progress;
            } else {
              x = leftX;
            }

            const rowRect = rowEl.getBoundingClientRect();
            const containerRect = scoreContainer.getBoundingClientRect();

            // Calculate robust relative top offset
            const rowTop = rowRect.top - containerRect.top + scoreContainer.scrollTop;
            const rowHeight = rowRect.height;

            let top = 0;
            let height = 0;

            // Handle viewMode padding and positioning visually
            if (viewMode === 'staff') {
              top = rowTop + 20;
              height = rowHeight - 65;
            } else if (viewMode === 'tab') {
              top = rowTop + 20;
              height = rowHeight - 20;
            } else {
              top = rowTop + 20;
              height = rowHeight - 40;
            }

            cursorStyle = {
              display: 'block',
              left: `${x}px`,
              top: `${top}px`,
              height: `${height}px`
            };
          }
        } else {
          cursorStyle.display = 'none';
        }

        animationFrameId = requestAnimationFrame(updateCursor);
      }
      animationFrameId = requestAnimationFrame(updateCursor);

      return () => {
        cancelAnimationFrame(animationFrameId);
      };
    } else {
      // Not playing, ensure cursor matches current static position if possible, or hide it
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      cursorStyle.display = 'none';
    }
  });

  // Staff rendering constants
  const lineSpacing = 9;
  const staffTop = 28;
  const staffH = lineSpacing * 4;

  const NOTE_COLORS: Record<string, string> = {
    played: 'rgba(58,245,160,0.65)',
    current: '#c8f53a',
    upcoming: 'rgba(255,255,255,0.25)'
  };

  function getNoteState(i: number) {
    if (i < playerState.currentNoteIdx) return 'played';
    if (i === playerState.currentNoteIdx) return 'current';
    return 'upcoming';
  }

  function getLedgerLines(y: number, x: number, col: string) {
    const lines = [];
    if (y > staffTop + staffH + 1) {
      for (let ly = staffTop + staffH + lineSpacing; ly <= y + 2; ly += lineSpacing)
        lines.push({ x1: x - 8, y1: ly, x2: x + 8, y2: ly, stroke: col });
    }
    if (y < staffTop - 1) {
      for (let ly = staffTop - lineSpacing; ly >= y - 2; ly -= lineSpacing)
        lines.push({ x1: x - 8, y1: ly, x2: x + 8, y2: ly, stroke: col });
    }
    return lines;
  }

  // Tab rendering constants
  const STRINGS = ['G', 'D', 'A', 'E'];
</script>

{#snippet noteBody(nx: number, alpha: number, col: string, y: number, isOpen: boolean, hasStem: boolean, stemDir: number, noteName: string, flagCount: number, isDotted: boolean)}
  {#if isOpen}
    <ellipse cx="{nx}" cy="{y}" rx="5.5" ry="4" fill="none" stroke="{col}" stroke-width="1.5" transform="rotate(-15 {nx} {y})" opacity="{alpha}"/>
  {:else}
    <ellipse cx="{nx}" cy="{y}" rx="5.5" ry="4" fill="{col}" transform="rotate(-15 {nx} {y})" opacity="{alpha}"/>
  {/if}

  {@const stemX = stemDir === 1 ? nx - 5 : nx + 5}
  {@const stemEndY = y + stemDir * 28}
  {#if hasStem}
    <line x1="{stemX}" y1="{y}" x2="{stemX}" y2="{stemEndY}" stroke="{col}" stroke-width="1.5" opacity="{alpha}"/>
  {/if}

  {#if noteName.includes('#')}
    <text x="{nx - 20}" y="{y + 5}" font-size="16" fill="{col}" font-family="serif" opacity="{alpha}">♯</text>
  {:else if noteName.includes('b')}
    <text x="{nx - 20}" y="{y + 4}" font-size="16" fill="{col}" font-family="serif" opacity="{alpha}">♭</text>
  {/if}

  {#if flagCount >= 1 && hasStem}
    {@const d = -stemDir}
    {@const bx = stemX}
    {@const by = stemEndY}
    <path d="M {bx} {by} c 1 {d*3}, 8 {d*6}, 10 {d*14} c -1 {d*-2}, -6 {d*-6}, -10 {d*-8} Z" fill="{col}" opacity="{alpha}"/>
    {#if flagCount >= 2}
      {@const by2 = by - d * 6}
      <path d="M {bx} {by2} c 1 {d*3}, 8 {d*6}, 10 {d*14} c -1 {d*-2}, -6 {d*-6}, -10 {d*-8} Z" fill="{col}" opacity="{alpha}"/>
    {/if}
  {/if}
  {#if isDotted}
    <circle cx="{nx + 9}" cy="{y - 2}" r="1.5" fill="{col}" opacity="{alpha}"/>
  {/if}
{/snippet}

<section class="score-section">
  <div class="sec-hdr">
    SCORE — Measure {Math.floor((playerState.song.notes[playerState.currentNoteIdx]?.beat || 0) / beatsPerMeasure) + 1}
    / {Math.ceil(getOriginalBeats() / beatsPerMeasure)}
    {#if playerState.repeatCount > 1}
      <span class="loop-indicator">{playerState.currentLoop}/{playerState.repeatCount}</span>
    {/if}
  </div>
  <div class="score-tabs">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="stab {viewMode === 'both' ? 'active' : ''}" onclick={() => viewMode = 'both'}>両方</div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="stab {viewMode === 'staff' ? 'active' : ''}" onclick={() => viewMode = 'staff'}>五線譜</div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="stab {viewMode === 'tab' ? 'active' : ''}" onclick={() => viewMode = 'tab'}>タブ譜</div>
  </div>
  <div class="score-area">
    <div bind:this={scoreContainer} bind:clientWidth={containerWidth} class="score-container">
      {#each rowLayouts as layout, row}
        <div id="score-row-{row}" style="position:relative;">
          {#if viewMode === 'staff' || viewMode === 'both'}
            {@const rowH = staffTop + staffH + 70}
            {@const [timeSigNum, timeSigDen] = playerState.song.timeSignature ?? [4, 4]}
            <svg viewBox="0 0 {containerWidth} {rowH}" width="{containerWidth}" height="{rowH}" style="display:block;margin-bottom:4px;">
              <!-- 五線 -->
              {#each Array(5) as _, i}
                {@const y = staffTop + i * lineSpacing}
                <line x1="10" y1="{y}" x2="{containerWidth - 10}" y2="{y}" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
              {/each}

              <!-- ヘ音記号・拍子記号 -->
              {#if row === 0}
                <text x="12" y="{staffTop + lineSpacing * 2 + 8}" font-size="38" fill="rgba(255,255,255,0.65)" font-family="serif" style="line-height:1">𝄢</text>
                <text x="46" y="{staffTop + lineSpacing * 1.5}" font-size="14" fill="rgba(255,255,255,0.6)" font-family="serif" font-weight="bold">{timeSigNum}</text>
                <text x="46" y="{staffTop + lineSpacing * 3.5}" font-size="14" fill="rgba(255,255,255,0.6)" font-family="serif" font-weight="bold">{timeSigDen}</text>
                {#if playerState.song.key}
                  <text x="10" y="{staffTop - 12}" font-size="13" fill="var(--accent)" font-family="'Space Mono',monospace" font-weight="bold">Key: {playerState.song.key}</text>
                {/if}
              {/if}

              <line x1="{layout.startX - 2}" y1="{staffTop}" x2="{layout.startX - 2}" y2="{staffTop + staffH}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
              <line x1="{layout.endX}" y1="{staffTop}" x2="{layout.endX}" y2="{staffTop + staffH}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>

              <!-- 小節番号・小節線 -->
              <text x="{layout.startX}" y="{staffTop - 4}" font-size="7" fill="rgba(255,255,255,0.25)" font-family="'Space Mono',monospace">{layout.rowStartMeasure + 1}</text>
              {#each layout.elements as el, j}
                {#if el.type === 'bar'}
                  {@const bx = layout.elPositions[j]}
                  <line x1="{bx}" y1="{staffTop}" x2="{bx}" y2="{staffTop + staffH}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
                  <text x="{bx + 3}" y="{staffTop - 4}" font-size="7" fill="rgba(255,255,255,0.25)" font-family="'Space Mono',monospace">{el.measureNum}</text>
                {/if}
              {/each}

              <!-- ノート -->
              {#each playerState.song.notes as note, i}
                {#if note.beat >= layout.rowStartBeat && note.beat < layout.rowEndBeat}
                  {@const elIdx = layout.elements.findIndex(el => el.type === 'note' && el.noteIdx === i)}
                  {@const x = layout.elPositions[elIdx]}
                  {@const y = getNoteY(note.name, staffTop, lineSpacing)}
                  {@const noteState = getNoteState(i)}
                  
                  {@const result = noteState === 'played' ? scoreState.noteResults[i] : null}
                  {@const col = (result?.grade && GRADE_COLORS[result.grade]) || NOTE_COLORS[noteState]}
                  
                  {@const timingShift = (result && result.timingDiffMs !== null && result.timingDiffMs !== undefined && result.grade !== 'miss') 
                    ? Math.max(-12, Math.min(12, result.timingDiffMs / 15)) 
                    : (result?.grade === 'miss' && result.timingDiffMs === 200 ? 12 : 0)}
                  {@const hasGhost = Math.abs(timingShift) > 1}
                  {@const ghostX = x + timingShift}

                  {#each getLedgerLines(y, x, col) as ll}
                    <line x1="{ll.x1}" y1="{ll.y1}" x2="{ll.x2}" y2="{ll.y2}" stroke="{ll.stroke}" stroke-width="1"/>
                  {/each}

                  {@const dur = note.dur ?? 1}
                  {@const isWhole = dur >= 4}
                  {@const isHalf = !isWhole && dur >= 2}
                  {@const isOpen = isWhole || isHalf}
                  {@const hasStem = !isWhole}
                  {@const isDotted = dur === 0.75 || dur === 1.5 || dur === 3}
                  {@const flagCount = dur <= 0.25 ? 2 : dur <= 0.5 ? 1 : dur <= 0.75 ? 1 : 0}
                  {@const stemDir = y > staffTop + staffH / 2 ? -1 : 1}

                  {#if hasGhost}
                    {@render noteBody(x, 0.3, col, y, isOpen, hasStem, stemDir, note.name, flagCount, isDotted)}
                    {@render noteBody(ghostX, 1.0, col, y, isOpen, hasStem, stemDir, note.name, flagCount, isDotted)}
                  {:else}
                    {@render noteBody(x, 1.0, col, y, isOpen, hasStem, stemDir, note.name, flagCount, isDotted)}
                  {/if}

                  {#if noteState !== 'upcoming'}
                    <text x="{hasGhost ? ghostX : x}" y="{rowH - 6}" text-anchor="middle" font-size="8" fill="{col}" font-family="'Space Mono',monospace">{note.name.replace(/\d+$/, '')}</text>
                  {/if}
                  {#if noteState === 'current'}
                    <circle cx="{x}" cy="{y}" r="11" fill="none" stroke="{col}" stroke-width="1.5" opacity="0.4"/>
                  {/if}
                {/if}
              {/each}
            </svg>
          {/if}

          {#if viewMode === 'tab' || viewMode === 'both'}
            <div class="tab-area-wrap {viewMode === 'both' ? 'tab-inrow' : ''}">
              <div class="tab-row-container" style="width:{containerWidth}px;position:relative;height:120px;">
                <!-- 弦の横線 (背景) -->
                {#each STRINGS as str, sidx}
                  {@const y = 20 + sidx * 20}
                  <div class="tab-string-line" style="top:{y+10}px;left:10px;right:10px;"></div>
                  <span class="tab-sname" style="position:absolute;top:{y+4}px;left:4px;">{str}</span>
                {/each}

                <!-- 小節線 -->
                <div class="tab-bar-line" style="left:{layout.startX-2}px;height:78px;top:20px;"></div>
                <div class="tab-bar-line" style="left:{layout.endX}px;height:78px;top:20px;"></div>

                {#each layout.elements as el, j}
                  {#if el.type === 'bar'}
                    {@const bx = layout.elPositions[j]}
                    <div class="tab-bar-line" style="left:{bx}px;height:78px;top:20px;"></div>
                    <span style="position:absolute;top:5px;left:{bx+3}px;font-size:7px;color:rgba(255,255,255,0.25);">{el.measureNum}</span>
                  {/if}
                {/each}
                <span style="position:absolute;top:5px;left:{layout.startX}px;font-size:7px;color:rgba(255,255,255,0.25);">{layout.rowStartMeasure+1}</span>

                <!-- ノート -->
                {#each playerState.song.notes as note, i}
                  {#if note.beat >= layout.rowStartBeat && note.beat < layout.rowEndBeat}
                    {@const elIdx = layout.elements.findIndex(el => el.type === 'note' && el.noteIdx === i)}
                    {@const x = layout.elPositions[elIdx]}
                    {@const sidx = STRINGS.indexOf(note.string)}
                    {#if sidx !== -1}
                      {@const y = 20 + sidx * 20}
                      {@const noteState = getNoteState(i)}
                      
                      {@const result = noteState === 'played' ? scoreState.noteResults[i] : null}
                      {@const gradeClass = result?.grade ? `tc-played-${result.grade}` : ''}
                      {@const stateClass = (noteState === 'played' ? 'tc-played' : noteState === 'current' ? 'tc-current' : '') + ' ' + gradeClass}
                      
                      {@const timingShift = (result && result.timingDiffMs !== null && result.timingDiffMs !== undefined && result.grade !== 'miss') 
                        ? Math.max(-12, Math.min(12, result.timingDiffMs / 15)) 
                        : (result?.grade === 'miss' && result.timingDiffMs === 200 ? 12 : 0)}
                      {@const hasGhost = Math.abs(timingShift) > 1}
                      {@const ghostX = x + timingShift}

                      {@const [timeSigNum] = playerState.song.timeSignature ?? [4, 4]}
                      {@const beatNum = (note.beat % timeSigNum) + 1}
                      {@const beatCol = i === playerState.currentNoteIdx ? 'var(--accent)' : 'var(--muted)'}

                      {#if hasGhost}
                        <div class="tab-note-val {stateClass}" style="left:{x-8}px;top:{y+1}px;width:16px;opacity:0.3;">{note.fret}</div>
                        <div class="tab-note-val {stateClass}" style="left:{ghostX-8}px;top:{y+1}px;width:16px;">{note.fret}</div>
                      {:else}
                        <div class="tab-note-val {stateClass}" style="left:{x-8}px;top:{y+1}px;width:16px;">{note.fret}</div>
                      {/if}
                      <div style="position:absolute;top:104px;left:{(hasGhost ? ghostX : x)-10}px;width:20px;text-align:center;font-size:8px;color:{beatCol};font-family:'Space Mono',monospace;">{beatNum}</div>
                    {/if}
                  {/if}
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/each}
      <div id="score-cursor" class="score-cursor" style:display={cursorStyle.display} style:left={cursorStyle.left} style:top={cursorStyle.top} style:height={cursorStyle.height}></div>
    </div>
  </div>
</section>

<style>
.score-section {
  grid-column: 1; grid-row: 1;
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column; overflow: hidden;
}
.sec-hdr {
  font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 3px; color: var(--muted);
  padding: 8px 16px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 8px;
}
.sec-hdr::before { content:''; width:4px; height:4px; background:var(--accent); border-radius:50%; box-shadow:0 0 6px var(--accent); }
.loop-indicator {
  margin-left: auto;
  font-size: 11px;
  font-weight: bold;
  color: var(--accent);
  background: rgba(200,245,58,0.1);
  border: 1px solid rgba(200,245,58,0.3);
  padding: 2px 10px;
  border-radius: 12px;
  letter-spacing: 1px;
}

.score-tabs { display: flex; border-bottom: 1px solid var(--border); }
.stab {
  padding: 8px 16px; font-size: 10px; font-family: 'Space Mono', monospace; letter-spacing: 1px;
  color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s;
}
.stab.active { color: var(--accent); border-bottom-color: var(--accent); }

.score-area {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  background: #0a0e05; padding: 20px 16px;
  position: relative;
}

.score-container { width: 100%; position: relative; }

.score-cursor {
  position: absolute;
  width: 2px;
  background-color: #c8f53a;
  box-shadow: 0 0 8px #c8f53a;
  opacity: 0.8;
  pointer-events: none;
  z-index: 10;
}

.tab-area-wrap {
  font-family: 'Space Mono', monospace;
}
.tab-inrow {
  border-top: 1px solid var(--border);
  padding-top: 20px;
  margin-bottom: 24px;
}
.tab-row-container {
  background: rgba(255,255,255,0.02);
  border-radius: 4px;
}
.tab-string-line {
  position: absolute;
  height: 1px;
  background: rgba(255,255,255,0.12);
  pointer-events: none;
}
.tab-bar-line {
  position: absolute;
  width: 1px;
  background: rgba(255,255,255,0.3);
  pointer-events: none;
}
.tab-sname {
  width: 18px; font-size: 10px; color: var(--muted);
  font-weight: bold;
}
.tab-note-val {
  position: absolute;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: rgba(255,255,255,0.25);
  background: #0a0e05;
  height: 18px;
  transition: all 0.15s;
  z-index: 2;
}
.tab-note-val.tc-played { color: rgba(58,245,160,0.7); }
.tab-note-val.tc-played-perfect { color: var(--accent2); }
.tab-note-val.tc-played-good { color: var(--accent); }
.tab-note-val.tc-played-ok { color: var(--warn); }
.tab-note-val.tc-played-miss { color: var(--danger); }
.tab-note-val.tc-current {
  color: var(--accent); font-weight: 700; 
  text-shadow: 0 0 8px var(--accent);
  font-size: 13px;
}
</style>
