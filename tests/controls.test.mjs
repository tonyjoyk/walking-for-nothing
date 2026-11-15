// Visitor controls (docs/stories/6.14.volume-slider.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readVolume, rememberVolume, VOLUME_KEY } from '../src/controls/visitorControls.js';

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };

test('6.14: the volume is remembered, and bad or missing storage never throws', () => {
  const s = memory();
  assert.equal(readVolume(s), null);
  rememberVolume(s, 0.234);
  assert.equal(s.getItem(VOLUME_KEY), '0.23');
  assert.equal(readVolume(s), 0.23);
  s.setItem(VOLUME_KEY, 'loud'); assert.equal(readVolume(s), null);
  s.setItem(VOLUME_KEY, '7'); assert.equal(readVolume(s), null);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readVolume(broken), null);
  assert.doesNotThrow(() => rememberVolume(broken, 0.5));
  assert.equal(readVolume(null), null);
});

test('6.14: the page has the sound button and a labelled volume slider in one control group', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const group = html.slice(html.indexOf('id="sound-ctl"'), html.indexOf('</div>', html.indexOf('id="sound"')));
  assert.match(group, /<input id="volume" type="range" min="0" max="100"[^>]*aria-label="Volume"/);
  assert.match(group, /<button id="sound" class="ctl sound" type="button"/);
});
