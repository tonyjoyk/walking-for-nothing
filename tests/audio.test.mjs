// Sound (Epic 6): the mix, birds and thunder logic, and the built manifest.
// docs/bmad/party-mode/2026-10-20-sound-mix.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { AUDIO_MIX, AUDIO_EVENTS, AUDIO_CALLS, AUDIO_THUNDER, createDefaultConfig, validateConfig } from '../src/config.js';
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

function runThunder(scenes, seed = 5) {
  const s = new ThunderScheduler({ files: { far: counts.thunderDistant, close: counts.thunderClose }, rng: makeRng(seed) });
  const out = [];
  let t = 0;
  for (const [scene, seconds] of scenes) for (let u = 0; u < seconds; u += 0.1, t += 0.1) for (const r of s.step(scene, 0.1)) out.push({ t, scene, u, ...r });
  return out;
}

test('thunder only in rain: first roll 6–14 s in, rolls at least 25 s apart, close roll once per visit', () => {
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
  let prev = thunderShape(3);
  for (let km = 4; km <= 12; km++) {
    const s = thunderShape(km);
    assert.ok(s.gainDb < prev.gainDb && s.cutoff < prev.cutoff && s.rate < prev.rate && s.delay > prev.delay);
    prev = s;
  }
});
