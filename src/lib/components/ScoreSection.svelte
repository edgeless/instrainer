<script lang="ts">
  import { playerState, getOriginalBeats } from '$lib/stores/player.svelte';
  
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

  $effect(() => {
    void playerState.currentSongKey;
    void playerState.isPlaying;
    void playerState.isRecording;
    void playerState.currentBeat;
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

    let html = '';

    if (viewMode === 'staff') {
      staffRows.forEach(r => { html += r; });

    } else if (viewMode === 'tab') {
      html += `<div class="tab-area-wrap">`;
      tabRows.forEach(r => { html += r; });
      html += `</div>`;

    } else {
      // 'both': 五線譜行 → タブ譜行 を行ごとに交互
      for (let row = 0; row < totalRows; row++) {
        if (staffRows[row]) html += staffRows[row];
        if (tabRows[row]) {
          html += `<div class="tab-area-wrap tab-inrow">`;
          html += tabRows[row];
          html += `</div>`;
        }
      }
    }

    scoreContainer.innerHTML = html;
  }

  /** 行ごとの五線譜SVG HTML文字列を配列で返す */
  function buildStaffRows(W: number): string[] {
    const lineSpacing = 9;
    const staffTop = 28;
    const staffH = lineSpacing * 4;
    const rowH = staffTop + staffH + 70;

    const [timeSigNum, timeSigDen] = playerState.song.timeSignature ?? [4, 4];
    const beatsPerMeasure = timeSigNum;
    const notes = playerState.song.notes;
    const totalBeats = getOriginalBeats();
    const totalMeasures = Math.ceil(totalBeats / beatsPerMeasure);
    const totalRows = Math.ceil(totalMeasures / MEASURES_PER_ROW);

    const clefW = 62;
    const NOTE_X_OFFSET = 6;
    const NOTE_COLORS: Record<string, string> = {
      played: 'rgba(58,245,160,0.65)',
      current: '#c8f53a',
      upcoming: 'rgba(255,255,255,0.25)'
    };

    const rows: string[] = [];

    for (let row = 0; row < totalRows; row++) {
      const rowStartMeasure = row * MEASURES_PER_ROW;
      const rowEndMeasure = Math.min(rowStartMeasure + MEASURES_PER_ROW, totalMeasures);
      const rowMeasureCount = rowEndMeasure - rowStartMeasure;

      const rowStartBeat = rowStartMeasure * beatsPerMeasure;
      const rowEndBeat = rowEndMeasure * beatsPerMeasure;
      const rowBeats = rowEndBeat - rowStartBeat;

      const isFirstRow = row === 0;
      const startX = isFirstRow ? clefW : 24;
      const endX = W - 12;
      const usableW = endX - startX;
      const beatSpacing = usableW / rowBeats;

      let html = '';

      // 五線
      for (let i = 0; i < 5; i++) {
        const y = staffTop + i * lineSpacing;
        html += `<line x1="10" y1="${y}" x2="${W - 10}" y2="${y}" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>`;
      }

      // ヘ音記号・拍子記号（最初の行のみ）
      if (isFirstRow) {
        html += `<text x="12" y="${staffTop + lineSpacing * 2 + 8}" font-size="38" fill="rgba(255,255,255,0.65)" font-family="serif" style="line-height:1">𝄢</text>`;
        html += `<text x="46" y="${staffTop + lineSpacing * 1.5}" font-size="14" fill="rgba(255,255,255,0.6)" font-family="serif" font-weight="bold">${timeSigNum}</text>`;
        html += `<text x="46" y="${staffTop + lineSpacing * 3.5}" font-size="14" fill="rgba(255,255,255,0.6)" font-family="serif" font-weight="bold">${timeSigDen}</text>`;
      }

      // 行先頭の縦線
      html += `<line x1="${startX - 2}" y1="${staffTop}" x2="${startX - 2}" y2="${staffTop + staffH}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>`;

      // 行末縦線
      html += `<line x1="${endX}" y1="${staffTop}" x2="${endX}" y2="${staffTop + staffH}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>`;

      // ── 統合レイアウト: 音符と小節線を一括配置 ──
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
      const MIN_NOTE_NOTE = 22;  // 音符⇔音符
      const MIN_NOTE_BAR  = 16;  // 音符⇔小節線
      const MIN_BAR_NOTE  = 16;  // 小節線⇔音符

      function getMinGap(prev: RowElement, cur: RowElement): number {
        if (prev.type === 'note' && cur.type === 'note') return MIN_NOTE_NOTE;
        if (prev.type === 'note' && cur.type === 'bar')  return MIN_NOTE_BAR;
        if (prev.type === 'bar'  && cur.type === 'note') return MIN_BAR_NOTE;
        return 12; // bar⇔bar（通常起きない）
      }

      // 理想位置（ビート比例）を計算し、最小間隔を適用
      const elPositions: number[] = [];
      const layoutStart = startX + NOTE_X_OFFSET;
      const layoutEnd = endX - 8;

      elements.forEach((el, j) => {
        const idealX = startX + ((el.beat - rowStartBeat) / rowBeats) * usableW + NOTE_X_OFFSET;
        if (j === 0) {
          elPositions.push(Math.max(idealX, layoutStart));
        } else {
          const minX = elPositions[j - 1] + getMinGap(elements[j - 1], el);
          elPositions.push(Math.max(idealX, minX));
        }
      });

      // はみ出し時はスケーリングで収める
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

      // 位置のルックアップマップを構築
      const noteXMap = new Map<number, number>();
      const barXMap = new Map<number, number>();

      elements.forEach((el, j) => {
        if (el.type === 'note') noteXMap.set(el.noteIdx, elPositions[j]);
        else barXMap.set(el.measureNum, elPositions[j]);
      });

      // ── 小節線・小節番号の描画 ──
      // 行先頭の小節番号
      html += `<text x="${layoutStart}" y="${staffTop - 4}" font-size="7" fill="rgba(255,255,255,0.25)" font-family="'Space Mono',monospace">${rowStartMeasure + 1}</text>`;

      for (let m = 1; m < rowMeasureCount; m++) {
        const mNum = rowStartMeasure + m + 1;
        const bx = barXMap.get(mNum) ?? (startX + ((m * beatsPerMeasure) / rowBeats) * usableW + NOTE_X_OFFSET);
        html += `<line x1="${bx}" y1="${staffTop}" x2="${bx}" y2="${staffTop + staffH}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>`;
        html += `<text x="${bx + 3}" y="${staffTop - 4}" font-size="7" fill="rgba(255,255,255,0.25)" font-family="'Space Mono',monospace">${mNum}</text>`;
      }

      // ── ノート描画 ──
      notes.forEach((note, i) => {
        if (note.beat < rowStartBeat || note.beat >= rowEndBeat) return;

        const x = noteXMap.get(i) ?? (startX + ((note.beat - rowStartBeat) / rowBeats) * usableW + NOTE_X_OFFSET);
        const y = getNoteY(note.name, staffTop, lineSpacing);

        let noteState = 'upcoming';
        if (i < playerState.currentNoteIdx) noteState = 'played';
        else if (i === playerState.currentNoteIdx) noteState = 'current';
        const col = NOTE_COLORS[noteState];

        // 加線（下）
        if (y > staffTop + staffH + 1) {
          for (let ly = staffTop + staffH + lineSpacing; ly <= y + 2; ly += lineSpacing)
            html += `<line x1="${x - 8}" y1="${ly}" x2="${x + 8}" y2="${ly}" stroke="${col}" stroke-width="1"/>`;
        }
        // 加線（上）
        if (y < staffTop - 1) {
          for (let ly = staffTop - lineSpacing; ly >= y - 2; ly -= lineSpacing)
            html += `<line x1="${x - 8}" y1="${ly}" x2="${x + 8}" y2="${ly}" stroke="${col}" stroke-width="1"/>`;
        }

        // durationに基づく音符の描き分け
        const dur = note.dur ?? 1;
        const isWhole = dur >= 4;
        const isHalf = !isWhole && dur >= 2;
        const isOpen = isWhole || isHalf;
        const hasStem = !isWhole;
        const isDotted = dur === 0.75 || dur === 1.5 || dur === 3;
        const flagCount = dur <= 0.25 ? 2 : dur <= 0.5 ? 1 : dur <= 0.75 ? 1 : 0;

        // 符頭
        if (isOpen) {
          html += `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="4" fill="none" stroke="${col}" stroke-width="1.5" transform="rotate(-15 ${x} ${y})"/>`;
        } else {
          html += `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="4" fill="${col}" transform="rotate(-15 ${x} ${y})"/>`;
        }

        // 符幹
        const stemDir = y > staffTop + staffH / 2 ? -1 : 1;
        const stemX = stemDir === 1 ? x - 5 : x + 5;
        const stemEndY = y + stemDir * 28;
        if (hasStem) {
          html += `<line x1="${stemX}" y1="${y}" x2="${stemX}" y2="${stemEndY}" stroke="${col}" stroke-width="1.5"/>`;
        }

        // 旗（8分・16分音符）
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

        // 付点
        if (isDotted) {
          html += `<circle cx="${x + 9}" cy="${y - 2}" r="1.5" fill="${col}"/>`;
        }

        // 演奏済み音名
        if (noteState !== 'upcoming')
          html += `<text x="${x}" y="${rowH - 6}" text-anchor="middle" font-size="8" fill="${col}" font-family="'Space Mono',monospace">${note.name}</text>`;
        // 現在音のハイライト
        if (noteState === 'current')
          html += `<circle cx="${x}" cy="${y}" r="11" fill="none" stroke="${col}" stroke-width="1.5" opacity="0.4"/>`;
      });

      // 再生カーソル
      if (playerState.isPlaying || playerState.isRecording) {
        const curNote = notes[playerState.currentNoteIdx];
        if (curNote && curNote.beat >= rowStartBeat && curNote.beat < rowEndBeat) {
          const px = noteXMap.get(playerState.currentNoteIdx)
            ?? (startX + ((curNote.beat - rowStartBeat) / rowBeats) * usableW + NOTE_X_OFFSET);
          html += `<line x1="${px - 14}" y1="${staffTop - 8}" x2="${px - 14}" y2="${staffTop + staffH + 8}" stroke="#c8f53a" stroke-width="1.5" opacity="0.8"/>`;
        }
      }

      rows.push(`<svg viewBox="0 0 ${W} ${rowH}" width="${W}" height="${rowH}" style="display:block;margin-bottom:4px;">${html}</svg>`);
    }

    return rows;
  }

  /** 行ごとのタブ譜 HTML 文字列を配列で返す */
  function buildTabRows(W: number): string[] {
    const notes = playerState.song.notes;
    const STRINGS = ['G', 'D', 'A', 'E'];
    const [timeSigNum] = playerState.song.timeSignature ?? [4, 4];
    const beatsPerMeasure = timeSigNum;
    const totalBeats = getOriginalBeats();
    const totalMeasures = Math.ceil(totalBeats / beatsPerMeasure);

    const labelW = 18;
    const beatsPerRow = MEASURES_PER_ROW * beatsPerMeasure;
    const totalRows = Math.ceil(totalMeasures / MEASURES_PER_ROW);
    const usableW = W - labelW - 8;
    const beatPx = Math.max(24, Math.floor(usableW / beatsPerRow));

    const rows: string[] = [];

    for (let row = 0; row < totalRows; row++) {
      const rowStartBeat = row * beatsPerRow;
      const rowEndBeat = Math.min(rowStartBeat + beatsPerRow, totalBeats);

      const rowNotes = notes.map((note, i) => ({ note, i }))
        .filter(({ note }) => note.beat >= rowStartBeat && note.beat < rowEndBeat);

      if (rowNotes.length === 0) continue;

      let html = '';

      STRINGS.forEach(str => {
        html += `<div class="tab-row"><span class="tab-sname">${str}</span><div class="tab-cells">`;
        rowNotes.forEach(({ note, i }) => {
          const state = i < playerState.currentNoteIdx ? 'tc-played' : i === playerState.currentNoteIdx ? 'tc-current' : '';
          const content = note.string === str ? note.fret.toString() : '─';
          const beatInRow = note.beat - rowStartBeat;
          const isMeasureStart = beatInRow > 0 && beatInRow % beatsPerMeasure === 0;
          const borderStyle = isMeasureStart ? 'border-left: 1.5px solid rgba(255,255,255,0.35);' : '';
          html += `<div class="tab-cell ${state}" style="width:${beatPx}px;${borderStyle}">${content}</div>`;
        });
        html += `</div></div>`;
      });

      // ビート番号行
      html += `<div style="display:flex;padding-left:${labelW}px;margin-top:3px;margin-bottom:8px;">`;
      rowNotes.forEach(({ note, i }) => {
        const beat = (note.beat % beatsPerMeasure) + 1;
        const col = i === playerState.currentNoteIdx ? 'var(--accent)' : 'var(--muted)';
        const beatInRow = note.beat - rowStartBeat;
        const isMeasureStart = beatInRow > 0 && beatInRow % beatsPerMeasure === 0;
        const borderStyle = isMeasureStart ? 'border-left: 1.5px solid rgba(255,255,255,0.2);' : '';
        html += `<div style="width:${beatPx}px;text-align:center;font-size:8px;color:${col};font-family:'Space Mono',monospace;${borderStyle}">${beat}</div>`;
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

.score-container { width: 100%; }

:global(.tab-area-wrap) {
  font-family: 'Space Mono', monospace; font-size: 12px;
}
:global(.tab-inrow) {
  border-top: 1px solid var(--border);
  padding-top: 8px;
  margin-bottom: 20px;
}
:global(.tab-row) { display: flex; align-items: center; height: 20px; border-bottom: 1px solid rgba(255,255,255,0.12); }
:global(.tab-sname) { width: 18px; font-size: 10px; color: var(--muted); flex-shrink: 0; }
:global(.tab-cells) { display: flex; flex: 1; }
:global(.tab-cell) {
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: rgba(255,255,255,0.25);
  transition: color 0.15s;
  flex-shrink: 0;
}
:global(.tab-cell.tc-played) { color: rgba(58,245,160,0.7); }
:global(.tab-cell.tc-current) { color: var(--accent); font-weight: 700; text-shadow: 0 0 8px var(--accent); }
</style>
