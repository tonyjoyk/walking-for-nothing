import { PRESETS, clone } from '../config.js';
import {
  SCENE_W, SCENE_H, HORIZON_Y, FIELD_TOP, GROUND_Y, WRAP_MARGIN,
  hexToRgb, lerp, mod, clamp, css, mix, shade,
} from './util.js';
import { drawSky, drawSun, drawStars, createStars } from './sky.js';
import { createClouds, drawClouds } from './clouds.js';
import { createTerrain, drawFarMountains, drawMidMountains, drawNearHills, drawTreeline, drawPalms } from './terrain.js';
import { createField, drawFieldBase, drawBand, drawMassCached } from './field.js';
import { drawCharacter, characterColors, characterPose, CharacterMotion, STANCE } from './character.js';
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
    this.manMotion = new CharacterMotion();
    this.massCache = { far: {}, mid: {}, fore: {} };
    this.fps = 60;
    this.needsManPlacement = true;
    this.onBirdsEnter = null;
    this.buildWorld();
  }

  buildWorld() {
    const seed = Math.round(this.config.grass.seed);
    this.terrain = createTerrain(seed);
    this.clouds = createClouds(seed);
    this.field = createField(seed, this.config.grass.clumping);
    this.fieldClumping = this.config.grass.clumping;
    this.massCache = { far: {}, mid: {}, fore: {} };
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
    else if (cfg.grass.clumping !== this.fieldClumping) {
      this.field = createField(this.seed, cfg.grass.clumping);
      this.fieldClumping = cfg.grass.clumping;
      this.massCache = { far: {}, mid: {}, fore: {} };
    }
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
    let moved = 0;
    if (cfg.playback.loop || this.manX < this.view.x0 + this.view.w + WRAP_MARGIN - 5) {
      moved = manSpeed * dt;
      this.manD += moved;
    }
    // The gait advances with distance walked, not with time, so the legs can
    // never run ahead of the ground. One cycle (two steps) covers
    // walkSpeed / cadence, which keeps the cadence control meaningful.
    const cycleLen = manSpeed / Math.max(0.05, C.cadence);
    if (moved > 0 && cycleLen > 0) this.walkPhase += (Math.PI * 2 * moved) / cycleLen;
    this.manMotion.update(dt, this.manPose(C), this.P.wind, this.time, C.fabric);
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

  // Hip swing so that a planted foot sweeps back exactly as far as the body
  // moves while that foot is down.
  walkSweep(C) {
    if (C.walkSpeed <= 0) return 0;
    const cycleLen = C.walkSpeed / Math.max(0.05, C.cadence);
    return (cycleLen * STANCE) / Math.max(0.1, C.scale);
  }

  manPose(C) {
    return {
      phase: this.walkPhase, sweep: this.walkSweep(C), stride: C.stride, bob: C.bob, armSwing: C.armSwing,
      fabric: C.fabric, wind: this.P.wind, time: this.time,
    };
  }

  // Legs and paws push the grass aside as they move through it.
  grassPushers() {
    const cfg = this.config;
    const out = [];
    if (cfg.character.visible) {
      const C = cfg.character;
      const p = characterPose(this.manPose(C));
      const k = C.scale;
      out.push({ x: this.manX, y: GROUND_Y + 8 + C.groundOffset, r: 46 * k, k: 0.16 });
      for (const leg of [p.near, p.far]) {
        out.push({ x: this.manX + leg.ankle.x * k, y: GROUND_Y + 8 + C.groundOffset, r: 30 * k, k: leg.planted ? 0.22 : 0.34 });
      }
    }
    if (this.dog.state !== 'absent') {
      const dx = this.screenX(this.dog.d);
      const k = 0.98 * cfg.dog.scale;
      const gy = GROUND_Y + 5 + cfg.character.groundOffset;
      out.push({ x: dx - 36 * k, y: gy, r: 26 * k, k: 0.35 });
      out.push({ x: dx + 34 * k, y: gy, r: 26 * k, k: 0.35 });
    }
    return out;
  }

  // How strongly a low sun throws long shadows (0 at noon or with no sun).
  lowSun() {
    const P = this.P;
    return clamp((P.sunY - 0.2) / 0.4, 0, 1) * P.sunAlpha * clamp(P.glow + 0.3, 0, 1);
  }

  // A soft contact shadow under the man and Juhu, drawn on the ground before them.
  drawContactShadows(ctx, P, cfg) {
    const C = cfg.character;
    const col = shade(mix(mix(P.grassMid, P.fieldTop, 0.3), P.skyTop, 0.25), 0.45);
    const contact = (x, y, rx, ry, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
      g.addColorStop(0, css(col, a));
      g.addColorStop(1, css(col, 0));
      ctx.save();
      ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
      ctx.fillStyle = g;
      ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
      ctx.restore();
    };
    if (this.dog.state !== 'absent') {
      const k = 0.98 * cfg.dog.scale;
      contact(this.screenX(this.dog.d), GROUND_Y - 1 + C.groundOffset, 62 * k, 9 * k, 0.3);
    }
    if (C.visible) contact(this.manX, GROUND_Y + 1 + C.groundOffset, 34 * C.scale, 7 * C.scale, 0.38);
  }

  // Long shadows when the sun is low: the figures' own silhouettes,
  // flattened onto the ground and skewed away from the sun (towards the
  // viewer, since the sun sits behind the scene). Drawn into an offscreen
  // layer so overlapping limbs don't double up, faded with distance from
  // the feet, then multiplied over the grass they fall on.
  drawCastShadows(ctx, P, cfg, pd) {
    const low = this.lowSun();
    if (low < 0.05 || typeof document === 'undefined') return;
    const C = cfg.character;
    const v = this.view, s = v.s * pd;
    const cw = Math.round(v.w * s), ch = Math.round(v.h * s);
    if (!this.shadowLayer) this.shadowLayer = document.createElement('canvas');
    const L = this.shadowLayer;
    if (L.width !== cw || L.height !== ch) { L.width = cw; L.height = ch; }
    const c = L.getContext('2d');
    const col = css(shade(mix(P.grassMid, P.skyTop, 0.45), 0.55));
    const flat = new Proxy({}, { get: () => col });
    const cast = (x, y, scale, draw) => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, cw, ch);
      c.setTransform(s, 0, 0, s, -v.x0 * s, -v.y0 * s);
      const dir = P.sunX * SCENE_W >= x ? -1 : 1;
      const skew = dir * (0.35 + low * 0.45);
      c.save();
      c.translate(x, y);
      c.transform(1, 0, -skew, -0.3, 0, 0); // y' = -0.3·y, x' = x - skew·y
      draw();
      c.restore();
      // fade: strongest at the feet, gone by the far end
      const len = 270 * scale;
      c.save();
      c.globalCompositeOperation = 'destination-in';
      const g = c.createLinearGradient(x, y, x + skew * len, y + 0.3 * len);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - len * 2, y - 20, len * 4, len);
      c.restore();
      // one figure at a time: the fade pass clears everything outside its rect
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.55 * low;
      ctx.drawImage(L, 0, 0);
      ctx.restore();
    };
    if (this.dog.state !== 'absent') {
      const dx = this.screenX(this.dog.d), k = 0.98 * cfg.dog.scale;
      cast(dx, GROUND_Y - 3 + C.groundOffset, k, () => drawDog(c, 0, 0, k, this.dog, flat, this.time));
    }
    if (C.visible) {
      cast(this.manX, GROUND_Y + C.groundOffset, C.scale,
        () => drawCharacter(c, 0, 0, C.scale, { ...this.manPose(C), motion: this.manMotion, rim: null }, flat));
    }
  }

  // Rim light from a low sun: on the side of the figure that faces it.
  rimFor(x) {
    const P = this.P;
    const low = clamp((P.sunY - 0.15) / 0.45, 0, 1);
    const alpha = P.sunAlpha * low * clamp(P.glow, 0, 1) * 0.75;
    if (alpha < 0.02) return null;
    return { dir: P.sunX * SCENE_W >= x ? 1 : -1, alpha, color: css(mix(P.sunColor, P.glowColor, 0.4)) };
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
    // a hidden tab or pane can report a zero-size canvas; drawing then would
    // poison the view (and the man's position) with NaN
    if (!(cw > 0 && ch > 0)) return;
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
      pushers: this.grassPushers(), rim: this.rimFor(v.x0 + v.w / 2),
    };
    drawMassCached(ctx, v, P, 'far', this.field, G, motion, pd, this.massCache.far);
    drawBand(ctx, v, P, 'far', this.field, G, motion);

    // shadows on the ground first, then Juhu (slightly behind) and the man
    this.drawContactShadows(ctx, P, cfg);
    if (this.dog.state !== 'absent') {
      const dx = this.screenX(this.dog.d);
      drawDog(ctx, dx, GROUND_Y - 3 + cfg.character.groundOffset, 0.98 * cfg.dog.scale, this.dog, dogColors(P), this.time);
    }
    if (cfg.character.visible) {
      const C = cfg.character;
      drawCharacter(ctx, this.manX, GROUND_Y + C.groundOffset, C.scale, {
        ...this.manPose(C), motion: this.manMotion, rim: this.rimFor(this.manX),
      }, characterColors(P));
    }

    drawMassCached(ctx, v, P, 'mid', this.field, G, motion, pd, this.massCache.mid);
    drawBand(ctx, v, P, 'mid', this.field, G, motion);
    this.drawCastShadows(ctx, P, cfg, pd);
    drawMassCached(ctx, v, P, 'fore', this.field, G, motion, pd, this.massCache.fore);
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
