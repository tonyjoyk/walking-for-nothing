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

// Story 1.3: labelled options, "All scenes", and a picked scene that loops.
test('1.3: the options are "All scenes" then the six, each with a label; a picked scene is remembered per tab', async () => {
  const { OPTIONS, readSceneLock, rememberSceneLock, LOCK_KEY } = await import('../src/controls/visitorControls.js');
  assert.deepEqual(OPTIONS.map(([, l]) => l), ['All scenes', 'Dawn', 'Day', 'Windy', 'Rain', 'Sunset', 'Night']);
  const m = new Map(); const s = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  assert.equal(readSceneLock(s), null);
  rememberSceneLock(s, 'night'); assert.equal(m.get(LOCK_KEY), 'night'); assert.equal(readSceneLock(s), 'night');
  rememberSceneLock(s, null); assert.equal(readSceneLock(s), null);
  m.set(LOCK_KEY, 'overcast'); assert.equal(readSceneLock(s), null, 'only the six can be picked');
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.equal(readSceneLock(broken), null);
  assert.doesNotThrow(() => rememberSceneLock(broken, 'rain'));
});

test('1.3: with the cycle off, crossings keep the same scene (it loops)', async () => {
  const { createDefaultConfig } = await import('../src/config.js');
  const { Scene } = await import('../src/scene/Scene.js');
  const cfg = createDefaultConfig();
  const s = new Scene(cfg); s.computeView(1280, 720); s.update(1 / 60);
  cfg.cycle.enabled = false; s.applyScene('night');
  for (let i = 0; i < 60 * 90; i++) s.update(1 / 60); // several crossings
  assert.equal(s.sceneName, 'night');
  cfg.cycle.enabled = true;
  for (let i = 0; i < 60 * 40; i++) s.update(1 / 60);
  assert.notEqual(s.sceneName, 'night', 'the journey moves on again');
});

// Story 6.15: sound on by default, and a first-visit hint.
test('6.15: sound is on unless the visitor turned it off; storage problems never throw', async () => {
  const { readSoundOn, rememberSoundOn, SOUND_KEY } = await import('../src/controls/visitorControls.js');
  const m = new Map(); const s = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
  assert.equal(readSoundOn(s), true, 'default on');
  rememberSoundOn(s, false); assert.equal(m.get(SOUND_KEY), 'off'); assert.equal(readSoundOn(s), false);
  rememberSoundOn(s, true); assert.equal(readSoundOn(s), true);
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(readSoundOn(broken), true);
  assert.doesNotThrow(() => rememberSoundOn(broken, false));
  assert.equal(readSoundOn(null), true);
});

// Story 6.19 (D-6.20): the speaker shows off until sound plays; a small cue invites a tap.
test('6.19: the speaker starts off, and the sound cue is a hidden polite status pill with no close button', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<button id="sound" class="ctl sound" type="button" aria-pressed="false" aria-label="Turn sound on">/);
  const tag = html.match(/<div id="sound-cue"[^>]*>/)[0];
  assert.match(tag, /role="status"/);
  assert.match(tag, /\shidden(\s|>)/);
  assert.doesNotMatch(html, /id="hint"|hint-close/);
  const cue = html.slice(html.indexOf('<div id="sound-cue"'), html.indexOf('</div>', html.indexOf('<div id="sound-cue"')));
  assert.doesNotMatch(cue, /<button/);
});

test('6.19: the sound shows off until it really plays, and the cue wording follows the pointer', async () => {
  const { cueText } = await import('../src/controls/visitorControls.js');
  assert.equal(cueText(true), 'Click for sound');
  assert.equal(cueText(false), 'Tap for sound');
  const src = readFileSync(new URL('../src/controls/visitorControls.js', import.meta.url), 'utf8');
  assert.match(src, /let wanted = readSoundOn\(storage\);\s*A\.enabled = false;/, 'off until it starts');
  assert.match(src, /const isOn = \(\) => started && A\.enabled/, 'the speaker shows on only once started');
  assert.match(src, /if \(started \|\| !wanted\) return;/, 'a remembered "off" keeps clicks on the page silent');
});

// The dev panel's scene dropdown now goes through applyScene, so the sound follows it.
test('dev panel: changing the scene updates the scene name the sound follows', async () => {
  const { createDefaultConfig } = await import('../src/config.js');
  const { Scene } = await import('../src/scene/Scene.js');
  const cfg = createDefaultConfig();
  const s = new Scene(cfg); s.computeView(1280, 720); s.update(1 / 60);
  s.applyScene('sunny'); s.update(1 / 60);
  cfg.activePreset = 'night'; s.applyScene(cfg.activePreset); s.update(1 / 60);
  assert.equal(s.sceneName, 'night');
  const src = readFileSync(new URL('../src/controls/ControlPanel.js', import.meta.url), 'utf8');
  assert.match(src, /\.on\('change', \(\) => \{ scene\.applyScene\(config\.activePreset\)/);
});
