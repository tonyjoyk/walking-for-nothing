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

// Story 1.2: the time-of-day picker.
test('1.2: the picker offers the six scenes in the day\'s order, shows overcast as rain, and has an icon for each', async () => {
  const { SCENES, pickerScene, sceneIcon } = await import('../src/controls/visitorControls.js');
  assert.deepEqual(SCENES.map(([n]) => n), ['dawn', 'sunny', 'wind', 'rain', 'twilight', 'night']);
  assert.equal(pickerScene('overcast'), 'rain');
  assert.equal(pickerScene('night'), 'night');
  assert.equal(pickerScene('nonsense'), 'sunny');
  for (const [n] of SCENES) assert.match(sceneIcon(n), /^<svg [^>]*aria-hidden="true"[^>]*>.*<\/svg>$/s);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<button id="scene-btn" class="ctl" type="button" aria-expanded="false" aria-controls="scene-list"/);
  assert.match(html, /<div id="scene-list" class="scene-list" role="group" aria-label="Time of day">/);
});

test('1.2: a scene change counts as easing in for transitionSeconds; a snapped scene does not', async () => {
  const { createDefaultConfig } = await import('../src/config.js');
  const { Scene } = await import('../src/scene/Scene.js');
  const cfg = createDefaultConfig();
  const s = new Scene(cfg); s.computeView(1280, 720); s.update(1 / 60);
  s.applyScene('rain'); s.snapParams();
  assert.equal(s.transitioning, false, 'snapped');
  s.applyScene('night');
  assert.equal(s.transitioning, true);
  for (let t = 0; t < cfg.playback.transitionSeconds + 0.1; t += 1 / 60) s.update(1 / 60);
  assert.equal(s.transitioning, false);
});
