import { css, tint, hexToRgb, clamp, lerp } from './util.js';
import { MunduCloth, MUNDU_LENGTHS } from './mundu.js';

// Local coordinates: origin at the walking line under the body, facing +x,
// y negative is up. Total height is ~262 units at scale 1.
const BASE = {
  shirt: hexToRgb('#7b4a2c'), shirtShade: hexToRgb('#5c3620'), cuff: hexToRgb('#95603f'),
  skin: hexToRgb('#8e5c3d'), skinShade: hexToRgb('#6b4029'),
  hair: hexToRgb('#1c1613'), beard: hexToRgb('#2b1f18'),
  mundu: hexToRgb('#f3efe4'), munduShade: hexToRgb('#d4cebe'), kasavu: hexToRgb('#c6a24d'),
};

const LEN = { thigh: 64, shin: 66, upper: 50, fore: 46 };
const STANCE_REACH = (64 + 66) * 0.98; // hip to ankle on a planted, nearly straight leg
const HIP_TOP = -8 - STANCE_REACH;     // hip height over a planted foot (ankle at -8)
const HIP_Y = HIP_TOP;
const SHOULDER = { x: 3, y: -212 };
const ANKLE_H = 8; // ankle height above the sole

// Foot outline around the ankle, foot flat on the ground (sole at y = ANKLE_H).
const HEEL = { x: -7, y: ANKLE_H };
const TOE = { x: 17, y: ANKLE_H };
const FOOT = [[-4, -4], [-8, 2], [-7, ANKLE_H], [18, ANKLE_H], [17, 4.5], [8, 1], [3, -3]];

// Gait timing. A foot is on the ground for 60% of the cycle (real walking is
// about 60/40), so both feet are down for a moment after each contact.
export const STANCE = 0.6;
const HEEL_STRIKE = 0.12; // share of stance spent rolling from heel to flat
const TOE_OFF = 0.72;     // share of stance where the heel starts to lift
const HEEL_UP = 0.5;      // foot pitch at toe-off (radians, heel up)
const TOE_UP = -0.22;     // foot pitch at heel strike (radians, toe up)
const FOOT_AHEAD = 3;     // planted feet sit slightly ahead of the hips

const smoothstep = (t) => t * t * (3 - 2 * t);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

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
  const flatX = half + FOOT_AHEAD - 2 * half * s; // ankle x if the foot were flat
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

// Where this foot should be. u: 0..1 gait position for this leg
// (0 = heel strike, leg forward). half: half the stance sweep. lift: knee lift.
function footTarget(u, half, lift) {
  if (u < STANCE) return { ...stanceFoot(u / STANCE, half), planted: true };
  // swing: carry the foot forward on a low arc from toe-off to the next heel strike
  const t = (u - STANCE) / (1 - STANCE);
  const a = stanceFoot(1, half), b = stanceFoot(0, half);
  const h = (6 + 12 * lift) * Math.pow(Math.sin(Math.PI * t), 0.8);
  return {
    ankle: { x: lerp(a.ankle.x, b.ankle.x, easeInOut(t)), y: lerp(a.ankle.y, b.ankle.y, t) - h },
    th: lerp(HEEL_UP, TOE_UP, smoothstep(t)) + 0.25 * Math.sin(Math.PI * t) * lift,
    pin: null, pinKind: null, planted: false,
  };
}

function legPose(foot, hip) {
  const { knee, ankle } = solveLeg(hip, foot.ankle);
  return { knee, ankle, footAngle: foot.th, pin: foot.pin, pinKind: foot.pinKind, planted: foot.planted };
}

// Heel and toe of a solved leg (after IK), in local units.
export function footPoints(leg) {
  return { heel: add(leg.ankle, rot(HEEL, leg.footAngle)), toe: add(leg.ankle, rot(TOE, leg.footAngle)) };
}

function armPose(phase, swing, shoulder) {
  // arms swing opposite to the leg on the same side; the forearm trails a
  // little behind the upper arm (follow-through)
  const ua = -0.36 * swing * Math.sin(phase);
  const elbow = seg(shoulder, ua, LEN.upper);
  const lag = phase - 0.55;
  const fa = ua + 0.2 + 0.3 * swing * Math.max(0, -Math.sin(lag)) - 0.08 * swing * Math.sin(lag);
  const hand = seg(elbow, fa, LEN.fore);
  return { elbow, hand, fa };
}

export function characterColors(P) {
  const k = P.charBrightness;
  const out = {};
  for (const [key, c] of Object.entries(BASE)) out[key] = css(tint(c, P.charTint, k));
  return out;
}

// Joint positions for a pose, in local units (origin on the walking line).
// Shared by the renderer, the secondary-motion springs, grass parting and
// the tests.
// pose: { phase, sweep, stride, bob, armSwing }
export function characterPose(pose) {
  const ph = pose.phase;
  const u = (((ph / (Math.PI * 2)) % 1) + 1) % 1;
  const half = Math.max(0, pose.sweep || 0) / 2;
  const nearFoot = footTarget(u, half, pose.stride);
  const farFoot = footTarget((u + 0.5) % 1, half, pose.stride);
  // Hip height comes from the planted legs (an inverted pendulum): as high
  // as the nearly straight stance leg allows, so it rises over the foot and
  // dips when both feet are down. bob scales that motion.
  let hipY = HIP_TOP;
  for (const f of [nearFoot, farFoot]) {
    if (!f.planted) continue;
    const dx = f.ankle.x;
    hipY = Math.max(hipY, f.ankle.y - Math.sqrt(Math.max(0, STANCE_REACH * STANCE_REACH - dx * dx)));
  }
  const by = (hipY - HIP_TOP) * pose.bob;
  const hip = { x: 0, y: HIP_TOP + by };
  const near = legPose(nearFoot, hip);
  const far = legPose(farFoot, hip);
  // the near shoulder moves forward as the near arm swings forward, against
  // the hips (counter-rotation seen from the side)
  const armPh = ph + Math.PI / 2;
  const twist = 2.2 * pose.armSwing * -Math.sin(armPh);
  const sh = { x: SHOULDER.x + twist, y: SHOULDER.y + by };
  const shF = { x: SHOULDER.x - 3 - twist * 0.6, y: SHOULDER.y + 1 + by };
  const armN = armPose(armPh, pose.armSwing, sh);
  const armF = armPose(armPh + Math.PI, pose.armSwing, shF);
  // slight forward lean that deepens at push-off; the head counters it
  const lean = 0.045 + 0.012 * Math.sin(Math.PI * 4 * (u - 0.1));
  return { u, by, hip, sh, shF, near, far, armN, armF, lean };
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
  constructor() { this.cloth = new MunduCloth(); this.tail = 0; this.tailV = 0; }

  update(dt, pose, wind, time, fabric, opts = {}) {
    const p = characterPose(pose);
    const length = MUNDU_LENGTHS[opts.length] || MUNDU_LENGTHS.folded;
    if (!this.cloth.pts || this.cloth.length !== length) {
      this.cloth.reset(waistY(p), length);
      dt = 1 / 60;
      for (let i = 0; i < 40; i++) this.stepCloth(dt, p, wind, time, fabric, opts);
      return;
    }
    if (dt <= 0) return;
    this.stepCloth(Math.min(dt, 1 / 30), p, wind, time, fabric, opts);
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

function drawLeg(ctx, hip, leg, color, rim, thigh) {
  const parts = [
    // shin with the calf on the back of the leg (-x side)
    () => limbPath(ctx, leg.knee, leg.ankle, 11.5, 6.5, 2.2, leg.knee.y < leg.ankle.y ? 1 : -1),
    () => footPath(ctx, leg.ankle, leg.footAngle),
  ];
  if (thigh) parts.unshift(() => limbPath(ctx, hip, leg.knee, 17, 11.5));
  // each part on its own: overlapping subpaths with opposite winding would cut holes
  parts.forEach((b) => fillPath(ctx, color, b));
  rimLight(ctx, rim, parts, 2);
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
  // short loose sleeve, wider at the cuff
  const cuff = { x: sh.x + (pose.elbow.x - sh.x) * 0.92, y: sh.y + (pose.elbow.y - sh.y) * 0.92 };
  if (!far) fillPath(ctx, C.shirtShade, () => limbPath(ctx, sh, cuff, 17, 16));
  fillPath(ctx, cloth, () => limbPath(ctx, sh, cuff, 15, 14.5));
  fillPath(ctx, far ? C.shirtShade : C.cuff, () => limbPath(ctx, { x: cuff.x * 0.93 + sh.x * 0.07, y: cuff.y * 0.93 + sh.y * 0.07 }, cuff, 14.5, 14.5));
}

// pose: { phase, sweep, stride, bob, armSwing, fabric, wind, time, motion, rim }
// phase advances 2π per gait cycle (two steps). sweep is how far a planted
// foot travels back during stance, in local units, which keeps it fixed on
// the ground. motion is an optional CharacterMotion (springs); rim is
// { dir, alpha, color } for the sun-side rim light.
export function drawCharacter(ctx, x, y, scale, pose, C) {
  const p = characterPose(pose);
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
  drawLeg(ctx, hip, far, C.skinShade, null, true);
  drawLeg(ctx, hip, near, C.skin, rim, true);

  // mundu: the cloth simulation's outline, filled opaque. Shading and folds
  // follow the cloth itself, never the legs.
  const cloth = motion.cloth.outline();
  const smoothThrough = (pts, first) => {
    if (first) ctx.lineTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  };
  const hemFrontToBack = cloth.hem.slice().reverse();
  const munduBuild = () => {
    ctx.moveTo(cloth.back[0].x, cloth.back[0].y);
    ctx.lineTo(cloth.front[0].x, cloth.front[0].y);
    smoothThrough(cloth.front, false);
    // the hem dips a little between chains, like hanging cloth
    for (let i = 1; i < hemFrontToBack.length; i++) {
      const a = hemFrontToBack[i - 1], b = hemFrontToBack[i];
      ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.8, b.x, b.y);
    }
    smoothThrough(cloth.back.slice().reverse(), false);
    ctx.closePath();
  };
  fillPath(ctx, C.mundu, munduBuild);
  ctx.save();
  ctx.beginPath(); munduBuild(); ctx.clip();
  // turning away from the light at the back edge
  const bx = cloth.back[3].x, fx = cloth.front[3].x;
  const sg = ctx.createLinearGradient(bx - 2, 0, fx, 0);
  sg.addColorStop(0, C.munduShade);
  sg.addColorStop(0.4, C.mundu);
  sg.addColorStop(1, C.mundu);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = sg;
  ctx.fillRect(bx - 10, cloth.back[0].y - 4, fx - bx + 20, 200);
  ctx.globalAlpha = 1;
  // two soft folds hang from below the waistband: one long one where the
  // cloth wraps over, one short one near the back; both follow the cloth
  ctx.strokeStyle = C.munduShade;
  ctx.lineWidth = 1.3;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  const wrap = cloth.inner[cloth.inner.length - 1].slice(1);
  ctx.moveTo(wrap[0].x, wrap[0].y);
  smoothThrough(wrap, false);
  const short = cloth.inner[0].slice(Math.floor(cloth.inner[0].length * 0.45));
  ctx.moveTo(short[0].x, short[0].y);
  smoothThrough(short, false);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
  rimLight(ctx, rim, munduBuild, 2.5);
  // kasavu border along the hem
  ctx.strokeStyle = C.kasavu;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(hemFrontToBack[0].x - 1, hemFrontToBack[0].y - 2);
  for (let i = 1; i < hemFrontToBack.length; i++) {
    const a = hemFrontToBack[i - 1], b = hemFrontToBack[i];
    ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.5, b.x + (i === hemFrontToBack.length - 1 ? 1 : 0), b.y - 2);
  }
  ctx.stroke();

  leanIn();
  // loose shirt, untucked over the mundu. The back curves (upper back round,
  // small of the back in), the chest is fuller than the belly.
  const tail = motion.tail;
  const torsoBuild = () => {
    ctx.moveTo(-9, -224 + by);
    ctx.bezierCurveTo(-24, -214 + by, -25, -186 + by, -18, -164 + by);
    ctx.quadraticCurveTo(-17, -146 + by, -23 - tail, -121 + by); // hangs over the seat
    ctx.quadraticCurveTo(-1, -115 + by, 22, -124 + by);
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
  ctx.moveTo(-14, -142 + by); // drape creases at the waist
  ctx.quadraticCurveTo(-4, -138 + by, 6, -142 + by);
  ctx.moveTo(-10, -132 + by);
  ctx.quadraticCurveTo(0, -128 + by, 10, -131 + by);
  ctx.stroke();

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
  fillPath(ctx, C.beard, () => { // beard along the jaw
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
