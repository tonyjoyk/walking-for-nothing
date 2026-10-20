// The greeting (docs/product/specs/greeting.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultConfig } from '../src/config.js';
import { Scene } from '../src/scene/Scene.js';
import { Greeting } from '../src/scene/greeting.js';
import { characterPose, footPoints } from '../src/scene/character.js';
import { createFakeContext } from './fakeCanvas.mjs';

const DT = 1 / 60;
function makeScene(edit = () => {}) {
  const cfg = createDefaultConfig();
  cfg.cycle.enabled = false;
  edit(cfg);
  const scene = new Scene(cfg);
  scene.computeView(1920, 1080);
  scene.update(DT);
  return { scene, cfg };
}
// Step until a condition holds (or a time limit); returns seconds taken.
function until(scene, cond, limit = 30) {
  for (let t = 0; t < limit; t += DT) { if (cond()) return t; scene.update(DT); }
  throw new Error(`timed out in state ${scene.greeting.state}`);
}

test('held on him: stop, turn, look 3 s, smile, turn back after 4 s more, walk on', () => {
  const { scene, cfg } = makeScene();
  scene.hovering = true;
  const g = scene.greeting;
  until(scene, () => g.state === 'looking', 6);
  assert.equal(scene.greet.speed, 0);
  assert.ok(scene.greet.head === 1 && scene.greet.body === 1);
  const look = until(scene, () => g.state === 'smiling');
  assert.ok(Math.abs(look - cfg.greeting.lookSeconds) < 0.05, `looked for ${look}`);
  const smile = until(scene, () => g.state === 'returning');
  assert.ok(Math.abs(smile - cfg.greeting.smileSeconds) < 0.05, `smiled for ${smile}`);
  assert.ok(scene.greet.smile > 0.95);
  const back = until(scene, () => g.state === 'walking');
  assert.ok(back < cfg.greeting.turnSeconds + cfg.greeting.stopSeconds + 0.2);
  assert.equal(scene.greet.speed, 1);
});

test('leaving him at any point gets him walking again within 2.5 s', () => {
  for (const phase of ['stopping', 'settling', 'turning', 'looking', 'smiling']) {
    const { scene } = makeScene();
    scene.hovering = true;
    until(scene, () => scene.greeting.state === phase, 12);
    for (let i = 0; i < 10; i++) scene.update(DT); // a moment into the phase
    scene.hovering = false;
    const t = until(scene, () => scene.greeting.state === 'walking', 5);
    assert.ok(t <= 2.5, `left during ${phase}: walking after ${t.toFixed(2)} s`);
    assert.equal(scene.greet.smile, 0);
    assert.equal(scene.greet.stand, 0);
  }
});

test('he never snaps: turn and smile change smoothly from frame to frame', () => {
  const { scene } = makeScene();
  scene.hovering = true;
  let prev = { ...scene.greet }, worst = 0;
  for (let i = 0; i < 60 * 16; i++) {
    if (i === 60 * 6) scene.hovering = false; // leave mid-look
    scene.update(DT);
    const g = scene.greet;
    worst = Math.max(worst, Math.abs(g.head - prev.head), Math.abs(g.body - prev.body), Math.abs(g.smile - prev.smile), Math.abs(g.speed - prev.speed));
    prev = { ...g };
  }
  assert.ok(worst < 0.04, `largest change in one frame ${worst.toFixed(3)}`);
});

test('another greeting needs the cursor to leave and come back, after a cooldown', () => {
  const { scene, cfg } = makeScene();
  scene.hovering = true;
  until(scene, () => scene.greeting.state === 'returning', 14);
  until(scene, () => scene.greeting.state === 'walking');
  for (let i = 0; i < 60 * 5; i++) scene.update(DT); // still hovering: he keeps walking
  assert.equal(scene.greeting.state, 'walking');
  scene.hovering = false; scene.update(DT);
  scene.hovering = true;
  const t = until(scene, () => scene.greeting.state === 'stopping', 5);
  assert.ok(t <= cfg.greeting.cooldownSeconds + 0.1);
});

test('he stops with both feet on the ground, and nothing slides while he stands', () => {
  const { scene, cfg } = makeScene();
  scene.hovering = true;
  until(scene, () => scene.greeting.state === 'settling', 6);
  const u = (((scene.walkPhase / (2 * Math.PI)) % 1) + 1) % 1;
  assert.ok((u > 0.01 && u < 0.11) || (u > 0.51 && u < 0.61), `stopped at gait position ${u.toFixed(2)}`);
  until(scene, () => scene.greeting.state === 'looking');
  const C = cfg.character;
  const feet = () => {
    const p = characterPose(scene.manPose(C));
    return [p.near, p.far].map((L) => { const f = footPoints(L); return { x: scene.manX + f.heel.x * C.scale, y: Math.max(f.heel.y, f.toe.y) }; });
  };
  const a = feet();
  for (let i = 0; i < 60 * 2; i++) scene.update(DT);
  const b = feet();
  for (let k = 0; k < 2; k++) {
    assert.ok(Math.abs(a[k].y) < 1.5, `foot ${k} off the ground by ${a[k].y.toFixed(2)}`);
    assert.ok(Math.abs(a[k].x - b[k].x) < 0.01, 'foot moved while standing');
  }
});

test('Juhu slows and waits while he stands', () => {
  const { scene } = makeScene();
  scene.callDog();
  until(scene, () => scene.dog.state === 'together', 25);
  scene.hovering = true;
  until(scene, () => scene.greeting.state === 'smiling', 8);
  assert.ok(Math.abs(scene.dog.speed) < 3, `Juhu speed ${scene.dog.speed.toFixed(1)}`);
});

test('every turn and smile renders without NaN, in both mundu lengths', () => {
  for (const length of ['full', 'folded']) {
    const { scene } = makeScene((c) => { c.character.munduLength = length; });
    const ctx = createFakeContext();
    const g = scene.greeting;
    for (const turn of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      for (const smile of [0, 0.5, 1]) {
        g.state = 'looking'; g.stand = 1; g.headP = turn; g.bodyP = Math.max(0, turn - 0.2); g.smile = smile; g.speed = 0;
        scene.greet = g.output();
        scene.render(ctx, 1920, 1080, 1);
      }
    }
    assert.deepEqual([...new Set(ctx.stats.bad)], [], length);
  }
});

test('hovering is detected on him, not on the sky or the grass beside him', () => {
  const { scene } = makeScene();
  const v = scene.view;
  const sx = (scene.manX - v.x0) * v.s, gy = (906 + scene.config.character.groundOffset - v.y0) * v.s;
  assert.ok(scene.hitMan(sx, gy - 100 * v.s), 'chest');
  assert.ok(scene.hitMan(sx + 5, gy - 250 * v.s), 'head');
  assert.ok(!scene.hitMan(sx, gy - 400 * v.s), 'sky above');
  assert.ok(!scene.hitMan(sx + 120 * v.s, gy - 100 * v.s), 'beside him');
});

test('feet stay planted when he walks on after a greeting', () => {
  const { scene, cfg } = makeScene();
  scene.hovering = true;
  until(scene, () => scene.greeting.state === 'returning', 14);
  scene.hovering = false;
  until(scene, () => scene.greeting.state === 'walking');
  for (let i = 0; i < 60; i++) scene.update(DT);
  const C = cfg.character;
  let seg = null, worst = 0, n = 0;
  for (let f = 0; f < 60 * 10; f++) {
    scene.update(DT);
    const leg = characterPose(scene.manPose(C)).near;
    if (leg.planted && leg.pinKind) {
      const wx = scene.manX + footPoints(leg)[leg.pinKind].x * C.scale;
      if (seg && seg.kind === leg.pinKind) { seg.min = Math.min(seg.min, wx); seg.max = Math.max(seg.max, wx); }
      else { if (seg && seg.max - seg.min < 500) { worst = Math.max(worst, seg.max - seg.min); n++; } seg = { kind: leg.pinKind, min: wx, max: wx }; }
    } else if (seg) { if (seg.max - seg.min < 500) { worst = Math.max(worst, seg.max - seg.min); n++; } seg = null; }
  }
  assert.ok(n > 5 && worst < 1, `slide ${worst.toFixed(2)} px over ${n} contacts`);
});

test('a one-shot greeting (tap or "Greet now") plays through without hovering', () => {
  const g = new Greeting();
  const cfg = createDefaultConfig().greeting;
  g.greetNow();
  const seen = new Set();
  for (let i = 0; i < 60 * 16; i++) { g.update(DT, false, cfg, {}); seen.add(g.state); }
  for (const s of ['stopping', 'settling', 'turning', 'looking', 'smiling', 'returning', 'starting']) assert.ok(seen.has(s), s);
  assert.equal(g.state, 'walking');
});
