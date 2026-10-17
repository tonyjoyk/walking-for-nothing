// Regression tests for the scene: run with `npm test` (Node 20+).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultConfig, validateConfig, PRESETS, RANGES } from '../src/config.js';
import { Scene } from '../src/scene/Scene.js';
import { characterPose, footPoints } from '../src/scene/character.js';
import { dogPose } from '../src/scene/dog.js';
import { createFakeContext } from './fakeCanvas.mjs';

const presets = Object.keys(PRESETS);

function run(scene, seconds, ctx, w = 1920, h = 1080) {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) {
    scene.update(1 / 60);
    if (ctx && i % 6 === 0) scene.render(ctx, w, h, 1);
  }
}

for (const name of presets) {
  test(`preset ${name} renders without errors or NaN geometry`, () => {
    const cfg = createDefaultConfig();
    cfg.activePreset = name;
    const scene = new Scene(cfg);
    scene.applyPreset(name); scene.snapParams();
    scene.callDog(); scene.spawnBirds();
    const ctx = createFakeContext();
    run(scene, 40, ctx);
    assert.deepEqual([...new Set(ctx.stats.bad)], [], 'non-finite numbers reached the canvas');
    assert.ok(ctx.stats.fills > 1000, 'scene drew very little');
  });
}

test('renders at phone, tall and ultra-wide sizes', () => {
  for (const [w, h] of [[390, 844], [768, 1024], [3440, 1440], [1280, 720]]) {
    const scene = new Scene(createDefaultConfig());
    const ctx = createFakeContext();
    run(scene, 5, ctx, w, h);
    assert.deepEqual([...new Set(ctx.stats.bad)], [], `NaN at ${w}x${h}`);
  }
});

test('a planted foot does not slide or float', () => {
  for (const [speed, cadence, scale] of [[38, 0.62, 1], [70, 0.9, 1.3], [20, 0.3, 0.7]]) {
    const cfg = createDefaultConfig();
    Object.assign(cfg.character, { walkSpeed: speed, cadence, scale });
    const scene = new Scene(cfg);
    scene.computeView(1920, 1080);
    scene.update(1 / 60);
    const C = cfg.character;
    let seg = null; let worst = 0; let worstY = 0; let segments = 0;
    for (let f = 0; f < 60 * 20; f++) {
      scene.update(1 / 60);
      const leg = characterPose(scene.manPose(C)).near;
      const kind = leg.planted ? leg.pinKind : null;
      if (kind) {
        // the point the foot pivots on, measured from the solved (IK) ankle
        const pt = footPoints(leg)[kind];
        const wx = scene.manX + pt.x * C.scale;
        worstY = Math.max(worstY, Math.abs(pt.y) * C.scale);
        if (seg && seg.kind === kind) { seg.min = Math.min(seg.min, wx); seg.max = Math.max(seg.max, wx); }
        else { if (seg) close(seg); seg = { kind, min: wx, max: wx }; }
      } else if (seg) { close(seg); seg = null; }
    }
    function close(s) {
      if (s.max - s.min > 500) return; // wrapped from the right edge to the left
      worst = Math.max(worst, s.max - s.min); segments++;
    }
    assert.ok(segments > 10, 'too few stances measured');
    assert.ok(worst < 1, `foot slid ${worst.toFixed(2)} px at speed ${speed}, cadence ${cadence}`);
    assert.ok(worstY < 1, `planted foot left the ground by ${worstY.toFixed(2)} px`);
  }
});

test("Juhu's planted paws stay put while she walks with him", () => {
  const cfg = createDefaultConfig();
  const scene = new Scene(cfg);
  scene.computeView(1920, 1080);
  scene.update(1 / 60); // first frame places the man (and resets Juhu)
  scene.callDog();
  for (let i = 0; i < 60 * 18; i++) scene.update(1 / 60); // arrive and settle into the walk
  assert.equal(scene.dog.state, 'together');
  const scale = 0.98 * cfg.dog.scale;
  const segs = [null, null, null, null]; let worst = 0; let count = 0;
  for (let f = 0; f < 60 * 10; f++) {
    scene.update(1 / 60);
    if (scene.dog.gait > 0.05) continue; // only judge the settled walk
    const dx = scene.screenX(scene.dog.d);
    dogPose(scene.dog, scale).legs.forEach((L, i) => {
      const wx = dx + L.paw.x * scale;
      if (L.planted) {
        if (segs[i]) { segs[i].min = Math.min(segs[i].min, wx); segs[i].max = Math.max(segs[i].max, wx); }
        else segs[i] = { min: wx, max: wx };
      } else if (segs[i]) {
        const r = segs[i].max - segs[i].min;
        if (r < 500) { worst = Math.max(worst, r); count++; }
        segs[i] = null;
      }
    });
  }
  assert.ok(count > 8, 'too few paw contacts measured');
  assert.ok(worst < 2, `a paw slid ${worst.toFixed(2)} px`);
});

test('a zero-size canvas (hidden tab) does not break the view or lose the man', () => {
  const scene = new Scene(createDefaultConfig());
  const ctx = createFakeContext();
  scene.update(1 / 60);
  scene.render(ctx, 0, 0, 1);
  scene.update(1 / 60);
  scene.render(ctx, 1280, 720, 1);
  for (let i = 0; i < 30; i++) scene.update(1 / 60);
  scene.render(ctx, 1280, 720, 1);
  assert.ok(Number.isFinite(scene.view.s) && scene.view.s > 0);
  assert.ok(Number.isFinite(scene.manX));
  assert.deepEqual([...new Set(ctx.stats.bad)], []);
});

test('density above 1 draws more blades; density 1 matches the default field', () => {
  const count = (d) => {
    const cfg = createDefaultConfig(); cfg.grass.density = d;
    const scene = new Scene(cfg); const ctx = createFakeContext();
    scene.update(1 / 60); scene.render(ctx, 1920, 1080, 1);
    return ctx.stats.calls;
  };
  assert.ok(count(2) > count(1) * 1.3);
});

test('the legs never show outside the mundu above its hem', () => {
  for (const [preset, length] of [['sunny', 'folded'], ['wind', 'folded'], ['sunny', 'full']]) {
    const cfg = createDefaultConfig();
    cfg.character.munduLength = length;
    const scene = new Scene(cfg);
    scene.applyPreset(preset); scene.snapParams();
    scene.computeView(1920, 1080);
    let worst = 0;
    // x of an edge polyline at height y (null if outside its span)
    const edgeAt = (pts, y) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        if ((y - a.y) * (y - b.y) <= 0 && a.y !== b.y) return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
      }
      return null;
    };
    for (let f = 0; f < 60 * 12; f++) {
      scene.update(1 / 60);
      if (f < 60) continue;
      const pose = characterPose(scene.manPose(cfg.character));
      const o = scene.manMotion.cloth.outline();
      const hemTop = Math.min(...o.hem.map((p) => p.y)) - 3;
      for (const leg of [pose.near, pose.far]) {
        // sample along the thigh and shin, at the leg surface on both sides
        for (const [a, b, r] of [[pose.hip, leg.knee, 8.5], [leg.knee, leg.ankle, 5.8]]) {
          for (let t = 0; t <= 1; t += 0.1) {
            const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
            if (y > hemTop || y < o.front[0].y + 4) continue;
            const fx = edgeAt(o.front, y), bx = edgeAt(o.back, y);
            if (fx !== null) worst = Math.max(worst, x + r - fx);
            if (bx !== null) worst = Math.max(worst, bx - (x - r));
          }
        }
      }
    }
    assert.ok(worst < 1.5, `a leg showed ${worst.toFixed(2)} units outside the ${length} mundu in ${preset}`);
  }
});

test('the walk stops cleanly at zero speed', () => {
  const cfg = createDefaultConfig();
  cfg.character.walkSpeed = 0;
  const scene = new Scene(cfg);
  const ctx = createFakeContext();
  run(scene, 3, ctx);
  assert.equal(scene.walkPhase, 0);
  assert.deepEqual([...new Set(ctx.stats.bad)], []);
});

test('every control extreme renders without NaN', () => {
  for (const [path, [lo, hi]] of Object.entries(RANGES)) {
    for (const v of [lo, hi]) {
      const cfg = createDefaultConfig();
      const [group, key] = path.split('.');
      if (!(group in cfg) || !(key in cfg[group])) continue;
      cfg[group][key] = v;
      const scene = new Scene(cfg);
      const ctx = createFakeContext();
      run(scene, 1, ctx);
      assert.deepEqual([...new Set(ctx.stats.bad)], [], `${path} = ${v}`);
    }
  }
});

test('config survives a JSON round trip, and bad values are rejected', () => {
  const cfg = createDefaultConfig();
  const { config, warnings } = validateConfig(JSON.parse(JSON.stringify(cfg)));
  assert.deepEqual(warnings, []);
  assert.deepEqual(config, cfg);
  const bad = validateConfig({ grass: { density: 'lots', mass: 99 }, character: { cadence: NaN } });
  assert.ok(bad.warnings.includes('grass.density'));
  assert.equal(bad.config.grass.mass, RANGES['grass.mass'][1]);
});

test('grass layout is deterministic for a seed', () => {
  const a = new Scene(createDefaultConfig()).field.mid.blades.slice(0, 50);
  const b = new Scene(createDefaultConfig()).field.mid.blades.slice(0, 50);
  assert.deepEqual(a, b);
});
