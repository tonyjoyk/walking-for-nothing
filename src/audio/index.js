// The site's sound (Epic 6). Recorded beds per scene, one-shot birds and
// thunder in the rain, with generated wind and rain as a fallback.
// How it all plays together: docs/bmad/party-mode/2026-10-20-sound-mix.md.
//
//   source -> (per play: low-pass, pan) -> layer gain -> bus -> master -> out
//
// The decisions (which bed, which bird, when thunder) are pure modules:
// mix.js, events.js, thunder.js. This file only turns them into Web Audio.
import { AUDIO_MIX, AUDIO_EVENTS, AUDIO_THUNDER } from '../config.js';
import { BedMix, coupling, sceneMix } from './mix.js';
import { EventScheduler } from './events.js';
import { ThunderScheduler } from './thunder.js';
import { AssetLoader } from './loader.js';
import { SynthFallback } from './synth.js';

const fromDb = (d) => Math.pow(10, d / 20);
const STOP_AFTER = 3; // seconds at zero before a bed's source is stopped

export class SoundDirector {
  constructor(config) {
    this.config = config;
    this.ctx = null;
    this.ready = false;
    this.tick = 0;
    this.scene = null;
    this.sceneNow = null;
    this.mix = new BedMix();
    this.beds = {};       // id -> { src, gain, silentFor, startedAt }
    this.duckUntil = 0;   // birds duck under thunder
    this.playing = [];    // readout for the dev panel
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

  build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    const bus = () => { const g = ctx.createGain(); g.connect(this.master); return g; };
    this.bus = { beds: bus(), birds: bus(), thunder: bus(), synth: bus() };
    this.synth = new SynthFallback(ctx, this.bus.synth);
    const base = (import.meta.env?.BASE_URL || '/') + 'audio/';
    this.loader = new AssetLoader(ctx, base);
    this.loader.loadManifest().then(() => {
      const c = this.loader.counts();
      this.events = new EventScheduler({ files: c });
      this.thunder = new ThunderScheduler({ files: { far: c[AUDIO_THUNDER.far] || 0, close: c[AUDIO_THUNDER.close] || 0 } });
      this.loader.loadFirst(this.idsFor(this.sceneNow || 'sunny'));
    });
  }

  // The ids a scene needs, beds first.
  idsFor(sceneName) {
    const ids = Object.keys(sceneMix(sceneName, AUDIO_MIX));
    for (const p of AUDIO_EVENTS[sceneName]?.pool || []) ids.push(p.id);
    if (AUDIO_THUNDER.scenes.includes(sceneName)) ids.push(AUDIO_THUNDER.far, AUDIO_THUNDER.close);
    return ids;
  }

  // Called every frame with the eased scene parameters and the scene name.
  update(P, dt, sceneName = 'sunny') {
    this.sceneNow = sceneName; // known before sound starts, so its files load first
    if (!this.ready || !this.ctx) return;
    this.tick += dt;
    if (this.tick < 0.1) return; // automation only needs ~10 updates/s
    const step = this.tick;
    this.tick = 0;
    const A = this.config.audio;
    const now = this.ctx.currentTime;
    const on = A.enabled && !A.muted;
    this.master.gain.setTargetAtTime(on ? A.master : 0, now, 0.6);
    this.bus.beds.gain.setTargetAtTime(A.beds, now, 0.3);
    this.bus.synth.gain.setTargetAtTime(A.beds, now, 0.3);
    const ducked = now < this.duckUntil ? 0.3 : 1;
    this.bus.birds.gain.setTargetAtTime((A.birdsOn ? A.birds : 0) * ducked, now, 0.4);
    this.bus.thunder.gain.setTargetAtTime(A.thunderOn ? A.thunder : 0, now, 0.3);

    if (sceneName !== this.scene) {
      this.scene = sceneName;
      this.mix.setScene(sceneName, AUDIO_MIX);
      if (this.loader?.manifest) this.idsFor(sceneName).forEach((id) => this.loader.load(id));
    }
    this.mix.step(step, A.crossfadeSeconds);
    this.updateBeds(P, step, now);

    if (!on || !this.events) return;
    for (const ev of this.events.step(sceneName, step, A.eventDensity)) this.playEvent(ev);
    for (const roll of this.thunder.step(sceneName, step)) this.playThunder(roll);
  }

  layerVolume(id) {
    const A = this.config.audio;
    const kind = { rainSteady: 'rain', windGrass: 'wind' }[id];
    if (kind === 'rain') return A.rainOn ? A.rain : 0;
    if (kind === 'wind') return A.windOn ? A.wind : 0;
    return 1;
  }

  updateBeds(P, dt, now) {
    let synthWind = 0, synthRain = 0;
    const playing = [];
    for (const id of this.mix.ids()) {
      const target = this.mix.amplitude(id) * coupling(id, P) * this.layerVolume(id);
      const bufs = this.loader?.get(id);
      let bed = this.beds[id];
      if (!bufs) {
        // not loaded (yet): the generated sound stands in for wind and rain
        if (id === 'windGrass') synthWind = Math.max(synthWind, target);
        if (id === 'rainSteady') synthRain = Math.max(synthRain, target);
        continue;
      }
      if (!bed && target > 0.001) {
        const src = this.ctx.createBufferSource();
        src.buffer = bufs[0];
        src.loop = true;
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        src.connect(gain).connect(this.bus.beds);
        // D-6.8: start anywhere, so a returning scene doesn't repeat itself
        src.start(0, Math.random() * Math.max(0, src.buffer.duration - 1));
        bed = this.beds[id] = { src, gain, silentFor: 0, startedAt: now };
      }
      if (!bed) continue;
      // a bed that has just started fades in over a couple of seconds
      bed.gain.gain.setTargetAtTime(target, now, now - bed.startedAt < 2 ? 0.7 : 0.15);
      if (target > 0.001) { bed.silentFor = 0; playing.push(`${id} ${Math.round(target * 100)}%`); } else bed.silentFor += dt;
      if (bed.silentFor > STOP_AFTER) {
        try { bed.src.stop(); } catch { /* already stopped */ }
        bed.src.disconnect(); bed.gain.disconnect();
        delete this.beds[id];
      }
    }
    this.synth.update(synthWind, synthRain, P, dt);
    if (synthWind > 0.01) playing.push(`generated wind ${Math.round(synthWind * 100)}%`);
    if (synthRain > 0.01) playing.push(`generated rain ${Math.round(synthRain * 100)}%`);
    this.playing = playing;
  }

  // One play of a buffer: low-pass and pan, then into a bus.
  playBuffer(buffer, { when, rate = 1, gainDb = 0, cutoff = 20000, pan = 0, out }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = fromDb(gainDb);
    let node = src.connect(lp).connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(out);
    src.start(when);
    src.onended = () => { src.disconnect(); lp.disconnect(); g.disconnect(); };
    return buffer.duration / rate;
  }

  playEvent(ev) {
    const bufs = this.loader.get(ev.id);
    if (!bufs) { this.loader.load(ev.id); return; }
    const t0 = this.ctx.currentTime + 0.05;
    for (const c of ev.calls) {
      this.playBuffer(bufs[c.file % bufs.length], {
        when: t0 + c.at, rate: c.rate, gainDb: ev.gainDb + c.gainDb, cutoff: ev.cutoff, pan: ev.pan, out: this.bus.birds,
      });
    }
    this.lastEvent = `${ev.id} × ${ev.calls.length}`;
  }

  playThunder(roll) {
    const id = roll.kind === 'close' ? AUDIO_THUNDER.close : AUDIO_THUNDER.far;
    const bufs = this.loader.get(id);
    if (!bufs) { this.loader.load(id); return; }
    const when = this.ctx.currentTime + 0.05;
    const length = this.playBuffer(bufs[roll.file % bufs.length], {
      when, rate: roll.rate, gainDb: roll.gainDb, cutoff: roll.cutoff, pan: (Math.random() - 0.5) * 0.6, out: this.bus.thunder,
    });
    this.duckUntil = when + length * 0.7;
    this.lastEvent = `thunder ${roll.kind} ${roll.km.toFixed(1)} km`;
  }

  // Dev panel buttons.
  birdNow() { const ev = this.events?.make(this.scene); if (ev) this.playEvent(ev); }
  thunderNow() { const r = this.thunder?.roll(); if (r) this.playThunder(r); }
  status() {
    if (!this.ready) return 'off';
    return [...this.playing, this.lastEvent ? `last: ${this.lastEvent}` : ''].filter(Boolean).join('\n') || 'silent';
  }

  // Flocks are silent for now (architecture §2); kept as the hook for later.
  chirpFlock() {}
}
