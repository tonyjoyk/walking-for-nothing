# Party mode: the greeting doesn't feel smooth (20 Oct 2026)

**Question (owner):** hovering the man and having him turn "doesn't feel very
smooth". The owner wants:

1. As soon as the cursor is on him, he stops walking.
2. If the cursor stays on him for 2 s or more, he turns to face the visitor.
3. A click on him makes him turn straight away.

**Roles:** Analyst, PM, UX, Architect, Dev, QA. **Outcome:** decision
[D-2.2](../../architecture/decisions.md#d-22-pause-on-hover-turn-after-a-2-s-rest-or-a-click),
story [2.1](../../stories/2.1.pause-on-hover-turn-on-rest-or-click.md).

## Analyst: what is actually wrong today (measured)

Measured with the real `Scene` at 1920×1080, hovering from six different
points in the stride:

| From hover to standing | From hover to the turn | Distance he walks after the hover |
| --- | --- | --- |
| 0.9–2.4 s | 1.7–3.2 s | 33–87 px |

The hover box is only about ±30 px wide. Three faults follow from that:

1. **He walks out from under the cursor.** Hover is only re-tested on
   `pointermove`, so a still cursor stays "on him" by accident (a stale
   value). The first small mouse movement then finds the cursor beside him
   and cancels the greeting mid-stop or mid-turn. This is the main "not
   smooth" feeling: he stops, half turns, and walks off for no visible
   reason.
2. **The reverse is also true.** If he walks into a still cursor, nothing
   happens until the mouse moves.
3. **One gesture does everything.** Brushing past him commits to a full
   stop, settle and turn. There's no lighter "he notices you" step, and a
   mouse click does nothing at all (only touch taps are handled).

There's also a small rough edge: after a stop that never became a turn, a
2 s cooldown and the "leave and come back" rule apply, so coming back to him
quickly is ignored.

## PM: requirements

- **R1:** the cursor on him → he starts slowing at once and comes to rest
  (both feet down, as now).
- **R2:** the cursor still on him 2 s after it arrived → he turns (then looks
  and smiles as now). 2 s is a dev-panel setting.
- **R3:** a click on him → he turns as soon as he is standing (at once if he
  already is). The click commits: he plays the whole greeting even if the
  cursor then leaves, the same as a tap on touch screens. A click anywhere
  else ends it, the same as a tap elsewhere.
- **R4:** the cursor leaves before he turns → he walks on, with no cooldown,
  and comes back to rest if the cursor returns.
- **R5:** everything else in the spec stays: no snapping, he always resolves
  within 2.5 s of leaving, feet planted, the cooldown and "come back again"
  rule after a full greeting.

## UX

- A pause that becomes a turn reads as a person: he stops because you're
  close, and only turns if you stay. That's closer to the spec's intent
  ("a person noticing you") than turning on first contact.
- Keep the **no cursor change** rule (UX principle 3, discovered, not
  announced), even though a click now does something. A pointer cursor would
  make him a button.
- The 2 s should run from when the cursor arrived, not from when he
  finished stopping. Otherwise the wait feels longer than the owner asked for.
- The stop can be a little shorter, but must keep its weight. Stop at the
  first both-feet-down moment at least a tenth of a stride ahead (was a
  fifth).

## Architect

- Keep `greeting.js` pure. Add one state, **`waiting`** (standing, not
  turned), between `settling` and `turning`. Add a hover clock for the 2 s.
  Add a `turned` flag, so the cooldown only follows a greeting in which he
  actually turned.
- `greetNow()` (click, tap, dev button) works from any state before he turns
  back, not only from `walking`.
- Re-test the hover **every frame** from the last pointer position
  (`Scene.pointer`), not only on `pointermove`. While a greeting is under
  way, widen the box behind him by the most he can walk while stopping
  (0.6 of a stride). He can then never stop out from under the cursor
  (hysteresis).
- `stopping` scales its speed curve by the speed he had when it began, so a
  re-stop while he's still speeding up doesn't jump.

## Dev

- The changes are small: `greeting.js` (states and clock), `Scene.js`
  (pointer, hysteresis, stop lead), `main.js` (mouse click, pointer
  tracking), config and dev panel (`dwellSeconds`).
- Existing tests that hover and expect a turn still pass, because hover
  for 2 s still leads to a turn. The timeline test needs the new pause
  accounted for.

## QA

New tests:

- Hover stops him and he doesn't turn before 2 s.
- He turns at 2 s ±0.05 s from the hover.
- A click turns him with no wait, and plays through after the cursor leaves.
- Leaving while waiting gets him walking again with no cooldown, and a
  re-hover stops him again.
- A still cursor stays "on him" while he stops (hysteresis), and he stops
  when he walks into a still cursor.
- No snapping, and feet planted, as before.

Browser check: hover, rest, click and brush past, at real size.

## Agreement

All roles agree with R1–R5 and the architecture above. They're recorded as
D-2.2 and story 2.1.
