import { HORIZON_Y, FIELD_TOP, rng, css, mix, mod } from './util.js';

// ---------------------------------------------------------------------------
// Birds: small flocks cross left to right, then leave.
// ---------------------------------------------------------------------------
export class Birds {
  constructor(seed) {
    this.r = rng(seed * 4099 + 1);
    this.flocks = [];
    this.timer = 0;
    this.firstDelay = 6;
    this.spawnNow = false;
    this.onEnter = null;
  }

  update(dt, cfg, allowed, view) {
    this.timer += dt;
    const due = this.flocks.length === 0 && this.timer >= (this.firstDelay > 0 ? this.firstDelay : cfg.interval);
    if ((allowed && due) || this.spawnNow) {
      this.spawn(cfg, view);
      this.timer = 0;
      this.firstDelay = 0;
      this.spawnNow = false;
    }
    for (const f of this.flocks) {
      f.x += f.speed * dt;
      f.t += dt;
    }
    this.flocks = this.flocks.filter((f) => f.x - f.spread < view.x0 + view.w + 80);
  }

  spawn(cfg, view) {
    const r = this.r;
    const n = Math.round(cfg.flockSize);
    const baseY = 520 - cfg.altitude * 400;
    const birds = [];
    for (let i = 0; i < n; i++) {
      birds.push({
        dx: -i * r.range(26, 48) - r.range(0, 20),
        dy: r.range(-34, 34) + (i % 2 ? 10 : -6),
        scale: r.range(0.7, 1.1) * cfg.scale,
        freq: r.range(0.85, 1.15),
        phase: r() * Math.PI * 2,
      });
    }
    const spread = n * 48 + 40;
    this.flocks.push({ x: view.x0 - 60, y: baseY, speed: cfg.speed * r.range(0.92, 1.08), birds, spread, t: 0 });
    if (this.onEnter) this.onEnter();
  }

  draw(ctx, P, cfg) {
    if (!this.flocks.length) return;
    const col = mix([58, 58, 58], P.skyMid, 0.25);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const f of this.flocks) {
      for (const b of f.birds) {
        const x = f.x + b.dx;
        const y = f.y + b.dy + Math.sin(f.t * 0.7 + b.phase) * 5;
        const w = Math.sin(f.t * 5.2 * cfg.wingSpeed * b.freq + b.phase) * 0.75;
        const s = b.scale;
        const span = 10 * s;
        ctx.strokeStyle = css(col, 0.55 + 0.35 * s);
        ctx.lineWidth = 1.9 * s;
        ctx.beginPath();
        ctx.moveTo(x - span, y - span * 0.15 - span * 0.6 * w);
        ctx.quadraticCurveTo(x - span * 0.45, y - span * 0.45 * w - 2.5 * s, x, y);
        ctx.quadraticCurveTo(x + span * 0.45, y - span * 0.45 * w - 2.5 * s, x + span, y - span * 0.15 - span * 0.6 * w);
        ctx.stroke();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Rain: stateless streaks in three depths. Positions are a pure function of
// time, so nothing is allocated per frame.
// ---------------------------------------------------------------------------
export function createRain(seed, max = 900) {
  const r = rng(seed * 211 + 9);
  const drops = [];
  for (let i = 0; i < max; i++) drops.push({ x: r(), y: r(), layer: i % 3, v: r.range(0.9, 1.1) });
  return drops;
}

const RAIN_LAYERS = [
  { speed: 0.55, len: 14, width: 1, alpha: 0.18 },
  { speed: 0.8, len: 22, width: 1.3, alpha: 0.26 },
  { speed: 1.1, len: 34, width: 1.7, alpha: 0.34 },
];

export function drawRain(ctx, view, P, drops, rainT, density, maxCount) {
  if (P.rain <= 0.01) return;
  const count = Math.floor(Math.min(drops.length, maxCount) * P.rain * density);
  const H = view.h + 120;
  const W = view.w + 240;
  const tanA = Math.tan(P.rainAngle);
  const col = mix(P.skyHorizon, [235, 240, 245], 0.6);
  for (let l = 0; l < 3; l++) {
    const L = RAIN_LAYERS[l];
    ctx.strokeStyle = css(col, L.alpha * Math.min(1, P.rain * 1.4));
    ctx.lineWidth = L.width;
    ctx.beginPath();
    for (let i = l; i < count; i += 3) {
      const d = drops[i];
      const yy = view.y0 - 60 + mod(d.y * H + rainT * 1300 * L.speed * d.v, H);
      const xx = view.x0 - 120 + mod(d.x * W + yy * tanA, W);
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx - tanA * L.len, yy - L.len);
    }
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Leaves carried on the wind (sparingly).
// ---------------------------------------------------------------------------
export function createLeaves(seed) {
  const r = rng(seed * 59 + 2);
  return Array.from({ length: 30 }, () => ({
    x: r(), y: r(), sp: r.range(0.7, 1.3), rot: r.range(1.5, 4), ph: r() * 6.28, size: r.range(7, 12),
  }));
}

export function drawLeaves(ctx, view, P, leaves, windT, windDir) {
  if (P.leaves <= 0.01) return;
  const n = Math.floor(leaves.length * P.leaves);
  const col = mix(P.grassMid, P.tree, 0.3);
  ctx.fillStyle = css(col, 0.9);
  const W = view.w + 300;
  for (let i = 0; i < n; i++) {
    const L = leaves[i];
    const travel = windT * 140 * L.sp * windDir;
    const x = view.x0 - 150 + mod(L.x * W + travel, W);
    const y = view.y0 + view.h * (0.2 + 0.55 * L.y) + Math.sin(windT * 0.9 + L.ph) * 34;
    const a = windT * L.rot + L.ph;
    ctx.beginPath();
    ctx.ellipse(x, y, L.size, L.size * 0.35 * (0.4 + 0.6 * Math.abs(Math.cos(a * 0.7))), a, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Atmosphere
// ---------------------------------------------------------------------------
export function drawHaze(ctx, view, P) {
  if (P.hazeAmount <= 0.01) return;
  const top = HORIZON_Y - 300;
  const g = ctx.createLinearGradient(0, top, 0, HORIZON_Y + 4);
  g.addColorStop(0, css(P.haze, 0));
  g.addColorStop(0.7, css(P.haze, 0.25 * P.hazeAmount));
  g.addColorStop(1, css(P.haze, 0.55 * P.hazeAmount));
  ctx.fillStyle = g;
  ctx.fillRect(view.x0 - 2, top, view.w + 4, HORIZON_Y + 4 - top);
}

// Mist sits in bands between mountain layers.
export function drawMist(ctx, view, P, y, height, k) {
  const a = P.mist * k;
  if (a <= 0.01) return;
  const g = ctx.createLinearGradient(0, y - height, 0, y);
  g.addColorStop(0, css(P.haze, 0));
  g.addColorStop(0.6, css(P.haze, 0.6 * a));
  g.addColorStop(1, css(P.haze, 0.85 * a));
  ctx.fillStyle = g;
  ctx.fillRect(view.x0 - 2, y - height, view.w + 4, height + 2);
}

// Global light: brightness and warm/cool cast over the finished frame.
export function drawLighting(ctx, view, P) {
  const x = view.x0 - 2, y = view.y0 - 2, w = view.w + 4, h = view.h + 4;
  ctx.save();
  if (P.brightness < 0.995) {
    ctx.globalCompositeOperation = 'multiply';
    const v = Math.round(255 * P.brightness);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, w, h);
  } else if (P.brightness > 1.005) {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = css([255, 255, 255], (P.brightness - 1) * 0.6);
    ctx.fillRect(x, y, w, h);
  }
  if (Math.abs(P.warmth) > 0.01) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = P.warmth > 0 ? css([255, 160, 80], P.warmth * 0.35) : css([80, 130, 255], -P.warmth * 0.35);
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// Painted grain: a noise tile generated once in code, overlaid in device pixels.
export function createGrain(seed, size = 256) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const r = rng(seed * 3 + 77);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 90 + (r() - 0.5) * 40;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function drawGrain(ctx, grain, deviceW, deviceH, amount) {
  if (!grain || amount <= 0.001) return;
  if (!grain._pattern) grain._pattern = ctx.createPattern(grain, 'repeat');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  ctx.fillStyle = grain._pattern;
  ctx.fillRect(0, 0, deviceW, deviceH);
  ctx.restore();
}

export { FIELD_TOP };
