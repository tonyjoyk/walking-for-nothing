// The speech bubble's markup (stories 2.2, 2.8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('2.8: the bubble starts hidden in the HTML, so it cannot flash before the styles load', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const tag = html.match(/<div id="bubble"[^>]*>/)[0];
  assert.match(tag, /\shidden(\s|>)/, tag);
  const js = readFileSync(new URL('../src/bubble.js', import.meta.url), 'utf8');
  assert.match(js, /el\.hidden = false/);
});
