// All sound is generated with the Web Audio API, so there are no files to
// license or load. Wind and rain are shaped noise; chirps are short pitch
// sweeps. Recorded loops can replace these later (see README).
import { wobble } from './scene/util.js';

export class AudioManager {
  constructor(config) {
    this.config = config;
    this.ctx = null;
    this.ready = false;
    this.lastChirp = -999;
    this.t = 0;
    this.tick = 0;
  }

  // Must be called from a user gesture (browser autoplay rules).
  async start() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.build();
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.ready = true;
      return true;
    } catch (e) {
      console.warn('Audio unavailable:', e);
      this.ready = false;
      return false;
    }
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.config.audio.enabled) this.ctx.resume(); }

  noiseBuffer(seconds, brown) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
      }
      // crossfade the loop point to avoid a click
      const f = Math.min(2048, len >> 4);
      for (let i = 0; i < f; i++) {
        const k = i / f;
        d[i] = d[i] * k + d[len - f + i] * (1 - k);
      }
    }
    return buf;
  }

  build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // wind: brown noise -> band-pass (moving) -> low-pass -> gain
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffer(6, true);
    windSrc.loop = true;
    this.windBand = ctx.createBiquadFilter();
    this.windBand.type = 'bandpass';
    this.windBand.frequency.value = 500;
    this.windBand.Q.value = 0.7;
    const windLow = ctx.createBiquadFilter();
    windLow.type = 'lowpass';
    windLow.frequency.value = 1800;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    windSrc.connect(this.windBand).connect(windLow).connect(this.windGain).connect(this.master);
    windSrc.start();

    // rain: white noise -> high-pass -> low-pass -> gain
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = this.noiseBuffer(4, false);
    rainSrc.loop = true;
    const rainHigh = ctx.createBiquadFilter();
    rainHigh.type = 'highpass';
    rainHigh.frequency.value = 900;
    const rainLow = ctx.createBiquadFilter();
    rainLow.type = 'lowpass';
    rainLow.frequency.value = 6500;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rainSrc.connect(rainHigh).connect(rainLow).connect(this.rainGain).connect(this.master);
    rainSrc.start();

    this.birdGain = ctx.createGain();
    this.birdGain.gain.value = 0.5;
    this.birdGain.connect(this.master);
  }

  // Called every frame with the smoothed scene parameters.
  update(P, dt) {
    if (!this.ready || !this.ctx) return;
    this.t += dt;
    this.tick += dt;
    if (this.tick < 0.1) return; // automation only needs ~10 updates/s
    this.tick = 0;
    const A = this.config.audio;
    const now = this.ctx.currentTime;
    const on = A.enabled && !A.muted;
    this.master.gain.setTargetAtTime(on ? A.master : 0, now, 0.6);

    const gust = 0.5 + 0.5 * wobble(this.t * 0.35, 3);
    const windLevel = A.windOn ? A.wind * (0.18 + 0.82 * P.wind) * (0.65 + 0.35 * gust) : 0;
    this.windGain.gain.setTargetAtTime(windLevel * 0.9, now, 0.8);
    this.windBand.frequency.setTargetAtTime(280 + 380 * gust + P.wind * 420, now, 0.8);

    const rainLevel = A.rainOn ? A.rain * P.rain : 0;
    this.rainGain.gain.setTargetAtTime(rainLevel * 0.35, now, 1.2);
    this.birdGain.gain.setTargetAtTime(A.birdsOn ? A.birds : 0, now, 0.3);
  }

  // A few soft chirps when a flock enters, with a cooldown.
  chirpFlock() {
    if (!this.ready || !this.config.birds.chirps) return;
    const A = this.config.audio;
    if (!A.enabled || A.muted || !A.birdsOn) return;
    const now = this.ctx.currentTime;
    if (now - this.lastChirp < 8) return;
    this.lastChirp = now;
    const calls = 2 + Math.floor(Math.random() * 3);
    for (let c = 0; c < calls; c++) {
      const start = now + 0.3 + c * (0.35 + Math.random() * 0.6);
      const notes = 2 + Math.floor(Math.random() * 2);
      const base = 2600 + Math.random() * 1200;
      for (let n = 0; n < notes; n++) this.note(start + n * 0.13, base * (1 + n * 0.08), 0.09 + Math.random() * 0.04);
    }
  }

  note(t, f, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.85, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.25, t + dur * 0.4);
    o.frequency.exponentialRampToValueAtTime(f * 0.95, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.birdGain);
    o.start(t);
    o.stop(t + dur + 0.05);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }
}
