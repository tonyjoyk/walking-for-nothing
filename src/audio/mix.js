// Which beds play, and how loud, for a scene (D-6.7). Pure: no Web Audio.
//
// A scene's weights change only when the scene changes, and are eased in
// power (amplitude squared), linearly over the crossfade time, so the total
// power moves straight from the old mix to the new one with no dip or bump
// (an equal-power crossfade). The live coupling to how hard it rains or blows
// is applied on top as an amplitude, because P is already eased by Scene.
import { AUDIO_MIX, AUDIO_COUPLING } from '../config.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function sceneMix(sceneName, mix = AUDIO_MIX) {
  return mix[sceneName] || mix.sunny || {};
}

// Amplitude multiplier for a bed from the eased scene parameters.
export function coupling(id, P, couplingMap = AUDIO_COUPLING) {
  const kind = couplingMap[id];
  if (kind === 'rain') return clamp01((P.rain || 0) / 0.8);
  if (kind === 'wind') return 0.25 + 0.75 * clamp01(P.wind || 0);
  return 1;
}

export class BedMix {
  constructor() {
    this.ramps = {}; // id -> { from, to, t } in power
    this.scene = null;
  }

  // Set the scene; ramps restart from wherever each bed is now.
  setScene(sceneName, mix = AUDIO_MIX) {
    if (sceneName === this.scene) return;
    this.scene = sceneName;
    const w = sceneMix(sceneName, mix);
    const ids = new Set([...Object.keys(this.ramps), ...Object.keys(w)]);
    for (const id of ids) {
      const now = this.power(id);
      const to = (w[id] || 0) ** 2;
      this.ramps[id] = { from: now, to, t: 0 };
    }
  }

  // Advance by dt seconds with a crossfade of `seconds`.
  step(dt, seconds) {
    for (const r of Object.values(this.ramps)) r.t = Math.min(1, r.t + (seconds > 0 ? dt / seconds : 1));
  }

  power(id) {
    const r = this.ramps[id];
    return r ? r.from + (r.to - r.from) * r.t : 0;
  }

  amplitude(id) { return Math.sqrt(Math.max(0, this.power(id))); }

  ids() { return Object.keys(this.ramps); }

  totalPower() { return this.ids().reduce((a, id) => a + this.power(id), 0); }
}
