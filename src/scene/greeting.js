// The greeting (docs/spec-greeting.md): when the visitor rests the cursor on
// the man he stops, turns to face them, looks, smiles, then turns back and
// walks on. Leaving him at any point sends him straight back to walking.
//
// A pure state machine. Each frame: update(dt, hovering, cfg, { stopFraction })
// stopFraction: while stopping, the share of the planned stopping distance
// still to go (the scene plans the stop so it ends with both feet down).
// and read the eased outputs:
//   speed  0..1  multiplier on walking speed
//   stand  0..1  blend from the walk to a standing pose
//   head   0..1  how far the head has turned to face the screen
//   body   0..1  how far the body has turned
//   smile  0..1

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const HEAD_LEAD = 0.25;      // the head leads the body by this share of the turn
const SETTLE_SECONDS = 0.8;  // feet come together and the arms settle
const SMILE_GROW = 1.5;      // seconds for the smile to spread
const SMILE_FADE = 0.8;

export class Greeting {
  constructor() {
    this.state = 'walking';
    this.t = 0;          // seconds in the current state
    this.speed = 1;
    this.stand = 0;
    this.headP = 0;      // raw turn progress of the head, 0 = profile, 1 = facing
    this.bodyP = 0;      // and of the body (eased on output)
    this.smile = 0;
    this.cooldown = 0;
    this.rearm = false;  // the cursor must leave and come back before another greeting
    this.oneShot = false; // a tap or "Greet now": play through without hovering
  }

  // Start a greeting regardless of the cursor (touch tap, dev panel).
  greetNow() {
    if (this.state === 'walking') { this.oneShot = true; this.cooldown = 0; this.rearm = false; }
  }

  // End a one-shot greeting early (a tap elsewhere).
  release() { this.oneShot = false; }

  get active() { return this.state !== 'walking'; }

  update(dt, hovering, cfg, ctx = {}) {
    const want = (hovering || this.oneShot) && cfg.enabled;
    this.t += dt;
    const goto = (s) => { this.state = s; this.t = 0; };
    const ease = (v, target, seconds) => {
      if (seconds <= 0) return target;
      const step = dt / seconds;
      return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
    };
    const leave = () => goto('returning');
    // Turning: the head moves first and the body follows a quarter of the
    // turn later, in either direction. Each part moves from where it is, so
    // turning back halfway through is always continuous.
    const rate = dt / (cfg.turnSeconds * (1 - HEAD_LEAD));
    const gap = HEAD_LEAD / (1 - HEAD_LEAD);
    const turnToward = (dir) => {
      this.headP = Math.min(1, Math.max(0, this.headP + dir * rate));
      const bodyMay = dir > 0 ? this.headP >= gap : this.headP <= 1 - gap;
      if (bodyMay || (dir > 0 ? this.headP >= 1 : this.headP <= 0)) this.bodyP = Math.min(1, Math.max(0, this.bodyP + dir * rate));
    };

    switch (this.state) {
      case 'walking':
        this.speed = ease(this.speed, 1, cfg.stopSeconds);
        this.cooldown = Math.max(0, this.cooldown - dt);
        if (!hovering) this.rearm = false;
        if (want && this.cooldown <= 0 && (!this.rearm || this.oneShot)) goto('stopping');
        break;

      case 'stopping':
        // slow evenly to the planned stop (both feet down): speed falls with
        // the square root of the distance left, i.e. constant deceleration
        if (ctx.stopFraction === undefined) this.speed = ease(this.speed, 0, cfg.stopSeconds);
        else this.speed = Math.sqrt(Math.max(0, Math.min(1, ctx.stopFraction)));
        if (this.speed <= 0.02) { this.speed = 0; goto('settling'); }
        if (!want) goto('starting');
        break;

      case 'settling':
        this.stand = ease(this.stand, 1, SETTLE_SECONDS);
        if (this.stand >= 1) goto('turning');
        if (!want) leave();
        break;

      case 'turning':
        turnToward(1);
        if (this.bodyP >= 1) goto('looking');
        if (!want) leave();
        break;

      case 'looking':
        if (this.t >= cfg.lookSeconds) goto('smiling');
        if (!want) leave();
        break;

      case 'smiling':
        this.smile = smooth(Math.min(1, this.t / SMILE_GROW));
        if (this.t >= cfg.smileSeconds) { this.oneShot = false; leave(); }
        if (!want) leave();
        break;

      case 'returning':
        this.smile = Math.max(0, this.smile - dt / SMILE_FADE);
        turnToward(-1);
        if (this.bodyP <= 0 && this.headP <= 0) goto('starting'); // feet part and speed returns together
        break;

      case 'starting':
        this.smile = 0;
        this.stand = ease(this.stand, 0, SETTLE_SECONDS);
        this.speed = ease(this.speed, 1, cfg.stopSeconds);
        if (this.speed >= 1 && this.stand <= 0) {
          this.oneShot = false;
          this.cooldown = cfg.cooldownSeconds;
          this.rearm = !!hovering;
          goto('walking');
        }
        break;
    }
    return this.output();
  }

  // Eased outputs.
  output() {
    return {
      speed: this.speed, stand: smooth(this.stand), head: smooth(this.headP), body: smooth(this.bodyP),
      smile: this.smile, state: this.state,
    };
  }
}
