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

const testURI = "irealb://And%20What%20If%20I%20Don%27t=Hancock%20Herbie==Medium%20Swing=Eb==1r34LbKcu71N%7CQy4Eb7%20QyX7bEZL%20lcKQy7X%2DC%7CQyX7bEZL7bB%7CAb7X4TA%2A%7BX7GB%2AQ%7CF%2D77bEZL7bB%207%2DF2NLZ%20QyXQyX%7DQyXbB%2FXyQ%5D%5ByX7%2DFB%207bE%20LZC7%20lcKQyX7bBZL%20lKcQyX7FZL%20lcKQyX%20%5D%5B%2AAlcKQybB%2F7%2Db7XyQ7%2DF%7CQyX7bA%7CQyXb7EZL%20lcKQyX7%2DC%7CXyQ%7CFEZL7bXyQZ%20==0=0===";

const protocolRegex = /irealb:\/\/([^"]*)/;
const musicPrefix = "1r34LbKcu7";
const match = protocolRegex.exec(testURI);
if (match) {
  const decoded = decodeURIComponent(match[1]);
  const sections = decoded.split("===");
  const firstSongData = sections[0];
  const parts = firstSongData.split(/=+/).filter(x => x !== "");
  let musicPartRaw = "";
  for (const p of parts) {
    if (p.includes(musicPrefix)) {
      musicPartRaw = p;
      break;
    }
  }
  const musicData = musicPartRaw.split(musicPrefix)[1];
  const unscrambled = deobfuscate(musicData);
  console.log("Unscrambled:", unscrambled);

  // Clean up
  const cleaned = unscrambled
    .replace(/\*\w/g, '')      // Section markers *A, *B etc
    .replace(/<.*?>/g, '')     // Comments
    .replace(/T\d+/g, '')      // Time signatures T44
    .replace(/XyQ|QyX/g, ' ')  // Empty space
    .replace(/Y+/g, ' ')       // Vertical spacers
    .replace(/f/g, ' ')        // Fermi? Actually 'f' is sometimes used as a marker
    .replace(/n/g, ' ');       // No chord

  console.log("Cleaned:", cleaned);

  // Split by bar lines or markers to detect measures
  const measureData = cleaned.split(/\||LZ|\[|\]|Z|{|}/).filter(m => m.trim().length > 0);
  console.log("Measures Raw:", measureData);

  const chordRegex = /[A-G][#b]?[\+\-\^\dhob#suadlt]*(\/[A-G][#b]?)?/g;
  for (const m of measureData) {
     const chords = m.match(chordRegex);
     console.log(`Measure: [${m}] -> Chords:`, chords);
  }
}
