import { HORIZON_Y, SCENE_W, SCENE_H, GEN_LEFT, GEN_RIGHT, rng, css, mix, shade } from './util.js';

// ---------------------------------------------------------------------------
// Mountains: hand-placed peaks inside the 1920 frame for composition,
// seeded peaks outside it for wide screens. Valleys are generated between.
// ---------------------------------------------------------------------------
const FAR_PEAKS = [
  [-760, 660], [-420, 610], [-90, 640], [180, 600], [520, 575], [820, 600],
  [1120, 585], [1420, 610], [1700, 568], [2000, 615], [2330, 590], [2760, 650],
];
// the broad mountain on the right (x ~1440) anchors the composition
const MID_PEAKS = [
  [-760, 760], [-380, 715], [40, 735], [420, 705], [860, 728], [1440, 622],
  [1960, 700], [2380, 690], [2760, 740],
];

// Peaks and valleys joined by slightly bent straight runs: angular like
// low-poly terrain, but with enough irregularity to feel hand-made.
function ridge(peaks, r, depthLo, depthHi) {
  const key = [];
  for (let i = 0; i < peaks.length; i++) {
    const [x, y] = peaks[i];
    key.push({ x, y, peak: true });
    if (i < peaks.length - 1) {
      const [nx, ny] = peaks[i + 1];
      const vx = x + (nx - x) * r.range(0.4, 0.62);
      const vy = Math.max(y, ny) + r.range(depthLo, depthHi);
      key.push({ x: vx, y: Math.min(vy, HORIZON_Y - 25), peak: false });
    }
  }
  const pts = [];
  for (let i = 0; i < key.length; i++) {
    const a = key[i];
    pts.push(a);
    const b = key[i + 1];
    if (!b) break;
    // shoulders: slopes bow outward a little near peaks, flatten near valleys
    const steps = 3;
    for (let k = 1; k < steps; k++) {
      const u = k / steps;
      const bow = a.peak ? -1 : 1;
      const j = Math.sin(u * Math.PI) * Math.abs(b.y - a.y) * 0.1 * bow;
      pts.push({ x: a.x + (b.x - a.x) * u + r.range(-6, 6), y: a.y + (b.y - a.y) * u + j + r.range(-4, 4), peak: false, mid: true });
    }
  }
  return pts;
}

export function createTerrain(seed) {
  const r = rng(seed * 13 + 3);
  const far = ridge(FAR_PEAKS, r, 30, 70);
  const mid = ridge(MID_PEAKS, r, 25, 60);

  // rolling near hills: smooth sum of sines
  const near = [];
  for (let x = GEN_LEFT; x <= GEN_RIGHT; x += 40) {
    const y = 812 + Math.sin(x * 0.0021 + 1.2) * 16 + Math.sin(x * 0.0057 + 0.4) * 9 + Math.sin(x * 0.011) * 4;
    near.push({ x, y });
  }

  // treeline: clumps of round canopies with deliberate gaps
  const trees = [];
  let x = GEN_LEFT;
  while (x < GEN_RIGHT) {
    const density = 0.5 + 0.5 * Math.sin(x * 0.0031 + 2.0) * Math.sin(x * 0.0013 + 0.6);
    if (density > 0.22) {
      const rad = r.range(14, 34) * (0.7 + density * 0.6);
      trees.push({ x, y: HORIZON_Y + 2 - rad * r.range(0.35, 0.7), r: rad, tone: r() < 0.45 ? 1 : 0 });
      x += rad * r.range(0.7, 1.2);
    } else {
      x += r.range(30, 70);
    }
  }

  // coconut palms: hand-placed inside the frame, seeded outside it
  const palmSpots = [
    [38, 112, -0.05], [104, 92, 0.06], [214, 70, -0.02], [1286, 84, 0.04],
    [1702, 104, -0.06], [1758, 80, 0.05], [1832, 94, -0.03],
    [-560, 90, 0.04], [-300, 76, -0.05], [2160, 96, 0.03], [2350, 78, -0.04], [2560, 88, 0.05],
  ];
  const palms = palmSpots.map(([px, h, lean]) => {
    const fronds = [];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 0.94 + (i / (n - 1)) * Math.PI * 0.88 + r.range(-0.1, 0.1); // left .. right
      fronds.push({ a, len: h * r.range(0.32, 0.42), droop: r.range(0.5, 0.8) });
    }
    return { x: px, h, lean, fronds, phase: r() * 6.28 };
  });

  return { far, mid, near, trees, palms };
}

// ---------------------------------------------------------------------------
function fillRidge(ctx, pts, color, haze, base) {
  let minY = Infinity;
  for (const p of pts) minY = Math.min(minY, p.y);
  const g = ctx.createLinearGradient(0, minY, 0, base);
  g.addColorStop(0, css(color));
  g.addColorStop(1, css(mix(color, haze, 0.45)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, base);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.lineTo(pts[pts.length - 1].x, base);
  ctx.closePath();
  ctx.fill();
}

// Deterministic jitter so the faces never flicker.
const jit = (x, k) => {
  const v = Math.sin(x * 12.9898 + k * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
};

// Faceted light and shade that follows the terrain. For each peak:
// - the shadow face runs along the actual ridge from the peak down to the
//   saddle on the side away from the sun, then down a jittered gully to the
//   base, and back up a spine line under the peak;
// - the lit face takes the upper part of the sun-facing slope.
// Each face's strength comes from how its slope faces the sun (Lambert, as
// in hillshading). Shadow is lit by the sky, so it takes the sky's hue
// instead of just darkening; the lit side warms towards the sun.
// contrast: 1 for the nearest range, lower for distant ones (atmospheric
// perspective).
function facets(ctx, pts, color, P, base, strength, contrast = 1, rim = 0) {
  if (strength <= 0.01) return;
  const shadowCol = shade(mix(color, P.skyTop, 0.4), 0.8);
  const litCol = mix(mix(color, P.sunColor, 0.3), P.skyHorizon, 0.25);
  const sun = { x: P.sunX * SCENE_W, y: P.sunY * SCENE_H };
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, base);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.lineTo(pts[pts.length - 1].x, base);
  ctx.closePath();
  ctx.clip();

  // how much a run of ridge points faces the sun, 0..1
  const facing = (from, to) => {
    let sum = 0, n = 0;
    const step = from < to ? 1 : -1;
    for (let i = from; i !== to; i += step) {
      const a = pts[i], b = pts[i + step];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      // outward normal of the slope (pointing up and out of the mountain)
      let nx = dy / len, ny = -dx / len;
      if (ny > 0) { nx = -nx; ny = -ny; }
      const lx = sun.x - (a.x + b.x) / 2, ly = sun.y - (a.y + b.y) / 2;
      const ll = Math.hypot(lx, ly) || 1;
      sum += Math.max(0, (nx * lx + ny * ly) / ll); n++;
    }
    return n ? sum / n : 0.5;
  };

  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    if (!p.peak) continue;
    let li = i - 1; while (li > 0 && pts[li].mid) li--;
    let ri = i + 1; while (ri < pts.length - 1 && pts[ri].mid) ri++;
    const sunRight = sun.x >= p.x;
    const shadowEnd = sunRight ? li : ri; // saddle away from the sun
    const litEnd = sunRight ? ri : li;
    const sd = sunRight ? -1 : 1;          // shadow side direction
    const h = base - p.y;
    const width = Math.abs(pts[shadowEnd].x - p.x);

    // spine: from the peak down towards the viewer, leaning into the shadow side
    const spine = [];
    for (let k = 0; k <= 4; k++) {
      const u = k / 4;
      spine.push({ x: p.x + sd * width * 0.18 * u + jit(p.x, k) * width * 0.05 * u, y: p.y + h * u });
    }
    // gully: from the shadow-side saddle down to the base
    const sad = pts[shadowEnd];
    const gully = [];
    for (let k = 0; k <= 3; k++) {
      const u = k / 3;
      gully.push({ x: sad.x - sd * width * 0.12 * u + jit(sad.x, k + 7) * width * 0.04 * u, y: sad.y + (base - sad.y) * u });
    }

    const kShadow = facing(i, shadowEnd);
    const shadowA = strength * contrast * (0.55 + 0.45 * (1 - kShadow));
    const g = ctx.createLinearGradient(0, p.y, 0, base);
    g.addColorStop(0, css(shadowCol, shadowA));
    g.addColorStop(1, css(shadowCol, shadowA * 0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    for (let j = i + (sunRight ? -1 : 1); j !== shadowEnd + (sunRight ? -1 : 1); j += sunRight ? -1 : 1) ctx.lineTo(pts[j].x, pts[j].y);
    for (const q of gully) ctx.lineTo(q.x, q.y);
    for (let k = spine.length - 1; k >= 0; k--) ctx.lineTo(spine[k].x, spine[k].y);
    ctx.closePath();
    ctx.fill();

    // lit face: the upper part of the sun-facing slope
    const kLit = facing(i, litEnd);
    const litA = strength * contrast * 0.7 * (0.4 + 0.6 * kLit);
    const lg = ctx.createLinearGradient(0, p.y, 0, p.y + h * 0.7);
    lg.addColorStop(0, css(litCol, litA));
    lg.addColorStop(1, css(litCol, 0));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    const ls = sunRight ? 1 : -1;
    for (let j = i + ls; j !== litEnd + ls; j += ls) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.lineTo(pts[litEnd].x - ls * Math.abs(pts[litEnd].x - p.x) * 0.3, base);
    for (let k = spine.length - 1; k >= 0; k--) ctx.lineTo(spine[k].x, spine[k].y);
    ctx.closePath();
    ctx.fill();

    // a faint secondary fold from the lit-side saddle
    const ls2 = pts[litEnd];
    ctx.fillStyle = css(shadowCol, strength * contrast * 0.25);
    ctx.beginPath();
    ctx.moveTo(ls2.x, ls2.y);
    ctx.lineTo(ls2.x + ls * 14 + jit(ls2.x, 3) * 6, base);
    ctx.lineTo(ls2.x - ls * 22, base);
    ctx.closePath();
    ctx.fill();
  }

  // rim light: a thin warm line along crests that face a low sun
  if (rim > 0.02) {
    ctx.strokeStyle = css(mix(P.sunColor, [255, 255, 255], 0.4), rim);
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const facesSun = (sun.x >= Math.max(a.x, b.x) && b.y > a.y) || (sun.x <= Math.min(a.x, b.x) && b.y < a.y);
      if (!facesSun) continue;
      ctx.moveTo(a.x, a.y + 0.8);
      ctx.lineTo(b.x, b.y + 0.8);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// How low (and present) the sun is, 0..1: drives rim light.
const lowSun = (P) => Math.min(1, Math.max(0, (P.sunY - 0.2) / 0.4)) * P.sunAlpha;

export function drawFarMountains(ctx, P, T) {
  fillRidge(ctx, T.far, P.mtnFar, P.haze, HORIZON_Y);
  facets(ctx, T.far, P.mtnFar, P, HORIZON_Y, P.facet * 1.6, 0.45, 0);
}

export function drawMidMountains(ctx, P, T) {
  fillRidge(ctx, T.mid, P.mtnMid, P.haze, HORIZON_Y);
  facets(ctx, T.mid, P.mtnMid, P, HORIZON_Y, P.facet * 1.6, 1, 0.55 * lowSun(P));
}

export function drawNearHills(ctx, P, T) {
  const pts = T.near;
  const g = ctx.createLinearGradient(0, 790, 0, HORIZON_Y);
  g.addColorStop(0, css(P.mtnNear));
  g.addColorStop(1, css(mix(P.mtnNear, P.haze, 0.3)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, HORIZON_Y + 4);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, HORIZON_Y + 4);
  ctx.closePath();
  ctx.fill();
}

export function drawTreeline(ctx, view, P, T) {
  const tones = [P.tree, mix(P.tree, P.mtnNear, 0.4)];
  for (let tone = 0; tone < 2; tone++) {
    ctx.fillStyle = css(tones[tone]);
    ctx.beginPath();
    for (const t of T.trees) {
      if (t.tone !== tone) continue;
      if (t.x + t.r < view.x0 || t.x - t.r > view.x0 + view.w) continue;
      ctx.moveTo(t.x + t.r, t.y);
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    }
    ctx.rect(view.x0 - 2, HORIZON_Y - 6, view.w + 4, 14);
    ctx.fill();
  }
}

export function drawPalms(ctx, view, P, T, time, wind) {
  const col = css(P.palm);
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineCap = 'round';
  for (const p of T.palms) {
    if (p.x < view.x0 - 80 || p.x > view.x0 + view.w + 80) continue;
    const baseY = HORIZON_Y + 4;
    const sway = Math.sin(time * (0.6 + wind * 0.8) + p.phase) * (1.2 + wind * 5);
    const topX = p.x + p.lean * p.h + sway + wind * 4;
    const topY = baseY - p.h;
    // trunk: gentle curve, tapered with two strokes
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(p.x, baseY);
    ctx.quadraticCurveTo(p.x + p.lean * p.h * 0.2, baseY - p.h * 0.55, topX, topY);
    ctx.stroke();
    // crown
    for (const f of p.fronds) {
      const a = f.a + wind * 0.25 + sway * 0.01;
      // fronds arc up and out, then droop: more droop for the side fronds
      const side = Math.cos(a) * Math.cos(a);
      const tx = topX + Math.cos(a) * f.len;
      const ty = topY + Math.sin(a) * f.len * 0.35 + f.len * f.droop * (0.25 + side * 0.9);
      const cx = topX + Math.cos(a) * f.len * 0.5;
      const cy = topY + Math.sin(a) * f.len * 0.55 - f.len * 0.12;
      const nx = -Math.sin(a) * 3.2;
      const ny = Math.cos(a) * 3.2;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(cx + nx, cy + ny, tx, ty);
      ctx.quadraticCurveTo(cx - nx, cy - ny, topX, topY);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(topX, topY + 1, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
