// Manifest and credits (docs/stories/6.4.manifest-and-credits.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { ALLOWED_LICENCES, CREDIT_FIELDS, checkManifest, soundCredits, readmeCreditsBlock, withReadmeCredits } from '../src/audio/credits.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('public/audio/manifest.json'));
const { sources } = JSON.parse(read('audio/sources.json'));
const clone = () => JSON.parse(JSON.stringify(manifest));

test('6.4: the shipped manifest passes the schema and licence check', () => {
  assert.deepEqual(checkManifest(manifest), []);
});

test('6.4: each sound has role, scenes, durations, loop points in samples and a full credit', () => {
  const sr = manifest.sampleRate;
  assert.equal(sr, 48000);
  for (const [id, s] of Object.entries(manifest.sounds)) {
    for (const f of s.files) {
      assert.ok(existsSync(new URL(`../public/audio/${f.webm}`, import.meta.url)), `${id}: ${f.webm} exists`);
      assert.ok(existsSync(new URL(`../public/audio/${f.m4a}`, import.meta.url)), `${id}: ${f.m4a} exists`);
      assert.ok(Math.abs(f.samples / sr - f.seconds) < 0.001, `${id}: samples match seconds`);
    }
    if (s.role === 'bed') {
      assert.equal(s.loop.startSample, 0, id);
      assert.equal(s.loop.endSample, s.files[0].samples, `${id}: the whole bed loops`);
    } else assert.equal(s.loop, null, id);
    for (const k of CREDIT_FIELDS) assert.ok(s.credit[k], `${id}: credit.${k}`);
  }
});

test('6.4: every file on disk is in the manifest', () => {
  const listed = new Set(Object.values(manifest.sounds).flatMap((s) => s.files.flatMap((f) => [f.webm, f.m4a])));
  const dir = new URL('../public/audio/', import.meta.url);
  const onDisk = readdirSync(dir);
  for (const f of onDisk.filter((n) => /\.(webm|m4a)$/.test(n))) assert.ok(listed.has(f), `${f} is credited`);
});

test('6.4: manifest licences match audio/sources.json, and BY-SA sources ship as CC BY-SA 4.0', () => {
  for (const src of sources) {
    const s = manifest.sounds[src.id];
    assert.ok(s, `${src.id} built`);
    const want = /BY-SA/.test(src.licence) ? 'CC BY-SA 4.0' : src.licence;
    assert.equal(s.credit.licence, want, src.id);
    assert.equal(s.credit.recordist, src.recordist, src.id);
    assert.equal(s.credit.url, src.url, src.id);
    assert.equal(s.credit.title, src.title, src.id);
  }
  for (const s of Object.values(manifest.sounds)) if (/SA/.test(s.credit.licence)) assert.equal(s.credit.licence, 'CC BY-SA 4.0');
});

test('6.4: the check fails on a licence outside the allowlist or a missing credit field', () => {
  assert.ok(!ALLOWED_LICENCES.some((l) => /NC|ND/.test(l)), 'no NC or ND (D-6.6)');
  for (const bad of ['CC BY-NC 4.0', 'CC BY-NC-SA 4.0', 'CC BY-ND 4.0', 'All rights reserved', '']) {
    const m = clone(); m.sounds.koel.credit.licence = bad;
    assert.ok(checkManifest(m).some((p) => p.startsWith('koel:')), `"${bad}" is refused`);
  }
  for (const k of CREDIT_FIELDS) {
    const m = clone(); delete m.sounds.dawnOrchard.credit[k];
    assert.ok(checkManifest(m).includes(`dawnOrchard: credit.${k} missing`), k);
  }
  const m = clone(); delete m.sounds.dayField.loop.endSample;
  assert.ok(checkManifest(m).includes('dayField: bed without loop points in samples'));
  const n = clone(); delete n.sounds.koel.files[0].samples;
  assert.ok(checkManifest(n).some((p) => p.includes('no sample count')));
});

test('6.4: one credit per recording, listing every file it became', () => {
  const credits = soundCredits(manifest);
  assert.equal(credits.length, new Set(Object.values(manifest.sounds).map((s) => s.credit.url)).size);
  const koel = credits.find((c) => c.ids.includes('koel'));
  assert.deepEqual(koel.files.filter((f) => f.endsWith('.webm')), ['koel-1.webm', 'koel-2.webm', 'koel-3.webm', 'koel-4.webm']);
  assert.equal(koel.attribution, true);
  assert.equal(credits.find((c) => c.ids.includes('dayField')).attribution, false);
});

test('6.4: the README "Sound credits" block is the one generated from the manifest', () => {
  const readme = read('README.md');
  assert.ok(readme.includes(readmeCreditsBlock(manifest)), 'README is up to date: run node scripts/build-audio.mjs --manifest-only');
  assert.equal(withReadmeCredits(readme, manifest), readme);
  for (const s of Object.values(manifest.sounds)) {
    assert.ok(readme.includes(`](${s.credit.url})`), s.credit.url);
    for (const f of s.files) assert.ok(readme.includes('`' + f.webm.replace('.webm', '') + '`'), f.webm);
  }
  assert.throws(() => withReadmeCredits('no markers', manifest), /markers/);
});
