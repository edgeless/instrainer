import { type Song, type Note } from './songs';

/**
 * iReal Pro URL Deobfuscation (unscramble)
 */
function obfusc50(s: string): string {
  const newString = s.split('');
  for (let i = 0; i < 5; i++) {
    newString[49 - i] = s[i];
    newString[i] = s[49 - i];
  }
  for (let i = 10; i < 24; i++) {
    newString[49 - i] = s[i];
    newString[i] = s[49 - i];
  }
  return newString.join('');
}

function deobfuscate(s: string): string {
  let r = '';
  let tempS = s;
  while (tempS.length > 50) {
    const p = tempS.substring(0, 50);
    tempS = tempS.substring(50);
    if (tempS.length < 2) {
      r = r + p;
    } else {
      r = r + obfusc50(p);
    }
  }
  r = r + tempS;
  return r;
}

/**
 * Chord to MIDI (Root only)
 * Follow Rule 6: E2 for E1 actual (Written Pitch)
 * Low E (MIDI 28) -> E2 (MIDI 40)
 */
const NOTE_TO_OFFSET: Record<string, number> = {
  'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
};

function getRootMidi(chord: string): number {
  const match = chord.match(/^([A-G])([#b])?/);
  if (!match) return 36; // Default to C2
  
  const root = match[1];
  const acc = match[2] || '';
  
  // Rule 6: E2 = 40. Start calculation from C2 (36)
  let midi = 36 + (NOTE_TO_OFFSET[root] || 0); 
  if (acc === '#') midi += 1;
  if (acc === 'b') midi -= 1;
  
  // Ensure it's in a reasonable bass range (min E2=40)
  while (midi < 36) midi += 12;
  return midi;
}

function midiToName(midi: number): string {
  const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const octave = Math.floor(midi / 12) - 1; // MIDI 36 is C2, so 36/12 - 1 = 2
  return names[midi % 12] + octave;
}

/**
 * Simplified Parser
 */
export function parseIRealURI(uri: string): Song | null {
  try {
    const protocolRegex = /irealb:\/\/([^"]*)/;
    const musicPrefix = "1r34LbKcu7";
    
    const match = protocolRegex.exec(uri);
    if (!match) return null;
    
    const decoded = decodeURIComponent(match[1]);
    const sections = decoded.split("===");
    if (sections.length < 1) return null;
    
    const firstSongData = sections[0];
    const parts = firstSongData.split(/=+/).filter(x => x !== "");
    
    let title = parts[0] || "Imported Song";
    let keyStr = parts[3] || "";
    let musicPartRaw = "";
    
    for (const p of parts) {
      if (p.includes(musicPrefix)) {
        musicPartRaw = p;
        break;
      }
    }
    
    if (!musicPartRaw) return null;
    
    const musicData = musicPartRaw.split(musicPrefix)[1];
    const unscrambled = deobfuscate(musicData);
    
    // Cleaning
    const cleaned = unscrambled
      .replace(/\*\w/g, '')      // Section markers (*A, *B...)
      .replace(/<.*?>/g, '')     // Comments
      .replace(/T\d+/g, '')      // Time signatures (T44...)
      .replace(/XyQ|QyX/g, ' ')  // Empty cells
      .replace(/Y+/g, ' ')       // Spacers
      .replace(/N\d/g, ' ')      // Numbered endings (N1, N2...)
      .replace(/f/g, ' ')        // Fermi etc
      .replace(/p/g, ' ');       // Pause slash
    
    // Split by bar lines or markers to detect measures
    // iReal markers: | (single), [ (double), ] (double), Z (final), { (repeat), } (repeat), LZ (bar line)
    const measureStrings = cleaned.split(/\||LZ|\[|\]|Z|{|}/).filter(m => m.trim().length > 0);
    
    const chordRegex = /[A-G][#b]?[\+\-\^\dhob#suadlt]*(\/[A-G][#b]?)?|n/g;
    
    const notes: Note[] = [];
    let currentBeat = 0;
    const beatsPerMeasure = 4;
    let lastMeasureChords: string[] = [];
    
    for (const mStr of measureStrings) {
      let chords: string[] | null = mStr.match(chordRegex);
      
      // Handle "Kcl" (repeat measure) or empty measures
      if (mStr.includes("Kcl") && lastMeasureChords.length > 0) {
        chords = [...lastMeasureChords];
      }
      
      if (!chords || chords.length === 0) continue;
      lastMeasureChords = [...chords];
      
      const durPerChord = beatsPerMeasure / chords.length;
      
      for (const chordStr of chords) {
        if (chordStr === 'n') {
          // No chord / Silence? For now skip or use last? 
          // Usually NC means silent or keep last bass note. 
          // We'll skip adding a note for now, or add a silent one if we had duration support for silence.
          currentBeat += durPerChord;
          continue;
        }
        
        const midi = getRootMidi(chordStr);
        const name = midiToName(midi);
        
        notes.push({
          name: name,
          midi: midi,
          string: 'E',
          fret: 0,
          beat: currentBeat,
          dur: durPerChord
        });
        currentBeat += durPerChord;
      }
    }
    
    // Auto-assign strings and frets
    notes.forEach(n => {
      if (n.midi >= 55) { n.string = 'G'; n.fret = n.midi - 55; }
      else if (n.midi >= 50) { n.string = 'D'; n.fret = n.midi - 50; }
      else if (n.midi >= 45) { n.string = 'A'; n.fret = n.midi - 45; }
      else if (n.midi >= 40) { n.string = 'E'; n.fret = n.midi - 40; }
      else { n.string = 'E'; n.fret = 0; }
    });

    return {
      name: title,
      bpm: 80,
      key: keyStr,
      timeSignature: [4, 4],
      notes: notes
    };
  } catch (e) {
    console.error("Failed to parse iReal URI", e);
    return null;
  }
}
