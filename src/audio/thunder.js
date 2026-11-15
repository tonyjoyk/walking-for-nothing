// Thunder in the rain scene (D-6.11). Pure: decides when a roll plays, which
// file, and how distance shapes it. With lightning (story 6.11, D-6.16) each
// strike is a flash now and its roll distance ÷ 0.343 seconds later.
// Thunder in every Rain pass (story 6.18, D-6.19; it was rare in 6.17): a
// strike early in each pass and at most maxGap apart, the roll right after
// its flash. The timing, distances, close roll and flash strength come from
// the live config.audio, so the dev panel changes them without a reload.
import { AUDIO_THUNDER } from '../config.js';
import { nextWait } from './events.js';

const lerp = (a, b, t) => a + (b - a) * t;
// The wait between rolls: random around the mean, never under minGap, and
// never over maxGap (story 6.18), so Rain always has a strike in each pass.
const gap = (rng, c) => Math.min(Math.max(c.minGap, c.maxGap ?? Infinity), nextWait(rng, c.mean, c.minGap));

// Distance in km -> how the roll is played. Far rolls are quieter, duller
// and a little slower.
export function thunderShape(km, cfg = AUDIO_THUNDER) {
  const [near, far] = cfg.distanceKm;
  const t = far > near ? Math.max(0, Math.min(1, (km - near) / (far - near))) : 0;
  // flash: how bright the lightning is (near 1, far 0.35)
  // flash: how bright the lightning is (near 1, the far end 0.6, so every strike is seen; story 6.18)
  return { gainDb: -(km - near), cutoff: lerp(3000, 600, t), rate: lerp(1, 0.92, t), delay: km / 0.343, flash: lerp(1, 0.6, t) };
}

export class ThunderScheduler {
  // files: { far: count, close: count }
  // settings: () => config.audio (live), read on every step. Without it,
  // cfg alone decides (the close roll only if cfg.closeRoll).
  constructor({ files, rng = Math.random, cfg = AUDIO_THUNDER, settings = null } = {}) {
    this.files = files || { far: 0, close: 0 };
    this.rng = rng;
    this.base = cfg;
    this.settings = settings;
    this.started = false; // the first strike of this visit has happened
    this.timing = '';     // the mean/minGap the current wait was drawn with
    this.active = false;
    this.wait = Infinity;
    this.closeUsed = false;
    this.lastFar = -1;
    this.pending = []; // rolls on their way after a flash: { in: seconds, km }
  }

  // Advance dt seconds. Returns what happens now:
  //   rolls:   { kind, file, km, ...shape }
  //   flashes: { kind: 'flash', strength, km } (only with lightning)
  // A roll already on its way after its flash still arrives if the scene
  // leaves Rain: the flash promised it.
  // The config in force now: the fixed AUDIO_THUNDER, with the dev values
  // from config.audio on top (story 6.17).
  get cfg() {
    const b = this.base;
    const a = this.settings?.();
    if (!a) return { ...b, closeRoll: !!b.closeRoll, flashStrength: b.flashStrength ?? 1 };
    const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    const n = num(a.thunderNearKm, b.distanceKm[0]), f = num(a.thunderFarKm, b.distanceKm[1]);
    return {
      ...b,
      mean: num(a.thunderMean, b.mean),
      minGap: num(a.thunderMinGap, b.minGap),
      maxGap: num(a.thunderMaxGap, b.maxGap ?? Infinity),
      distanceKm: [Math.min(n, f), Math.max(n, f)],
      closeRoll: typeof a.thunderClose === 'boolean' ? a.thunderClose : !!b.closeRoll,
      flashStrength: num(a.flashStrength, b.flashStrength ?? 1),
    };
  }

  step(sceneName, dt, { lightning = false } = {}) {
    const c = this.cfg;
    const out = this.land(dt);
    const on = c.scenes.includes(sceneName);
    if (on && !this.active) {
      this.active = true;
      this.started = false;
      this.closeUsed = false;
      this.timing = `${c.mean}/${c.minGap}/${c.maxGap}`;
      this.wait = c.firstAfter[0] + (c.firstAfter[1] - c.firstAfter[0]) * this.rng();
    }
    if (!on) { this.active = false; this.wait = Infinity; return out; }
    // "how often" or the minimum gap changed (dev panel): redraw the wait
    // now, still after any roll on its way, so the change is heard at once
    const timing = `${c.mean}/${c.minGap}/${c.maxGap}`;
    if (timing !== this.timing) {
      this.timing = timing;
      if (this.started) this.wait = this.inFlight() + gap(this.rng, c);
    }
    this.wait -= dt;
    if (this.wait > 0) return out;
    const strike = this.strike(undefined, { lightning });
    this.started = true;
    // the next strike counts from when this roll is heard, so rolls never overlap
    this.wait = (strike.wait || 0) + gap(this.rng, c);
    return out.concat(strike.now);
  }

  // Seconds until the last roll on its way lands (0 if none).
  inFlight() { return this.pending.reduce((m, p) => Math.max(m, p.in), 0); }

  // A strike now (also used by "Thunder now"): with lightning, a flash now
  // and the roll later; without, the roll now.
  strike(km, { lightning = false } = {}) {
    const c = this.cfg;
    const d = km ?? c.distanceKm[0] + (c.distanceKm[1] - c.distanceKm[0]) * this.rng();
    if (!lightning) { const roll = this.roll(d); return { now: roll ? [roll] : [], wait: 0 }; }
    const shape = thunderShape(d, c);
    this.pending.push({ in: shape.delay, km: d });
    // flash strength (dev panel, 0–1) scales the distance brightness
    const strength = shape.flash * Math.max(0, Math.min(1, c.flashStrength ?? 1));
    return { now: [{ kind: 'flash', strength, km: d }], wait: shape.delay };
  }

  // Rolls whose sound arrives during this step.
  land(dt) {
    const out = [];
    for (const p of this.pending) {
      p.in -= dt;
      if (p.in > 0) continue;
      const roll = this.roll(p.km);
      if (roll) out.push(roll);
    }
    this.pending = this.pending.filter((p) => p.in > 0);
    return out;
  }

  // A roll now (also used by "Thunder now").
  roll(km) {
    const c = this.cfg;
    const d = km ?? c.distanceKm[0] + (c.distanceKm[1] - c.distanceKm[0]) * this.rng();
    let kind = 'far';
    if (c.closeRoll && d < c.closeUnderKm && !this.closeUsed && this.files.close > 0) { kind = 'close'; this.closeUsed = true; }
    const count = this.files[kind] || 0;
    if (!count) return null;
    let file = 0;
    if (kind === 'far') {
      file = Math.floor(this.rng() * count);
      if (count > 1 && file === this.lastFar) file = (file + 1) % count;
      this.lastFar = file;
    }
    return { kind, file, km: d, ...thunderShape(d, c) };
  }
}
