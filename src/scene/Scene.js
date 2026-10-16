import { PRESETS, clone } from '../config.js';
import {
  SCENE_W, SCENE_H, HORIZON_Y, FIELD_TOP, GROUND_Y, WRAP_MARGIN,
  hexToRgb, lerp, mod, clamp,
} from './util.js';
import { drawSky, drawSun, drawStars, createStars } from './sky.js';
import { createClouds, drawClouds } from './clouds.js';
import { createTerrain, drawFarMountains, drawMidMountains, drawNearHills, drawTreeline, drawPalms } from './terrain.js';
import { createField, drawFieldBase, drawBand } from './field.js';
import { drawCharacter, characterColors } from './character.js';
import { Dog, drawDog, dogColors } from './dog.js';
import {
  Birds, createRain, drawRain, createLeaves, drawLeaves,
  drawHaze, drawMist, drawLighting, createGrain, drawGrain,
} from './life.js';

const MIN_VIEW_W = 760;

const QUALITY = {
  low: { density: 1, rainMax: 300, grain: false, grassScale: 0.55 },
  medium: { density: 1.5, rainMax: 600, grain: true, grassScale: 0.8 },
  high: { density: 2, rainMax: 900, grain: true, grassScale: 1 },
};

export class Scene {
  constructor(config) {
    this.config = config;
    this.P = {};                   // current (smoothed) scene parameters
    this.snapParams();
    this.appliedPreset = config.activePreset;
    this.view = { x0: 0, y0: 0, w: SCENE_W, h: SCENE_H, s: 1 };
    this.time = 0;
    this.walkPhase = 0;
    this.manD = 0;
    this.manX = 0;
    this.prevWrap = null;
    this.swayT = 0;
    this.windT = 0;
    this.rainT = 0;
    this.cloudOffsets = [0, 0, 0];
    this.dog = new Dog();
    this.fps = 60;
    this.needsManPlacement = true;
    this.onBirdsEnter = null;
    this.buildWorld();
  }

  buildWorld() {
    const seed = Math.round(this.config.grass.seed);
    this.terrain = createTerrain(seed);
    this.clouds = createClouds(seed);
    this.field = createField(seed);
    this.stars = createStars(seed);
    this.rain = createRain(seed);
    this.leaves = createLeaves(seed);
    this.grain = createGrain(seed);
    const prevBirds = this.birds;
    this.birds = new Birds(seed);
    this.birds.onEnter = () => this.onBirdsEnter && this.onBirdsEnter();
    if (prevBirds) { this.birds.firstDelay = 0; this.birds.timer = prevBirds.timer; }
    this.seed = seed;
  }

  // ---- parameters -------------------------------------------------------
  snapParams() {
    for (const [k, v] of Object.entries(this.config.scene)) {
      this.P[k] = typeof v === 'string' ? hexToRgb(v) : v;
    }
  }

  applyPreset(name) {
    if (!PRESETS[name]) return;
    this.config.activePreset = name;
    this.appliedPreset = name;
    Object.assign(this.config.scene, clone(PRESETS[name]));
  }

  resetToPreset() { this.applyPreset(this.config.activePreset); }

  restartCharacter() { this.needsManPlacement = true; }
  callDog() { this.dog.callNow = true; }
  spawnBirds() { this.birds.spawnNow = true; }

  get quality() { return QUALITY[this.config.playback.quality] || QUALITY.high; }

  // ---- update -----------------------------------------------------------
  update(rawDt) {
    const cfg = this.config;
    if (cfg.activePreset !== this.appliedPreset) this.applyPreset(cfg.activePreset);
    if (Math.round(cfg.grass.seed) !== this.seed) this.buildWorld();
    if (rawDt > 0) this.fps = lerp(this.fps, 1 / rawDt, 0.05);

    // Parameter easing runs even when paused, so tuning stays live.
    const T = cfg.playback.transitionSeconds;
    const k = T <= 0.01 ? 1 : 1 - Math.exp(-rawDt * 3 / T);
    for (const [key, v] of Object.entries(cfg.scene)) {
      const cur = this.P[key];
      if (typeof v === 'string') {
        const t = hexToRgb(v);
        if (!Array.isArray(cur)) { this.P[key] = t; continue; }
        cur[0] = lerp(cur[0], t[0], k); cur[1] = lerp(cur[1], t[1], k); cur[2] = lerp(cur[2], t[2], k);
      } else {
        this.P[key] = typeof cur === 'number' ? lerp(cur, v, k) : v;
      }
    }

    const motion = cfg.playback.reducedMotion ? 0.3 : 1;
    const dt = cfg.playback.playing ? rawDt * cfg.playback.speed * motion : 0;
    this.time += dt;
    const P = this.P;
    const C = cfg.character;

    // man
    const trackLen = this.view.w + WRAP_MARGIN * 2;
    if (this.needsManPlacement) {
      this.manD = this.view.x0 + this.view.w * C.x - (this.view.x0 - WRAP_MARGIN);
      this.needsManPlacement = false;
      this.prevWrap = null;
      this.dog.reset();
      this.dog.firstDone = false;
    }
    const manSpeed = C.walkSpeed;
    let crossed = false;
    if (cfg.playback.loop || this.manX < this.view.x0 + this.view.w + WRAP_MARGIN - 5) {
      this.manD += manSpeed * dt;
    }
    this.walkPhase += Math.PI * 2 * C.cadence * dt * (manSpeed > 0 ? 1 : 0);
    const w = mod(this.manD, trackLen);
    if (this.prevWrap !== null && w < this.prevWrap - trackLen * 0.5) crossed = true;
    this.prevWrap = w;
    this.manX = this.screenX(this.manD);

    // environment clocks
    this.swayT += dt * cfg.grass.swaySpeed;
    this.windT += dt * (0.8 + P.wind * 1.6);
    this.rainT += dt * P.rainSpeed;
    const cs = P.cloudSpeed * (1 + P.wind * 0.6) * cfg.grass.windDir;
    this.cloudOffsets[0] += dt * 5 * cs;
    this.cloudOffsets[1] += dt * 8 * cs;
    this.cloudOffsets[2] += dt * 12 * cs;

    // Juhu
    const dogAllowed = cfg.dog.enabled && !!cfg.dog.presets[cfg.activePreset];
    this.dog.update({
      dt, cfg: cfg.dog, allowed: dogAllowed, manD: this.manD, manSpeed,
      manX: this.manX, view: this.view, crossed, trackLen, screenX: (d) => this.screenX(d),
    });

    // birds
    const birdsAllowed = cfg.birds.enabled && !!cfg.birds.presets[cfg.activePreset];
    this.birds.update(dt, cfg.birds, birdsAllowed, this.view);
  }

  screenX(d) {
    const trackLen = this.view.w + WRAP_MARGIN * 2;
    return this.view.x0 - WRAP_MARGIN + mod(d, trackLen);
  }

  // ---- view -------------------------------------------------------------
  // The field is pinned to the bottom. Taller screens add sky above;
  // wider screens add land at the sides. The man is never cropped.
  computeView(cw, ch) {
    const aspect = cw / ch;
    let s, w, h, x0, y0;
    if (aspect <= SCENE_W / SCENE_H) {
      // Narrow screens show a centred slice of the land (never less than
      // MIN_VIEW_W wide) so the man keeps a readable size; the walk track
      // shrinks to match, so he is never cropped.
      w = clamp(SCENE_H * aspect * 1.25, MIN_VIEW_W, SCENE_W);
      s = cw / w; h = ch / s; x0 = (SCENE_W - w) / 2; y0 = SCENE_H - h;
    } else {
      s = ch / SCENE_H; h = SCENE_H; w = cw / s; x0 = (SCENE_W - w) / 2; y0 = 0;
    }
    const changedWidth = Math.abs(w - this.view.w) > 0.5 || Math.abs(x0 - this.view.x0) > 0.5;
    this.view = { s, w, h, x0, y0 };
    if (changedWidth) {
      // keep the man where he was on screen when the viewport changes
      const keepX = clamp(this.manX || x0 + w * this.config.character.x, x0 - WRAP_MARGIN, x0 + w + WRAP_MARGIN);
      const offset = keepX - (x0 - WRAP_MARGIN);
      const delta = this.dog.state !== 'absent' ? this.dog.d - this.manD : 0;
      this.manD = offset; this.prevWrap = null;
      if (this.dog.state !== 'absent') this.dog.d = this.manD + delta;
    }
  }

  // ---- render -----------------------------------------------------------
  render(ctx, cw, ch, pd) {
    this.computeView(cw, ch);
    const v = this.view;
    const P = this.P;
    const cfg = this.config;
    const Q = this.quality;
    const s = v.s * pd;
    ctx.setTransform(s, 0, 0, s, -v.x0 * s, -v.y0 * s);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // sky
    drawSky(ctx, v, P);
    drawStars(ctx, v, P, this.stars, this.time);
    drawSun(ctx, v, P);
    drawClouds(ctx, v, P, this.clouds, this.cloudOffsets, cfg.clouds.parallax);

    // land, back to front
    drawFarMountains(ctx, P, this.terrain);
    drawMist(ctx, v, P, HORIZON_Y - 150, 120, 0.8);
    drawMidMountains(ctx, P, this.terrain);
    drawMist(ctx, v, P, HORIZON_Y - 40, 110, 1);
    drawNearHills(ctx, P, this.terrain);
    drawHaze(ctx, v, P);
    this.birds.draw(ctx, P, cfg.birds);
    drawPalms(ctx, v, P, this.terrain, this.time, P.wind);
    drawTreeline(ctx, v, P, this.terrain);

    // field
    drawFieldBase(ctx, v, P);
    const reduce = cfg.playback.reducedMotion ? 0.35 : 1;
    const G = { ...cfg.grass, density: cfg.grass.density * Q.grassScale };
    const motion = {
      swayT: this.swayT, windT: this.windT, wind: P.wind,
      windDir: cfg.grass.windDir, swayAmp: cfg.grass.swayAmp * reduce,
    };
    drawBand(ctx, v, P, 'far', this.field, G, motion);

    // Juhu (slightly behind) then the man
    if (this.dog.state !== 'absent') {
      const dx = this.screenX(this.dog.d);
      drawDog(ctx, dx, GROUND_Y - 3, 0.98 * cfg.dog.scale, this.dog, dogColors(P), this.time);
    }
    if (cfg.character.visible) {
      const C = cfg.character;
      drawCharacter(ctx, this.manX, GROUND_Y, C.scale, {
        phase: this.walkPhase, stride: C.stride, bob: C.bob, armSwing: C.armSwing,
        fabric: C.fabric, wind: P.wind, time: this.time,
      }, characterColors(P));
    }

    drawBand(ctx, v, P, 'mid', this.field, G, motion);
    drawBand(ctx, v, P, 'fore', this.field, G, motion);

    // weather and light
    drawRain(ctx, v, P, this.rain, this.rainT, cfg.weather.rainDensity, Q.rainMax);
    drawLeaves(ctx, v, P, this.leaves, this.windT, cfg.grass.windDir);
    drawLighting(ctx, v, P);
    if (cfg.playback.debug) this.drawDebug(ctx);
    if (Q.grain) drawGrain(ctx, this.grain, cw * pd, ch * pd, cfg.finish.grain);
  }

  drawDebug(ctx) {
    const v = this.view;
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.font = '14px system-ui, sans-serif';
    const line = (y, color, label) => {
      ctx.strokeStyle = color; ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(v.x0, y); ctx.lineTo(v.x0 + v.w, y); ctx.stroke();
      ctx.fillText(label, v.x0 + 10, y - 5);
    };
    line(HORIZON_Y, '#ff3b8b', 'horizon');
    line(FIELD_TOP, '#ffb000', 'field top');
    line(GROUND_Y, '#00c2ff', 'walking line');
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(0, 0, SCENE_W, SCENE_H);
    ctx.beginPath();
    ctx.moveTo(this.manX - 12, GROUND_Y); ctx.lineTo(this.manX + 12, GROUND_Y);
    ctx.moveTo(this.manX, GROUND_Y - 12); ctx.lineTo(this.manX, GROUND_Y + 12);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    const d = this.dog;
    const text = [
      `fps ${this.fps.toFixed(0)}`,
      `preset ${this.config.activePreset}`,
      `juhu ${d.state}  gait ${d.gait.toFixed(2)}  crossings ${d.crossings}`,
      `view ${v.w.toFixed(0)} x ${v.h.toFixed(0)}  scale ${v.s.toFixed(3)}`,
    ];
    text.forEach((t, i) => ctx.fillText(t, v.x0 + 10, v.y0 + 24 + i * 18));
    ctx.restore();
  }
}
