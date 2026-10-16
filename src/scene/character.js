import { css, tint, hexToRgb } from './util.js';

// Local coordinates: origin at the walking line under the body, facing +x,
// y negative is up. Total height is ~262 units at scale 1.
const BASE = {
  shirt: hexToRgb('#7b4a2c'), shirtShade: hexToRgb('#5c3620'), cuff: hexToRgb('#95603f'),
  skin: hexToRgb('#8e5c3d'), skinShade: hexToRgb('#6b4029'),
  hair: hexToRgb('#1c1613'), beard: hexToRgb('#2b1f18'),
  mundu: hexToRgb('#f3efe4'), munduShade: hexToRgb('#d4cebe'), kasavu: hexToRgb('#c6a24d'),
};

const LEN = { thigh: 64, shin: 64, upper: 50, fore: 46 };
const HIP_Y = -134;
const SHOULDER = { x: 3, y: -212 };

// Joint angle convention: 0 points straight down, positive swings forward (+x).
const seg = (o, a, l) => ({ x: o.x + Math.sin(a) * l, y: o.y + Math.cos(a) * l });

// Gait timing. A foot is on the ground for 60% of the cycle (real walking is
// about 60/40), so there is a short double-support moment at each contact.
export const STANCE = 0.6;
const PLANT_BEND = 0.06; // slight knee flex while the foot carries weight
const smoothstep = (t) => t * t * (3 - 2 * t);

// Hip swing that keeps a planted foot still on the ground. During stance the
// hip angle sweeps linearly from +reach to -reach, so the foot travels back at
// a constant rate that exactly cancels the body's forward motion. The swing
// phase eases the leg forward again with the knee folding.
// u: 0..1 gait position (0 = this foot touches down, leg fully forward).
function legPose(u, reachA, lift, hip) {
  let s, bend;
  if (u < STANCE) {
    s = 1 - 2 * (u / STANCE);
    bend = PLANT_BEND;
  } else {
    const t = (u - STANCE) / (1 - STANCE);
    s = -1 + 2 * smoothstep(t);
    bend = PLANT_BEND + 0.62 * lift * Math.pow(Math.sin(Math.PI * t), 1.2);
  }
  const a = reachA * s;
  const knee = seg(hip, a, LEN.thigh);
  const foot = seg(knee, a - bend, LEN.shin);
  return { knee, foot };
}

// Hip angle that makes one stance sweep the foot back by `sweep` units.
// Foot x = L1 sin(a) + L2 sin(a - b), so the stance sweep is
// 2 sin(A) (L1 + L2 cos b), which inverts directly.
export function reachForSweep(sweep) {
  const k = sweep / (2 * (LEN.thigh + LEN.shin * Math.cos(PLANT_BEND)));
  return Math.asin(Math.max(-0.95, Math.min(0.95, k)));
}

function armPose(phase, swing, shoulder) {
  // arms swing opposite to the leg on the same side
  const ua = -0.4 * swing * Math.sin(phase);
  const elbow = seg(shoulder, ua, LEN.upper);
  const fa = ua + 0.16 + 0.32 * swing * Math.max(0, -Math.sin(phase));
  const hand = seg(elbow, fa, LEN.fore);
  return { elbow, hand };
}

export function characterColors(P) {
  const k = P.charBrightness;
  const out = {};
  for (const [key, c] of Object.entries(BASE)) {
    const t = tint(c, P.charTint, k);
    out[key] = css(t);
  }
  return out;
}

function stroke(ctx, a, b, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawArm(ctx, sh, pose, C, far) {
  const cuffStart = { x: sh.x + (pose.elbow.x - sh.x) * 0.7, y: sh.y + (pose.elbow.y - sh.y) * 0.7 };
  stroke(ctx, pose.elbow, pose.hand, 8.6, far ? C.skinShade : C.skin);
  if (!far) stroke(ctx, sh, pose.elbow, 15.5, C.shirtShade); // separates sleeve from torso
  stroke(ctx, sh, pose.elbow, 13, far ? C.shirtShade : C.shirt);
  stroke(ctx, cuffStart, pose.elbow, 14.5, far ? C.shirtShade : C.cuff);
  ctx.fillStyle = far ? C.skinShade : C.skin;
  ctx.beginPath();
  ctx.arc(pose.hand.x, pose.hand.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

// Joint positions for a pose, in local units (origin on the walking line).
// Shared by the renderer and by anything that needs to know where the legs
// are (grass parting, tests).
export function characterPose(pose) {
  const ph = pose.phase;
  const u = (((ph / (Math.PI * 2)) % 1) + 1) % 1;
  // highest as each leg passes under the body (mid-stance), lowest after contact
  const by = -pose.bob * 4 * Math.cos(Math.PI * 4 * (u - STANCE / 2));
  const hip = { x: 0, y: HIP_Y + by };
  const sh = { x: SHOULDER.x, y: SHOULDER.y + by };
  const near = legPose(u, pose.reach, pose.stride, hip);
  const far = legPose((u + 0.5) % 1, pose.reach, pose.stride, hip);
  // arms: furthest back when the same-side leg is furthest forward
  const shF = { x: sh.x - 3, y: sh.y + 1 };
  const armN = armPose(ph + Math.PI / 2, pose.armSwing, sh);
  const armF = armPose(ph + Math.PI * 1.5, pose.armSwing, shF);
  return { u, by, hip, sh, shF, near, far, armN, armF };
}

// pose: { phase, reach, stride, bob, armSwing, fabric, wind, time }
// phase advances 2π per gait cycle (two steps). reach is the hip swing in
// radians that matches the ground covered (see reachForSweep).
export function drawCharacter(ctx, x, y, scale, pose, C) {
  const { by, hip, sh, near, far, armN, armF } = characterPose(pose);
  const flutter = Math.sin(pose.time * (2.4 + pose.wind * 3)) * pose.fabric * (0.6 + pose.wind * 2.5);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // far side
  drawArm(ctx, { x: sh.x - 3, y: sh.y + 1 }, armF, C, true);
  stroke(ctx, far.knee, far.foot, 11, C.skinShade);
  // near shin
  stroke(ctx, near.knee, near.foot, 11.5, C.skin);

  // mundu: from the waist to about the knee, wrapping both thighs with a
  // little A-line flare
  const hemY = Math.min(near.knee.y, far.knee.y) + 2;
  const front = Math.max(near.knee.x, far.knee.x) + 11;
  const back = Math.min(near.knee.x, far.knee.x) - 11 - flutter * 0.6;
  const waist = HIP_Y - 8 + by;
  ctx.fillStyle = C.mundu;
  ctx.beginPath();
  ctx.moveTo(-19, waist);
  ctx.lineTo(19, waist);
  ctx.quadraticCurveTo(front + 1, (waist + hemY) / 2, front, hemY);
  ctx.quadraticCurveTo((front + back) / 2, hemY + 6 + flutter * 0.4, back, hemY + 1);
  ctx.quadraticCurveTo(back - 2, (waist + hemY) / 2, -19, waist);
  ctx.closePath();
  ctx.fill();
  // fold line and kasavu hem
  ctx.strokeStyle = C.munduShade;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(3, waist + 6);
  ctx.quadraticCurveTo(near.knee.x * 0.5 + 2, (waist + hemY) / 2, near.knee.x * 0.8, hemY + 1);
  ctx.stroke();
  ctx.strokeStyle = C.kasavu;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(back + 1, hemY - 1);
  ctx.quadraticCurveTo((front + back) / 2, hemY + 3.5 + flutter * 0.4, front - 1, hemY - 2);
  ctx.stroke();

  // loose shirt, untucked over the mundu, leaning slightly forward
  const hemFl = flutter * 0.8;
  const torso = () => {
    ctx.beginPath();
    ctx.moveTo(-10, -223 + by);
    ctx.quadraticCurveTo(-24, -192 + by, -19, -148 + by);
    ctx.lineTo(-21 - hemFl, -124 + by);
    ctx.quadraticCurveTo(0, -119 + by, 21, -125 + by);
    ctx.lineTo(19, -150 + by);
    ctx.quadraticCurveTo(26, -194 + by, 16, -224 + by);
    ctx.quadraticCurveTo(3, -231 + by, -10, -223 + by);
    ctx.closePath();
  };
  ctx.fillStyle = C.shirt;
  torso();
  ctx.fill();
  // shade the back half
  ctx.save();
  torso();
  ctx.clip();
  ctx.fillStyle = C.shirtShade;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(-30, -235 + by);
  ctx.lineTo(-3, -235 + by);
  ctx.quadraticCurveTo(-12, -180 + by, -8, -115 + by);
  ctx.lineTo(-30, -115 + by);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // placket
  ctx.strokeStyle = C.shirtShade;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(14, -216 + by);
  ctx.quadraticCurveTo(19, -180 + by, 15, -127 + by);
  ctx.stroke();

  // near arm over the torso
  drawArm(ctx, sh, armN, C, false);

  // neck and head
  const hb = by * 0.9;
  ctx.save();
  ctx.translate(3, 0);
  ctx.fillStyle = C.skinShade;
  ctx.fillRect(-4, -232 + hb, 10, 14);
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(4, -243 + hb, 16.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath(); // nose
  ctx.moveTo(19, -246 + hb);
  ctx.lineTo(23.5, -238 + hb);
  ctx.lineTo(19.5, -236 + hb);
  ctx.fill();
  ctx.fillStyle = C.skinShade;
  ctx.beginPath(); // ear
  ctx.ellipse(-1, -241 + hb, 3.2, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // beard along the jaw
  ctx.fillStyle = C.beard;
  ctx.beginPath();
  ctx.moveTo(-1, -238 + hb);
  ctx.quadraticCurveTo(0, -225 + hb, 10, -224 + hb);
  ctx.quadraticCurveTo(19, -225 + hb, 21, -232 + hb);
  ctx.lineTo(17.5, -234 + hb);
  ctx.quadraticCurveTo(10, -231 + hb, 4, -237 + hb);
  ctx.closePath();
  ctx.fill();
  // short hair
  ctx.fillStyle = C.hair;
  ctx.beginPath();
  ctx.moveTo(17, -251 + hb);
  ctx.quadraticCurveTo(11, -263 + hb, -2, -261 + hb);
  ctx.quadraticCurveTo(-15, -257 + hb, -13.5, -242 + hb);
  ctx.quadraticCurveTo(-12.5, -234 + hb, -8, -231 + hb);
  ctx.lineTo(-5, -238 + hb);
  ctx.quadraticCurveTo(-3, -251 + hb, 8, -253 + hb);
  ctx.closePath();
  ctx.fill();
  // eye
  ctx.fillStyle = C.hair;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(13.5, -245 + hb, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.restore();
}
