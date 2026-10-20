// Builds the site's sound from the chosen recordings (story 6.3, D-6.4).
//
//   node scripts/build-audio.mjs          # all sources
//   node scripts/build-audio.mjs rainSteady koel
//
// Reads audio/sources.json (what to use and how) and audio/sources.lock.json
// (checksums), takes the originals from audio-src/ (git-ignored) and writes
// public/audio/<id>[-n].webm (Opus) + .m4a (AAC) and public/audio/manifest.json.
//
// - Beds: the calmest ~75 s (steadiest loudness, no bursts) unless edits set
//   start/end; an equal-power crossfade is baked into the ends so the loop is
//   seamless; levelled with one linear gain (no compression) to about -28 LUFS.
// - Events (bird calls): individual calls found from the energy envelope, cut
//   with short fades, each levelled to about -24 LUFS. Mono.
// - Thunder: separate rolls found in the long recordings, cut with a soft
//   start and a long tail, levelled to about -22 LUFS.
// Requires ffmpeg with libopus and aac.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SR = 48000;
const OUT = join(root, 'public/audio');
const TARGET = { bed: -28, event: -24, thunder: -22 }; // LUFS
const PEAK_MAX = -3;           // dBFS sample peak ceiling
const BED_SECONDS = 75;        // loop length
const BUDGET_BYTES = 6 * 1024 * 1024; // per format
const EVENT_COUNT = { koel: 4, kingfisher: 3, crowsHouse: 3 };
const THUNDER_COUNT = { thunderDistant: 5, thunderClose: 1 };
const ALLOWED = ['CC0', 'CC BY 3.0', 'CC BY 4.0', 'CC BY-SA 4.0']; // D-6.6

const db = (x) => 20 * Math.log10(Math.max(1e-12, x));
const fromDb = (d) => Math.pow(10, d / 20);

function ffmpeg(args, input) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', ...args], { input, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}\n${r.stderr}`);
  return r;
}

// Decode to interleaved float32 at 48 kHz, high-passed (removes rumble and DC).
function decode(path, channels, highpass) {
  const r = ffmpeg(['-i', path, '-af', `highpass=f=${highpass || 60},aresample=${SR}`, '-ac', String(channels), '-f', 'f32le', '-']);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4).slice();
}

const rawArgs = (ch) => ['-f', 'f32le', '-ar', String(SR), '-ac', String(ch), '-i', '-'];
const buf = (f) => Buffer.from(f.buffer, f.byteOffset, f.byteLength);

// EBU R128: integrated loudness and the short-term (3 s) series at 10 Hz.
function loudness(pcm, ch) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...rawArgs(ch), '-af', 'ebur128=framelog=info', '-f', 'null', '-'],
    { input: buf(pcm), maxBuffer: 1 << 30 });
  const err = r.stderr.toString();
  const I = Number((err.match(/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/) || [])[1]);
  const S = [...err.matchAll(/ S:\s*(-?[\d.]+|-inf)/g)].map((m) => (m[1] === '-inf' ? -120 : Number(m[1])));
  return { I, S };
}

function peakDb(pcm) { let m = 0; for (const v of pcm) m = Math.max(m, Math.abs(v)); return db(m); }

// One linear gain to the target, lowered if the peak would pass the ceiling.
function level(pcm, ch, target) {
  const { I } = loudness(pcm, ch);
  let g = target - I;
  const p = peakDb(pcm) + g;
  if (p > PEAK_MAX) g -= p - PEAK_MAX;
  const k = fromDb(g);
  for (let i = 0; i < pcm.length; i++) pcm[i] *= k;
  return { I, gain: g, peak: peakDb(pcm), out: loudness(pcm, ch).I };
}

function fade(pcm, ch, inSec, outSec) {
  const n = pcm.length / ch, fi = Math.round(inSec * SR), fo = Math.round(outSec * SR);
  for (let f = 0; f < n; f++) {
    let k = 1;
    if (f < fi) k = Math.sin((Math.PI / 2) * (f / fi));
    if (f > n - fo) k = Math.min(k, Math.sin((Math.PI / 2) * ((n - f) / fo)));
    for (let c = 0; c < ch; c++) pcm[f * ch + c] *= k;
  }
}

function slice(pcm, ch, a, b) { return pcm.slice(Math.round(a * SR) * ch, Math.round(b * SR) * ch); }

// Mono energy envelope in dB, one value per `step` seconds.
function envelope(pcm, ch, step) {
  const n = Math.floor(pcm.length / ch / (step * SR)), w = Math.round(step * SR), out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let f = i * w; f < (i + 1) * w; f++) { let v = 0; for (let c = 0; c < ch; c++) v += pcm[f * ch + c]; v /= ch; s += v * v; }
    out[i] = 10 * Math.log10(s / w + 1e-12);
  }
  return out;
}
const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor((a.length - 1) * p)]; };

// ---- beds ---------------------------------------------------------------
function buildBed(src, pcm, ch, X) {
  const total = pcm.length / ch / SR;
  const L = Math.min(BED_SECONDS, total - X - 0.5);
  let start = src.edits.start;
  if (start == null) {
    // the calmest window: steady short-term loudness and no bursts
    const { S } = loudness(pcm, ch); // 10 per second
    let best = Infinity;
    for (let s = 0.5; s + L + X <= total - 0.2; s += 1) {
      const w = S.slice(Math.round((s + 3) * 10), Math.round((s + L + X) * 10)).filter((v) => v > -100);
      if (w.length < 10) continue;
      const mean = w.reduce((a, b) => a + b, 0) / w.length;
      const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / w.length);
      const burst = Math.max(0, Math.max(...w) - pct(w, 0.5) - 6);
      const cost = sd + 0.6 * burst;
      if (cost < best) { best = cost; start = s; }
    }
    if (start == null) start = 0;
  }
  const seg = slice(pcm, ch, start, start + L + X);
  // equal-power loop crossfade: the tail after L fades out over the first X
  // seconds while the head fades in, so the end flows straight into the start
  const n = Math.round(L * SR), x = Math.round(X * SR), out = seg.slice(0, n * ch);
  for (let f = 0; f < x; f++) {
    const a = Math.sin((Math.PI / 2) * (f / x)), b = Math.cos((Math.PI / 2) * (f / x));
    for (let c = 0; c < ch; c++) out[f * ch + c] = seg[f * ch + c] * a + seg[(n + f) * ch + c] * b;
  }
  return { clips: [{ pcm: out, start, length: L }] };
}

// ---- bird calls -----------------------------------------------------------
function buildEvents(src, pcm, ch, count) {
  const step = 0.02, env = envelope(pcm, ch, step), floor = pct(env, 0.2), thr = floor + 12;
  const regions = [];
  let a = -1;
  env.forEach((v, i) => {
    if (v > thr && a < 0) a = i;
    if ((v <= thr || i === env.length - 1) && a >= 0) { regions.push([a * step, i * step]); a = -1; }
  });
  const merged = [];
  for (const r of regions) {
    const last = merged[merged.length - 1];
    if (last && r[0] - last[1] < 0.35) last[1] = r[1]; else merged.push([...r]);
  }
  const total = pcm.length / ch / SR;
  const calls = merged
    .map(([s, e]) => [Math.max(0, s - 0.15), Math.min(total, e + 0.35)])
    .filter(([s, e]) => e - s >= 0.4 && e - s <= 4.5)
    .map(([s, e]) => ({ s, e, peak: Math.max(...env.slice(Math.floor(s / step), Math.ceil(e / step))) }))
    .sort((p, q) => q.peak - p.peak)
    .reduce((kept, c) => (kept.length < count && kept.every((k) => Math.abs(k.s - c.s) >= 3) ? [...kept, c] : kept), [])
    .sort((p, q) => p.s - q.s);
  return {
    clips: calls.map(({ s, e }) => {
      const c = slice(pcm, ch, s, e);
      fade(c, ch, 0.015, 0.12);
      return { pcm: c, start: s, length: e - s };
    }),
  };
}

// ---- thunder ------------------------------------------------------------
function buildThunder(src, pcm, ch, count) {
  const step = 0.5, raw = envelope(pcm, ch, step);
  const env = raw.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - 2); j <= Math.min(raw.length - 1, i + 2); j++) { s += raw[j]; n++; } return s / n; });
  const floor = pct(env, 0.25);
  const peaks = [];
  env.forEach((v, i) => { if (v > floor + 8 && v >= Math.max(...env.slice(Math.max(0, i - 20), i + 21))) peaks.push({ i, v }); });
  peaks.sort((p, q) => q.v - p.v);
  const chosen = [];
  for (const p of peaks) if (chosen.every((c) => Math.abs(c.i - p.i) * step >= 25)) chosen.push(p);
  const total = pcm.length / ch / SR;
  return {
    clips: chosen.slice(0, count).sort((p, q) => p.i - q.i).map(({ i, v }) => {
      let s = i; while (s > 0 && i - s < 12 && env[s] > v - 15) s--;
      let e = i; while (e < env.length - 1 && e - i < 40 && env[e] > floor + 3) e++;
      const a = Math.max(0, s * step - 0.5), b = Math.min(total, Math.max(e * step + 1, a + 6));
      const c = slice(pcm, ch, a, Math.min(b, a + 22));
      fade(c, ch, 0.4, 2.5);
      return { pcm: c, start: a, length: c.length / ch / SR };
    }),
  };
}

// ---- encode ---------------------------------------------------------------
function encode(pcm, ch, name, role) {
  const opus = role === 'bed' ? '56k' : role === 'thunder' ? '56k' : '48k';
  ffmpeg([...rawArgs(ch), '-c:a', 'libopus', '-b:a', opus, '-vbr', 'on', '-application', 'audio', '-y', join(OUT, `${name}.webm`)], buf(pcm));
  ffmpeg([...rawArgs(ch), '-c:a', 'aac', '-b:a', ch === 1 ? '64k' : '80k', '-movflags', '+faststart', '-y', join(OUT, `${name}.m4a`)], buf(pcm));
}

// ---- main -----------------------------------------------------------------
const { sources } = JSON.parse(readFileSync(join(root, 'audio/sources.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(root, 'audio/sources.lock.json'), 'utf8')).files;
const only = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const manifestPath = join(OUT, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { sounds: {} };
manifest.about = 'Generated by scripts/build-audio.mjs from audio/sources.json. Do not edit by hand.';
manifest.sampleRate = SR;

for (const src of sources) {
  if (only.length && !only.includes(src.id)) continue;
  if (!ALLOWED.includes(src.licence)) throw new Error(`${src.id}: licence "${src.licence}" is not allowed (D-6.6)`);
  const L = lock[src.id];
  const path = join(root, 'audio-src', L.file);
  const sha = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (sha !== L.sha256) throw new Error(`${src.id}: checksum mismatch for ${L.file}`);
  const ch = src.edits.mono ? 1 : (src.role === 'event' ? 1 : 2);
  const pcm = decode(path, ch, src.edits.highpass);
  const built = src.role === 'bed' ? buildBed(src, pcm, ch, src.edits.loopCrossfade || 3)
    : src.role === 'thunder' ? buildThunder(src, pcm, ch, THUNDER_COUNT[src.id] || 4)
      : buildEvents(src, pcm, ch, EVENT_COUNT[src.id] || 3);
  // remove this id's old outputs, then write the new ones
  for (const f of readdirSync(OUT)) if (f.startsWith(src.id + '.') || f.startsWith(src.id + '-')) unlinkSync(join(OUT, f));
  const files = built.clips.map((clip, n) => {
    const name = built.clips.length > 1 || src.role !== 'bed' ? `${src.id}-${n + 1}` : src.id;
    const extra = src.edits.gainDb || 0;
    const lv = level(clip.pcm, ch, TARGET[src.role] + extra);
    encode(clip.pcm, ch, name, src.role);
    console.log(`${name.padEnd(28)} ${src.role.padEnd(7)} from ${clip.start.toFixed(1)}s, ${clip.length.toFixed(1)}s, ` +
      `${lv.I.toFixed(1)} -> ${lv.out.toFixed(1)} LUFS, peak ${lv.peak.toFixed(1)} dBFS`);
    return { name, from: Number(clip.start.toFixed(2)), seconds: Number(clip.length.toFixed(3)), lufs: Number(lv.out.toFixed(1)) };
  });
  manifest.sounds[src.id] = {
    role: src.role, scenes: src.scenes, channels: ch,
    files: files.map((f) => ({ webm: `${f.name}.webm`, m4a: `${f.name}.m4a`, seconds: f.seconds, from: f.from, lufs: f.lufs })),
    loop: src.role === 'bed' ? { start: 0, end: files[0].seconds } : null,
    credit: {
      title: src.title, recordist: src.recordist, url: src.url,
      licence: src.licence, edited: src.role === 'bed' ? 'trimmed, looped and levelled' : 'cut and levelled',
    },
  };
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const size = (ext) => readdirSync(OUT).filter((f) => f.endsWith(ext)).reduce((a, f) => a + statSync(join(OUT, f)).size, 0);
const webm = size('.webm'), m4a = size('.m4a');
console.log(`\nOpus total ${(webm / 1048576).toFixed(2)} MB, AAC total ${(m4a / 1048576).toFixed(2)} MB (budget ${(BUDGET_BYTES / 1048576).toFixed(0)} MB per format)`);
if (webm > BUDGET_BYTES || m4a > BUDGET_BYTES) { console.error('Over budget.'); process.exit(1); }
