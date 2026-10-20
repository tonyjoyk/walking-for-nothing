// One-shot birds (D-6.9, D-6.10). Pure: decides what plays and when; the
// SoundDirector turns the result into Web Audio nodes.
import { AUDIO_EVENTS, AUDIO_CALLS } from '../config.js';

// Small seeded generator (mulberry32), so tests are repeatable.
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng, [a, b]) => a + (b - a) * rng();

// Wait before the next event: minGap plus an exponential tail, so the
// average is exactly `mean` and two events are never closer than minGap.
export function nextWait(rng, mean, minGap, density = 1) {
  const m = mean / Math.max(1e-6, density), g = Math.min(minGap, m);
  return g + -(m - g) * Math.log(1 - rng());
}

export class EventScheduler {
  // files: { id: number of cut files } from the manifest
  constructor({ files, rng = Math.random, events = AUDIO_EVENTS, calls = AUDIO_CALLS } = {}) {
    this.files = files || {};
    this.rng = rng;
    this.events = events;
    this.calls = calls;
    this.scene = null;
    this.wait = Infinity;
    this.last = {}; // id -> last file index
  }

  // Advance dt seconds in `sceneName`. Returns the events that start now:
  // [{ id, calls: [{ file, at, rate, gainDb }], pan, distance, gainDb, cutoff }]
  step(sceneName, dt, density = 1) {
    const cfg = this.events[sceneName];
    if (sceneName !== this.scene) {
      this.scene = sceneName;
      this.wait = cfg && density > 0 ? nextWait(this.rng, cfg.mean, cfg.minGap, density) : Infinity;
    }
    if (!cfg || density <= 0) { this.wait = Infinity; return []; }
    if (!Number.isFinite(this.wait)) this.wait = nextWait(this.rng, cfg.mean, cfg.minGap, density);
    this.wait -= dt;
    if (this.wait > 0) return [];
    this.wait = nextWait(this.rng, cfg.mean, cfg.minGap, density);
    const ev = this.make(sceneName);
    return ev ? [ev] : [];
  }

  // An event for this scene now (also used by "Bird now").
  make(sceneName) {
    const cfg = this.events[sceneName] || this.events.sunny;
    const pool = cfg.pool.filter((p) => (this.files[p.id] || 0) > 0);
    if (!pool.length) return null;
    let r = this.rng() * pool.reduce((a, p) => a + p.weight, 0), pick = pool[0];
    for (const p of pool) { r -= p.weight; if (r <= 0) { pick = p; break; } }
    const call = this.calls[pick.id] || { phrase: [1, 1], gap: [0, 0], rise: 0 };
    const n = Math.round(between(this.rng, [call.phrase[0] - 0.49, call.phrase[1] + 0.49]));
    const distance = this.rng(); // 0 near .. 1 far
    const baseRate = between(this.rng, [0.96, 1.04]);
    const calls = [];
    let at = 0;
    for (let i = 0; i < n; i++) {
      calls.push({ file: this.pickFile(pick.id), at, rate: baseRate * (1 + call.rise * i), gainDb: between(this.rng, [-1.5, 1.5]) + i * call.rise * 50 });
      at += between(this.rng, call.gap);
    }
    return {
      id: pick.id, calls,
      pan: between(this.rng, [-0.7, 0.7]),
      distance,
      gainDb: -1 - 8 * distance,
      cutoff: 9000 - 5500 * distance,
    };
  }

  // A file index for id, never the same one twice in a row.
  pickFile(id) {
    const count = this.files[id] || 1;
    let f = Math.floor(this.rng() * count);
    if (count > 1 && f === this.last[id]) f = (f + 1 + Math.floor(this.rng() * (count - 1))) % count;
    this.last[id] = f;
    return f;
  }
}
