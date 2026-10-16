// Coordinate convention
// The scene is authored in a logical 1920 x 1080 space, origin top-left,
// y pointing down. The field is pinned to the bottom of the viewport.
// Taller screens reveal more sky above y = 0; wider screens reveal more
// land left of x = 0 and right of x = 1920. Geometry is generated across
// GEN_LEFT..GEN_RIGHT so very wide screens still have content.
export const SCENE_W = 1920;
export const SCENE_H = 1080;
export const HORIZON_Y = 872;   // where hills meet the field
export const FIELD_TOP = 866;   // top edge of the field fill
export const GROUND_Y = 906;    // the walking line (character feet)
export const GEN_LEFT = -800;
export const GEN_RIGHT = 2720;
export const WRAP_MARGIN = 190; // off-screen run-out on each side

// Deterministic PRNG so static geometry never changes between frames.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const mod = (a, n) => ((a % n) + n) % n;
export const smooth = (t) => t * t * (3 - 2 * t);

// Smooth, deterministic 1D "noise" made of incommensurate sines.
export function wobble(t, seed = 0) {
  return (
    Math.sin(t * 0.71 + seed * 1.3) * 0.5 +
    Math.sin(t * 1.37 + seed * 2.1) * 0.3 +
    Math.sin(t * 2.93 + seed * 0.7) * 0.2
  );
}

// Smooth 1D gradient noise in roughly -1..1 (Perlin style, deterministic).
const GRAD = Array.from({ length: 256 }, (_, i) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
});
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const a = GRAD[i & 255] * f;
  const b = GRAD[(i + 1) & 255] * (f - 1);
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  return (a + (b - a) * u) * 2;
}

// ---- colour -------------------------------------------------------------
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
export function css(c, alpha = 1) {
  const r = Math.round(clamp(c[0], 0, 255));
  const g = Math.round(clamp(c[1], 0, 255));
  const b = Math.round(clamp(c[2], 0, 255));
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${clamp(alpha, 0, 1).toFixed(3)})`;
}
// Multiply a colour by a tint colour and a brightness scalar.
export function tint(c, t, k = 1) {
  return [c[0] * (t[0] / 255) * k, c[1] * (t[1] / 255) * k, c[2] * (t[2] / 255) * k];
}
export function shade(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
