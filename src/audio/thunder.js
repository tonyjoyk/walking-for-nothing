// Thunder in the rain scene (D-6.11). Pure: decides when a roll plays, which
// file, and how distance shapes it.
import { AUDIO_THUNDER } from '../config.js';
import { nextWait } from './events.js';

const lerp = (a, b, t) => a + (b - a) * t;

// Distance in km -> how the roll is played. Far rolls are quieter, duller
// and a little slower.
export function thunderShape(km, cfg = AUDIO_THUNDER) {
  const [near, far] = cfg.distanceKm;
  const t = Math.max(0, Math.min(1, (km - near) / (far - near)));
  return { gainDb: -(km - near), cutoff: lerp(3000, 600, t), rate: lerp(1, 0.92, t), delay: km / 0.343 };
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
  }

  // Advance dt seconds. Returns rolls that start now: [{ kind, file, km, ...shape }]
  step(sceneName, dt) {
    const c = this.cfg;
    const on = c.scenes.includes(sceneName);
    if (on && !this.active) {
      this.active = true;
      this.closeUsed = false;
      this.wait = c.firstAfter[0] + (c.firstAfter[1] - c.firstAfter[0]) * this.rng();
    }
    if (!on) { this.active = false; this.wait = Infinity; return []; }
    this.wait -= dt;
    if (this.wait > 0) return [];
    this.wait = nextWait(this.rng, c.mean, c.minGap);
    const roll = this.roll();
    return roll ? [roll] : [];
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
