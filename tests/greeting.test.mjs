// The greeting (docs/product/specs/greeting.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultConfig, validateConfig } from '../src/config.js';
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

test('held on him: stop, turn, look 3 s, smile, turn back after 4 s more, walk on (bubble off)', () => {
  const { scene, cfg } = makeScene((c) => { c.greeting.bubble = false; });
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
  until(scene, () => scene.greeting.state === 'returning', 25);
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
  until(scene, () => scene.greeting.state === 'returning', 25);
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
  for (let i = 0; i < 60 * 30; i++) { g.update(DT, false, cfg, {}); seen.add(g.state); }
  for (const s of ['stopping', 'settling', 'turning', 'looking', 'smiling', 'returning', 'starting']) assert.ok(seen.has(s), s);
  assert.equal(g.state, 'walking');
});

// Story 2.1 / D-2.2: pause on hover; turn after a 2 s rest or a click.
// Hover from a given point in the stride (frames walked first).
function hoverFrom(frames) {
  const made = makeScene();
  for (let i = 0; i < frames; i++) made.scene.update(DT);
  return made;
}
// The man's position on screen (CSS px), chest height.
function manOnScreen(scene, dx = 0) {
  const v = scene.view;
  return { x: (scene.manX - v.x0) * v.s + dx, y: (906 + scene.config.character.groundOffset - 100 - v.y0) * v.s };
}

test('2.1 AC1: the cursor on him slows him at once; he stands without turning', () => {
  for (const frames of [0, 9, 23, 41]) {
    const { scene } = hoverFrom(frames);
    scene.hovering = true;
    scene.update(DT);
    assert.equal(scene.greeting.state, 'stopping');
    scene.update(DT);
    assert.ok(scene.greet.speed < 1, 'slowing by the next frame');
    until(scene, () => scene.greeting.state === 'waiting', 4);
    assert.equal(scene.greet.speed, 0);
    assert.equal(scene.greet.head, 0);
    assert.equal(scene.greet.body, 0);
  }
});

test('2.1 AC2: he turns 2 s after the cursor arrives, or as soon as he is standing', () => {
  for (const frames of [0, 9, 23, 41]) {
    const { scene, cfg } = hoverFrom(frames);
    scene.hovering = true;
    let standing = null;
    const t = until(scene, () => {
      if (standing === null && scene.greeting.state === 'waiting') standing = scene.greeting.hoverT;
      return scene.greeting.state === 'turning';
    }, 6);
    const expected = Math.max(cfg.greeting.dwellSeconds, standing ?? 0);
    assert.ok(Math.abs(t - expected) < 0.05, `turned at ${t.toFixed(2)} s, expected ${expected.toFixed(2)} s`);
  }
});

test('2.1 AC2: he does not turn while the cursor has been on him for less than 2 s', () => {
  const { scene } = makeScene();
  scene.hovering = true;
  for (let t = 0; t < 1.9; t += DT) { scene.update(DT); assert.equal(scene.greet.head, 0); }
});

test('2.1 AC3: a click turns him as soon as he stands, and plays through after the cursor leaves', () => {
  for (const when of ['walking', 'stopping', 'waiting']) {
    const { scene } = makeScene();
    scene.hovering = true;
    if (when !== 'walking') until(scene, () => scene.greeting.state === when, 4);
    scene.greetNow();
    let waited = 0;
    until(scene, () => {
      if (scene.greeting.state === 'waiting') waited++;
      return scene.greeting.state === 'turning';
    }, 4);
    assert.ok(waited <= 1, `${when}: stood ${waited} frames before turning`);
    scene.hovering = false; // the visitor moves away after clicking
    until(scene, () => scene.greeting.state === 'smiling', 8);
    until(scene, () => scene.greeting.state === 'walking', 25);
  }
});

test('2.1 AC4: a click elsewhere ends a clicked greeting', () => {
  const { scene } = makeScene();
  scene.greetNow();
  until(scene, () => scene.greeting.state === 'looking', 6);
  scene.greeting.release();
  const t = until(scene, () => scene.greeting.state === 'walking', 5);
  assert.ok(t <= 2.5);
});

test('2.1 AC5: leaving before he turns: walking within 2.5 s, no cooldown, and a return stops him again', () => {
  const { scene } = makeScene();
  scene.hovering = true;
  until(scene, () => scene.greeting.state === 'waiting', 4);
  scene.hovering = false;
  const t = until(scene, () => scene.greeting.state === 'walking', 5);
  assert.ok(t <= 2.5, `walking after ${t.toFixed(2)} s`);
  assert.equal(scene.greeting.cooldown, 0);
  scene.hovering = true;
  scene.update(DT);
  assert.equal(scene.greeting.state, 'stopping');
  // and coming back while he is still starting off stops him again, smoothly
  scene.hovering = false;
  until(scene, () => scene.greeting.state === 'starting', 4);
  for (let i = 0; i < 20; i++) scene.update(DT);
  const before = scene.greet.speed;
  scene.hovering = true;
  scene.update(DT);
  assert.equal(scene.greeting.state, 'stopping');
  assert.ok(Math.abs(scene.greet.speed - before) < 0.05, `speed jumped ${before.toFixed(2)} → ${scene.greet.speed.toFixed(2)}`);
});

test('2.1 AC6: a still cursor stays on him while he stops, and he stops when he walks into one', () => {
  for (const frames of [0, 9, 23, 41]) {
    const { scene } = hoverFrom(frames);
    // the cursor at his back edge: the worst case for walking out from under it
    scene.pointer = manOnScreen(scene, -25 * scene.view.s);
    scene.update(DT);
    assert.equal(scene.greeting.state, 'stopping');
    until(scene, () => scene.greeting.state === 'turning', 6); // never lost the cursor
  }
  const { scene } = makeScene();
  scene.pointer = manOnScreen(scene, 140 * scene.view.s); // ahead of him
  scene.update(DT);
  assert.equal(scene.greeting.state, 'walking');
  until(scene, () => scene.greeting.state === 'stopping', 6);
  scene.pointer = null; scene.hovering = false;
});

test('2.1 AC7: no snapping through pause, leave, return, click and turn', () => {
  const { scene } = makeScene();
  let prev = { ...scene.greet }, worst = 0;
  const script = [[0, true], [1.2, false], [1.6, true], [3.5, 'click'], [4, false]];
  for (let i = 0; i < 60 * 16; i++) {
    const t = i * DT;
    for (const [at, what] of script) if (Math.abs(t - at) < DT / 2) { if (what === 'click') scene.greetNow(); else scene.hovering = what; }
    scene.update(DT);
    const g = scene.greet;
    worst = Math.max(worst, Math.abs(g.head - prev.head), Math.abs(g.body - prev.body), Math.abs(g.smile - prev.smile), Math.abs(g.speed - prev.speed), Math.abs(g.stand - prev.stand));
    prev = { ...g };
  }
  assert.ok(worst < 0.04, `largest change in one frame ${worst.toFixed(3)}`);
});

test('2.1 AC8: dwellSeconds is a validated setting', () => {
  const cfg = createDefaultConfig();
  assert.equal(cfg.greeting.dwellSeconds, 2);
  const ok = validateConfig({ greeting: { dwellSeconds: 3.5 } });
  assert.equal(ok.config.greeting.dwellSeconds, 3.5);
  const bad = validateConfig({ greeting: { dwellSeconds: 'soon' } });
  assert.equal(bad.config.greeting.dwellSeconds, 2);
  assert.ok(bad.warnings.length > 0);
});

// Story 2.2 / D-2.3: the speech bubble.
test('2.2 AC1/5: the bubble shows only while he faces the visitor', () => {
  const { scene } = makeScene();
  scene.hovering = true;
  const seen = new Map();
  for (let i = 0; i < 60 * 30; i++) {
    scene.update(DT);
    const s = scene.greeting.state;
    seen.set(s, (seen.get(s) || new Set()).add(scene.bubbleShown));
  }
  for (const s of ['looking', 'smiling']) assert.deepEqual([...seen.get(s)], [true], s);
  for (const s of ['walking', 'stopping', 'settling', 'waiting', 'turning', 'returning', 'starting']) {
    if (seen.has(s)) assert.deepEqual([...seen.get(s)], [false], s);
  }
});

test('2.2 AC3: with the bubble on, he faces the visitor for readSeconds before turning back', () => {
  const { scene, cfg } = makeScene();
  scene.greetNow(); // a click: plays through without the cursor
  until(scene, () => scene.greeting.state === 'looking', 6);
  const facing = until(scene, () => scene.greeting.state === 'returning', 40);
  assert.ok(Math.abs(facing - cfg.greeting.readSeconds) < 0.05, `faced for ${facing.toFixed(2)} s`);
});

test('2.2 AC7: with the bubble off, the timing is 3 s + 4 s and nothing shows', () => {
  const { scene, cfg } = makeScene((c) => { c.greeting.bubble = false; });
  scene.greetNow();
  until(scene, () => scene.greeting.state === 'looking', 6);
  let shown = false;
  const facing = until(scene, () => { shown ||= scene.bubbleShown; return scene.greeting.state === 'returning'; }, 40);
  assert.ok(Math.abs(facing - cfg.greeting.lookSeconds - cfg.greeting.smileSeconds) < 0.05, `faced for ${facing.toFixed(2)} s`);
  assert.equal(shown, false);
  const ok = validateConfig({ greeting: { bubble: false, readSeconds: 20 } });
  assert.equal(ok.config.greeting.bubble, false);
  assert.equal(ok.config.greeting.readSeconds, 20);
  assert.ok(validateConfig({ greeting: { bubble: 'yes' } }).warnings.length > 0);
});

test('2.2 AC2: the head point sits just above his head', () => {
  const { scene } = makeScene();
  const h = scene.headPoint(), v = scene.view;
  const m = manOnScreen(scene);
  assert.ok(Math.abs(h.x - m.x) < 10 * v.s);
  assert.ok(scene.hitMan(h.x, h.y + 20 * v.s), 'just below the point is still him');
  assert.ok(!scene.hitMan(h.x, h.y - 20 * v.s), 'just above is sky');
});

// Story 2.4 / D-2.5: a plain white plate behind dark words, 40%, or 60% where needed.
test('2.4: the plate is 40%, stepping up to 60% only when 40% is under 4.5:1', async () => {
  const { choosePlate, plateContrast, PLATES } = await import('../src/bubble.js');
  const sky = (r, g, b, n = 100) => Array.from({ length: n }, () => [r, g, b]);
  assert.deepEqual(PLATES, [0.4, 0.6]);
  for (const [name, c] of [['day', [0xa9, 0xd5, 0xe0]], ['sunset', [0xd0, 0x70, 0x90]], ['rain', [0x80, 0x88, 0x90]]]) {
    const p = choosePlate(sky(...c));
    assert.equal(p.alpha, 0.4, name);
    assert.ok(p.ratio >= 4.5, `${name} ${p.ratio.toFixed(1)}`);
  }
  // a very dark sky: 40% is not enough, so 60%, which is
  const dark = sky(0x10, 0x14, 0x30);
  assert.ok(plateContrast(dark, 0.4) < 4.5);
  const p = choosePlate(dark);
  assert.equal(p.alpha, 0.6);
  assert.ok(p.ratio >= 4.5, `dark ${p.ratio.toFixed(1)}`);
  // judged on the darkest tenth: a few dark pixels don't pass as light
  assert.ok(plateContrast([...sky(0xa9, 0xd5, 0xe0, 80), ...sky(0, 0, 0, 20)], 0.4) < plateContrast(sky(0xa9, 0xd5, 0xe0), 0.4));
});

// Story 2.5 / D-2.6: "View my work" at the end of the bubble.
test('2.5: the bubble ends with a "View my work" link to the portfolio, opening in a new tab', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const bubble = html.slice(html.indexOf('id="bubble"'), html.indexOf('</div>', html.indexOf('id="bubble"')));
  const paras = bubble.match(/<p[^>]*>[\s\S]*?<\/p>/g);
  const last = paras[paras.length - 1];
  assert.match(last, /<a href="https:\/\/tonyjoyk\.github\.io\/tony-joy-portfolio\/" target="_blank" rel="noopener">View my work<\/a>/);
});
