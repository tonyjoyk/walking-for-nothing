import { css, tint, hexToRgb, clamp, lerp } from './util.js';
import { MunduCloth, MUNDU_STATES } from './mundu.js';
import { HIP, KNEE, ANKLE, sampleGait } from './gaitData.js';

// Local coordinates: origin at the walking line under the body, facing +x,
// y negative is up. Total height is ~262 units at scale 1.
const BASE = {
  shirt: hexToRgb('#7b4a2c'), shirtShade: hexToRgb('#5c3620'), cuff: hexToRgb('#95603f'),
  skin: hexToRgb('#8e5c3d'), skinShade: hexToRgb('#6b4029'),
  hair: hexToRgb('#1c1613'), beard: hexToRgb('#2b1f18'),
  mundu: hexToRgb('#f3efe4'), munduShade: hexToRgb('#d4cebe'), kasavu: hexToRgb('#2e6b4e'),
  sandal: hexToRgb('#3a2a20'),
};

const LEN = { thigh: 64, shin: 66, upper: 50, fore: 46 };
const HIP_TOP = -8 - (64 + 66);  // hip height over a planted foot with a straight knee (ankle at -8)
const HIP_Y = HIP_TOP;
const SHOULDER = { x: 3, y: -212 };
const ANKLE_H = 8; // ankle height above the sole

// Foot outline around the ankle, foot flat on the ground (sole at y = ANKLE_H).
const HEEL = { x: -7, y: ANKLE_H };
const TOE = { x: 17, y: ANKLE_H };
const FOOT = [[-4, -4], [-8, 2], [-7, ANKLE_H], [18, ANKLE_H], [17, 4.5], [8, 1], [3, -3]];

// Gait timing. A foot is on the ground for 62% of the cycle, as in the gait
// data (gaitData.js), so both feet are down for a moment after each contact.
export const STANCE = 0.62;
const HEEL_STRIKE = 0.12; // share of stance spent rolling from heel to flat
const TOE_OFF = 0.72;     // share of stance where the heel starts to lift
const HEEL_UP = 0.5;      // foot pitch at toe-off (radians, heel up)
const TOE_UP = -0.22;     // foot pitch at heel strike (radians, toe up)
// Where the stance sits relative to the hips. In the data the foot lands
// about 45 units ahead of the hip and leaves about 58 behind it (the knee is
// already bending at push-off), so the stance is centred slightly behind.
const AHEAD = -0.15;      // share of the half-sweep the stance is shifted (+ forward, - back)
const LOAD_FLEX = 0.75;   // share of the data's knee flex used while loading (slow walk)
const KNEE_SWING = 0.85;  // share of the data's swing knee flex (slow walk)
const DEG = Math.PI / 180;

const smoothstep = (t) => t * t * (3 - 2 * t);

// Joint angle convention: 0 points straight down, positive swings forward (+x).
const seg = (o, a, l) => ({ x: o.x + Math.sin(a) * l, y: o.y + Math.cos(a) * l });
// Rotate a vector by theta in screen space (y down, positive = clockwise).
const rot = (v, th) => ({ x: v.x * Math.cos(th) - v.y * Math.sin(th), y: v.x * Math.sin(th) + v.y * Math.cos(th) });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

// Where the foot is during stance: it rolls over the heel, lies flat, then
// pivots on the toe. The pinned point (heel or toe) moves back at exactly the
// body's speed, so in world space it does not move at all.
// s: 0..1 through stance. half: half the stance sweep in local units.
function stanceFoot(s, half) {
  const flatX = half * (1 + AHEAD) - 2 * half * s; // ankle x if the foot were flat
  if (s < HEEL_STRIKE) {
    const th = TOE_UP * (1 - smoothstep(s / HEEL_STRIKE));
    const heel = { x: flatX + HEEL.x, y: 0 };
    return { ankle: add(heel, rot(sub({ x: 0, y: 0 }, HEEL), th)), th, pin: heel, pinKind: 'heel' };
  }
  if (s > TOE_OFF) {
    const th = HEEL_UP * smoothstep((s - TOE_OFF) / (1 - TOE_OFF));
    const toe = { x: flatX + TOE.x, y: 0 };
    return { ankle: add(toe, rot(sub({ x: 0, y: 0 }, TOE), th)), th, pin: toe, pinKind: 'toe' };
  }
  return { ankle: { x: flatX, y: -ANKLE_H }, th: 0, pin: { x: flatX + HEEL.x, y: 0 }, pinKind: 'heel' };
}

// Two-bone IK: the knee that puts the ankle at `target`, bending forward.
// If the target is out of reach the leg straightens towards it.
function solveLeg(hip, target) {
  const L1 = LEN.thigh, L2 = LEN.shin;
  const dx = target.x - hip.x, dy = target.y - hip.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1, L1 + L2 - 0.01);
  const base = Math.atan2(dx, dy);
  const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const knee = seg(hip, base + Math.acos(cosA), L1);
  const ankle = seg(hip, base, d);
  return { knee, ankle };
}

// Hip-to-ankle distance for a given knee flexion (radians).
const legSpan = (k) => Math.sqrt(LEN.thigh ** 2 + LEN.shin ** 2 + 2 * LEN.thigh * LEN.shin * Math.cos(k));

// Where this foot should be. u: 0..1 gait position for this leg
// (0 = heel strike, leg forward). half: half the stance sweep. lift: knee lift.
// While planted, the foot is pinned (stanceFoot). In swing, the hip and knee
// follow the measured gait curves, scaled to this step length, and blend into
// the toe-off and heel-strike positions at either end so the foot leaves and
// lands exactly where it is pinned.
function footTarget(u, half, lift, hip) {
  if (u < STANCE) return { ...stanceFoot(u / STANCE, half), planted: true };
  const t = (u - STANCE) / (1 - STANCE);
  const a = stanceFoot(1, half), b = stanceFoot(0, half);
  // scale the data's hip angles so heel strike lands at our contact point
  const hsAngle = Math.atan2(b.ankle.x - hip.x, b.ankle.y - hip.y);
  const hipScale = hsAngle / (HIP[0] * DEG);
  const a1 = sampleGait(HIP, u) * DEG * hipScale;
  const k = sampleGait(KNEE, u) * DEG * KNEE_SWING * lift;
  const knee = seg(hip, a1, LEN.thigh);
  const a2 = a1 - k;
  let ankle = seg(knee, a2, LEN.shin);
  const wa = 1 - smoothstep(Math.min(1, t / 0.25));
  const wb = smoothstep(Math.max(0, (t - 0.7) / 0.3));
  ankle = { x: lerp(lerp(ankle.x, a.ankle.x, wa), b.ankle.x, wb), y: lerp(lerp(ankle.y, a.ankle.y, wa), b.ankle.y, wb) };
  // keep the toes clear of the ground
  ankle.y = Math.min(ankle.y, -ANKLE_H - 3 * Math.sin(Math.PI * t));
  // foot pitch: square to the shin, plus the ankle angle from the data
  const thFK = -a2 - sampleGait(ANKLE, u) * DEG;
  const th = lerp(lerp(thFK, HEEL_UP, wa), TOE_UP, wb);
  return { ankle, th, pin: null, pinKind: null, planted: false };
}

function legPose(foot, hip) {
  const { knee, ankle } = solveLeg(hip, foot.ankle);
  return { knee, ankle, footAngle: foot.th, pin: foot.pin, pinKind: foot.pinKind, planted: foot.planted };
}

// Heel and toe of a solved leg (after IK), in local units.
export function footPoints(leg) {
  return { heel: add(leg.ankle, rot(HEEL, leg.footAngle)), toe: add(leg.ankle, rot(TOE, leg.footAngle)) };
}

// Arm swing targets from gait studies (Murray 1967 and later): the shoulder
// swings about 8° forward to 25° back, furthest forward at the opposite
// foot's heel strike, lagging it slightly; the elbow bends about 8° on the
// back swing and 40° on the front swing, lagging the shoulder by a further
// ~7% of the cycle. Angles in radians, positive = forward.
// armU: the gait position of the leg on the same side as this arm.
function armTargets(armU, swing) {
  const ph = 2 * Math.PI * (armU - 0.5 - 0.06);
  const shoulder = (-8.5 + 16.5 * Math.cos(ph)) * DEG * swing;
  // a hanging arm keeps a relaxed bend of about 12°
  const elbow = (12 + (12 + 16 * Math.cos(ph - 2 * Math.PI * 0.07)) * Math.min(1.2, swing)) * DEG;
  return { shoulder, elbow };
}

function armFromAngles(shoulder, a) {
  const elbow = seg(shoulder, a.shoulder, LEN.upper);
  const fa = a.shoulder + a.elbow;
  const hand = seg(elbow, fa, LEN.fore);
  return { elbow, hand, fa };
}

// Arms as driven, damped pendulums (after Collins, Adamczyk & Kuo 2009 and
// Pontzer et al. 2009): the arm hangs from a shoulder that moves with the
// trunk, and swings mostly passively. A gentle spring towards the gait
// targets stands in for muscle tone and keeps the swing in step; the
// forearm is a second pendulum that reacts to the upper arm's acceleration.
const ARM = {
  g: 1470,          // units/s² (150 units ≈ 1 m)
  lUpper: 43,       // effective pendulum length of the whole arm
  tone: 0.35,       // muscle spring as a share of the gravity stiffness
  dampShoulder: 0.22, dampElbow: 0.4,
};

class ArmPendulum {
  constructor() { this.a = null; this.v = { shoulder: 0, elbow: 0 }; this.prevSh = null; this.shV = 0; }

  step(dt, target, shoulderPos) {
    if (!this.a) { this.a = { ...target }; this.prevSh = shoulderPos.x; return; }
    // horizontal acceleration of the shoulder (trunk counter-rotation)
    const shV = (shoulderPos.x - this.prevSh) / dt;
    const shA = (shV - this.shV) / dt;
    this.prevSh = shoulderPos.x; this.shV = shV;
    const w2 = ARM.g / ARM.lUpper;
    const K = w2 * (1 + ARM.tone);
    const c1 = 2 * ARM.dampShoulder * Math.sqrt(K);
    // gravity and tone pull towards the target; a moving pivot swings the arm
    const acc1 = K * (target.shoulder - this.a.shoulder) - c1 * this.v.shoulder
      - (clamp(shA, -4000, 4000) * Math.cos(this.a.shoulder)) / ARM.lUpper;
    this.v.shoulder += acc1 * dt;
    this.a.shoulder += this.v.shoulder * dt;
    const Ke = K * 0.8;
    const c2 = 2 * ARM.dampElbow * Math.sqrt(Ke);
    const acc2 = Ke * (target.elbow - this.a.elbow) - c2 * this.v.elbow - acc1 * 0.35;
    this.v.elbow += acc2 * dt;
    this.a.elbow = clamp(this.a.elbow + this.v.elbow * dt, 4 * DEG, 75 * DEG);
  }
}

// Colours for the figure: the chosen look (config.character), tinted by the
// scene's light. look is optional; without it the defaults are used.
export function characterColors(P, look) {
  const base = { ...BASE };
  if (look) {
    const skin = hexToRgb(look.skinColor), shirt = hexToRgb(look.shirtColor), mundu = hexToRgb(look.munduColor);
    Object.assign(base, {
      skin, skinShade: shadeRgb(skin, 0.75),
      shirt, shirtShade: shadeRgb(shirt, 0.75), cuff: mixRgb(shirt, [255, 255, 255], 0.12),
      hair: hexToRgb(look.hairColor), beard: hexToRgb(look.beardColor),
      mundu, munduShade: shadeRgb(mundu, 0.87), kasavu: hexToRgb(look.kasavuColor),
    });
  }
  const k = P.charBrightness;
  const out = {};
  for (const [key, c] of Object.entries(base)) out[key] = css(tint(c, P.charTint, k));
  if (look) Object.assign(out, { beardOn: look.beard, sleeve: look.sleeve, build: look.build, loose: look.shirtLoose });
  return out;
}
const shadeRgb = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Joint positions for a pose, in local units (origin on the walking line).
// Shared by the renderer, the secondary-motion springs, grass parting and
// the tests.
// pose: { phase, sweep, stride, bob, armSwing }
export function characterPose(pose) {
  const ph = pose.phase;
  const u = (((ph / (Math.PI * 2)) % 1) + 1) % 1;
  const half = Math.max(0, pose.sweep || 0) / 2;
  const uFar = (u + 0.5) % 1;
  // Hip height comes from the leg that is taking weight (an inverted
  // pendulum): its knee flexes a little after heel strike, as in the data,
  // then straightens, so the body dips after each contact and rises over the
  // foot. bob scales that motion. The trailing leg just bends to follow.
  let hipY = -Infinity;
  for (const lu of [u, uFar]) {
    if (lu >= 0.5) continue;
    const f = stanceFoot(lu / STANCE, half);
    const d = legSpan(sampleGait(KNEE, lu) * DEG * LOAD_FLEX);
    hipY = Math.max(hipY, f.ankle.y - Math.sqrt(Math.max(0, d * d - f.ankle.x * f.ankle.x)));
  }
  const by = (hipY - HIP_TOP) * pose.bob;
  const hip = { x: 0, y: HIP_TOP + by };
  const nearFoot = footTarget(u, half, pose.stride, hip);
  const farFoot = footTarget(uFar, half, pose.stride, hip);
  const near = legPose(nearFoot, hip);
  const far = legPose(farFoot, hip);
  // the near shoulder moves forward as the near arm swings forward, against
  // the hips (counter-rotation seen from the side)
  const twist = 2.2 * pose.armSwing * Math.min(1.2, (pose.sweep || 0) / 80) * Math.cos(ph);
  const sh = { x: SHOULDER.x + twist, y: SHOULDER.y + by };
  const shF = { x: SHOULDER.x - 3 - twist * 0.6, y: SHOULDER.y + 1 + by };
  // arm swing grows with step length and relaxes to a hang when standing
  const swing = pose.armSwing * Math.min(1.2, (pose.sweep || 0) / 80);
  const tN = armTargets(u, swing), tF = armTargets(uFar, swing);
  const armN = armFromAngles(sh, pose.arms?.near.a ?? tN);
  const armF = armFromAngles(shF, pose.arms?.far.a ?? tF);
  // slight forward lean that deepens at push-off; the head counters it
  const lean = 0.045 + 0.012 * Math.sin(Math.PI * 4 * (u - 0.1));
  return { u, uFar, by, hip, sh, shF, near, far, armN, armF, lean, armTargets: { near: tN, far: tF } };
}

// ---------------------------------------------------------------------------
// Secondary motion: the mundu is a Verlet cloth (mundu.js) that collides with
// the legs; the shirt tail follows on a spring.
// ---------------------------------------------------------------------------
const waistY = (p) => HIP_Y - 8 + p.by;

// What the cloth collides with: thigh and shin capsules for both legs, and
// a circle for the seat the back of the cloth drapes over.
function clothColliders(p) {
  const legs = [];
  for (const L of [p.near, p.far]) {
    legs.push({ a: p.hip, b: L.knee, r: 8.5 });
    legs.push({ a: L.knee, b: L.ankle, r: 5.8 });
  }
  return { legs, seat: { x: -12, y: HIP_Y + 18 + p.by, r: 13 } };
}

// opts: { length: 'folded' | 'full', drag, windDir, stiffness }
export class CharacterMotion {
  constructor() {
    this.cloth = new MunduCloth(); this.tail = 0; this.tailV = 0;
    this.arms = { near: new ArmPendulum(), far: new ArmPendulum() };
  }

  update(dt, pose, wind, time, fabric, opts = {}) {
    const p = characterPose(pose);
    const state = MUNDU_STATES[opts.length] ? opts.length : 'full';
    if (!this.cloth.pts || this.cloth.state !== state) {
      this.cloth.reset(waistY(p), state);
      dt = 1 / 60;
      for (let i = 0; i < 40; i++) this.stepCloth(dt, p, wind, time, fabric, opts);
      return;
    }
    if (dt <= 0) return;
    this.stepCloth(Math.min(dt, 1 / 30), p, wind, time, fabric, opts);
    // arms: fixed small substeps keep the pendulums stable
    const n = Math.max(1, Math.ceil(Math.min(dt, 1 / 30) / (1 / 120)));
    for (let i = 0; i < n; i++) {
      this.arms.near.step(dt / n, p.armTargets.near, p.sh);
      this.arms.far.step(dt / n, p.armTargets.far, p.shF);
    }
    // shirt tail: a spring towards a gentle wind flutter
    const target = Math.sin(time * (2.4 + wind * 3)) * fabric * (0.6 + wind * 2.5) * 0.8 + wind * fabric * 3;
    this.tailV = (this.tailV + (target - this.tail) * 140 * dt) * Math.exp(-11 * dt);
    this.tail += this.tailV * dt;
  }

  stepCloth(dt, p, wind, time, fabric, opts) {
    const { legs, seat } = clothColliders(p);
    const gust = Math.sin(time * (1.7 + wind * 2.3)) * 0.5 + 0.5;
    // walking through still air pushes the cloth back; wind pushes it downwind
    const ax = -(opts.drag || 0) * 1.6 + (opts.windDir || 1) * wind * fabric * (300 + 500 * gust);
    this.cloth.step(dt, waistY(p), legs, seat, ax, 0, opts.stiffness ?? 1);
  }
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

// A limb segment that tapers from width wa at a to wb at b, with an optional
// bulge (calf, forearm) on the side given by bulgeSide (+1 / -1).
function limbPath(ctx, a, b, wa, wb, bulge = 0, bulgeSide = 1) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const ang = Math.atan2(ny, nx);
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const ra = wa / 2, rb = wb / 2;
  const mw = (ra + rb) / 2;
  ctx.moveTo(a.x + nx * ra, a.y + ny * ra);
  const s1 = bulgeSide > 0 ? bulge : 0;
  ctx.quadraticCurveTo(m.x + nx * (mw + s1 * 2), m.y + ny * (mw + s1 * 2), b.x + nx * rb, b.y + ny * rb);
  ctx.arc(b.x, b.y, rb, ang, ang + Math.PI, true);
  const s2 = bulgeSide < 0 ? bulge : 0;
  ctx.quadraticCurveTo(m.x - nx * (mw + s2 * 2), m.y - ny * (mw + s2 * 2), a.x - nx * ra, a.y - ny * ra);
  ctx.arc(a.x, a.y, ra, ang + Math.PI, ang, true);
  ctx.closePath();
}

function fillPath(ctx, color, build) {
  ctx.fillStyle = color;
  ctx.beginPath();
  build();
  ctx.fill();
}

// Rim light: a thin band along the edge of a shape that faces the sun.
// Fills shape minus (shape shifted away from the sun), clipped to the shape.
// build may be a list of parts; each is lit on its own so overlaps stay clean.
function rimLight(ctx, rim, build, w = 3) {
  if (!rim || rim.alpha < 0.02) return;
  if (Array.isArray(build)) { for (const b of build) rimLight(ctx, rim, b, w); return; }
  ctx.save();
  ctx.beginPath();
  build();
  ctx.clip();
  ctx.beginPath();
  ctx.rect(-400, -400, 800, 800);
  ctx.translate(-rim.dir * w, w * 0.35);
  build();
  ctx.globalAlpha = rim.alpha;
  ctx.fillStyle = rim.color;
  ctx.fill('evenodd');
  ctx.restore();
}

function footPath(ctx, ankle, th) {
  const pts = FOOT.map(([x, y]) => add(ankle, rot({ x, y }, th)));
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function drawLeg(ctx, hip, leg, color, rim, thigh, sandal) {
  const parts = [
    // shin with the calf on the back of the leg (-x side)
    () => limbPath(ctx, leg.knee, leg.ankle, 11.5, 6.5, 2.2, leg.knee.y < leg.ankle.y ? 1 : -1),
    () => footPath(ctx, leg.ankle, leg.footAngle),
  ];
  if (thigh) parts.unshift(() => limbPath(ctx, hip, leg.knee, 17, 11.5));
  // each part on its own: overlapping subpaths with opposite winding would cut holes
  parts.forEach((b) => fillPath(ctx, color, b));
  rimLight(ctx, rim, parts, 2);
  if (sandal) {
    // a dark sole under the foot and one strap over the instep
    const P = (x, y) => add(leg.ankle, rot({ x, y }, leg.footAngle));
    const h = P(-7.5, ANKLE_H + 0.8), t = P(18.5, ANKLE_H + 0.8);
    ctx.strokeStyle = sandal;
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(t.x, t.y); ctx.stroke();
    const a = P(8, 1.5), b = P(11, ANKLE_H);
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
}

function drawArm(ctx, sh, pose, C, far, rim) {
  const skin = far ? C.skinShade : C.skin;
  const cloth = far ? C.shirtShade : C.shirt;
  // forearm with a little muscle on the outer side, then the hand
  const handDir = Math.atan2(pose.hand.y - pose.elbow.y, pose.hand.x - pose.elbow.x);
  const hx = pose.hand.x + Math.cos(handDir) * 3, hy = pose.hand.y + Math.sin(handDir) * 3;
  const parts = [
    () => limbPath(ctx, pose.elbow, pose.hand, 9.5, 6.4, 1.2, 1),
    () => ctx.ellipse(hx, hy, 6.2, 4.2, handDir, 0, Math.PI * 2),
  ];
  parts.forEach((b) => fillPath(ctx, skin, b));
  if (!far) rimLight(ctx, rim, parts.slice(0, 1), 1.6);
  // loose sleeve, wider at the cuff: short, to the elbow, or full length
  if (C.sleeve === 'long') {
    fillPath(ctx, cloth, () => limbPath(ctx, pose.elbow, pose.hand, 12.5, 10.5));
    fillPath(ctx, far ? C.shirtShade : C.cuff, () => limbPath(ctx, {
      x: pose.elbow.x + (pose.hand.x - pose.elbow.x) * 0.85, y: pose.elbow.y + (pose.hand.y - pose.elbow.y) * 0.85,
    }, pose.hand, 10.8, 10.5));
  }
  const reach = C.sleeve === 'short' ? 0.6 : C.sleeve === 'long' ? 1.02 : 0.92;
  const cuff = { x: sh.x + (pose.elbow.x - sh.x) * reach, y: sh.y + (pose.elbow.y - sh.y) * reach };
  if (!far) fillPath(ctx, C.shirtShade, () => limbPath(ctx, sh, cuff, 17, 16));
  fillPath(ctx, cloth, () => limbPath(ctx, sh, cuff, 15, 14.5));
  fillPath(ctx, far ? C.shirtShade : C.cuff, () => limbPath(ctx, { x: cuff.x * 0.93 + sh.x * 0.07, y: cuff.y * 0.93 + sh.y * 0.07 }, cuff, 14.5, 14.5));
}

// ---------------------------------------------------------------------------
// The mundu's construction, in cloth points. A Kerala mundu is one long
// rectangle wrapped round the waist: the outer layer overlaps at the front,
// its free edge runs from the waist to the hem, and a border runs along that
// edge and along the hem. Everything here is built from the simulated cloth
// points, so the border and folds move with the cloth and cannot detach.
// ---------------------------------------------------------------------------
export function munduGeometry(cloth) {
  const o = cloth.outline();
  return {
    back: o.back,                              // waist to hem
    front: o.front,                            // waist to hem
    hem: o.hem.slice().reverse(),              // front to back
    wrapEdge: o.inner[o.inner.length - 1],     // the outer layer's free edge, waist to hem
    inner: o.inner,
    waist: [o.back[0], o.front[0]],
  };
}

// Smooth curve through points (quadratic midpoints), continuing the path.
function curveThrough(ctx, pts) {
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
}

function drawMundu(ctx, cloth, C, rim, state) {
  const g = munduGeometry(cloth);
  const folded = state === 'folded';
  const outline = () => {
    ctx.moveTo(g.back[0].x, g.back[0].y);
    ctx.lineTo(g.front[0].x, g.front[0].y);
    curveThrough(ctx, g.front);
    // the hem dips a little between chains, like hanging cloth
    for (let i = 1; i < g.hem.length; i++) {
      const a = g.hem[i - 1], b = g.hem[i];
      ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.8, b.x, b.y);
    }
    curveThrough(ctx, g.back.slice().reverse());
    ctx.closePath();
  };
  fillPath(ctx, C.mundu, outline);

  ctx.save();
  ctx.beginPath(); outline(); ctx.clip();
  // the back of the cloth turns away from the light
  const bx = g.back[3].x, fx = g.front[3].x;
  const sg = ctx.createLinearGradient(bx - 2, 0, fx, 0);
  sg.addColorStop(0, C.munduShade);
  sg.addColorStop(0.45, C.mundu);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = sg;
  ctx.fillRect(bx - 10, g.waist[0].y - 4, fx - bx + 20, 220);
  ctx.globalAlpha = 1;

  // the outer layer overlaps at the front: a soft shadow just behind its
  // free edge, then the layer itself on top
  const edge = g.wrapEdge.slice(1);
  ctx.strokeStyle = C.munduShade;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(edge[0].x - 1.5, edge[0].y);
  curveThrough(ctx, edge.map((p) => ({ x: p.x - 1.5, y: p.y })));
  ctx.stroke();
  ctx.globalAlpha = 1;
  fillPath(ctx, C.mundu, () => {
    ctx.moveTo(edge[0].x, edge[0].y);
    curveThrough(ctx, edge);
    ctx.lineTo(g.hem[0].x, g.hem[0].y);
    ctx.lineTo(g.front[g.front.length - 1].x, g.front[g.front.length - 1].y);
    curveThrough(ctx, g.front.slice(1).reverse());
    ctx.closePath();
  });

  // a few broad folds, following the cloth: one long fold in the body of
  // the cloth; when folded, the gathered cloth adds two shorter diagonal
  // folds running back from the tuck
  ctx.strokeStyle = C.munduShade;
  ctx.lineWidth = 1.3;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  const body = g.inner[0].slice(Math.floor(g.inner[0].length * 0.35));
  ctx.moveTo(body[0].x, body[0].y);
  curveThrough(ctx, body);
  if (folded) {
    const w = g.waist[1], b0 = g.back[2], b1 = g.back[3];
    ctx.moveTo(w.x - 4, w.y + 7);
    ctx.quadraticCurveTo((w.x + b0.x) / 2, w.y + 9, b0.x + 6, b0.y + 4);
    ctx.moveTo(w.x - 2, w.y + 15);
    ctx.quadraticCurveTo((w.x + b1.x) / 2 + 3, w.y + 20, b1.x + 8, b1.y + 2);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // the border: along the hem and up the outer layer's free edge, drawn as
  // part of the cloth (inside its outline)
  ctx.strokeStyle = C.kasavu;
  ctx.lineCap = 'butt';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(g.hem[0].x, g.hem[0].y - 2);
  curveThrough(ctx, g.hem.map((p) => ({ x: p.x, y: p.y - 2 })));
  ctx.moveTo(edge[edge.length - 1].x + 1.6, edge[edge.length - 1].y);
  curveThrough(ctx, edge.slice().reverse().map((p) => ({ x: p.x + 1.6, y: p.y })));
  ctx.stroke();
  ctx.lineCap = 'round';

  // waistband: the rolled top of the cloth, thicker when it is folded up,
  // with a small tuck at the front where it is secured
  const [wb, wf] = g.waist;
  ctx.strokeStyle = C.munduShade;
  ctx.lineWidth = folded ? 7 : 4.5;
  ctx.beginPath();
  ctx.moveTo(wb.x - 2, wb.y + 1);
  ctx.quadraticCurveTo((wb.x + wf.x) / 2, wb.y + 3, wf.x + 2, wf.y + 1);
  ctx.stroke();
  ctx.strokeStyle = C.mundu;
  ctx.lineWidth = folded ? 3.5 : 2;
  ctx.stroke();
  fillPath(ctx, C.munduShade, () => {
    ctx.moveTo(wf.x - 7, wf.y + 2);
    ctx.quadraticCurveTo(wf.x - 1, wf.y + (folded ? 16 : 11), wf.x + 2, wf.y + 2);
    ctx.closePath();
  });
  ctx.restore();
  rimLight(ctx, rim, outline, 2.5);
}

// pose: { phase, sweep, stride, bob, armSwing, fabric, wind, time, motion, rim }
// phase advances 2π per gait cycle (two steps). sweep is how far a planted
// foot travels back during stance, in local units, which keeps it fixed on
// the ground. motion is an optional CharacterMotion (springs); rim is
// { dir, alpha, color } for the sun-side rim light.
export function drawCharacter(ctx, x, y, scale, pose, C) {
  const p = characterPose(pose.motion?.arms.near.a ? { ...pose, arms: pose.motion.arms } : pose);
  const { by, hip, sh, shF, near, far, armN, armF, lean } = p;
  // without a running simulation (tests, one-off renders) settle a cloth for this pose
  let motion = pose.motion;
  if (!motion || !motion.cloth.pts) {
    motion = new CharacterMotion();
    motion.update(0, pose, pose.wind || 0, pose.time || 0, pose.fabric ?? 1, { length: pose.munduLength });
  }
  const rim = pose.rim;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // upper body leans forward about the hip
  const leanIn = () => { ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(lean); ctx.translate(-hip.x, -hip.y); };

  // far side
  leanIn();
  drawArm(ctx, shF, armF, C, true, null);
  ctx.restore();
  drawLeg(ctx, hip, far, C.skinShade, null, true, C.sandal);
  drawLeg(ctx, hip, near, C.skin, rim, true, C.sandal);

  drawMundu(ctx, motion.cloth, C, rim, motion.cloth.state);

  leanIn();
  // loose shirt, untucked over the mundu. The back curves (upper back round,
  // small of the back in), the chest is fuller than the belly.
  const tail = motion.tail;
  const loose = (C.loose ?? 1) - 1;
  const build = C.build ?? 1;
  // build widens the torso about the spine
  ctx.save();
  ctx.scale(build, 1);
  const torsoBuild = () => {
    ctx.moveTo(-9, -224 + by);
    ctx.bezierCurveTo(-24, -214 + by, -25, -186 + by, -18, -164 + by);
    ctx.quadraticCurveTo(-17 - loose * 4, -146 + by, -23 - tail - loose * 8, -121 + by); // hangs over the seat
    ctx.quadraticCurveTo(-1, -115 + by + loose * 2, 22 + loose * 6, -124 + by);
    ctx.quadraticCurveTo(19, -140 + by, 20, -156 + by);
    ctx.bezierCurveTo(27, -178 + by, 25, -206 + by, 15, -224 + by);
    ctx.quadraticCurveTo(3, -232 + by, -9, -224 + by);
    ctx.closePath();
  };
  fillPath(ctx, C.shirt, torsoBuild);
  // shade the back half and a crease where the arm swings
  ctx.save();
  ctx.beginPath(); torsoBuild(); ctx.clip();
  ctx.globalAlpha = 0.5;
  fillPath(ctx, C.shirtShade, () => {
    ctx.moveTo(-30, -235 + by);
    ctx.lineTo(-4, -235 + by);
    ctx.bezierCurveTo(-13, -200 + by, -6, -160 + by, -9, -112 + by);
    ctx.lineTo(-30, -112 + by);
    ctx.closePath();
  });
  ctx.globalAlpha = 1;
  ctx.restore();
  rimLight(ctx, rim, torsoBuild, 3.5);
  ctx.strokeStyle = C.shirtShade;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); // placket
  ctx.moveTo(15, -216 + by);
  ctx.quadraticCurveTo(20, -180 + by, 16, -127 + by);
  ctx.stroke();
  // folds from under the arm towards the waist: they swing with the arm and
  // pull tighter on the side the arm is reaching back
  const armA = Math.atan2(armN.elbow.x - sh.x, armN.elbow.y - sh.y);
  const pull = clamp(-armA * 2.2, -1, 1); // >0 when the arm is back
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const sy = -196 + i * 9 + by;
    const ex = -10 + i * 7 + pull * 9;
    const ey = -146 + i * 7 + by + Math.abs(pull) * 3;
    ctx.moveTo(sh.x - 6 + i * 2, sy);
    ctx.quadraticCurveTo((sh.x + ex) / 2 - 4 - pull * 3, (sy + ey) / 2 + 2, ex, ey);
  }
  ctx.moveTo(-14 + tail * 0.4, -134 + by); // a soft blouse at the waist
  ctx.quadraticCurveTo(-3, -129 + by + tail * 0.3, 8, -132 + by);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore(); // build

  // near arm over the torso
  drawArm(ctx, sh, armN, C, false, rim);

  // neck, tapering into the shoulders, and head. The head is held steadier
  // than the body and tilts back against the lean so the gaze stays level.
  const hb = -by * 0.45;
  ctx.save();
  ctx.translate(3, hb);
  const neckBuild = () => {
    ctx.moveTo(-4, -236 + by);
    ctx.lineTo(7, -236 + by);
    ctx.quadraticCurveTo(8, -226 + by, 14, -221 + by);
    ctx.lineTo(-9, -221 + by);
    ctx.quadraticCurveTo(-4, -226 + by, -4, -236 + by);
    ctx.closePath();
  };
  fillPath(ctx, C.skinShade, neckBuild);
  ctx.translate(4, -243 + by);
  ctx.rotate(-lean * 0.8);
  ctx.translate(-4, 243 - by);
  const hy = by;
  const headBuild = () => {
    // a slightly egg-shaped skull, deeper at the back, with a jaw line
    ctx.moveTo(-12, -244 + hy);
    ctx.bezierCurveTo(-13, -262 + hy, 14, -265 + hy, 18, -248 + hy);
    ctx.lineTo(23, -239 + hy); // nose
    ctx.lineTo(19, -236 + hy);
    ctx.quadraticCurveTo(19, -229 + hy, 14, -226 + hy);
    ctx.quadraticCurveTo(4, -224 + hy, -2, -230 + hy);
    ctx.quadraticCurveTo(-11, -234 + hy, -12, -244 + hy);
    ctx.closePath();
  };
  fillPath(ctx, C.skin, headBuild);
  rimLight(ctx, rim, headBuild, 2.2);
  fillPath(ctx, C.skinShade, () => ctx.ellipse(-1, -241 + hy, 3.2, 4.4, 0, 0, Math.PI * 2)); // ear
  if (C.beardOn !== false) fillPath(ctx, C.beard, () => { // beard along the jaw
    ctx.moveTo(-1, -238 + hy);
    ctx.quadraticCurveTo(0, -225 + hy, 10, -223 + hy);
    ctx.quadraticCurveTo(19, -225 + hy, 20, -233 + hy);
    ctx.lineTo(17, -235 + hy);
    ctx.quadraticCurveTo(10, -231 + hy, 4, -237 + hy);
    ctx.closePath();
  });
  fillPath(ctx, C.hair, () => { // short hair
    ctx.moveTo(17, -251 + hy);
    ctx.quadraticCurveTo(11, -264 + hy, -2, -262 + hy);
    ctx.quadraticCurveTo(-15, -258 + hy, -13.5, -243 + hy);
    ctx.quadraticCurveTo(-12.5, -235 + hy, -8, -232 + hy);
    ctx.lineTo(-5, -238 + hy);
    ctx.quadraticCurveTo(-3, -251 + hy, 8, -253 + hy);
    ctx.closePath();
  });
  ctx.globalAlpha = 0.7;
  fillPath(ctx, C.hair, () => ctx.arc(13.5, -245 + hy, 1.3, 0, Math.PI * 2)); // eye
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.restore(); // lean
  ctx.restore();
}
