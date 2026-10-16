import { GEN_LEFT, GEN_RIGHT, rng, css, mix, mod } from './util.js';

const SPAN = GEN_RIGHT - GEN_LEFT;

// A cumulus cloud: a wide base row of puffs, a taller middle tier and a
// crown. It sits on a flat underside and is lit from above with a vertical
// gradient, which gives the soft painted look without blur filters.
function makeCloud(r, x, y, scale, layer) {
  const width = r.range(240, 400) * scale;
  const puffs = [];
  const bias = r.range(-0.15, 0.15); // where the crown sits
  const n1 = Math.round(r.range(6, 9));
  for (let i = 0; i < n1; i++) {
    const u = i / (n1 - 1);
    const rad = width * r.range(0.07, 0.12) * (0.75 + Math.sin(u * Math.PI) * 0.5);
    puffs.push({ dx: (u - 0.5) * width * 0.92, dy: -rad * r.range(0.5, 0.8), r: rad });
  }
  const n2 = Math.round(r.range(2, 4));
  for (let i = 0; i < n2; i++) {
    const u = n2 === 1 ? 0.5 : i / (n2 - 1);
    const rad = width * r.range(0.13, 0.19);
    puffs.push({ dx: (u - 0.5) * width * 0.55 + bias * width, dy: -width * r.range(0.12, 0.17) - rad * 0.3, r: rad });
  }
  const n3 = r() < 0.7 ? 1 : 2;
  for (let i = 0; i < n3; i++) {
    const rad = width * r.range(0.13, 0.18);
    puffs.push({ dx: bias * width * 1.4 + (i - (n3 - 1) / 2) * width * 0.2 + r.range(-15, 15), dy: -width * r.range(0.27, 0.33), r: rad });
  }
  let top = 0;
  for (const p of puffs) top = Math.min(top, p.dy - p.r);
  return { x, y, scale, layer, width, puffs, top };
}

// The first clouds in the pool are placed by hand for composition
// (big soft mass on the left, smaller ones right). The rest are seeded.
// "cloudAmount" reads the first N, so changing it never reshuffles.
export function createClouds(seed) {
  const r = rng(seed * 97 + 11);
  const hand = [
    [330, 300, 1.55, 1], [1640, 330, 1.05, 1], [1080, 395, 0.7, 2], [-120, 230, 1.1, 0],
    [2080, 170, 0.8, 0], [760, 160, 0.6, 0], [1350, 240, 0.65, 0],
  ];
  const pool = hand.map(([x, y, s, l]) => makeCloud(r, x, y, s, l));
  for (let i = 0; i < 12; i++) {
    pool.push(makeCloud(r, r.range(GEN_LEFT, GEN_RIGHT), r.range(110, 470), r.range(0.6, 1.4), Math.floor(r() * 3)));
  }
  return pool;
}

const LAYER_SPEED = [5, 8, 12]; // logical px per second at cloudSpeed 1

export function drawClouds(ctx, view, P, pool, offsets, parallax) {
  const amount = P.cloudAmount;
  const n = Math.min(pool.length, Math.ceil(amount));
  const shadeCol = P.cloudShade;
  const lightCol = P.cloudLight;
  const midCol = mix(shadeCol, lightCol, 0.55);
  for (let i = 0; i < n; i++) {
    const c = pool[i];
    // the last cloud fades in by the fractional part of cloudAmount
    const frac = i === n - 1 && amount % 1 > 0 ? amount % 1 : 1;
    const alpha = P.cloudOpacity * frac;
    if (alpha < 0.01) continue;
    const layerOffset = offsets[c.layer] * (1 + (c.layer - 1) * 0.35 * parallax);
    const x = GEN_LEFT + mod(c.x - GEN_LEFT + layerOffset, SPAN);
    const s = P.cloudScale;
    const halfW = c.width * s * 0.75;
    if (x + halfW < view.x0 || x - halfW > view.x0 + view.w) continue;
    // depth: farther layers are paler
    const depthMix = [0.35, 0.15, 0][c.layer];
    const sky = P.skyMid;
    const shd = mix(shadeCol, sky, depthMix);
    const mid = mix(midCol, sky, depthMix);
    const lit = mix(lightCol, sky, depthMix * 0.6);
    const baseY = c.y;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x - halfW * 1.4, baseY - 900, halfW * 2.8, 900 + 1); // flat underside
    ctx.clip();
    const topY = baseY + c.top * s;
    // 1. soft halo
    fillPuffs(ctx, c, x, baseY, s, 1.1, 0, css(mid, alpha * 0.2));
    // 2. body, lit from the top and shaded toward the base
    const g = ctx.createLinearGradient(0, topY, 0, baseY);
    g.addColorStop(0, css(lit, alpha));
    g.addColorStop(0.55, css(mid, alpha));
    g.addColorStop(1, css(shd, alpha));
    fillPuffs(ctx, c, x, baseY, s, 1.0, 0, g);
    // 3. highlights on the upper puffs, nudged toward the light
    ctx.globalAlpha = 0.22;
    fillPuffs(ctx, c, x - 6 * s, baseY, s, 0.78, -0.22, css(mix(lit, [255, 255, 255], 0.4), alpha), true);
    ctx.restore();
  }
}

function fillPuffs(ctx, c, x, baseY, s, rk, lift, fill, upperOnly = false) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (const p of c.puffs) {
    if (upperOnly && p.dy > -c.width * 0.1) continue;
    const rr = p.r * s * rk;
    const px = x + p.dx * s;
    const py = baseY + p.dy * s + lift * p.r * s;
    ctx.moveTo(px + rr, py);
    ctx.arc(px, py, rr, 0, Math.PI * 2);
  }
  ctx.fill();
}
