import { FIELD_TOP, GROUND_Y, SCENE_H, GEN_LEFT, GEN_RIGHT, rng, css, mix } from './util.js';

// Three depth bands. Far blades sit behind the characters; mid and fore
// blades are drawn in front of them, which creates the occlusion.
// Counts are per 1920 logical px at density 1.
const BANDS = {
  far:  { y0: FIELD_TOP + 2, y1: GROUND_Y - 4, per1920: 1150, w: [2.2, 4], h: (y) => 7 + (y - FIELD_TOP) * 0.95, buckets: 3, seedLen: 4 },
  mid:  { y0: GROUND_Y + 3, y1: 978, per1920: 850, w: [3.5, 6.5], h: (y) => 58 + (y - GROUND_Y) * 1.05, buckets: 4, seedLen: 7 },
  fore: { y0: 992, y1: SCENE_H + 40, per1920: 240, w: [6, 11], h: (y) => 70 + (y - 992) * 0.9, buckets: 3, seedLen: 12 },
};

export function createField(seed) {
  const r = rng(seed * 7919 + 17);
  const span = GEN_RIGHT - GEN_LEFT;
  const bands = {};
  for (const [name, B] of Object.entries(BANDS)) {
    const count = Math.round(B.per1920 * (span / 1920));
    const blades = [];
    for (let i = 0; i < count; i++) {
      // clustering: accept positions more often where a slow noise is high
      let x;
      for (let tries = 0; tries < 4; tries++) {
        x = r.range(GEN_LEFT, GEN_RIGHT);
        const c = 0.5 + 0.5 * Math.sin(x * 0.019 + seed) * Math.sin(x * 0.0071 + seed * 0.3);
        if (r() < 0.35 + c * 0.65) break;
      }
      const y = r.range(B.y0, B.y1);
      blades.push({
        x, y,
        h: B.h(y),
        hv: r.range(-1, 1),
        w: r.range(B.w[0], B.w[1]),
        lean: r.range(-0.12, 0.22),
        phase: r() * Math.PI * 2,
        bucket: Math.floor(r() * B.buckets),
        rank: r(),       // density selection: drawn when rank < density
        seedRoll: r(),   // seed head when seedRoll < seedFreq
      });
    }
    blades.sort((a, b) => a.y - b.y);
    // group indices by colour bucket so each bucket is one fill call
    const byBucket = Array.from({ length: B.buckets }, () => []);
    blades.forEach((b) => byBucket[b.bucket].push(b));
    bands[name] = { ...B, blades, byBucket };
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
