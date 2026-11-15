// Juhu's rhythm across scenes (docs/stories/3.1.juhu-every-scene.md, D-3.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultConfig } from '../src/config.js';
import { Scene } from '../src/scene/Scene.js';

// Walk from page load through several scenes, noting Juhu's state in each.
function journey(opening, scenes = 9, w = 1920, h = 1080) {
  const cfg = createDefaultConfig();
  const s = new Scene(cfg);
  s.computeView(w, h);
  s.applyScene(opening, true);
  const log = []; let idx = 0, last = null, t = 0, firstApproach = null, firstTogether = null;
  for (let i = 0; i < 60 * 60 * 6 && idx <= scenes; i++) {
    s.update(1 / 60); t += 1 / 60;
    const name = s.sceneName || cfg.activePreset;
    if (name !== last) { idx++; last = name; log[idx] = { name, states: new Set() }; }
    log[idx].states.add(s.dog.state);
    if (firstApproach === null && s.dog.state === 'approaching') firstApproach = { t, at: (s.manX - s.view.x0) / s.view.w };
    if (firstTogether === null && s.dog.state === 'together') firstTogether = { t, at: (s.manX - s.view.x0) / s.view.w };
  }
  return { log, firstApproach, firstTogether };
}

test('3.1: Juhu joins him in the first scene, walks into the second, skips two, and returns in the fifth', () => {
  for (const opening of ['sunny', 'night', 'rain', 'twilight', 'wind', 'dawn']) {
    const { log, firstApproach, firstTogether } = journey(opening);
    assert.ok(firstApproach.t >= 2, `${opening}: first visit after ${firstApproach.t.toFixed(1)} s`);
    // D-3.7: she sets off only once he has reached the middle, and still joins him in scene 1
    assert.ok(firstApproach.at >= 0.5, `${opening}: he has reached the middle (${firstApproach.at.toFixed(2)})`);
    assert.ok(firstTogether.at > 0.5 && firstTogether.at <= 0.9, `${opening}: together at ${firstTogether.at.toFixed(2)} of the width`);
    assert.ok(log[1].states.has('together'), `${opening}: with him in scene 1 (${log[1].name})`);
    assert.ok(log[2].states.has('together') && log[2].states.has('absent'), `${opening}: walks on in scene 2, then leaves`);
    assert.deepEqual([...log[3].states], ['absent'], `${opening}: scene 3 alone`);
    assert.deepEqual([...log[4].states], ['absent'], `${opening}: scene 4 alone`);
    assert.ok(log[5].states.has('together'), `${opening}: back in scene 5 (${log[5].name})`);
    assert.ok(log[6].states.has('together'), `${opening}: still with him into scene 6`);
    assert.deepEqual([...log[7].states], ['absent'], `${opening}: scene 7 alone`);
  }
});

test('3.1: every scene allows her', () => {
  const cfg = createDefaultConfig();
  for (const v of Object.values(cfg.dog.presets)) assert.equal(v, true);
});
