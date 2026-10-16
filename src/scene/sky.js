import { SCENE_W, SCENE_H, FIELD_TOP, GEN_LEFT, GEN_RIGHT, rng, css, mix } from './util.js';

export function drawSky(ctx, view, P) {
  const top = view.y0;
  const g = ctx.createLinearGradient(0, Math.min(top, 0), 0, FIELD_TOP);
  g.addColorStop(0, css(P.skyTop));
  g.addColorStop(0.55, css(P.skyMid));
  g.addColorStop(1, css(P.skyHorizon));
  ctx.fillStyle = g;
  ctx.fillRect(view.x0 - 2, top - 2, view.w + 4, FIELD_TOP - top + 4);
}

export function createStars(seed) {
  const r = rng(seed * 31 + 5);
  const stars = [];
  for (let i = 0; i < 180; i++) {
    stars.push({
      x: r.range(GEN_LEFT, GEN_RIGHT),
      y: r.range(-700, 640) * (0.6 + 0.4 * r()),
      size: r() < 0.12 ? r.range(1.6, 2.4) : r.range(0.7, 1.4),
      phase: r() * Math.PI * 2,
      speed: r.range(0.3, 1.2),
    });
  }
  return stars;
}

export function drawStars(ctx, view, P, stars, t) {
  if (P.stars <= 0.01) return;
  const n = Math.floor(stars.length * Math.min(1, P.stars * 1.1));
  const col = mix(P.skyHorizon, [255, 255, 255], 0.85);
  for (let i = 0; i < n; i++) {
    const s = stars[i];
    if (s.x < view.x0 || s.x > view.x0 + view.w || s.y < view.y0) continue;
    // fade out toward the horizon
    const fade = Math.min(1, (FIELD_TOP - 160 - s.y) / 260);
    if (fade <= 0) continue;
    const tw = 0.65 + 0.35 * Math.sin(t * s.speed + s.phase);
    ctx.fillStyle = css(col, P.stars * tw * fade);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawSun(ctx, view, P) {
  if (P.sunAlpha <= 0.005) return;
  const x = P.sunX * SCENE_W;
  const y = P.sunY * SCENE_H;
  const r = P.sunSize;
  // Glow: a wide soft radial wash, screen-blended.
  if (P.glow > 0.01) {
    const gr = r * (3.5 + P.glow * 4);
    const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, gr);
    g.addColorStop(0, css(P.glowColor, 0.55 * P.glow * P.sunAlpha));
    g.addColorStop(0.35, css(P.glowColor, 0.18 * P.glow * P.sunAlpha));
    g.addColorStop(1, css(P.glowColor, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(x - gr, y - gr, gr * 2, gr * 2);
    ctx.restore();
  }
  // Disc with a slightly softened rim.
  ctx.fillStyle = css(P.sunColor, 0.35 * P.sunAlpha);
  ctx.beginPath(); ctx.arc(x, y, r * 1.06, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = css(P.sunColor, P.sunAlpha);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
