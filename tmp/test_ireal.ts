import { parseIRealURI } from '../src/lib/utils/ireal';

const testURI = "irealb://And%20What%20If%20I%20Don%27t=Hancock%20Herbie==Medium%20Swing=Eb==1r34LbKcu71N%7CQy4Eb7%20QyX7bEZL%20lcKQy7X%2DC%7CQyX7bEZL7bB%7CAb7X4TA%2A%7BX7GB%2AQ%7CF%2D77bEZL7bB%207%2DF2NLZ%20QyXQyX%7DQyXbB%2FXyQ%5D%5ByX7%2DFB%207bE%20LZC7%20lcKQyX7bBZL%20lKcQyX7FZL%20lcKQyX%20%5D%5B%2AAlcKQybB%2F7%2Db7XyQ7%2DF%7CQyX7bA%7CQyXb7EZL%20lcKQyX7%2DC%7CXyQ%7CFEZL7bXyQZ%20==0=0===";

const song = parseIRealURI(testURI);
if (song) {
  console.log("Success!");
  console.log("Name:", song.name);
  console.log("Notes count:", song.notes.length);
  console.log("First note:", song.notes[0]);
  console.log("Last note:", song.notes[song.notes.length - 1]);
} else {
  console.log("Failed to parse.");
}
