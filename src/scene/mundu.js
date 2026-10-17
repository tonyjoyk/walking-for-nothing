// The mundu as a small Verlet cloth (after Jakobsen, "Advanced Character
// Physics"): a few vertical chains of points hang from the waistband. Each
// frame the points move under gravity, air drag and wind, then a few passes
// of constraints pull them back to their rest lengths and push them out of
// the legs. Drawn as one opaque shape through the chain points, so the legs
// can never show through above the hem.
//
// Local units, as in character.js: origin on the walking line, facing +x.

const CHAINS = 5;        // back edge .. front edge
const SPACING = 15;      // target distance between points along a chain
const ITERATIONS = 6;    // constraint passes per step (more = stiffer)
const DAMPING = 0.97;    // velocity kept per step
const GRAVITY = 1100;    // units/s² (150 units ≈ 1 m)
const SUBSTEPS = 2;
const LEG_MARGIN = 3;    // cloth sits this far outside the leg surface
const WAIST_HALF = 18;   // half the waistband width

// Waist-to-hem length and, per chain from back to front, a share of it.
// Unfolded (full): an even hem just above the ankles. Folded: the cloth is
// hitched up and tucked at the front, so the hem rises towards the front.
export const MUNDU_STATES = {
  full: { length: 132, profile: [1, 1, 1, 1, 0.99] },
  folded: { length: 86, profile: [1.04, 1, 0.93, 0.85, 0.77] },
};

export class MunduCloth {
  constructor() { this.pts = null; this.state = null; }

  // state: 'full' | 'folded' (see MUNDU_STATES)
  reset(waistY, state) {
    const S = MUNDU_STATES[state] || MUNDU_STATES.full;
    this.state = state;
    this.n = Math.max(6, Math.round(S.length / SPACING) + 1); // points per chain, incl. the pin
    this.segs = S.profile.map((f) => (S.length * f) / (this.n - 1)); // per chain
    this.pts = [];
    for (let c = 0; c < CHAINS; c++) {
      const chain = [];
      const x = -WAIST_HALF + (2 * WAIST_HALF * c) / (CHAINS - 1);
      for (let k = 0; k < this.n; k++) {
        const p = { x: x * (1 + 0.25 * k / (this.n - 1)), y: waistY + k * this.segs[c] };
        chain.push({ x: p.x, y: p.y, px: p.x, py: p.y });
      }
      this.pts.push(chain);
    }
  }

  // ax, ay: extra acceleration (drag from walking, wind)
  step(dt, waistY, legs, seat, ax, ay, stiffness = 1) {
    const h = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (let c = 0; c < CHAINS; c++) {
        const chain = this.pts[c];
        // the pin rides on the waistband
        chain[0].x = -WAIST_HALF + (2 * WAIST_HALF * c) / (CHAINS - 1);
        chain[0].y = waistY;
        chain[0].px = chain[0].x; chain[0].py = chain[0].y;
        for (let k = 1; k < this.n; k++) {
          const p = chain[k];
          const vx = (p.x - p.px) * DAMPING, vy = (p.y - p.py) * DAMPING;
          p.px = p.x; p.py = p.y;
          // lower points catch more of the drag and wind
          const reach = k / (this.n - 1);
          p.x += vx + ax * reach * h * h;
          p.y += vy + (GRAVITY + ay) * h * h;
        }
      }
      for (let it = 0; it < ITERATIONS; it++) this.solve(waistY, legs, seat, stiffness);
    }
  }

  solve(waistY, legs, seat, stiffness) {
    const P = this.pts;
    for (let c = 0; c < CHAINS; c++) {
      const chain = P[c];
      const seg = this.segs[c];
      for (let k = 0; k < this.n - 1; k++) link(chain[k], chain[k + 1], seg, 1, k === 0);
      // bending: keep every other point roughly apart, so it folds like cloth, not rope
      for (let k = 0; k < this.n - 2; k++) link(chain[k], chain[k + 2], seg * 1.9, 0.25 * stiffness, k === 0);
    }
    // ties across the cloth, slightly flared towards the hem; soft so it can bunch
    for (let k = 1; k < this.n; k++) {
      const rest = ((2 * WAIST_HALF) / (CHAINS - 1)) * (1 + 0.25 * k / (this.n - 1));
      for (let c = 0; c < CHAINS - 1; c++) link(P[c][k], P[c + 1][k], rest, 0.3 * stiffness, false);
    }
    // the outer edges wrap the legs: the front edge stays in front of every
    // leg surface, the back edge behind it (and over the seat)
    for (let k = 1; k < this.n; k++) {
      const front = P[CHAINS - 1][k], back = P[0][k];
      const fx = legExtent(legs, front.y, 1);
      if (fx !== null && front.x < fx + LEG_MARGIN) front.x = fx + LEG_MARGIN;
      const bx = legExtent(legs, back.y, -1);
      if (bx !== null && back.x > bx - LEG_MARGIN) back.x = bx - LEG_MARGIN;
      if (seat) {
        const dx = back.x - seat.x, dy = back.y - seat.y;
        const d = Math.hypot(dx, dy);
        if (d < seat.r && d > 0.001) { back.x = seat.x + (dx / d) * seat.r; back.y = seat.y + (dy / d) * seat.r; }
        if (back.x > seat.x - seat.r * 0.2 && back.y < seat.y + seat.r && back.y > seat.y - seat.r) back.x = Math.min(back.x, seat.x - seat.r * 0.2);
      }
      // inner chains stay between the edges, and nothing rides above the waist
      for (let c = 1; c < CHAINS - 1; c++) {
        const p = P[c][k];
        if (p.x > front.x) p.x = front.x;
        if (p.x < back.x) p.x = back.x;
      }
      for (let c = 0; c < CHAINS; c++) if (P[c][k].y < waistY + 2) P[c][k].y = waistY + 2;
    }
  }

  // Outline for drawing: back edge up from the hem is not needed; returns
  // { back: [...], front: [...], hem: [...] } in drawing order.
  outline() {
    const P = this.pts;
    return {
      front: P[CHAINS - 1].map((p) => ({ x: p.x, y: p.y })),
      back: P[0].map((p) => ({ x: p.x, y: p.y })),
      hem: P.map((chain) => ({ x: chain[this.n - 1].x, y: chain[this.n - 1].y })),
      inner: P.slice(1, -1).map((chain) => chain.map((p) => ({ x: p.x, y: p.y }))),
    };
  }
}

// Move a and b towards distance `rest`. pinA: a does not move.
function link(a, b, rest, stiffness, pinA) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const diff = ((d - rest) / d) * stiffness;
  if (pinA) { b.x -= dx * diff; b.y -= dy * diff; return; }
  a.x += dx * diff * 0.5; a.y += dy * diff * 0.5;
  b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5;
}

// Front-most (side = 1) or back-most (side = -1) leg surface at height y,
// or null if no leg crosses that height.
function legExtent(legs, y, side) {
  let best = null;
  for (const L of legs) {
    const { a, b, r } = L;
    const y0 = Math.min(a.y, b.y) - r, y1 = Math.max(a.y, b.y) + r;
    if (y < y0 || y > y1) continue;
    const dy = b.y - a.y;
    const t = Math.abs(dy) < 0.001 ? 0.5 : Math.min(1, Math.max(0, (y - a.y) / dy));
    const x = a.x + (b.x - a.x) * t + side * r;
    if (best === null || (side > 0 ? x > best : x < best)) best = x;
  }
  return best;
}
