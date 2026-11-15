// Thunder in the rain scene (D-6.11). Pure: decides when a roll plays, which
// file, and how distance shapes it. With lightning (story 6.11, D-6.16) each
// strike is a flash now and its roll distance ÷ 0.343 seconds later.
import { AUDIO_THUNDER } from '../config.js';
import { nextWait } from './events.js';

const lerp = (a, b, t) => a + (b - a) * t;

// Distance in km -> how the roll is played. Far rolls are quieter, duller
// and a little slower.
export function thunderShape(km, cfg = AUDIO_THUNDER) {
  const [near, far] = cfg.distanceKm;
  const t = Math.max(0, Math.min(1, (km - near) / (far - near)));
  // flash: how bright the lightning is (near 1, far 0.35)
  return { gainDb: -(km - near), cutoff: lerp(3000, 600, t), rate: lerp(1, 0.92, t), delay: km / 0.343, flash: lerp(1, 0.35, t) };
}

export class ThunderScheduler {
  // files: { far: count, close: count }
  constructor({ files, rng = Math.random, cfg = AUDIO_THUNDER } = {}) {
    this.files = files || { far: 0, close: 0 };
    this.rng = rng;
    this.cfg = cfg;
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
  step(sceneName, dt, { lightning = false } = {}) {
    const c = this.cfg;
    const out = this.land(dt);
    const on = c.scenes.includes(sceneName);
    if (on && !this.active) {
      this.active = true;
      this.closeUsed = false;
      this.wait = c.firstAfter[0] + (c.firstAfter[1] - c.firstAfter[0]) * this.rng();
    }
    if (!on) { this.active = false; this.wait = Infinity; return out; }
    this.wait -= dt;
    if (this.wait > 0) return out;
    const strike = this.strike(undefined, { lightning });
    // the next strike counts from when this roll is heard, so rolls never overlap
    this.wait = (strike.wait || 0) + nextWait(this.rng, c.mean, c.minGap);
    return out.concat(strike.now);
  }

  // A strike now (also used by "Thunder now"): with lightning, a flash now
  // and the roll later; without, the roll now.
  strike(km, { lightning = false } = {}) {
    const c = this.cfg;
    const d = km ?? c.distanceKm[0] + (c.distanceKm[1] - c.distanceKm[0]) * this.rng();
    if (!lightning) { const roll = this.roll(d); return { now: roll ? [roll] : [], wait: 0 }; }
    const shape = thunderShape(d, c);
    this.pending.push({ in: shape.delay, km: d });
    return { now: [{ kind: 'flash', strength: shape.flash, km: d }], wait: shape.delay };
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
    if (d < c.closeUnderKm && !this.closeUsed && this.files.close > 0) { kind = 'close'; this.closeUsed = true; }
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
