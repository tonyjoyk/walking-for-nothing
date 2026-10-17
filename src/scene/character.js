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
  // standing still (the greeting): legs straighten and the feet come in
  // under the hips, slightly apart
  const stand = pose.stand || 0;
  const standHip = -8 - legSpan(4 * DEG);
  const by = lerp((hipY - HIP_TOP) * pose.bob, standHip - HIP_TOP, stand);
  const hip = { x: 0, y: HIP_TOP + by };
  const nearFoot = footTarget(u, half, pose.stride, hip);
  const farFoot = footTarget(uFar, half, pose.stride, hip);
  if (stand > 0) {
    for (const [f, x] of [[nearFoot, 5], [farFoot, -3]]) {
      f.ankle = { x: lerp(f.ankle.x, x, stand), y: lerp(f.ankle.y, -ANKLE_H, stand) };
      f.th = lerp(f.th, 0, stand);
    }
  }
  const near = legPose(nearFoot, hip);
  const far = legPose(farFoot, hip);
  // the near shoulder moves forward as the near arm swings forward, against
  // the hips (counter-rotation seen from the side)
  const twist = 2.2 * pose.armSwing * Math.min(1.2, (pose.sweep || 0) / 80) * (pose.swingScale ?? 1) * (1 - stand) * Math.cos(ph);
  const sh = { x: SHOULDER.x + twist, y: SHOULDER.y + by };
  const shF = { x: SHOULDER.x - 3 - twist * 0.6, y: SHOULDER.y + 1 + by };
  // arm swing grows with step length and relaxes to a hang when standing
  const swing = pose.armSwing * Math.min(1.2, (pose.sweep || 0) / 80) * (pose.swingScale ?? 1) * (1 - stand);
  const tN = armTargets(u, swing), tF = armTargets(uFar, swing);
  const armN = armFromAngles(sh, pose.arms?.near.a ?? tN);
  const armF = armFromAngles(shF, pose.arms?.far.a ?? tF);
  // slight forward lean that deepens at push-off; the head counters it
  const lean = (0.045 + 0.012 * Math.sin(Math.PI * 4 * (u - 0.1))) * (1 - stand * 0.85);
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
  // turning towards the viewer the foot shortens (footScale) and its front
  // view, a small rounded shape, takes over (front)
  const fs = leg.footScale ?? 1, front = leg.front ?? 0;
  const footSpace = (draw) => {
    ctx.save();
    ctx.translate(leg.ankle.x, leg.ankle.y); ctx.scale(fs, 1); ctx.translate(-leg.ankle.x, -leg.ankle.y);
    draw();
    ctx.restore();
  };
  const shin = () => limbPath(ctx, leg.knee, leg.ankle, 11.5, 6.5, 2.2, leg.knee.y < leg.ankle.y ? 1 : -1);
  const parts = [shin];
  if (thigh) parts.unshift(() => limbPath(ctx, hip, leg.knee, 17, 11.5));
  // each part on its own: overlapping subpaths with opposite winding would cut holes
  parts.forEach((b) => fillPath(ctx, color, b));
  footSpace(() => fillPath(ctx, color, () => footPath(ctx, leg.ankle, leg.footAngle)));
  if (front > 0.3) {
    ctx.globalAlpha = (front - 0.3) / 0.7;
    fillPath(ctx, color, () => ctx.ellipse(leg.ankle.x, leg.ankle.y + ANKLE_H - 2.5, 4.6, 3.2, 0, 0, Math.PI * 2));
    ctx.globalAlpha = 1;
  }
  rimLight(ctx, rim, parts, 2);
  if (sandal) {
    // a dark sole under the foot and one strap over the instep
    footSpace(() => {
      const P = (x, y) => add(leg.ankle, rot({ x, y }, leg.footAngle));
      const h = P(-7.5, ANKLE_H + 0.8), t = P(18.5, ANKLE_H + 0.8);
      ctx.strokeStyle = sandal;
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(t.x, t.y); ctx.stroke();
      const a = P(8, 1.5), b = P(11, ANKLE_H);
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
  }
}

// A tapered band along a polyline (shoulder, elbow, wrist), with widths per
// point. Normals are averaged at inner points, so a bent elbow is a smooth
// change of direction, not a joint. capStart rounds the first end; the last
// end is cut square (a sleeve hem, or where the hand takes over).
function taperedPath(ctx, pts, widths, capStart = true) {
  const n = pts.length;
  const normals = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
  const side = (s) => pts.map((p, i) => ({ x: p.x + normals[i].x * widths[i] * 0.5 * s, y: p.y + normals[i].y * widths[i] * 0.5 * s }));
  const L = side(1), R = side(-1);
  ctx.moveTo(L[0].x, L[0].y);
  for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(L[i].x, L[i].y, (L[i].x + L[i + 1].x) / 2, (L[i].y + L[i + 1].y) / 2);
  ctx.lineTo(L[n - 1].x, L[n - 1].y);
  ctx.lineTo(R[n - 1].x, R[n - 1].y);
  for (let i = n - 2; i > 0; i--) ctx.quadraticCurveTo(R[i].x, R[i].y, (R[i].x + R[i - 1].x) / 2, (R[i].y + R[i - 1].y) / 2);
  ctx.lineTo(R[0].x, R[0].y);
  if (capStart) {
    // round the start outwards (away from the limb), from the right side back to the left
    const ang = Math.atan2(normals[0].y, normals[0].x);
    ctx.arc(pts[0].x, pts[0].y, widths[0] / 2, ang + Math.PI, ang, true);
  }
  ctx.closePath();
}

const lerpPt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// A small hand, continuing the forearm: palm, slightly curled fingers and a
// hint of thumb on the forward side.
function handPath(ctx, wrist, dir) {
  const c = Math.cos(dir), s = Math.sin(dir);
  const P = (u, v) => ({ x: wrist.x + c * u - s * v, y: wrist.y + s * u + c * v }); // u along, v across
  const pts = [P(-1, -3.1), P(5, -3.6), P(10, -2.6), P(12, -0.6), P(11.2, 1.6), P(8, 3), P(5.5, 4.4), P(3.5, 3.6), P(1.5, 3.4), P(-1, 3.1)];
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.closePath();
}

// The arm is one continuous tapered shape from shoulder to wrist (no joint
// discs), then a small hand. The sleeve is a tapered band over the upper
// arm, cut square at a rolled cuff.
function drawArm(ctx, sh, pose, C, far, rim, frontness = 0) {
  const skin = far ? C.skinShade : C.skin;
  const cloth = far ? C.shirtShade : C.shirt;
  const { elbow, hand } = pose;
  const dir = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
  const armPts = [sh, lerpPt(sh, elbow, 0.55), elbow, lerpPt(elbow, hand, 0.5), hand];
  const arm = () => taperedPath(ctx, armPts, [12.5, 11, 9, 7.6, 6], false); // the sleeve covers its top
  const palm = () => handPath(ctx, hand, dir);
  fillPath(ctx, skin, arm);
  fillPath(ctx, skin, palm);
  if (!far) rimLight(ctx, rim, arm, 1.6);

  // sleeve: short, to the elbow (rolled), or full length
  const long = C.sleeve === 'long';
  const reach = C.sleeve === 'short' ? 0.62 : 0.94;
  const cuffAt = long ? lerpPt(elbow, hand, 0.9) : lerpPt(sh, elbow, reach);
  const sleevePts = long ? [sh, lerpPt(sh, elbow, 0.55), elbow, cuffAt] : [sh, lerpPt(sh, cuffAt, 0.5), cuffAt];
  const sleeveW = long ? [16, 15, 13, 11.5] : [16, 15, 15.5];
  // the sleeve starts inside the shoulder, so its square top is hidden by
  // the torso and only its sides and cuff show
  // (from the front the sleeve shows its rounded shoulder and needs no outline)
  if (!far && frontness < 0.3) {
    ctx.globalAlpha = 1 - frontness / 0.3;
    fillPath(ctx, C.shirtShade, () => taperedPath(ctx, sleevePts, sleeveW.map((w) => w + 2), false));
    ctx.globalAlpha = 1;
  }
  fillPath(ctx, cloth, () => taperedPath(ctx, sleevePts, sleeveW, far || frontness > 0.15));
  // the rolled cuff: a narrow band just above the sleeve's end
  const k = sleevePts.length - 1;
  const cuffStart = lerpPt(sleevePts[k - 1], sleevePts[k], 0.78);
  fillPath(ctx, far ? C.shirtShade : C.cuff, () => taperedPath(ctx, [cuffStart, sleevePts[k]], [sleeveW[k] + 0.6, sleeveW[k] + 0.6], false));
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
// ---------------------------------------------------------------------------
// Turning to face the screen (the greeting, docs/spec-greeting.md).
// Outlines are lists of path commands. Each profile outline has a front-view
// twin with exactly the same commands, so turning is a point-by-point blend:
// the nose bump flattens into the oval face, the shirt widens into the
// shoulders. At turn 0 the commands are the profile ones, so nothing pops.
// Limbs and features are placed in simple 3D (forward, sideways) and
// projected: x = forward·cos(a) + (centre - sideways)·sin(a).
// ---------------------------------------------------------------------------
function tracePath(ctx, side, front, t, dy = 0) {
  const L = (i, j) => side[i][j] + (front[i][j] - side[i][j]) * t;
  for (let i = 0; i < side.length; i++) {
    const c = side[i][0];
    if (c === 'M') ctx.moveTo(L(i, 1), L(i, 2) + dy);
    else if (c === 'L') ctx.lineTo(L(i, 1), L(i, 2) + dy);
    else if (c === 'Q') ctx.quadraticCurveTo(L(i, 1), L(i, 2) + dy, L(i, 3), L(i, 4) + dy);
    else if (c === 'C') ctx.bezierCurveTo(L(i, 1), L(i, 2) + dy, L(i, 3), L(i, 4) + dy, L(i, 5), L(i, 6) + dy);
  }
  ctx.closePath();
}

const HEAD_SIDE = [
  ['M', -11, -236], ['C', -15, -246, -13, -262, 1, -264], ['C', 11, -265, 17, -258, 18, -251],
  ['Q', 19.5, -249, 18.6, -246.5], ['Q', 21.5, -242, 23.8, -238.6], ['Q', 22.6, -236.6, 20.2, -236.8],
  ['Q', 21.2, -234.5, 20.4, -233], ['Q', 21.4, -230, 19.6, -228], ['Q', 13, -225, 5, -227],
  ['Q', -1, -229, -3, -232], ['Q', -7, -233, -11, -236],
];
const HEAD_FRONT = [
  ['M', -6.5, -236], ['C', -11, -244, -10, -262, 4.5, -265], ['C', 15, -265, 19, -258, 18, -250],
  ['Q', 18.6, -248, 18.2, -246.5], ['Q', 18, -242, 17.6, -239.5], ['Q', 17.2, -237, 16.4, -235.5],
  ['Q', 15.8, -233.5, 14.8, -231.5], ['Q', 13.6, -228.5, 11, -227], ['Q', 8, -225.2, 4.5, -225.2],
  ['Q', 1, -225.2, -2, -227], ['Q', -6, -230, -6.5, -236],
];
const NECK_SIDE = [['M', -4, -236], ['L', 7, -236], ['Q', 8, -226, 14, -221], ['L', -9, -221], ['Q', -4, -226, -4, -236]];
const NECK_FRONT = [['M', -2, -236], ['L', 9, -236], ['Q', 9.5, -227, 17, -221], ['L', -10, -221], ['Q', -2.5, -227, -2, -236]];
const BEARD_SIDE = [
  ['M', 1.6, -245], ['Q', 4, -237, 11, -235.4], ['Q', 16, -234.6, 18.4, -236.6], ['Q', 21, -237.6, 22, -236.9],
  ['Q', 21.2, -235.4, 19.6, -235], ['Q', 21.6, -232, 21.2, -229.6], ['Q', 19.4, -224.6, 13, -224],
  ['Q', 5, -224.2, 0.5, -228.6], ['Q', -1.4, -236, 1.6, -245],
];
const BEARD_FRONT = [
  ['M', -7.5, -245], ['Q', -6.4, -237.4, -2, -235.9], ['Q', -0.4, -235.7, 1, -236.5], ['Q', 4.5, -238.4, 8, -236.5],
  ['Q', 9.4, -235.7, 11, -235.9], ['Q', 15.4, -237.4, 16.5, -245], ['Q', 18.6, -228.5, 9, -223.4],
  ['Q', 4.5, -222.2, 0, -223.4], ['Q', -9.6, -228.5, -7.5, -245],
];
const HAIR_SIDE = [
  ['M', 14.5, -255.5], ['Q', 15.5, -261, 9, -264.6], ['Q', 5, -266.8, 0.5, -265.4], ['Q', -4, -266, -8, -262.5],
  ['C', -14, -257, -15, -246, -12, -238.5], ['Q', -9, -238, -6.5, -240], ['Q', -4.5, -246, -2, -247.5],
  ['Q', 2.5, -250.5, 3.6, -246], ['Q', 6.5, -253.5, 14.5, -255.5],
];
const HAIR_FRONT = [
  ['M', 17.6, -247], ['Q', 19.4, -261, 9.5, -265.9], ['Q', 4.5, -267.8, -0.5, -265.9], ['Q', -5, -265, -7.6, -262],
  ['C', -10.6, -257, -10.2, -250, -8.8, -245.5], ['Q', -8.4, -244.6, -7.4, -246], ['Q', -6.2, -251.5, -2.6, -255],
  ['Q', 4.5, -258.2, 12, -255], ['Q', 16, -253, 17.6, -247],
];
function torsoShapes(by, loose, tail) {
  const side = [
    ['M', -9, -224], ['C', -24, -214, -25, -186, -18, -164], ['Q', -17 - loose * 4, -146, -23 - tail - loose * 8, -121],
    ['Q', -1, -115 + loose * 2, 22 + loose * 6, -124], ['Q', 19, -140, 20, -156], ['C', 27, -178, 25, -206, 15, -224],
    ['Q', 3, -232, -9, -224],
  ];
  const front = [
    ['M', -12, -227], ['C', -27, -225, -33, -205, -29, -178], ['Q', -24 - loose * 3, -150, -25 - tail - loose * 7, -121],
    ['Q', 2, -116 + loose * 2, 29 + loose * 7, -121], ['Q', 28 + loose * 3, -150, 33, -178], ['C', 37, -205, 31, -225, 16, -227],
    ['Q', 2, -231, -12, -227],
  ];
  return { side, front, by };
}
const BODY_CX = 2;   // the body's centre line in the front view
const HEAD_CX = 4.5; // the head's centre line (in head space)

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
  const tb = clamp(pose.turnBody || 0, 0, 1), th = clamp(pose.turnHead || 0, 0, 1);
  const smile = clamp(pose.smile || 0, 0, 1);
  const sb = Math.sin(tb * Math.PI / 2), cb = Math.cos(tb * Math.PI / 2);
  // project a profile point with a sideways offset (towards the viewer = +)
  const proj = (pt, side) => ({ x: pt.x * cb + (BODY_CX - side) * sb, y: pt.y });

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // upper body leans forward about the hip
  const leanIn = () => { ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(lean); ctx.translate(-hip.x, -hip.y); };
  // arms and legs, projected for the turn: his left side (near) moves to the
  // viewer's left, the right side comes round from behind
  const armPts = (s0, a, side) => {
    const out = (d) => side + Math.sign(side) * d * sb; // from the front, arms hang a little outward
    return { s: proj(s0, side), a: { elbow: proj(a.elbow, out(4)), hand: proj(a.hand, out(8)), fa: a.fa } };
  };
  const nArm = armPts(sh, armN, 25), fArm = armPts(shF, armF, -25);
  const legPts = (L, side) => ({ ...L, knee: proj(L.knee, side), ankle: proj(L.ankle, side), footScale: Math.max(0.3, cb), front: sb });
  const hipN = proj(hip, 8), hipF = proj(hip, -8);
  const farArmBehind = tb < 0.75;

  // far side
  if (farArmBehind) { leanIn(); drawArm(ctx, fArm.s, fArm.a, C, true, null, sb); ctx.restore(); }
  drawLeg(ctx, hipF, legPts(far, -8), C.skinShade, null, true, C.sandal);
  drawLeg(ctx, hipN, legPts(near, 8), C.skin, rim, true, C.sandal);

  // the mundu: the simulated cloth, morphed towards its front view
  drawMundu(ctx, tb > 0 ? munduTurned(motion.cloth, sb) : motion.cloth, C, rim, motion.cloth.state);

  leanIn();
  // loose shirt, untucked over the mundu. The back curves (upper back round,
  // small of the back in), the chest is fuller than the belly.
  const tail = motion.tail;
  const loose = (C.loose ?? 1) - 1;
  const build = C.build ?? 1;
  // build widens the torso about the spine
  ctx.save();
  ctx.scale(build, 1);
  const T = torsoShapes(by, loose, tail);
  const torsoBuild = () => tracePath(ctx, T.side, T.front, sb, by);
  fillPath(ctx, C.shirt, torsoBuild);
  // shade the back half (fades as he turns: from the front, a soft shade on his left)
  ctx.save();
  ctx.beginPath(); torsoBuild(); ctx.clip();
  ctx.globalAlpha = 0.5 * (1 - sb);
  fillPath(ctx, C.shirtShade, () => {
    ctx.moveTo(-30, -235 + by);
    ctx.lineTo(-4, -235 + by);
    ctx.bezierCurveTo(-13, -200 + by, -6, -160 + by, -9, -112 + by);
    ctx.lineTo(-30, -112 + by);
    ctx.closePath();
  });
  ctx.globalAlpha = 0.3 * sb;
  fillPath(ctx, C.shirtShade, () => { ctx.rect(-40, -240 + by, 22, 130); });
  ctx.globalAlpha = 1;
  ctx.restore();
  rimLight(ctx, rim, torsoBuild, 3.5);
  ctx.strokeStyle = C.shirtShade;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); // placket, moving to the centre of the chest as he turns
  const pl = (a, b) => a + (b - a) * sb;
  ctx.moveTo(pl(15, 3), -216 + by);
  ctx.quadraticCurveTo(pl(20, 3.5), -180 + by, pl(16, 3), -125 + by);
  ctx.stroke();
  if (sb > 0.05) { // the collar opening, seen from the front
    ctx.globalAlpha = sb;
    ctx.beginPath();
    ctx.moveTo(-7, -228 + by); ctx.lineTo(3, -213 + by); ctx.lineTo(13, -228 + by);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // folds from under the arm towards the waist: they swing with the arm and
  // pull tighter on the side the arm is reaching back
  const armA = Math.atan2(armN.elbow.x - sh.x, armN.elbow.y - sh.y);
  const pull = clamp(-armA * 2.2, -1, 1); // >0 when the arm is back
  ctx.globalAlpha = 0.7 * (1 - sb);
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

  // arms over the torso; the far arm joins once it has come round
  if (!farArmBehind) drawArm(ctx, fArm.s, fArm.a, C, true, null, sb);
  drawArm(ctx, nArm.s, nArm.a, C, false, rim, sb);

  // neck and head. The head is held steadier than the body and tilts back
  // against the lean so the gaze stays level. It turns ahead of the body.
  const hb = -by * 0.45;
  ctx.save();
  ctx.translate(3, hb);
  fillPath(ctx, C.skinShade, () => tracePath(ctx, NECK_SIDE, NECK_FRONT, (sb + th) / 2, by));
  ctx.translate(4, -243 + by);
  ctx.rotate(-lean * 0.8);
  ctx.translate(-4, 243 - by);
  drawHead(ctx, C, rim, by, th, smile);
  ctx.restore();

  ctx.restore(); // lean
  ctx.restore();
}

// The head at a turn of t (0 profile, 1 facing the screen) with a smile.
function drawHead(ctx, C, rim, hy, t, smile) {
  const s = Math.sin(t * Math.PI / 2), c = Math.cos(t * Math.PI / 2);
  // a feature at (forward, sideways) from the head's centre line
  const fx = (forward, side) => HEAD_CX + forward * c - side * s;
  const facing = (forward, side) => forward * s + side * c; // > 0: towards the viewer
  const headBuild = () => tracePath(ctx, HEAD_SIDE, HEAD_FRONT, t, hy);

  // the far ear peeks out from behind the head as it comes round
  if (s > 0.75) fillPath(ctx, C.skinShade, () => ctx.ellipse(fx(-5, -13.5), -242 + hy, 2.4, 3.6, -0.15, 0, Math.PI * 2));
  fillPath(ctx, C.skin, headBuild);
  // a quiet division of light: the back of the head and jaw in shade (in
  // profile); from the front, a soft shade down his left side
  ctx.save();
  ctx.beginPath(); headBuild(); ctx.clip();
  ctx.globalAlpha = 0.35 * (1 - s);
  fillPath(ctx, C.skinShade, () => {
    ctx.moveTo(-16, -268 + hy); ctx.lineTo(4, -268 + hy);
    ctx.quadraticCurveTo(2, -246 + hy, 9, -224 + hy);
    ctx.lineTo(-16, -224 + hy); ctx.closePath();
  });
  ctx.globalAlpha = 0.22 * s;
  fillPath(ctx, C.skinShade, () => ctx.ellipse(-6, -245 + hy, 7, 16, 0, 0, Math.PI * 2));
  // cheeks lift and warm as he smiles
  if (smile > 0 && s > 0.3) {
    ctx.globalAlpha = 0.07 * smile * s;
    fillPath(ctx, '#ffffff', () => {
      ctx.ellipse(fx(8, 6), -239.5 + hy - smile, 3.6, 2.2, 0, 0, Math.PI * 2);
      ctx.moveTo(fx(8, -6) + 3.6, -239.5 + hy - smile);
      ctx.ellipse(fx(8, -6), -239.5 + hy - smile, 3.6, 2.2, 0, 0, Math.PI * 2);
    });
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  rimLight(ctx, rim, headBuild, 2.2);
  // near ear: just in front of the back of the head in profile, at the edge from the front
  fillPath(ctx, C.skinShade, () => ctx.ellipse(fx(-5, 13.5), -242 + hy, 2.6, 3.8, 0.15, 0, Math.PI * 2));

  if (C.beardOn !== false) fillPath(ctx, C.beard, () => tracePath(ctx, BEARD_SIDE, BEARD_FRONT, t, hy));

  // mouth: comes into view as the face turns; a closed smile curves the
  // corners up and dips the middle a little
  const mouthA = clamp((s - 0.45) / 0.35, 0, 1);
  if (mouthA > 0) {
    const mc = fx(10, 0), w = 3.4 * s;
    const my = -233.4 + hy;
    ctx.globalAlpha = mouthA;
    ctx.strokeStyle = '#2a1712';
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(mc - w, my - 1.6 * smile);
    ctx.quadraticCurveTo(mc, my + 0.4 + 1.6 * smile, mc + w, my - 1.6 * smile);
    ctx.stroke();
    ctx.strokeStyle = C.skinShade; // the lower lip
    ctx.lineWidth = 1;
    ctx.globalAlpha = mouthA * 0.7;
    ctx.beginPath();
    ctx.moveTo(mc - w * 0.55, my + 1.6 + 0.6 * smile);
    ctx.quadraticCurveTo(mc, my + 2.3 + 1.2 * smile, mc + w * 0.55, my + 1.6 + 0.6 * smile);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  fillPath(ctx, C.hair, () => tracePath(ctx, HAIR_SIDE, HAIR_FRONT, t, hy));

  // eyes and brows: the near ones slide across; the far ones come into view
  // from behind the nose. Smiling, the lower lids rise a little.
  const eyeH = 0.9 * (1 - 0.45 * smile);
  const eye = (side, alpha) => {
    if (alpha <= 0) return;
    const ex = fx(9.9, side), ey = -245.6 + hy - 0.4 * smile;
    ctx.globalAlpha = 0.85 * alpha;
    fillPath(ctx, C.hair, () => ctx.ellipse(ex, ey, 1.2 + 0.1 * s, eyeH, 0.1 * c, 0, Math.PI * 2));
    ctx.strokeStyle = C.hair;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(ex - 2.8 * (0.6 + 0.4 * s), ey - 3.6);
    ctx.quadraticCurveTo(ex, ey - 4.8 - 0.3 * smile, ex + 2.8 * (0.6 + 0.4 * s), ey - 3.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  eye(4.3, 1);
  eye(-4.3, clamp(facing(9.9, -4.3) / 3, 0, 1));
  // a hint of the nose from the front: a soft line and the shadow beneath
  if (s > 0.4) {
    ctx.globalAlpha = (s - 0.4) / 0.6 * 0.6;
    ctx.strokeStyle = C.skinShade;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(fx(11, -1), -245 + hy);
    ctx.quadraticCurveTo(fx(12, -2), -240.5 + hy, fx(12, -1), -238.4 + hy);
    ctx.moveTo(fx(11, 2), -238 + hy);
    ctx.quadraticCurveTo(fx(12, 0), -237 + hy, fx(11, -2.4), -238 + hy);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// The cloth outline seen turning: each chain point moves towards its place
// in the front view (back edge to his left, front edge to his right, the
// wrapped edge just right of centre), keeping the simulated heights.
function munduTurned(cloth, s) {
  const P = cloth.pts;
  const n = P[0].length, C = P.length;
  const frontX = (c, k) => BODY_CX + (-21 + (42 * c) / (C - 1)) * (1 + 0.12 * (k / (n - 1)));
  const at = (c, k) => ({ x: P[c][k].x + (frontX(c, k) - P[c][k].x) * s, y: P[c][k].y });
  const chains = P.map((chain, c) => chain.map((_, k) => at(c, k)));
  const outline = {
    front: chains[C - 1], back: chains[0],
    hem: chains.map((ch) => ch[n - 1]), inner: chains.slice(1, -1),
  };
  return { state: cloth.state, pts: P, outline: () => outline };
}
