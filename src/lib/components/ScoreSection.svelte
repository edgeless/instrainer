<script lang="ts">
  import { playerState, getTotalBeats } from '$lib/stores/player.svelte';
  
  let viewMode = $state('both');

  const BASS_NOTE_OFFSETS: Record<string, number> = {
    'E1':10,'F1':9.5,'G1':9,'Ab1':8.5,'A1':8,'Bb1':7.5,'B1':7,
    'C2':6.5,'Db2':6,'D2':6,'Eb2':5.5,'E2':5,'F2':4.5,'F#2':4.5,'Gb2':4.5,
    'G2':4,'Ab2':3.5,'A2':3,'Bb2':2.5,'B2':2,
    'C3':1.5,'Db3':1,'D3':1,'Eb3':0.5,'E3':0,'F3':-0.5,'G3':-1,'A3':-1.5,'Bb3':-2
  };
  function getNoteY(noteName: string, topY: number, lineSpacing: number) {
    const offset = BASS_NOTE_OFFSETS[noteName] ?? 5;
    return topY + offset * (lineSpacing / 2);
  }

  // To prevent constant DOM recreation, we can bind:this the elements and use an effect,
  // or since it only depends on state, we can use an effect and update the canvas/DOM.
  // We'll just define an effect that uses the old DOM string generation so it renders identically.
  let staffSvg: SVGSVGElement | undefined = $state();
  let tabArea: HTMLDivElement | undefined = $state();
  
  $effect(() => {
    // Re-run whenever relevant state changes
    void playerState.currentSongKey;
    void playerState.isPlaying;
    void playerState.isRecording;
    void playerState.currentBeat;
    void playerState.currentNoteIdx;
    
    // We defer actual drawing to avoid partial updates causing glitches
    requestAnimationFrame(renderScore);
  });

  function renderScore() {
    if (staffSvg) renderStaff();
    if (tabArea) renderTab();
  }

  function renderStaff() {
    if (!staffSvg) return;
    const svg = staffSvg;
    const W = svg.parentElement?.clientWidth || 600;
    const lineSpacing = 9;
    const staffTop = 28;
    const staffH = lineSpacing * 4;
    const svgH = staffTop + staffH + 30;

    svg.setAttribute('viewBox', `0 0 ${W} ${svgH}`);
    svg.setAttribute('height', svgH.toString());

    let html = '';
    for(let i=0;i<5;i++){
      const y = staffTop + i * lineSpacing;
      html += `<line x1="10" y1="${y}" x2="${W-10}" y2="${y}" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>`;
    }

    html += `<text x="12" y="${staffTop + lineSpacing*2 + 8}" font-size="38" fill="rgba(255,255,255,0.65)" font-family="serif" style="line-height:1">𝄢</text>`;
    html += `<text x="46" y="${staffTop + lineSpacing*1.5}" font-size="14" fill="rgba(255,255,255,0.6)" font-family="serif" font-weight="bold">4</text>`;
    html += `<text x="46" y="${staffTop + lineSpacing*3.5}" font-size="14" fill="rgba(255,255,255,0.6)" font-family="serif" font-weight="bold">4</text>`;

    const notes = playerState.song.notes;
    const totalBeats = getTotalBeats();
    const startX = 72;
    const endX = W - 20;
    const usableW = endX - startX;

    const NOTE_COLORS: Record<string, string> = { played:'rgba(58,245,160,0.65)', current:'#c8f53a', upcoming:'rgba(255,255,255,0.25)' };

    notes.forEach((note, i) => {
      const x = startX + (note.beat / totalBeats) * usableW + 6;
      const y = getNoteY(note.name, staffTop, lineSpacing);

      let state = 'upcoming';
      if(i < playerState.currentNoteIdx) state = 'played';
      else if(i === playerState.currentNoteIdx) state = 'current';
      const col = NOTE_COLORS[state];

      if(y > staffTop + staffH + 1){
        for(let ly = staffTop + staffH + lineSpacing; ly <= y + 2; ly += lineSpacing){
          html += `<line x1="${x-8}" y1="${ly}" x2="${x+8}" y2="${ly}" stroke="${col}" stroke-width="1"/>`;
        }
      }
      if(y < staffTop - 1){
        for(let ly = staffTop - lineSpacing; ly >= y - 2; ly -= lineSpacing){
          html += `<line x1="${x-8}" y1="${ly}" x2="${x+8}" y2="${ly}" stroke="${col}" stroke-width="1"/>`;
        }
      }

      html += `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="4" fill="${col}" transform="rotate(-15 ${x} ${y})"/>`;
      const stemDir = y > staffTop + staffH/2 ? -1 : 1;
      const stemLen = 28;
      const stemX = stemDir === 1 ? x + 5 : x - 5;
      html += `<line x1="${stemX}" y1="${y}" x2="${stemX}" y2="${y + stemDir * stemLen}" stroke="${col}" stroke-width="1.5"/>`;

      if(state !== 'upcoming'){
        html += `<text x="${x}" y="${svgH - 4}" text-anchor="middle" font-size="8" fill="${col}" font-family="'Space Mono',monospace">${note.name}</text>`;
      }
      if(state === 'current'){
        html += `<circle cx="${x}" cy="${y}" r="11" fill="none" stroke="${col}" stroke-width="1.5" opacity="0.4"/>`;
      }
    });

    if(playerState.isPlaying || playerState.isRecording){
      const note = notes[playerState.currentNoteIdx];
      if(note){
        const px = startX + (note.beat / totalBeats) * usableW + 6;
        html += `<line x1="${px-14}" y1="${staffTop-8}" x2="${px-14}" y2="${staffTop+staffH+8}" stroke="#c8f53a" stroke-width="1.5" opacity="0.8"/>`;
      }
    }
    svg.innerHTML = html;
  }

  function renderTab() {
    if (!tabArea) return;
    const area = tabArea;
    const notes = playerState.song.notes;
    const STRINGS = ['G','D','A','E'];
    const containerW = area.clientWidth || 500;
    const labelW = 18;
    const usableW = containerW - labelW - 8;
    const cellW = Math.max(30, Math.floor(usableW / notes.length));
    let html = '';

    STRINGS.forEach(str => {
      html += `<div class="tab-row"><span class="tab-sname">${str}</span><div class="tab-cells">`;
      notes.forEach((note, i) => {
        let state = i < playerState.currentNoteIdx ? 'tc-played' : i === playerState.currentNoteIdx ? 'tc-current' : '';
        const isThisString = note.string === str;
        const content = isThisString ? note.fret.toString() : '─';
        html += `<div class="tab-cell ${state}" style="width:${cellW}px">${content}</div>`;
      });
      html += `</div></div>`;
    });

    html += `<div style="display:flex;padding-left:${labelW}px;margin-top:3px;">`;
    notes.forEach((note, i) => {
      const beat = (note.beat % 4) + 1;
      const col = i === playerState.currentNoteIdx ? 'var(--accent)' : 'var(--muted)';
      html += `<div style="width:${cellW}px;text-align:center;font-size:8px;color:${col};font-family:'Space Mono',monospace">${beat}</div>`;
    });
    html += `</div>`;
    area.innerHTML = html;
  }
  
  $effect(() => {
    const onResize = () => requestAnimationFrame(renderScore);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });
</script>

<section class="score-section">
  <div class="sec-hdr">
    SCORE — Measure {Math.floor((playerState.song.notes[playerState.currentNoteIdx]?.beat || 0) / 4) + 1}
    / {Math.ceil(getTotalBeats() / 4)}
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
    <svg bind:this={staffSvg} style="display: {viewMode === 'staff' || viewMode === 'both' ? 'block' : 'none'}; width: 100%; margin-bottom: 16px;"></svg>
    <div bind:this={tabArea} style="display: {viewMode === 'tab' || viewMode === 'both' ? 'block' : 'none'};" class="tab-area-wrap"></div>
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

.tab-area-wrap {
  font-family: 'Space Mono', monospace; font-size: 12px;
  border-top: 1px solid var(--border); padding-top: 16px;
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
