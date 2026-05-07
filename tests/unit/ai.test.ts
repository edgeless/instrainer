import { test, describe } from 'node:test';
import assert from 'node:assert';
import { generateSong, setMockGenerator } from '../../src/lib/utils/ai';

describe('AI Generator', () => {
  test('generateSong extracts JSON properly', async () => {
    // Inject a mock generator that simply returns a canned response array
    setMockGenerator(async () => {
        return [{
          generated_text: 'Here is your song: <|im_start|>assistant\n{"name": "Test", "bpm": 120, "notes": [{"name": "C3", "midi": 36, "string": "A", "fret": 3, "beat": 0, "dur": 1}]}'
        }];
    });

    try {
      const result = await generateSong("make a song");
      assert.strictEqual(result.name, "Test");
      assert.strictEqual(result.bpm, 120);
      assert.strictEqual(result.notes.length, 1);
      assert.strictEqual(result.notes[0].midi, 36);
    } finally {
      // Clear the mock
      setMockGenerator(null);
    }
  });

  test('generateSong handles invalid JSON gracefully', async () => {
    setMockGenerator(async () => {
        return [{
          generated_text: 'This is not json at all { "name": "bad" '
        }];
    });

    try {
      await assert.rejects(
        () => generateSong("make a song"),
        (err: Error) => {
          assert.ok(err.message.includes('Failed to find JSON'));
          return true;
        }
      );
    } finally {
      setMockGenerator(null);
    }
  });
});
