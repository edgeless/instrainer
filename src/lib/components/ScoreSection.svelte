<script lang="ts">
  import { playerState, getOriginalBeats, getDisplayBeat } from '$lib/stores/player.svelte';
  import { scoreState } from '$lib/stores/score.svelte';
  import { escapeHtml } from '$lib/utils/security';
  
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

  function getNoteY(noteName: string, topY: number, lineSpacing: number) {
    const baseNote = noteName.replace(/[#b]/g, '');
    const offset = DIATONIC_POSITIONS[baseNote] ?? 6;
    return topY + offset * (lineSpacing / 2);
  }

  // 単一の出力先コンテナ
  let scoreContainer: HTMLDivElement | undefined = $state();

  // 行のレイアウト情報を保存。
  // 注意: renderScore() のみで更新され、updateCursor() からは読み取り専用として扱われます。
  type RowLayout = ReturnType<typeof getRowLayout>;
  let activeLayouts: RowLayout[] = [];

  $effect(() => {
    void playerState.currentSongKey;
    // We intentionally removed currentBeat from triggering renderScore.
    // Instead, it is handled by the new smooth cursor animation loop.
    // However, if the currentNoteIdx changes, or playback state changes
    // (which might affect current/upcoming note colors when pausing),
    // we still need to trigger renderScore.
    void playerState.isPlaying;
    void playerState.isRecording;
    void playerState.currentNoteIdx;
    requestAnimationFrame(renderScore);
  });

  // viewMode の切り替え時にも即再描画
  $effect(() => {
    void viewMode;
    requestAnimationFrame(renderScore);
  });

  function renderScore() {
    if (!scoreContainer) return;
    const W = scoreContainer.clientWidth || 600;
    const staffRows = buildStaffRows(W);
    const tabRows = buildTabRows(W);
    const totalRows = Math.max(staffRows.length, tabRows.length);

    // Save layouts for cursor calculation
    activeLayouts = [];
    for (let row = 0; row < totalRows; row++) {
      activeLayouts.push(getRowLayout(W, row));
    }

    let html = '';

    if (viewMode === 'staff') {
      staffRows.forEach((r, i) => {
        html += `<div id="score-row-${i}" style="position:relative;">${r}</div>`;
      });

    } else if (viewMode === 'tab') {
      html += `<div class="tab-area-wrap">`;
      tabRows.forEach((r, i) => {
        html += `<div id="score-row-${i}" style="position:relative;">${r}</div>`;
      });
      html += `</div>`;

    } else {
      // 'both': 五線譜行 → タブ譜行 を行ごとに交互
      for (let row = 0; row < totalRows; row++) {
        html += `<div id="score-row-${row}" style="position:relative;">`;
        if (staffRows[row]) html += staffRows[row];
        if (tabRows[row]) {
          html += `<div class="tab-area-wrap tab-inrow">`;
          html += tabRows[row];
          html += `</div>`;
        }
        html += `</div>`;
      }
    }

    html += `<div id="score-cursor" class="score-cursor"></div>`;

    scoreContainer.innerHTML = html;
  }

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

  /** 行ごとの五線譜SVG HTML文字列を配列で返す */
  function buildStaffRows(W: number): string[] {
    const lineSpacing = 9;
    const staffTop = 28;
    const staffH = lineSpacing * 4;
    const rowH = staffTop + staffH + 70;

    const [timeSigNum, timeSigDen] = playerState.song.timeSignature ?? [4, 4];
    const notes = playerState.song.notes;
    const totalBeats = getOriginalBeats();
    const totalMeasures = Math.ceil(totalBeats / timeSigNum);
    const totalRows = Math.ceil(totalMeasures / MEASURES_PER_ROW);

    const NOTE_COLORS: Record<string, string> = {
      played: 'rgba(58,245,160,0.65)',
      current: '#c8f53a',
      upcoming: 'rgba(255,255,255,0.25)'
    };

    const GRADE_COLORS: Record<string, string> = {
      perfect: 'var(--accent2)',
      good: 'var(--accent)',
      ok: 'var(--warn)',
      miss: 'var(--danger)'
    };

    const rows: string[] = [];

    for (let row = 0; row < totalRows; row++) {
      const layout = getRowLayout(W, row);
      let html = '';

      // 五線
      for (let i = 0; i < 5; i++) {
        const y = staffTop + i * lineSpacing;
        html += `<line x1="10" y1="${y}" x2="${W - 10}" y2="${y}" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>`;
      }

      // ヘ音記号・拍子記号
      if (row === 0) {
        html += `<text x="12" y="${staffTop + lineSpacing * 2 + 8}" font-size="38" fill="rgba(255,255,255,0.65)" font-family="serif" style="line-height:1">𝄢</text>`;
        html += `<text x="46" y="${staffTop + lineSpacing * 1.5}" font-size="14" fill="rgba(255,255,255,0.6)" font-family="serif" font-weight="bold">${escapeHtml(timeSigNum)}</text>`;
        html += `<text x="46" y="${staffTop + lineSpacing * 3.5}" font-size="14" fill="rgba(255,255,255,0.6)" font-family="serif" font-weight="bold">${escapeHtml(timeSigDen)}</text>`;
        if (playerState.song.key) {
          html += `<text x="10" y="${staffTop - 12}" font-size="13" fill="var(--accent)" font-family="'Space Mono',monospace" font-weight="bold">Key: ${escapeHtml(playerState.song.key)}</text>`;
        }
      }

      html += `<line x1="${layout.startX - 2}" y1="${staffTop}" x2="${layout.startX - 2}" y2="${staffTop + staffH}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>`;
      html += `<line x1="${layout.endX}" y1="${staffTop}" x2="${layout.endX}" y2="${staffTop + staffH}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>`;

      // 全体ノート情報のインデックスをマッピング
      const nodeLayoutMap = new Map<number, number>();
      layout.elements.forEach((el, j) => {
        if (el.type === 'note') nodeLayoutMap.set(el.noteIdx, layout.elPositions[j]);
      });

      // 小節番号・小節線
      html += `<text x="${layout.startX}" y="${staffTop - 4}" font-size="7" fill="rgba(255,255,255,0.25)" font-family="'Space Mono',monospace">${layout.rowStartMeasure + 1}</text>`;
      layout.elements.forEach((el, j) => {
        if (el.type === 'bar') {
          const bx = layout.elPositions[j];
          html += `<line x1="${bx}" y1="${staffTop}" x2="${bx}" y2="${staffTop + staffH}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>`;
          html += `<text x="${bx + 3}" y="${staffTop - 4}" font-size="7" fill="rgba(255,255,255,0.25)" font-family="'Space Mono',monospace">${el.measureNum}</text>`;
        }
      });

      // ノート
      notes.forEach((note, i) => {
        if (note.beat < layout.rowStartBeat || note.beat >= layout.rowEndBeat) return;
        const x = nodeLayoutMap.get(i)!;
        const y = getNoteY(note.name, staffTop, lineSpacing);

        let noteState = 'upcoming';
        if (i < playerState.currentNoteIdx) noteState = 'played';
        else if (i === playerState.currentNoteIdx) noteState = 'current';

        let col = NOTE_COLORS[noteState];
        if (noteState === 'played') {
          const result = scoreState.noteResults[i];
          if (result && result.grade) {
            col = GRADE_COLORS[result.grade] || col;
          }
        }

        if (y > staffTop + staffH + 1) {
          for (let ly = staffTop + staffH + lineSpacing; ly <= y + 2; ly += lineSpacing)
            html += `<line x1="${x - 8}" y1="${ly}" x2="${x + 8}" y2="${ly}" stroke="${col}" stroke-width="1"/>`;
        }
        if (y < staffTop - 1) {
          for (let ly = staffTop - lineSpacing; ly >= y - 2; ly -= lineSpacing)
            html += `<line x1="${x - 8}" y1="${ly}" x2="${x + 8}" y2="${ly}" stroke="${col}" stroke-width="1"/>`;
        }

        const dur = note.dur ?? 1;
        const isWhole = dur >= 4;
        const isHalf = !isWhole && dur >= 2;
        const isOpen = isWhole || isHalf;
        const hasStem = !isWhole;
        const isDotted = dur === 0.75 || dur === 1.5 || dur === 3;
        const flagCount = dur <= 0.25 ? 2 : dur <= 0.5 ? 1 : dur <= 0.75 ? 1 : 0;

        if (isOpen) {
          html += `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="4" fill="none" stroke="${col}" stroke-width="1.5" transform="rotate(-15 ${x} ${y})"/>`;
        } else {
          html += `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="4" fill="${col}" transform="rotate(-15 ${x} ${y})"/>`;
        }

        const stemDir = y > staffTop + staffH / 2 ? -1 : 1;
        const stemX = stemDir === 1 ? x - 5 : x + 5;
        const stemEndY = y + stemDir * 28;
        if (hasStem) {
          html += `<line x1="${stemX}" y1="${y}" x2="${stemX}" y2="${stemEndY}" stroke="${col}" stroke-width="1.5"/>`;
        }

        // 臨時記号 (Accidentals)
        if (note.name.includes('#')) {
          html += `<text x="${x - 20}" y="${y + 5}" font-size="16" fill="${col}" font-family="serif">♯</text>`;
        } else if (note.name.includes('b')) {
          html += `<text x="${x - 20}" y="${y + 4}" font-size="16" fill="${col}" font-family="serif">♭</text>`;
        }

        if (flagCount >= 1 && hasStem) {
          const d = -stemDir;
          const bx = stemX;
          const by = stemEndY;
          html += `<path d="M ${bx} ${by} c 1 ${d*3}, 8 ${d*6}, 10 ${d*14} c -1 ${d*-2}, -6 ${d*-6}, -10 ${d*-8} Z" fill="${col}"/>`;
          if (flagCount >= 2) {
            const by2 = by - d * 6;
            html += `<path d="M ${bx} ${by2} c 1 ${d*3}, 8 ${d*6}, 10 ${d*14} c -1 ${d*-2}, -6 ${d*-6}, -10 ${d*-8} Z" fill="${col}"/>`;
          }
        }
        if (isDotted) {
          html += `<circle cx="${x + 9}" cy="${y - 2}" r="1.5" fill="${col}"/>`;
        }
        if (noteState !== 'upcoming')
          html += `<text x="${x}" y="${rowH - 6}" text-anchor="middle" font-size="8" fill="${col}" font-family="'Space Mono',monospace">${escapeHtml(note.name.replace(/\d+$/, ''))}</text>`;
        if (noteState === 'current')
          html += `<circle cx="${x}" cy="${y}" r="11" fill="none" stroke="${col}" stroke-width="1.5" opacity="0.4"/>`;
      });

      rows.push(`<svg viewBox="0 0 ${W} ${rowH}" width="${W}" height="${rowH}" style="display:block;margin-bottom:4px;">${html}</svg>`);
    }

    return rows;
  }

  /** 行ごとのタブ譜 HTML 文字列を配列で返す */
  function buildTabRows(W: number): string[] {
    const notes = playerState.song.notes;
    const STRINGS = ['G', 'D', 'A', 'E'];
    const [timeSigNum] = playerState.song.timeSignature ?? [4, 4];
    const totalBeats = getOriginalBeats();
    const totalMeasures = Math.ceil(totalBeats / timeSigNum);
    const totalRows = Math.ceil(totalMeasures / MEASURES_PER_ROW);

    const rows: string[] = [];

    for (let row = 0; row < totalRows; row++) {
      const layout = getRowLayout(W, row);
      let html = `<div class="tab-row-container" style="width:${W}px;position:relative;height:120px;">`;

      // 弦の横線 (背景)
      STRINGS.forEach((str, sidx) => {
        const y = 20 + sidx * 20;
        html += `<div class="tab-string-line" style="top:${y+10}px;left:10px;right:10px;"></div>`;
        html += `<span class="tab-sname" style="position:absolute;top:${y+4}px;left:4px;">${str}</span>`;
      });

      // 小節線
      html += `<div class="tab-bar-line" style="left:${layout.startX-2}px;height:78px;top:20px;"></div>`;
      html += `<div class="tab-bar-line" style="left:${layout.endX}px;height:78px;top:20px;"></div>`;

      layout.elements.forEach((el, j) => {
        if (el.type === 'bar') {
          const bx = layout.elPositions[j];
          html += `<div class="tab-bar-line" style="left:${bx}px;height:78px;top:20px;"></div>`;
          html += `<span style="position:absolute;top:5px;left:${bx+3}px;font-size:7px;color:rgba(255,255,255,0.25);">${el.measureNum}</span>`;
        }
      });
      html += `<span style="position:absolute;top:5px;left:${layout.startX}px;font-size:7px;color:rgba(255,255,255,0.25);">${layout.rowStartMeasure+1}</span>`;

      // ノート
      notes.forEach((note, i) => {
        if (note.beat < layout.rowStartBeat || note.beat >= layout.rowEndBeat) return;

        const x = layout.elPositions[layout.elements.findIndex(el => el.type === 'note' && el.noteIdx === i)];
        const sidx = STRINGS.indexOf(note.string);
        if (sidx === -1) return;

        const y = 20 + sidx * 20;
        let state = i < playerState.currentNoteIdx ? 'tc-played' : i === playerState.currentNoteIdx ? 'tc-current' : '';
        if (state === 'tc-played') {
          const result = scoreState.noteResults[i];
          if (result && result.grade) {
            state = `tc-played-${result.grade}`;
          }
        }

        const beatNum = (note.beat % timeSigNum) + 1;
        const beatCol = i === playerState.currentNoteIdx ? 'var(--accent)' : 'var(--muted)';

        html += `<div class="tab-note-val ${state}" style="left:${x-8}px;top:${y+1}px;width:16px;">${escapeHtml(note.fret)}</div>`;
        html += `<div style="position:absolute;top:104px;left:${x-10}px;width:20px;text-align:center;font-size:8px;color:${beatCol};font-family:'Space Mono',monospace;">${escapeHtml(beatNum)}</div>`;
      });

      html += `</div>`;
      rows.push(html);
    }

    return rows;
  }
  
  $effect(() => {
    const onResize = () => requestAnimationFrame(renderScore);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  // Smooth cursor animation
  let animationFrameId: number = 0;

  $effect(() => {
    if (playerState.isPlaying || playerState.isRecording) {
      function updateCursor() {
        if (!scoreContainer) return;
        const cursorEl = scoreContainer.querySelector('#score-cursor') as HTMLElement;
        if (!cursorEl) return;

        const displayBeat = getDisplayBeat();
        const originalBeats = getOriginalBeats();
        // Ignore negative beats (count-in)
        if (displayBeat < 0 || activeLayouts.length === 0 || originalBeats === 0) {
          cursorEl.style.display = 'none';
          animationFrameId = requestAnimationFrame(updateCursor);
          return;
        }

        // Handle looping correctly
        const beatInLoop = displayBeat % originalBeats;

        // Find which row this beat belongs to
        let targetRowIdx = -1;
        for (let i = 0; i < activeLayouts.length; i++) {
          const isLastRow = i === activeLayouts.length - 1;
          if (beatInLoop >= activeLayouts[i].rowStartBeat &&
              (beatInLoop < activeLayouts[i].rowEndBeat || (isLastRow && beatInLoop <= activeLayouts[i].rowEndBeat))) {
            targetRowIdx = i;
            break;
          }
        }

        if (targetRowIdx !== -1) {
          const layout = activeLayouts[targetRowIdx];
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

            cursorEl.style.display = 'block';
            cursorEl.style.left = `${x}px`;

            // Handle viewMode padding and positioning visually
            if (viewMode === 'staff') {
              cursorEl.style.top = `${rowTop + 20}px`;
              cursorEl.style.height = `${rowHeight - 65}px`;
            } else if (viewMode === 'tab') {
              cursorEl.style.top = `${rowTop + 20}px`;
              cursorEl.style.height = `${rowHeight - 20}px`;
            } else {
              cursorEl.style.top = `${rowTop + 20}px`;
              cursorEl.style.height = `${rowHeight - 40}px`;
            }
          }
        } else {
          cursorEl.style.display = 'none';
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
      if (scoreContainer) {
        const cursorEl = scoreContainer.querySelector('#score-cursor') as HTMLElement;
        if (cursorEl) {
           // We can keep it hidden when paused, or optionally position it statically
           // For now, let's just hide it when not playing since the highlight does the job,
           // or we can implement static positioning.
           // Since the original cursor was only shown if (isPlaying || isRecording),
           // we'll maintain that logic and hide it.
           cursorEl.style.display = 'none';
        }
      }
    }
  });
</script>

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
    <div bind:this={scoreContainer} class="score-container"></div>
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

:global(.score-cursor) {
  position: absolute;
  width: 2px;
  background-color: #c8f53a;
  box-shadow: 0 0 8px #c8f53a;
  opacity: 0.8;
  pointer-events: none;
  z-index: 10;
  display: none;
}

:global(.tab-area-wrap) {
  font-family: 'Space Mono', monospace;
}
:global(.tab-inrow) {
  border-top: 1px solid var(--border);
  padding-top: 20px;
  margin-bottom: 24px;
}
:global(.tab-row-container) {
  background: rgba(255,255,255,0.02);
  border-radius: 4px;
}
:global(.tab-string-line) {
  position: absolute;
  height: 1px;
  background: rgba(255,255,255,0.12);
  pointer-events: none;
}
:global(.tab-bar-line) {
  position: absolute;
  width: 1px;
  background: rgba(255,255,255,0.3);
  pointer-events: none;
}
:global(.tab-sname) {
  width: 18px; font-size: 10px; color: var(--muted);
  font-weight: bold;
}
:global(.tab-note-val) {
  position: absolute;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: rgba(255,255,255,0.25);
  background: #0a0e05;
  height: 18px;
  transition: all 0.15s;
  z-index: 2;
}
:global(.tab-note-val.tc-played) { color: rgba(58,245,160,0.7); }
:global(.tab-note-val.tc-played-perfect) { color: var(--accent2); }
:global(.tab-note-val.tc-played-good) { color: var(--accent); }
:global(.tab-note-val.tc-played-ok) { color: var(--warn); }
:global(.tab-note-val.tc-played-miss) { color: var(--danger); }
:global(.tab-note-val.tc-current) { 
  color: var(--accent); font-weight: 700; 
  text-shadow: 0 0 8px var(--accent);
  font-size: 13px;
}
</style>
