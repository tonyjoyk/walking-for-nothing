import { FIELD_TOP, GROUND_Y, SCENE_H, GEN_LEFT, GEN_RIGHT, rng, css, mix } from './util.js';

// Three depth bands. Far blades sit behind the characters; mid and fore
// blades are drawn in front of them, which creates the occlusion.
// Counts are per 1920 logical px at density 1.
const BANDS = {
  far:  { y0: FIELD_TOP + 2, y1: GROUND_Y - 4, per1920: 2600, w: [2.2, 4], h: (y) => 7 + (y - FIELD_TOP) * 0.95, buckets: 3, seedLen: 4 },
  mid:  { y0: GROUND_Y + 3, y1: 978, per1920: 2300, w: [3.5, 6.5], h: (y) => 58 + (y - GROUND_Y) * 1.05, buckets: 4, seedLen: 7 },
  fore: { y0: 992, y1: SCENE_H + 40, per1920: 520, w: [6, 11], h: (y) => 70 + (y - 992) * 0.9, buckets: 3, seedLen: 12 },
};

// Clump sizes per band: [min, max] blades sharing one root.
const CLUMP = { far: [3, 7], mid: [5, 13], fore: [4, 9] };
// Mass layer: a dense, low silhouette of undergrowth painted before the
// blades so the flat ground never shows through. step = px between tufts,
// rise = tuft height as a share of a blade at the same depth.
const MASS = { far: { step: 2, rise: 0.95, rows: 4 }, mid: { step: 2.5, rise: 0.7, rows: 7 }, fore: { step: 4, rise: 0.6, rows: 5 } };

// clumping 0..1: 0 scatters single blades, 1 grows everything in clumps.
export function createField(seed, clumping = 0.75) {
  const r = rng(seed * 7919 + 17);
  const span = GEN_RIGHT - GEN_LEFT;
  const bands = {};
  for (const [name, B] of Object.entries(BANDS)) {
    const count = Math.round(B.per1920 * (span / 1920));
    const blades = [];
    const [cMin, cMax] = CLUMP[name];
    const spread = B.w[1] * 3.2; // how far blades in a clump sit from its root
    while (blades.length < count) {
      // clustering: accept clump roots more often where a slow noise is high
      let cx;
      for (let tries = 0; tries < 4; tries++) {
        cx = r.range(GEN_LEFT, GEN_RIGHT);
        const c = 0.5 + 0.5 * Math.sin(cx * 0.019 + seed) * Math.sin(cx * 0.0071 + seed * 0.3);
        if (r() < 0.35 + c * 0.65) break;
      }
      const cy = r.range(B.y0, B.y1);
      const single = r() > clumping;
      const n = single ? 1 : Math.min(count - blades.length, Math.round(r.range(cMin, cMax)));
      const cLean = r.range(-0.08, 0.16);
      const cPhase = r() * Math.PI * 2;
      const cBucket = Math.floor(r() * B.buckets);
      const fan = r.range(0.25, 0.55); // blades in a clump fan outwards
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const x = n === 1 ? cx : cx + (t - 0.5) * spread + r.range(-1, 1) * spread * 0.25;
        const y = n === 1 ? cy : Math.min(B.y1, Math.max(B.y0, cy + r.range(-3, 3)));
        // middle blades of a clump stand taller than the outer ones
        const centre = 1 - Math.abs(t - 0.5) * 2;
        blades.push({
          x, y,
          h: B.h(y) * (n === 1 ? 1 : 0.78 + 0.32 * centre),
          hv: r.range(-1, 1),
          w: r.range(B.w[0], B.w[1]),
          lean: n === 1 ? r.range(-0.12, 0.22) : cLean + (t - 0.5) * fan + r.range(-0.04, 0.04),
          phase: n === 1 ? r() * Math.PI * 2 : cPhase + r.range(-0.5, 0.5),
          // most blades share the clump's tone; a few catch the light differently
          bucket: r() < 0.75 ? cBucket : Math.floor(r() * B.buckets),
          rank: r(),       // density selection: drawn when rank < density
          seedRoll: r(),   // seed head when seedRoll < seedFreq
          stiff: r.range(0.75, 1.25), // per-blade stiffness for wind response
        });
      }
    }
    blades.sort((a, b) => a.y - b.y);
    // group indices by colour bucket so each bucket is one fill call
    const byBucket = Array.from({ length: B.buckets }, () => []);
    blades.forEach((b) => byBucket[b.bucket].push(b));

    // mass layer tufts along the back edge of the band
    const M = MASS[name];
    // staggered rows, so the undergrowth has no single hard top edge
    const rows = [];
    for (let ri = 0; ri < M.rows; ri++) {
      const y = B.y0 + (B.y1 - B.y0) * (ri / M.rows) * 0.9;
      const tufts = [];
      for (let x = GEN_LEFT; x <= GEN_RIGHT; x += M.step) {
        tufts.push({ x: x + r.range(-0.4, 0.4) * M.step, k: r.range(0.55, 1), phase: r() * Math.PI * 2 });
      }
      rows.push({ y, tufts });
    }
    bands[name] = { ...B, blades, byBucket, rows, mass: M };
  }
  return bands;
}

export function drawFieldBase(ctx, view, P) {
  const g = ctx.createLinearGradient(0, FIELD_TOP, 0, SCENE_H);
  g.addColorStop(0, css(P.fieldTop));
  g.addColorStop(0.3, css(mix(P.fieldTop, P.fieldBottom, 0.55)));
  g.addColorStop(1, css(P.fieldBottom));
  ctx.fillStyle = g;
  ctx.fillRect(view.x0 - 2, FIELD_TOP, view.w + 4, SCENE_H - FIELD_TOP + 2);
  // soften the horizon seam
  const h = ctx.createLinearGradient(0, FIELD_TOP - 6, 0, FIELD_TOP + 22);
  h.addColorStop(0, css(P.haze, 0));
  h.addColorStop(0.4, css(P.haze, 0.35 * P.hazeAmount));
  h.addColorStop(1, css(P.haze, 0));
  ctx.fillStyle = h;
  ctx.fillRect(view.x0 - 2, FIELD_TOP - 6, view.w + 4, 28);
}

function bucketColors(name, P) {
  if (name === 'far') return [P.grassFar, mix(P.grassFar, P.grassLight, 0.5), mix(P.grassFar, P.fieldTop, 0.5)];
  if (name === 'mid') return [P.grassMid, P.grassDark, P.grassLight, mix(P.grassMid, P.grassLight, 0.5)];
  return [P.grassDark, mix(P.grassDark, P.grassMid, 0.5), mix(P.grassDark, P.fieldBottom, 0.4)];
}

function massColors(name, P) {
  if (name === 'far') return [mix(P.grassFar, P.grassLight, 0.15), mix(P.grassFar, P.fieldTop, 0.5)];
  if (name === 'mid') return [mix(P.grassMid, P.grassLight, 0.2), mix(P.grassMid, P.grassDark, 0.6)];
  return [mix(P.grassDark, P.grassMid, 0.45), mix(P.grassDark, P.fieldBottom, 0.5)];
}

// Dense undergrowth: a few staggered rows of tufted silhouettes painted
// under each band's blades, so the flat ground never shows through. Each
// row sways with the same gust wave as the blades.
export function drawMass(ctx, view, P, bandName, bands, G, motion) {
  const amount = G.mass ?? 0;
  if (amount <= 0.001) return;
  const band = bands[bandName];
  const M = band.mass;
  const left = view.x0 - 20;
  const right = view.x0 + view.w + 20;
  const occl = bandName === 'mid' ? G.occlusion : 1;
  const { swayT, windT, wind, windDir, swayAmp } = motion;
  const [c0, c1] = massColors(bandName, P);
  for (const row of band.rows) {
    const top = row.y;
    const hBase = band.h(top) * M.rise * G.heightMul * amount * occl;
    const g = ctx.createLinearGradient(0, top - hBase, 0, top + 30);
    g.addColorStop(0, css(c0));
    g.addColorStop(1, css(c1));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(left - M.step, band.y1 + 2);
    ctx.lineTo(left - M.step, top);
    for (const t of row.tufts) {
      if (t.x < left - M.step || t.x > right + M.step) continue;
      const h = hBase * t.k;
      const gust = wind * (0.55 + 0.45 * Math.sin(windT - windDir * t.x * 0.0045));
      const sway = Math.sin(swayT * 1.6 + t.x * 0.013 + t.phase) * 0.06 * swayAmp * (1 + wind);
      const dx = (windDir * gust * 0.7 + sway + 0.05) * h;
      ctx.lineTo(t.x - M.step * 0.45, top + 1);
      ctx.lineTo(t.x + dx, top - h);
    }
    ctx.lineTo(right + M.step, top);
    ctx.lineTo(right + M.step, band.y1 + 2);
    ctx.closePath();
    ctx.fill();
  }
}

// motion: { swayT, windT, wind, windDir, swayAmp }
export function drawBand(ctx, view, P, bandName, bands, G, motion) {
  const band = bands[bandName];
  const colors = bucketColors(bandName, P);
  const left = view.x0 - 40;
  const right = view.x0 + view.w + 40;
  const occl = bandName === 'mid' ? G.occlusion : 1;
  const hMul = G.heightMul * occl;
  const wMul = G.bladeWidth * (bandName === 'fore' ? 1.1 : 1);
  const { swayT, windT, wind, windDir, swayAmp } = motion;
  const seedTips = [];

  for (let bi = 0; bi < band.byBucket.length; bi++) {
    ctx.fillStyle = css(colors[bi]);
    ctx.beginPath();
    for (const b of band.byBucket[bi]) {
      if (b.rank > G.density || b.x < left || b.x > right) continue;
      const h = b.h * hMul * (1 + G.heightVar * b.hv * 0.6);
      const w = b.w * wMul;
      // coherent gust wave travelling in the wind direction
      const gust = wind * (0.55 + 0.45 * Math.sin(windT - windDir * b.x * 0.0045));
      const sway = Math.sin(swayT * 1.6 + b.x * 0.013 + b.phase) * 0.07 * swayAmp * (1 + wind);
      const bend = b.lean + windDir * gust * 0.9 + sway;
      const dx = bend * h;
      const tipX = b.x + dx;
      const tipY = b.y - Math.sqrt(Math.max(h * h - dx * dx * 0.55, h * h * 0.3));
      const kx = b.x + dx * 0.35;
      const ky = b.y - (b.y - tipY) * 0.55;
      ctx.moveTo(b.x - w * 0.5, b.y);
      ctx.lineTo(kx - w * 0.3, ky);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(kx + w * 0.3, ky);
      ctx.lineTo(b.x + w * 0.5, b.y);
      if (b.seedRoll < G.seedFreq) seedTips.push(tipX, tipY, Math.atan2(tipY - ky, tipX - kx));
    }
    ctx.fill();
  }

  if (seedTips.length) {
    const len = band.seedLen * G.heightMul;
    ctx.fillStyle = css(P.seedColor, 0.92);
    ctx.beginPath();
    for (let i = 0; i < seedTips.length; i += 3) {
      const x = seedTips[i], y = seedTips[i + 1], a = seedTips[i + 2];
      ctx.moveTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.ellipse(x, y, len, len * 0.32, a, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}
