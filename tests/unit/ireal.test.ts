import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parseIRealURI } from '../../src/lib/utils/ireal';

describe('parseIRealURI', () => {
  test('returns null for invalid protocol', () => {
    const result = parseIRealURI('http://example.com');
    assert.strictEqual(result, null);
  });

  test('returns null when music prefix is missing', () => {
    const result = parseIRealURI('irealb://Song%20Title===Composer===Style===Key===n===*A{C|F|G|C}');
    assert.strictEqual(result, null);
  });

  test('happy path: parses a simple iReal URI', () => {
    const title = "Test Song";
    const key = "C";
    const musicData = "1r34LbKcu7[C |F |G |C ]";
    // iReal URI for a single song uses '=' or similar within the song data.
    // '===' is used as a separator between multiple songs in a playlist.
    const content = `${title}=Composer=Style=${key}=n=${musicData}`;
    const uri = `irealb://${content}`;

    const result = parseIRealURI(uri);

    assert.notStrictEqual(result, null);
    if (result) {
      assert.strictEqual(result.name, title);
      assert.strictEqual(result.key, key);
      assert.ok(result.notes.length > 0);
    }
  });

  test('handles malformed URI components by returning null (catch block)', () => {
    // This should trigger decodeURIComponent error
    const malformedUri = 'irealb://%E0%A0%A0';

    // We expect it to catch the error, log it, and return null
    const result = parseIRealURI(malformedUri);
    assert.strictEqual(result, null);
  });

  test('handles repeat measure marker Kcl', () => {
    const musicData = "1r34LbKcu7| C | Kcl |";
    const content = `RepeatTest=Comp=Style=C=n=${musicData}`;
    const uri = `irealb://${content}`;

    const result = parseIRealURI(uri);
    assert.notStrictEqual(result, null);
    if (result) {
      // First measure has C (4 beats), second measure is Kcl so it should also have C (4 beats)
      assert.strictEqual(result.notes.length, 2);
      assert.strictEqual(result.notes[0].name, "C2");
      assert.strictEqual(result.notes[1].name, "C2");
      assert.strictEqual(result.notes[1].beat, 4);
    }
  });
});
