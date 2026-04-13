import { test, describe } from 'node:test';
import assert from 'node:assert';
import { escapeHtml } from '../../src/lib/utils/security';

describe('escapeHtml', () => {
  test('escapes &', () => {
    assert.strictEqual(escapeHtml('a & b'), 'a &amp; b');
  });

  test('escapes < and >', () => {
    assert.strictEqual(escapeHtml('<script>'), '&lt;script&gt;');
  });

  test('escapes "', () => {
    assert.strictEqual(escapeHtml('"test"'), '&quot;test&quot;');
  });

  test('escapes \'', () => {
    assert.strictEqual(escapeHtml("'test'"), '&#39;test&#39;');
  });

  test('escapes multiple characters', () => {
    assert.strictEqual(escapeHtml('<a href="x&y">test\'s</a>'), '&lt;a href=&quot;x&amp;y&quot;&gt;test&#39;s&lt;/a&gt;');
  });

  test('coerces non-strings to string', () => {
    assert.strictEqual(escapeHtml(123), '123');
    assert.strictEqual(escapeHtml(null), 'null');
    assert.strictEqual(escapeHtml(undefined), 'undefined');
  });
});
