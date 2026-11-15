// Sound (Epic 6): the mix, birds and thunder logic, and the built manifest.
// docs/bmad/party-mode/2026-10-20-sound-mix.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { AUDIO_MIX, AUDIO_EVENTS, AUDIO_CALLS, AUDIO_THUNDER, RANGES, createDefaultConfig, validateConfig } from '../src/config.js';
import { SCENE_NAMES } from '../src/weather.js';
import { BedMix, coupling } from '../src/audio/mix.js';
import { EventScheduler, makeRng, nextWait } from '../src/audio/events.js';
import { ThunderScheduler, thunderShape } from '../src/audio/thunder.js';

const manifest = JSON.parse(readFileSync(new URL('../public/audio/manifest.json', import.meta.url), 'utf8'));
const counts = Object.fromEntries(Object.entries(manifest.sounds).map(([id, s]) => [id, s.files.length]));
const dbOf = (p) => 10 * Math.log10(p);

test('every scene has a mix, and every id used exists in the manifest', () => {
  for (const s of SCENE_NAMES) assert.ok(AUDIO_MIX[s], `no mix for ${s}`);
  const ids = [
    ...Object.values(AUDIO_MIX).flatMap((m) => Object.keys(m)),
    ...Object.values(AUDIO_EVENTS).flatMap((e) => e.pool.map((p) => p.id)),
    AUDIO_THUNDER.far, AUDIO_THUNDER.close,
  ];
  for (const id of ids) assert.ok(manifest.sounds[id], `${id} missing from manifest`);
  for (const p of Object.values(AUDIO_EVENTS).flatMap((e) => e.pool)) assert.ok(AUDIO_CALLS[p.id], `no call shape for ${p.id}`);
});

test('every manifest file is on disk, and every licence is on the D-6.6 allowlist', () => {
  const allowed = ['CC0', 'CC BY 3.0', 'CC BY 4.0', 'CC BY-SA 4.0'];
  for (const [id, s] of Object.entries(manifest.sounds)) {
    assert.ok(allowed.includes(s.credit.licence), `${id}: ${s.credit.licence}`);
    for (const f of s.files) for (const ext of ['webm', 'm4a']) {
      assert.ok(existsSync(new URL(`../public/audio/${f[ext]}`, import.meta.url)), `${f[ext]} missing`);
    }
  }
});

test('the default sound settings pass validation', () => {
  const cfg = createDefaultConfig();
  const { config: clean, warnings } = validateConfig(cfg);
  assert.deepEqual(warnings, []);
  assert.deepEqual(clean.audio, cfg.audio);
});

test('scene crossfades are equal-power: total power stays within 1 dB and reaches the targets', () => {
  const mix = new BedMix();
  mix.setScene('sunny');
  mix.step(100, 8);
  for (const [from, to] of [['sunny', 'twilight'], ['twilight', 'night'], ['dawn', 'sunny']]) {
    mix.setScene(from); mix.step(100, 8);
    const a = mix.totalPower();
    mix.setScene(to);
    const b = (AUDIO_MIX[to] && Object.values(AUDIO_MIX[to]).reduce((s, w) => s + w * w, 0));
    for (let t = 0; t < 8; t += 0.1) {
      mix.step(0.1, 8);
      const p = mix.totalPower();
      assert.ok(dbOf(p) >= Math.min(dbOf(a), dbOf(b)) - 1 && dbOf(p) <= Math.max(dbOf(a), dbOf(b)) + 1, `${from}->${to} at ${t}s: ${dbOf(p)}`);
    }
    for (const [id, w] of Object.entries(AUDIO_MIX[to])) assert.ok(Math.abs(mix.amplitude(id) - w) < 1e-9, `${id} reached ${w}`);
  }
});

test('a bed shared by both scenes keeps playing through the change', () => {
  const mix = new BedMix();
  mix.setScene('sunny'); mix.step(100, 8);
  mix.setScene('wind');
  for (let t = 0; t < 8; t += 0.1) { mix.step(0.1, 8); assert.ok(mix.amplitude('dayField') > 0.29); assert.ok(mix.amplitude('windGrass') > 0.34); }
});

test('rain and wind beds follow how hard it rains and blows', () => {
  assert.equal(coupling('rainSteady', { rain: 0 }), 0);
  assert.equal(coupling('rainSteady', { rain: 0.8 }), 1);
  assert.ok(coupling('windGrass', { wind: 1 }) > coupling('windGrass', { wind: 0.2 }));
  assert.equal(coupling('dayField', { rain: 1, wind: 1 }), 1);
});

test('the wait between events averages the configured mean and never falls under minGap', () => {
  const rng = makeRng(7);
  const waits = Array.from({ length: 20000 }, () => nextWait(rng, 14, 6));
  const mean = waits.reduce((a, b) => a + b, 0) / waits.length;
  assert.ok(Math.abs(mean - 14) / 14 < 0.05, `mean ${mean}`);
  assert.ok(Math.min(...waits) >= 6);
});

function runEvents(scene, seconds, seed = 3) {
  const s = new EventScheduler({ files: counts, rng: makeRng(seed) });
  const out = [];
  for (let t = 0; t < seconds; t += 0.1) for (const e of s.step(scene, 0.1)) out.push({ t, ...e });
  return out;
}

test('no birds in wind, rain or night; birds in dawn, sunny and (rarely) twilight', () => {
  for (const s of ['wind', 'rain', 'night']) assert.equal(runEvents(s, 600).length, 0, s);
  const sunny = runEvents('sunny', 3000);
  assert.ok(Math.abs(3000 / sunny.length - AUDIO_EVENTS.sunny.mean) / AUDIO_EVENTS.sunny.mean < 0.2, `sunny every ${3000 / sunny.length}s`);
  const tw = runEvents('twilight', 3000);
  assert.ok(tw.length > 0 && tw.every((e) => e.id === 'crowsHouse'));
  assert.ok(3000 / tw.length > 60, 'crows stay rare');
});

test('koel calls in rising phrases of 2 to 4; no file plays twice in a row', () => {
  const evs = runEvents('sunny', 5000);
  const koel = evs.filter((e) => e.id === 'koel');
  assert.ok(koel.length > 20);
  for (const e of koel) {
    assert.ok(e.calls.length >= 2 && e.calls.length <= 4, `phrase of ${e.calls.length}`);
    for (let i = 1; i < e.calls.length; i++) {
      assert.ok(e.calls[i].rate > e.calls[i - 1].rate, 'each call a touch higher');
      assert.ok(e.calls[i].at - e.calls[i - 1].at >= 1.4);
    }
  }
  for (const id of ['koel', 'kingfisher']) {
    const files = evs.filter((e) => e.id === id).flatMap((e) => e.calls.map((c) => c.file));
    for (let i = 1; i < files.length; i++) assert.notEqual(files[i], files[i - 1], `${id} repeated a file`);
  }
});

test('density 0 silences the birds', () => {
  const s = new EventScheduler({ files: counts, rng: makeRng(1) });
  let n = 0;
  for (let t = 0; t < 600; t += 0.1) n += s.step('sunny', 0.1, 0).length;
  assert.equal(n, 0);
});

// Story 6.9's original timing, to keep the scheduler's mechanics covered
// (the defaults changed in story 6.17, D-6.18).
const STORY_6_9 = { ...AUDIO_THUNDER, firstAfter: [6, 14], mean: 40, minGap: 25, distanceKm: [3, 12], closeRoll: true };

function runThunder(scenes, seed = 5, cfg = STORY_6_9) {
  const s = new ThunderScheduler({ files: { far: counts.thunderDistant, close: counts.thunderClose }, rng: makeRng(seed), cfg });
  const out = [];
  let t = 0;
  for (const [scene, seconds] of scenes) for (let u = 0; u < seconds; u += 0.1, t += 0.1) for (const r of s.step(scene, 0.1)) out.push({ t, scene, u, ...r });
  return out;
}

test('thunder only in rain: first roll 6–14 s in, rolls at least 25 s apart, close roll once per visit (6.9 timing)', () => {
  assert.equal(runThunder([['sunny', 300], ['night', 300], ['overcast', 300]]).length, 0);
  for (let seed = 1; seed <= 30; seed++) {
    const visits = [['rain', 40], ['twilight', 30], ['rain', 120], ['night', 20]];
    const rolls = runThunder(visits, seed);
    assert.ok(rolls.every((r) => r.scene === 'rain'));
    const firsts = [rolls.find((r) => r.t < 40), rolls.find((r) => r.t >= 70 && r.t < 190)].filter(Boolean);
    for (const f of firsts) assert.ok(f.u >= 6 - 0.11 && f.u <= 14 + 0.11, `first roll at ${f.u}`);
    for (let i = 1; i < rolls.length; i++) if (rolls[i].t < 40 === rolls[i - 1].t < 40) assert.ok(rolls[i].t - rolls[i - 1].t >= 25 - 0.11);
    assert.ok(rolls.filter((r) => r.kind === 'close' && r.t >= 70).length <= 1);
    assert.ok(rolls.filter((r) => r.kind === 'close').every((r) => r.km < AUDIO_THUNDER.closeUnderKm));
  }
});

test('farther thunder is quieter, duller and slower', () => {
  const cfg = { distanceKm: [3, 12] };
  let prev = thunderShape(3, cfg);
  for (let km = 4; km <= 12; km++) {
    const s = thunderShape(km, cfg);
    assert.ok(s.gainDb < prev.gainDb && s.cutoff < prev.cutoff && s.rate < prev.rate && s.delay > prev.delay);
    prev = s;
  }
});

// Lightning before thunder (story 6.11, D-6.16)
function runStorm(scenes, seed = 5) {
  const s = new ThunderScheduler({ files: { far: counts.thunderDistant, close: counts.thunderClose }, rng: makeRng(seed) });
  const flashes = [], rolls = [];
  let t = 0;
  for (const [scene, seconds] of scenes) {
    for (let u = 0; u < seconds; u += 0.1, t += 0.1) {
      for (const h of s.step(scene, 0.1, { lightning: true })) (h.kind === 'flash' ? flashes : rolls).push({ t, scene, ...h });
    }
  }
  return { flashes, rolls };
}

test('lightning: one flash per roll, the roll distance ÷ 0.343 s later; rolls still never overlap', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { flashes, rolls } = runStorm([['rain', 400], ['sunny', 60]], seed);
    assert.ok(flashes.length >= 3, `only ${flashes.length} flashes`);
    assert.equal(rolls.length, flashes.length, 'every flash gets exactly one roll');
    flashes.forEach((f, i) => {
      const r = rolls[i];
      assert.equal(r.km, f.km);
      assert.ok(Math.abs(r.t - f.t - f.km / 0.343) <= 0.11, `roll ${(r.t - f.t).toFixed(2)} s after flash at ${f.km.toFixed(1)} km`);
      assert.ok(f.strength > 0 && f.strength <= 1);
      if (i) assert.ok(f.t - flashes[i - 1].t >= 1, 'never more than one flash a second');
    });
    for (let i = 1; i < rolls.length; i++) assert.ok(rolls[i].t - rolls[i - 1].t >= AUDIO_THUNDER.minGap - 0.11, `rolls at least ${AUDIO_THUNDER.minGap} s apart`);
    assert.ok(flashes.every((f) => f.scene === 'rain'), 'flashes only in rain');
  }
});

test('lightning: a roll on its way still arrives after the scene leaves Rain; nearer is brighter', () => {
  const s = new ThunderScheduler({ files: { far: counts.thunderDistant, close: counts.thunderClose }, rng: makeRng(2) });
  const now = s.strike(0.4, { lightning: true }).now;
  assert.equal(now.length, 1);
  assert.ok(now[0].strength < thunderShape(0.15).flash, 'nearer is brighter');
  let rolls = [];
  for (let t = 0; t < 40; t += 0.1) rolls = rolls.concat(s.step('sunny', 0.1, { lightning: true }));
  assert.equal(rolls.length, 1);
  assert.equal(rolls[0].km, 0.4);
  // without lightning: the roll now, no flash (story 6.9 behaviour)
  const off = s.strike(6).now;
  assert.equal(off.length, 1);
  assert.notEqual(off[0].kind, 'flash');
});

test('lightning shows with sound off, and can be switched off in config', async () => {
  const { SoundDirector } = await import('../src/audio/index.js');
  for (const lightning of [true, false]) {
    const cfg = createDefaultConfig();
    cfg.audio.enabled = false; // sound off
    cfg.audio.lightning = lightning;
    const d = new SoundDirector(cfg);
    d.thunder.files = { far: counts.thunderDistant, close: counts.thunderClose };
    let flashes = 0;
    d.onFlash = () => flashes++;
    for (let t = 0; t < 120; t += 1 / 60) d.update({}, 1 / 60, 'rain');
    if (lightning) assert.ok(flashes >= 1); else assert.equal(flashes, 0);
  }
  assert.equal(validateConfig({ audio: { lightning: false } }).config.audio.lightning, false);
});

// Mellow thunder (story 6.17, D-6.18)
const files = { far: counts.thunderDistant, close: counts.thunderClose };
function runLive(audio, seconds, seed, { lightning = true } = {}) {
  const s = new ThunderScheduler({ files, rng: makeRng(seed), settings: () => audio });
  const flashes = [], rolls = [];
  for (let t = 0; t < seconds; t += 0.1) {
    for (const h of s.step('rain', 0.1, { lightning })) (h.kind === 'flash' ? flashes : rolls).push({ t, ...h });
  }
  return { flashes, rolls, s };
}

test('6.18 defaults: a strike early in every Rain pass, the roll right after its flash, gentle', () => {
  const A = createDefaultConfig().audio;
  assert.equal(A.thunderClose, false);
  assert.ok(A.thunder <= 0.6, `thunder volume ${A.thunder}`);
  assert.equal(A.thunderMean, AUDIO_THUNDER.mean);
  assert.equal(A.thunderMinGap, AUDIO_THUNDER.minGap);
  assert.equal(A.thunderMaxGap, AUDIO_THUNDER.maxGap);
  assert.deepEqual([A.thunderNearKm, A.thunderFarKm], AUDIO_THUNDER.distanceKm);
  for (let seed = 1; seed <= 40; seed++) {
    const { rolls, flashes } = runLive(createDefaultConfig().audio, 600, seed);
    // the first strike comes within 3–8 s of rain arriving
    assert.ok(flashes[0].t >= 3 - 0.11 && flashes[0].t <= 8 + 0.11, `first flash at ${flashes[0].t.toFixed(1)} s`);
    // the roll lands at most about a second after its flash
    flashes.forEach((f, k) => { if (rolls[k]) assert.ok(rolls[k].t - f.t <= 1.3, `roll ${(rolls[k].t - f.t).toFixed(2)} s after its flash`); });
    // never closer than minGap, never further apart than maxGap (plus the roll's travel)
    for (let k = 1; k < flashes.length; k++) {
      const g = flashes[k].t - flashes[k - 1].t;
      assert.ok(g >= A.thunderMinGap - 0.11 && g <= A.thunderMaxGap + 1.3 + 0.11, `gap ${g.toFixed(1)} s`);
    }
    // so any 16 s of Rain (the shortest pass, on a phone) has at least one strike
    for (let from = 0; from + 16 <= 600; from += 2) {
      assert.ok(flashes.some((f) => f.t >= from && f.t < from + 16), `no strike between ${from} and ${from + 16} s`);
    }
    assert.ok(rolls.every((r) => r.kind === 'far'), 'the soft roll, no loud close roll by default');
  }
});

test('dev values are respected: how often, minimum gap, distance range and the close roll', () => {
  const A = { ...createDefaultConfig().audio, thunderMean: 30, thunderMinGap: 20, thunderNearKm: 2, thunderFarKm: 4, thunderClose: true };
  const { rolls, flashes } = runLive(A, 900, 3);
  assert.ok(rolls.length >= 15, `${rolls.length} rolls with mean 30 s`);
  for (let i = 1; i < rolls.length; i++) assert.ok(rolls[i].t - rolls[i - 1].t >= 20 - 0.11);
  assert.ok(rolls.every((r) => r.km >= 2 && r.km <= 4));
  assert.equal(rolls.filter((r) => r.kind === 'close').length, 1, 'one close roll per visit when switched on');
  assert.ok(flashes.length - rolls.length <= 1, "every flash gets its roll (the last may still be on its way)");
  // the close roll stays off when switched off, even near
  const off = runLive({ ...A, thunderClose: false }, 900, 3).rolls;
  assert.equal(off.filter((r) => r.kind === 'close').length, 0);
  // nearest and farthest swapped still work
  const swapped = runLive({ ...A, thunderNearKm: 9, thunderFarKm: 7 }, 900, 4).rolls;
  assert.ok(swapped.length && swapped.every((r) => r.km >= 7 && r.km <= 9));
});

test('dev changes take effect live, without a new scheduler', () => {
  const A = createDefaultConfig().audio;
  const s = new ThunderScheduler({ files, rng: makeRng(7), settings: () => A });
  let rolls = [], clock = 0;
  const run = (sec) => {
    for (let t = 0; t < sec; t += 0.1, clock += 0.1) {
      for (const h of s.step('rain', 0.1, { lightning: true })) if (h.kind !== 'flash') rolls.push({ t: clock, ...h });
    }
  };
  run(200);
  const before = rolls.length;
  A.thunderMean = 20; A.thunderMinGap = 10; A.thunderNearKm = 1; A.thunderFarKm = 2;
  run(300);
  const after = rolls.slice(before);
  assert.ok(after.length >= 8, `${after.length} rolls after "how often" went to 20 s`);
  assert.ok(after.slice(1).every((r) => r.km <= 2));
  // even across the change, rolls keep the minimum gap in force (the default 8 s, then 10 s)
  for (let i = 1; i < rolls.length; i++) assert.ok(rolls[i].t - rolls[i - 1].t >= createDefaultConfig().audio.thunderMinGap - 0.11);
});

test('flash strength scales the flash; 1 is unchanged, 0 is no light; the roll still comes', () => {
  const at = (flashStrength) => {
    const s = new ThunderScheduler({ files, rng: makeRng(1), settings: () => ({ ...createDefaultConfig().audio, flashStrength }) });
    return s.strike(8, { lightning: true }).now[0].strength;
  };
  const full = thunderShape(8, AUDIO_THUNDER).flash;
  assert.equal(at(1), full);
  assert.ok(Math.abs(at(0.5) - full * 0.5) < 1e-9);
  assert.equal(at(0), 0);
  assert.equal(createDefaultConfig().audio.flashStrength, 1);
  // and through the SoundDirector to the scene
  return import('../src/audio/index.js').then(({ SoundDirector }) => {
    const cfg = createDefaultConfig();
    cfg.audio.flashStrength = 0.4;
    const d = new SoundDirector(cfg);
    d.thunder.files = files;
    const seen = [];
    d.onFlash = (x) => seen.push(x);
    d.thunderNow(); // "Thunder now" flashes too
    assert.equal(seen.length, 1);
    assert.ok(seen[0] > 0 && seen[0] <= 0.4 + 1e-9, `flash ${seen[0]}`);
  });
});

test('the new thunder settings are validated, clamped, and saved and loaded', () => {
  const keys = ['thunderMean', 'thunderMinGap', 'thunderMaxGap', 'thunderNearKm', 'thunderFarKm', 'flashStrength'];
  for (const k of keys) assert.ok(RANGES[`audio.${k}`], `no range for audio.${k}`);
  const def = createDefaultConfig().audio;
  for (const k of keys) {
    const [lo, hi] = RANGES[`audio.${k}`];
    assert.ok(def[k] >= lo && def[k] <= hi, `${k} default out of range`);
  }
  const ok = validateConfig({ audio: { thunderMean: 150, thunderMinGap: 45, thunderMaxGap: 200, thunderNearKm: 3, thunderFarKm: 9, thunderClose: true, flashStrength: 0.3 } });
  assert.equal(ok.warnings.length, 0);
  assert.deepEqual(
    keys.map((k) => ok.config.audio[k]).concat(ok.config.audio.thunderClose),
    [150, 45, 200, 3, 9, 0.3, true],
  );
  const clamped = validateConfig({ audio: { thunderMean: 1, thunderMinGap: 9999, thunderNearKm: -3, thunderFarKm: 99, flashStrength: 2 } }).config.audio;
  assert.equal(clamped.thunderMean, RANGES['audio.thunderMean'][0]);
  assert.equal(clamped.thunderMinGap, RANGES['audio.thunderMinGap'][1]);
  assert.equal(clamped.thunderNearKm, RANGES['audio.thunderNearKm'][0]);
  assert.equal(clamped.thunderFarKm, RANGES['audio.thunderFarKm'][1]);
  assert.equal(clamped.flashStrength, 1);
  const bad = validateConfig({ audio: { thunderMean: 'often', thunderClose: 'yes', flashStrength: NaN } });
  assert.deepEqual(bad.warnings.sort(), ['audio.flashStrength', 'audio.thunderClose', 'audio.thunderMean']);
  assert.equal(bad.config.audio.thunderClose, false);
  // a saved config (Download JSON) loads back the same
  const saved = JSON.parse(JSON.stringify({ audio: { ...def, thunderMean: 75, thunderClose: true, flashStrength: 0.6 } }));
  const back = validateConfig(saved).config.audio;
  assert.equal(back.thunderMean, 75); assert.equal(back.thunderClose, true); assert.equal(back.flashStrength, 0.6);
});
