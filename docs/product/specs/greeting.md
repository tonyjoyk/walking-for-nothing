# Spec: the man stops and greets the visitor

**Status:** built (18 Oct 2026) · tests in `tests/greeting.test.mjs`

> **Revised 20 Oct 2026 by [D-2.2](../../architecture/decisions.md#d-22-pause-on-hover-turn-after-a-2-s-rest-or-a-click)
> (story [2.1](../../stories/2.1.pause-on-hover-turn-on-rest-or-click.md)).**
> The cursor on him now only makes him **stop and stand**. He **turns** once
> it has rested on him for 2 s, or straight away on a **click**. See
> "Revision 2" at the end. Where the text below disagrees, Revision 2 wins.

## Summary

When a visitor rests the cursor on the man, he slows, stops and slowly turns
to face them. He looks at them with a calm expression for 3 seconds, and
then a smile slowly spreads. About 4 seconds later he turns back and walks
on. If the cursor leaves him at any point, he turns back straight away
(slowly, never snapping) and walks on.

## Problem

The site is a quiet loop. The visitor can watch, but nothing in the scene
acknowledges them. One small, gentle moment of contact, which they discover
rather than are told about, makes the place feel inhabited without adding
any interface.

## Goals

1. **It feels like a person noticing you.** He stops with weight and turns
   head-first, and the smile builds slowly. Nothing pops or snaps, and
   nothing happens faster than about 0.8 seconds.
2. **It always resolves.** Whatever the visitor does (leave early, hover
   again, leave mid-turn), he ends up walking on within about 2.5 seconds
   of the cursor leaving. He never gets stuck.
3. **It doesn't break what works.** While he walks, his feet stay planted
   (slide under 1 px). Scene changes, Juhu, shadows and grass parting all
   carry on. Frame time stays within today's budget.
4. **It works on touch.** On a phone, tapping the man plays the same greeting
   once.

## Non-goals

- **Talking, waving, text or sound.** It's a look and a smile, nothing more.
- **Following the cursor with his eyes or head.** A deliberate, single
  gesture fits the site better than tracking.
- **Juhu greeting the visitor.** That could be a later idea; she simply
  waits while he stands.
- **A front-facing walk.** He only turns while standing still.

## User stories

- As a **visitor on a computer**, I want the man to stop and turn to me when
  I rest my cursor on him, so that the place feels like it notices me.
- As a **visitor who keeps the cursor on him**, I want his expression to warm
  slowly into a smile, so that the moment feels genuine rather than
  mechanical.
- As a **visitor who moves the cursor away**, I want him to turn back and
  carry on without a jolt, so that nothing looks broken.
- As a **visitor on a phone**, I want a tap on him to do the same, so that
  touch visitors get the moment too.
- As a **visitor who moves the cursor around quickly**, I don't want him to
  start and stop jerkily, so that brushing past him doesn't spoil the scene.
- As the **owner**, I want to switch the greeting off and tune its timings in
  the dev panel, so that I can get the pacing right without code changes.

## The moment, beat by beat

| Phase | Duration (default) | What happens |
| --- | --- | --- |
| **Stopping** | 0.7–2.5 s | He slows evenly to a stop planned at the next moment with both feet on the ground (at least a fifth of a stride ahead), then feet and arms settle (0.8 s). Juhu slows and waits beside him. |
| **Turning to face** | 1.4 s | The head leads by about a quarter of the turn, then the shoulders and body follow. The profile (nose, beard line) flattens into a front view, and the second eye and ear come into view. |
| **Looking** | 3 s | Calm, neutral expression facing the screen. Just breathing, a tiny rise and fall. |
| **Smiling** | 4 s | Over the first ~1.5 s, the mouth curves up, the cheeks lift and the eyes narrow slightly. Then he holds the smile. |
| **Turning back** | 1.4 s | Head first, then the body. The smile fades as he turns. |
| **Starting** | ~0.9 s | Speed eases back up into the normal walk. |

**If the cursor leaves**, during any phase from Stopping to Smiling, he goes
straight to Turning back, starting from wherever he has turned to so far.
The smile fades as he turns. Then he starts walking.

**Re-hovering** while he's turning back or starting doesn't interrupt. A new
greeting can begin once he's walking again and after a short cooldown
(2 s). The cursor has to rest on him again; it can't still be resting from
before.

## Requirements

### P0

**P0.1 Hover detection.**
- The cursor counts as being on him when it's over his body: a box around
  the figure, at least 30×80 px on screen even on small views.
- Movement is checked against the man's current position, scale and ground
  offset.
- Acceptance:
  - [ ] Hovering the man starts a greeting; hovering sky, grass or Juhu
    doesn't.
  - [ ] The cursor leaving the page counts as leaving him.

**P0.2 State machine.**
- The states are: walking → stopping → turning → looking → smiling →
  returning → starting → walking. Leaving the man jumps to returning.
- Durations come from config.
- Acceptance:
  - [ ] With the cursor held on him, he turns back 3 s + 4 s after facing
    the screen.
  - [ ] Leaving at any point means he's walking again within 2.5 s.
  - [ ] No state can be entered twice without passing through walking.

**P0.3 Stopping and starting with weight.**
- Speed eases out and back in.
- He stops on a double-support pose, with both feet down. Feet never hang in
  the air while he stands.
- Acceptance:
  - [ ] While standing, both feet are on the ground and nothing slides.
  - [ ] Juhu slows and waits.
  - [ ] Walking resumes with feet planted (the existing slip test passes).

**P0.4 The turn.**
- A continuous turn from profile to front view, with the head leading the
  body. Details are under "Implementation plan".
- Acceptance:
  - [ ] No visible pop at the start or end of the turn.
  - [ ] The front view reads as the same man at 1×: hair, beard, shirt and
    mundu with its border.
  - [ ] Both mundu lengths work.

**P0.5 Expression.**
- The face is neutral, then eases into a smile; the smile fades as he turns
  away.
- Acceptance:
  - [ ] The smile is readable at normal display size.
  - [ ] No extra facial detail beyond eyes, brows, nose hint, mouth and
    cheeks.

**P0.6 Dev panel.**
- A greeting on/off switch.
- Timings: stop, turn, look, smile and cooldown.
- A "Greet now" button.
- Acceptance:
  - [ ] Settings save and validate like all the others.

### P1

- **P1.1 Tap to greet on touch screens.** A tap on him plays the whole
  sequence once; a tap anywhere else ends it.
- **P1.2 A tiny idle while facing.** A breath, and one slow blink during the
  look.

### P2

- **P2.1 Juhu reacts:** she sits, or looks up at him.
- **P2.2 Reduced motion:** a shorter, gentler version of the turn (the
  current reduced-motion setting already slows everything).

## Success criteria

The site has no analytics, so we judge it by review:
- **Close-up check:** a capture of the full sequence at 1× and close up,
  frame by frame. Frames at turn progress 0.1, 0.5 and 0.9 must read as one
  continuous turn.
- **Tests:**
  - the timeline;
  - leaving at every phase;
  - no NaN in any pose;
  - feet planted before and after the greeting.
- **Performance:** frame time while turned is no worse than while walking.

## Open questions

All are non-blocking; the defaults are listed.

1. **Should the cursor change shape over the man?** Default: no. A pointer
   cursor would turn it into a button.
2. **Is "a smile" with a hint of teeth too much?** Default: closed-mouth
   smile, with cheeks lifted and eyes softened.

---

## Implementation plan

### Principles

- **Reuse the profile drawing.** At the start of the turn the man is drawn
  by today's code, so there's nothing to pop. The turned figure is a morph
  from the same profile outlines towards front-view outlines, not a separate
  sprite.
- **Turn the body from 3D positions.** Joints (shoulders, hips, feet, eyes,
  ears) get a simple 3D position: forward, sideways and up. They're
  projected for the current turn angle: screen x = forward·cos(angle) −
  sideways·sin(angle). Their depth decides what's drawn in front. This is
  the standard 2.5D way to turn a 2D rig.
- **Outlines that change shape morph.** The head, torso and mundu are each
  sampled into the same number of points in profile and in front view, and
  blended point by point. The nose bump flattens into the oval face, and
  the shirt widens into the shoulders.

### Steps

1. **`src/scene/greeting.js` (new, ~120 lines).** A pure state machine:
   `update(dt, hovering, cfg, { stopFraction })` returns
   `{ speedFactor, stand, turnHead, turnBody, smile }`.
   - All values are eased, each from 0 to 1.
   - The cooldown and the "must rest on him again" rule live here.
   - Fully unit-testable.
2. **Scene integration.**
   - The man's speed becomes `walkSpeed × speedFactor`. Juhu gets the same
     effective speed, so she slows and waits.
   - While stopping, if the speed is very low and he's mid-swing, he keeps
     creeping until the next double-support moment, then stops.
   - `manPose` passes `stand`, `turnHead`, `turnBody` and `smile` to the
     rig.
   - `hitMan(x, y)` converts screen coordinates to scene coordinates and
     checks against the figure's box.
3. **Standing pose (`character.js`).**
   - As `stand` rises, ankle targets blend to a natural stance (feet
     slightly apart, under the hips) and the hip rises to straight legs.
   - Arm swing fades to a relaxed hang.
   - The cloth carries on simulating, so the mundu settles naturally.
4. **Turned figure (`character.js`, ~250 lines).** When the turn is above 0,
   `drawCharacter` uses `drawTurned()`.
   - **Head:** the profile outline and a front oval with a jaw, both resampled
     to 64 points around the head centre and blended by the head's turn.
     - Features are placed by 3D projection, so the near eye slides across,
       the far eye comes into view, and the second ear appears.
     - The beard has a profile shape and a front shape (round the jaw and
       chin, with a moustache), morphed the same way.
     - The mouth and smile appear as the face comes round, closed-mouthed.
       The corners curve up, the cheeks lift, and the lower lids rise
       slightly.
   - **Torso:** the profile shirt outline and a front outline (wider
     shoulders, straight sides, soft hem), morphed by the body's turn. The
     placket and collar are projected, and the sleeves follow the arms.
   - **Arms:** shoulder positions are projected; the arms hang relaxed. The
     far arm is drawn behind the torso until it comes round beside it.
   - **Legs and feet:** hips and feet are projected. Feet shorten towards the
     front view and are drawn as small rounded shapes with sandal soles.
   - **Mundu:** the simulated cloth outline and a front outline (wrapped
     panel, slight flare; full or folded) are both resampled and morphed.
     The border (hem and wrap edge) morphs as two separate lines, so it
     stays attached to the cloth.
   - The shadow and rim light use the same function, so they follow
     automatically.
5. **Input (`main.js`).**
   - `pointermove` and `pointerleave` on the canvas feed `hovering` from
     `scene.hitMan`.
   - On touch, a tap on the man starts a one-shot greeting (P1.1).
6. **Config and panel.**
   - `greeting: { enabled, stopSeconds, turnSeconds, lookSeconds,
     smileSeconds, cooldownSeconds }` with ranges.
   - A **Greeting** group in the dev panel, with a "Greet now" button.
7. **Tests (`tests/greeting.test.mjs`).**
   - The timeline with the cursor held on him.
   - Leaving at each phase.
   - The cooldown and the "rest on him again" rule.
   - Standing feet on the ground.
   - Renders with no NaN at turn 0–1 and smile 0–1, for both mundu states.
   - The existing slip test, run after a full greeting.
8. **Captures.** `npm run capture` gets a `greet` job: a strip through the
   whole sequence at 2×, plus 1× frames.

---

## Revision 2 (20 Oct 2026): pause on hover, turn on rest or click

Why: [party mode notes](../../bmad/party-mode/2026-10-20-greeting-hover-dwell-click.md).
Decision: D-2.2.

| Visitor does | He does |
| --- | --- |
| Puts the cursor on him | Starts slowing at once, stops with both feet down, and stands (**waiting**) |
| Keeps it there for 2 s (timed from arrival) | Turns, looks, smiles, turns back and walks on, as before |
| Clicks him (any time before he turns back) | Turns as soon as he's standing, and plays the whole greeting even if the cursor leaves |
| Moves away before he has turned | Walks on with no cooldown; stops again if the cursor comes back |
| Moves away after he has turned | Turns back and walks on, as before (then the cooldown and "come back again" rule) |
| Clicks somewhere else | Ends a clicked greeting, the same as a tap elsewhere |

**States:** walking → stopping → settling → **waiting** → turning →
looking → smiling → returning → starting.

**Hover:** tested every frame against the last pointer position. While he's
greeting, the box extends behind him by 0.6 of a stride.

**Stop:** at the first both-feet-down moment at least 0.1 of a stride ahead.

**Config:** `greeting.dwellSeconds` (default 2, range 0–6), "turn after (s)"
in the dev panel.

**Unchanged:** the turn, the face, no cursor change, touch tap, "Greet
now", the no-snap and resolve-within-2.5 s goals.

---

## Revision 3 (20 Oct 2026): a few words from Tony

Decision: [D-2.3](../../architecture/decisions.md#d-23-a-speech-bubble-when-he-faces-you).
Story: [2.2](../../stories/2.2.speech-bubble.md).

**Problem.** The greeting shows that someone is there, but not who. A
visitor who finds it should get a short sense of the person behind the site.

**Requirement.** When he has turned to face the visitor (after the 2 s rest,
a click or a tap), a simple speech bubble shows this text:

> Hey, I'm Tony, a product designer from Kerala, India.
>
> I lead design at Resolve to Save Lives, a public health nonprofit, where I
> design tools and services for healthcare staff.
>
> The internet often feels rushed and demanding. So I created a digital space
> where we can slow down and feel calm.

| When | The bubble |
| --- | --- |
| He finishes turning to face the visitor | Fades in (0.8 s) |
| While he faces them | Stays. He holds the look for at least `readSeconds` (default 15 s) in all, so the text can be read |
| The cursor is on the bubble | Counts as being on him: he keeps facing them |
| He starts turning back (time's up, or the cursor leaves both him and the bubble) | Fades out (0.8 s) |

**Non-goals:** links, buttons, a close control, animation of the text, a
typing effect, more than one message.

**Config:** `greeting.bubble` (on/off), `greeting.readSeconds` (5–40 s).

---

## Revision 4 (20 Oct 2026): "View my work"

Decision: [D-2.6](../../architecture/decisions.md#d-26-a-view-my-work-link-in-the-bubble).
Story: [2.5](../../stories/2.5.view-my-work-link.md).

**Requirement.** At the bottom left of the speech bubble, a link reading
"View my work" goes to https://tonyjoyk.github.io/tony-joy-portfolio/.

- It's part of the bubble, so it appears and disappears with it.
- It can be reached with the mouse (the cursor on the bubble keeps him
  facing), by touch, and by keyboard while the bubble shows.
- **Out of scope:** any other links, buttons or calls to action.

---

## Revision 5 (20 Oct 2026): reaching the bubble, holding on touch, revealing the text

Decision: [D-2.7](../../architecture/decisions.md#d-27-a-hover-bridge-a-hold-after-the-reveal-and-a-staggered-reveal).
Story: [2.6](../../stories/2.6.bubble-reach-hold-reveal.md).

**Problems (found by testing and owner feedback):**
- **Desktop:** between his head and the bubble there's a gap of about 22 px,
  and the bubble also sits to one side. Moving the cursor from him to the
  bubble leaves his hover box, so he turns away and the bubble fades before
  the cursor arrives.
- **Touch:** the 15 s hold starts before the text is visible. A tap that
  just misses the link counts as "tapped elsewhere" and dismisses it.

**Requirements:**
- **R1, hover bridge.** While the bubble shows, the cursor anywhere in the
  box spanning him and the bubble (plus 12 px) counts as on him. Leaving
  that box still ends the greeting as before.
- **R2, a short hold (owner, 20 Oct).** 15 s felt far too long. The bubble
  now stays for `readSeconds` = **4 s** after its text has fully appeared
  (about 5 s on screen), then he turns back and walks on. While the cursor
  rests on the bubble itself, the 4 s is paused, so someone reading it or
  reaching for the link isn't cut off.
- **R2b, click him again to dismiss.** While he faces the visitor, a click
  or tap on him sends him on his way at once.
- **R3, near misses on touch.** A tap inside the same box doesn't dismiss
  it; a tap clearly elsewhere still does.
- **R4, reveal.** The text appears line by line, not all at once (see the
  timing in D-2.7). With reduced motion, it simply fades in.
- **Unchanged:** the copy, look, link, timing of the stop and turn, and the
  plate. With the bubble off, the original 3 s look and 4 s smile still
  apply.

This replaces the Revision 3 non-goal "animation of the text": the owner
now wants a reveal. A letter-by-letter typing effect is still out.

