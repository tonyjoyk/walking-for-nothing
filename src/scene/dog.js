import { css, tint, hexToRgb, lerp, clamp } from './util.js';

// ---------------------------------------------------------------------------
// Behaviour
// absent -> approaching (trot) -> together (trot eases to walk) -> departing -> absent
// Positions are unwrapped distances along the same track as the man, so the
// pair wraps around the screen together without any special cases.
// ---------------------------------------------------------------------------
export class Dog {
  constructor() { this.reset(); }

  reset() {
    this.state = 'absent';
    this.d = 0;
    this.speed = 0;
    this.gait = 0;      // 0 = walk, 1 = trot
    this.psi = 0;       // gait cycle phase, 0..1
    this.timer = 0;     // seconds since page load (first visit)
    this.firstDone = false;
    this.crossings = 0; // man crossings counted in the current phase
    this.callNow = false;
    this.lastX = null;
    this.togetherD = 0;
  }

  // ctx: { dt, cfg, allowed, manD, manSpeed, manX, screenX(d), view, crossed, trackLen }
  update(c) {
    const { dt, cfg } = c;
    this.timer += dt;

    if (this.state === 'absent') {
      if (c.crossed && this.firstDone) this.crossings++;
      const due = this.callNow ||
        (c.allowed && (!this.firstDone ? this.timer >= cfg.firstVisitDelay : this.crossings >= cfg.aloneCrossings));
      if (due && (this.callNow || c.allowed)) this.tryStart(c);
      return;
    }

    const target = c.manD - cfg.spacing * cfg.scale;
    const gap = target - this.d;
    let desired;
    let gaitTarget;

    if (this.state === 'approaching' || this.state === 'together') {
      desired = c.manSpeed + clamp(gap * 1.1, -c.manSpeed * 0.6, cfg.approachSpeed);
      if (this.state === 'approaching') {
        gaitTarget = clamp((this.speed - c.manSpeed) / (cfg.approachSpeed * 0.45), 0, 1);
        if (Math.abs(gap) < 6) { this.state = 'together'; this.crossings = 0; this.togetherD = 0; }
      } else {
        gaitTarget = Math.abs(gap) > 30 ? 0.6 : 0;
        // "one crossing together" = walking one screen-width side by side,
        // however far across the screen she joined him
        this.togetherD += c.manSpeed * dt;
        if (!c.allowed || this.togetherD >= cfg.togetherCrossings * c.trackLen * 0.85) this.state = 'departing';
      }
    } else { // departing: trot on ahead and leave the frame
      desired = c.manSpeed + cfg.approachSpeed * 0.75;
      gaitTarget = 1;
    }

    // smooth acceleration and gait blending
    const acc = 1 - Math.exp(-dt * 1.6);
    this.speed = lerp(this.speed, desired, acc);
    const gk = 1 - Math.exp(-dt * (3 / Math.max(0.3, cfg.easeSeconds)));
    this.gait = lerp(this.gait, gaitTarget, gk);
    this.d += this.speed * dt;

    // stride length grows with the trot, so legs match ground speed
    const stride = lerp(46, 92, this.gait) * cfg.scale;
    this.cycleLen = stride;
    this.psi = (this.psi + (this.speed * dt) / stride) % 1;

    // secondary motion: the tail and ears follow the body on springs, so they
    // lag the bob and swing a little when she speeds up or slows down
    const by = dogBob(this.psi, this.gait);
    const byVel = dt > 0 ? (by - (this.lastBy ?? by)) / dt : 0;
    this.lastBy = by;
    const accel = dt > 0 ? (this.speed - (this.lastSpeed ?? this.speed)) / dt : 0;
    this.lastSpeed = this.speed;
    const tailTarget = Math.sin(this.psi * Math.PI * 2 + 1.2) * (2 + this.gait * 2) - clamp(accel * 0.05, -6, 6);
    const earTarget = clamp(byVel * 0.02, -0.25, 0.25) - clamp(accel * 0.002, -0.15, 0.15);
    this.tailV = ((this.tailV || 0) + (tailTarget - (this.tail || 0)) * 60 * dt) * Math.exp(-6 * dt);
    this.tail = (this.tail || 0) + this.tailV * dt;
    this.earV = ((this.earV || 0) + (earTarget - (this.ear || 0)) * 180 * dt) * Math.exp(-9 * dt);
    this.ear = (this.ear || 0) + this.earV * dt;

    const x = c.screenX(this.d);
    if (this.state === 'departing' && this.lastX !== null && x < this.lastX - 50) {
      this.state = 'absent';
      this.crossings = 0;
      this.lastX = null;
      return;
    }
    this.lastX = x;
  }

  tryStart(c) {
    const { view, manX } = c;
    const left = view.x0;
    // wait until the man is well inside the frame so she can come from behind
    if (manX < left + 230 || manX > left + view.w * 0.62) return;
    const startX = left - 120;
    this.d = c.manD - (manX - startX);
    this.speed = c.manSpeed + c.cfg.approachSpeed * 0.8;
    this.gait = 1;
    this.state = 'approaching';
    this.firstDone = true;
    this.callNow = false;
    this.crossings = 0;
    this.lastX = null;
  }
}

// ---------------------------------------------------------------------------
// Drawing. Local coordinates: origin on the ground under the body, facing +x.
// Withers height ~90 units at scale 1 (about a third of the man's height).
// ---------------------------------------------------------------------------
const BASE = {
  tan: hexToRgb('#b27a40'), tanShade: hexToRgb('#8d5e2f'),
  saddle: hexToRgb('#251d18'), nose: hexToRgb('#141110'),
};

export function dogColors(P) {
  const out = {};
  for (const [k, c] of Object.entries(BASE)) out[k] = css(tint(c, P.charTint, P.charBrightness));
  return out;
}

// Phase offsets (fraction of a cycle) for [nearHind, nearFore, farHind, farFore].
// Walk: four-beat lateral sequence. Trot: diagonal pairs move together.
const WALK = [0, 0.25, 0.5, 0.75];
const TROT = [0, 0.5, 0.5, 0];
const FORE = { l1: 27, l2: 34 };
const HIND = { l1: 32, l2: 36 };
const PAW_Y = -3; // paw centre above the ground

const smooth = (t) => t * t * (3 - 2 * t);

// Body bob: twice per cycle, stronger in the trot.
export function dogBob(psi, g) { return -(0.8 + 2.2 * g) * Math.cos(psi * Math.PI * 4); }

// Where a paw should be. u: 0..1 for this leg (0 = touch-down, leg forward).
// While planted the paw moves back exactly as fast as the body moves forward,
// so it stays put on the ground. duty: share of the cycle on the ground.
function pawTarget(u, half, duty, lift, x0) {
  if (u < duty) return { x: x0 + half - 2 * half * (u / duty), y: PAW_Y, planted: true };
  const t = (u - duty) / (1 - duty);
  return { x: x0 - half + 2 * half * smooth(t), y: PAW_Y - lift * Math.sin(Math.PI * t), planted: false };
}

// Two-bone IK. bend +1 puts the joint in front of the line (stifle, elbow),
// -1 behind it.
function solve(pivot, target, L, bend) {
  const dx = target.x - pivot.x, dy = target.y - pivot.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(L.l1 - L.l2) + 1, L.l1 + L.l2 - 0.01);
  const base = Math.atan2(dx, dy);
  const a = Math.acos(clamp((L.l1 * L.l1 + d * d - L.l2 * L.l2) / (2 * L.l1 * d), -1, 1));
  const ang = base + bend * a;
  const knee = { x: pivot.x + Math.sin(ang) * L.l1, y: pivot.y + Math.cos(ang) * L.l1 };
  const paw = { x: pivot.x + Math.sin(base) * d, y: pivot.y + Math.cos(base) * d };
  return { knee, paw };
}

// Joint positions for all four legs, in local units (origin on the ground
// under the body). Shared by the renderer and the tests.
export function dogPose(dog, scale) {
  const g = dog.gait;
  const offs = WALK.map((w, i) => lerp(w, TROT[i], g));
  const by = dogBob(dog.psi, g);
  const duty = lerp(0.64, 0.5, g);
  const half = ((dog.cycleLen || 46) * duty) / Math.max(0.1, scale) / 2;
  const lift = 7 + 6 * g;
  const fore = { x: 34, y: -62 + by };
  const hind = { x: -38, y: -64 + by };
  const legs = [
    [hind, offs[0], HIND, 1, -36],
    [fore, offs[1], FORE, 1, 36],
    [{ x: hind.x - 3, y: hind.y }, offs[2], HIND, 1, -39],
    [{ x: fore.x - 3, y: fore.y }, offs[3], FORE, 1, 33],
  ].map(([pivot, off, L, bend, x0]) => {
    const u = (((dog.psi + off) % 1) + 1) % 1;
    const t = pawTarget(u, half, duty, lift, x0);
    return { pivot, ...solve(pivot, t, L, bend), planted: t.planted };
  });
  return { by, fore, hind, legs };
}

function leg(ctx, L, color, wUpper, wLower) {
  ctx.strokeStyle = color;
  ctx.lineWidth = wUpper;
  ctx.beginPath(); ctx.moveTo(L.pivot.x, L.pivot.y); ctx.lineTo(L.knee.x, L.knee.y); ctx.stroke();
  ctx.lineWidth = wLower;
  ctx.beginPath(); ctx.moveTo(L.knee.x, L.knee.y); ctx.lineTo(L.paw.x, L.paw.y); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(L.paw.x + 2.5, L.paw.y + 0.5, 4.5, 3, 0, 0, Math.PI * 2); ctx.fill();
}

export function drawDog(ctx, x, y, scale, dog, C, time) {
  const g = dog.gait;
  const psi = dog.psi;
  const { by, legs } = dogPose(dog, scale);
  const hb = by * 0.6 + Math.sin(psi * Math.PI * 4 + 0.8) * 0.8;
  const tail = (dog.tail ?? Math.sin(psi * Math.PI * 2 + 1.2) * (2 + g * 2)) + Math.sin(time * 1.3) * 1.5;
  const ear = dog.ear || 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // far legs first, darker
  leg(ctx, legs[2], C.tanShade, 10, 5.5);
  leg(ctx, legs[3], C.tanShade, 8.5, 5.5);

  // tail: bushy, carried low
  ctx.fillStyle = C.saddle;
  ctx.beginPath();
  ctx.moveTo(-50, -84 + by);
  ctx.quadraticCurveTo(-74 + tail, -72 + by, -80 + tail, -40 + by);
  ctx.quadraticCurveTo(-80 + tail, -30 + by, -73 + tail, -29 + by);
  ctx.quadraticCurveTo(-66, -50 + by, -50, -68 + by);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.tanShade;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-58, -64 + by);
  ctx.quadraticCurveTo(-70 + tail, -50 + by, -74 + tail, -32 + by);
  ctx.stroke();

  // body
  ctx.fillStyle = C.tan;
  ctx.beginPath();
  ctx.moveTo(30, -96 + by);
  ctx.quadraticCurveTo(0, -88 + by, -40, -84 + by);
  ctx.quadraticCurveTo(-57, -80 + by, -56, -63 + by);
  ctx.quadraticCurveTo(-55, -50 + by, -43, -48 + by);
  ctx.quadraticCurveTo(-30, -55 + by, -14, -51 + by);
  ctx.quadraticCurveTo(18, -45 + by, 38, -50 + by);
  ctx.quadraticCurveTo(54, -56 + by, 54, -74 + by);
  ctx.quadraticCurveTo(56, -92 + hb, 62, -104 + hb);
  ctx.lineTo(44, -120 + hb);
  ctx.quadraticCurveTo(34, -106 + by, 30, -96 + by);
  ctx.closePath();
  ctx.fill();

  // saddle
  ctx.fillStyle = C.saddle;
  ctx.beginPath();
  ctx.moveTo(28, -97 + by);
  ctx.quadraticCurveTo(0, -89 + by, -40, -85 + by);
  ctx.quadraticCurveTo(-53, -82 + by, -55, -70 + by);
  ctx.quadraticCurveTo(-34, -66 + by, -14, -65 + by);
  ctx.quadraticCurveTo(14, -65 + by, 30, -77 + by);
  ctx.quadraticCurveTo(40, -92 + hb, 48, -114 + hb);
  ctx.lineTo(44, -117 + hb);
  ctx.quadraticCurveTo(36, -104 + by, 28, -97 + by);
  ctx.closePath();
  ctx.fill();

  // near legs, in front of the body
  leg(ctx, legs[0], C.tan, 11, 6);
  leg(ctx, legs[1], C.tan, 9.5, 6);

  // head: broad skull, strong wedge muzzle, upright ears
  ctx.fillStyle = C.tan;
  ctx.beginPath();
  ctx.ellipse(55, -113 + hb, 16, 13.5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(60, -124 + hb);
  ctx.quadraticCurveTo(76, -120 + hb, 87, -112 + hb);
  ctx.quadraticCurveTo(87, -104 + hb, 76, -101 + hb);
  ctx.quadraticCurveTo(62, -100 + hb, 52, -106 + hb);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.saddle;
  ctx.beginPath(); // dark muzzle tip
  ctx.moveTo(74, -121 + hb);
  ctx.quadraticCurveTo(81, -117 + hb, 88, -112 + hb);
  ctx.quadraticCurveTo(88, -105 + hb, 80, -102 + hb);
  ctx.quadraticCurveTo(76, -110 + hb, 72, -113 + hb);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath(); // cap between the ears
  ctx.ellipse(52, -122 + hb, 10, 5.5, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath(); // far ear
  ctx.moveTo(44, -122 + hb); ctx.lineTo(44 - ear * 17, -139 + hb + Math.abs(ear) * 3); ctx.lineTo(53, -125 + hb);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); // near ear
  ctx.moveTo(50, -124 + hb); ctx.lineTo(55 - ear * 17, -141 + hb + Math.abs(ear) * 3); ctx.lineTo(61, -123 + hb);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.nose;
  ctx.beginPath();
  ctx.arc(86.5, -111 + hb, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(65, -117 + hb, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
