# Plan: field depth, mundu and peaks

**Status:** Phases 0–4 done (17 Oct 2026).

## Goals

1. **Field depth.** The ground-offset control moves the man (and Juhu) up
   or down. The way the field behaves around them follows that position:
   - **Up:** he walks *on* a grassy field. The grass in front of him is
     low, and it barely reacts to him.
   - **Down:** he walks *through* a hay field. The hay is tall in front of
     him and moves as he passes.

   The hay style stays as it is now.
2. **Mundu.** It should clearly read as a Kerala mundu in two states:
   - **Unfolded:** to the ankles, legs hidden, border down the wrapped edge
     and along the hem.
   - **Folded:** tucked up at the waist with gathered cloth, knee length,
     and the border following the folded edge.
3. **Peaks.** Follow the reference:
   - One large mountain with smaller peaks beside it, and more peaks
     continuing past the frame edges on wide screens.
   - Each mountain has one broad lit face and a soft vertical gradient,
     instead of the current faceted planes and gully lines.

## How the work is done

- **Change the drawing, not the system.** The rig, the cloth simulation,
  the field and the render order all stay. Every change lands in an
  existing function or adds a few parameters.
- **One input drives many effects.** Ground offset becomes the single
  "how deep in the field" input. Grass height in front of him, grass
  parting and contact shading all derive from it. There's no new set of
  sliders, and no way to set them so they contradict each other.
- **Judge at real size, against the reference.** A capture script renders
  each state at the size and crop of the reference images, side by side
  with them. Zoomed close-ups are only for debugging.
- **Each phase is small and testable.** Each phase:
  - lands as its own commit;
  - keeps `npm test` passing and adds a test for its new behaviour;
  - ends with before/after images.
- **Stop at "reads right at 1×".** No extra detail beyond that.

---

## Phase 0: verification tool (small)

- Move the capture scripts I've been using from the scratchpad into
  `tools/capture.mjs`, and add `npm run capture`. It renders:
  - all six states at 1600×900;
  - square crops matching the reference sheet;
  - a close-up strip of the character for both mundu states.
- **Why:** every later phase is judged with the same tool, and you can
  re-run it yourself.

---

## Phase 1: field depth follows ground offset

**Current behaviour:** ground offset only moves the figures. Grass height
in front of him and parting strength are fixed, so moving him up just
floats him, and moving him down just buries him.

**Change:** compute one value, `depth`, from 0 (up, on the grass) to 1
(down, in the hay), from ground offset (−20 → 0, +20 → 1). Then apply it:

| What | Up (depth 0): grassy field | Down (depth 1): hay field | Where |
| --- | --- | --- | --- |
| Height of the grass band in front of him | ×0.55 (ankle to shin height) | ×1.0 (as now) | `Scene.render` (one multiplier on `G.occlusion`) |
| Grass parting around legs and paws | almost none (×0.1) | full | `grassPushers()` |
| Contact shadow | crisper and darker (feet on the ground) | softer (lost in the hay) | `drawContactShadows()` |

**Grass parting:**
- I read your note as: parting goes close to nothing when he's up, and
  rises gradually as he goes down. Please confirm.
- I'll also add a **grass parting** control (0 to 2×, default lower than
  today). It sets the maximum, and depth scales it.
- The flicker between planted and swinging feet goes. Both feet push with
  the same strength, so the movement is a calm wake, not a twitch.

**Your existing controls keep working:**
- **Grass occlusion** stays as the base value; depth multiplies it.
- **Ground offset** stays −20 to +20, and your default of 20 means "in the
  hay", exactly as now.

**Test:**
- At depth 0 the grass in front of him is shorter and parting is near zero.
- At depth 1 the scene is unchanged from today.

**Size:** about 30 lines in `Scene.js`, plus 1 control and 1 range.

---

## Phase 2: mundu construction

**Where I agree with the feedback:**
- The silhouette and how the cloth is constructed matter more than the
  simulation.
- The border must follow the cloth's real edges.
- The folded state needs gathered cloth at the waist, not a short skirt.

**Where I'd differ:** keep the existing Verlet cloth, and use it only for
motion and for keeping the legs inside the cloth.
- **Why keep it:** it's already there (140 lines) and tested. It's what
  guarantees no leg ever shows through, and it gives the small hem sway
  the reference asks for.
- **What it no longer decides:** the *shape*. The designed silhouette and
  construction come from the drawing on top of it.
- Removing it would mean rebuilding that guarantee by hand.

**Changes, all in the garment drawing in `character.js` plus a few
per-chain lengths in `mundu.js`:**

1. **Border as part of the garment.** A narrow band, drawn in the border
   colour:
   - along the hem, following the hem points;
   - down the front wrapped edge, following the front-most inner chain;
   - attached to cloth points, so it can't detach or jitter.

   The default colour becomes a restrained dark green, as in the
   reference. The **border colour** control (now called "kasavu border")
   stays, so gold is one click away.
2. **A front wrap panel.** A slightly lighter overlapping panel from the
   waist to the hem, bounded by the bordered edge. This shows the wrap
   instead of a central split.
3. **A waistband roll.** A thin band with a small tuck at the front, where
   the cloth is secured.
4. **Unfolded state (full):**
   - The hem sits just above the ankle.
   - The A-line flare is capped, so in long strides the cloth doesn't
     open into a wide bell. Legs read as close together.
   - Sway is a little stiffer than the folded state.
5. **Folded state:**
   - The chains are shorter at the front than the back, so the hem rises
     towards the tucked front. That's the asymmetric line in the
     reference.
   - A larger gathered roll at the waist and hips, with 2–3 irregular
     folds.
   - The border runs along the raised hem and up the tucked edge.
   - Shins and feet show below the hem.
6. **Feet (optional, tiny):** a dark sandal sole under each foot. In the
   reference, the feet below the hem are what make the length readable.

**Test:**
- The existing "no leg shows outside the cloth" test runs for both states.
- New: the border points equal the hem and edge cloth points every frame
  (they can't detach).
- New: in the unfolded state, the hem stays within a few units of the
  ankle, so no shin shows.

**Size:** about 80–120 lines changed in the garment drawing; about 10 in
`mundu.js`. No new files.

---

## Phase 3: peaks

**What the reference does:**
- One large peak, with smaller peaks to one side, and further peaks past
  the frame edge on wide screens.
- **Light:**
  - The face towards the sun is one broad, lighter plane, from the summit
    down one clean ridge line to the base.
  - That plane is lightest near the top and fades into the haze lower
    down.
  - The shaded side stays the mountain's own colour (no dark wedges).
  - Distant ranges are flat silhouettes, lighter and with less contrast.

**Changes in `terrain.js`:**

1. **Composition.**
   - Replace the near-range peak list with one dominant peak (centre-right
     in the 1920 frame, higher than any other) and two or three smaller,
     varied peaks.
   - Thin the far range to fewer, lower and softer peaks.
   - Keep peaks continuing past the frame edges for wide screens.
   - Data only: these are two peak lists.
2. **Shading: replace, not add.**
   - The faces, gullies, saddle folds and spine jitter from the last round
     come out.
   - In their place, each peak gets **one** lit plane: from the summit
     along the sun-side ridge, down a single straight edge from the summit
     to the base.
   - It's filled with a gradient from about 40% at the top to 0 near the
     base, and smaller peaks get a fainter plane.
   - The far range gets no plane. The crest rim line becomes very faint
     and only appears at twilight.
3. **Body gradient.** Mountains lighten slightly towards the base into the
   haze, as now, tuned against the reference.

**Net effect:** `terrain.js` gets shorter.

**Test:**
- The existing render and NaN checks across all presets and screen sizes.
- A visual check of all six states against the reference.

**Size:** about −60 / +40 lines.

---

## Phase 4 (next, if you want it): head and arms

From the earlier review, and consistent with the mundu notes ("simple
face, short dark hair and beard, sleeves rolled to the elbows"):
- the head as one profile silhouette with the beard following the jaw;
- arms as continuous tapered shapes, with no joint circles;
- small hands.

This is kept separate so the three goals above land first.

---

## Order and checkpoints

| Phase | Commit | You review |
| --- | --- | --- |
| 0 | `tools/capture.mjs`, `npm run capture` | (none) |
| 1 | Field depth from ground offset; parting control | Slide ground offset from −20 to +20 and check the field changes from grassy to hay |
| 2 | Mundu construction, both states | Both states against the reference sheet at 1× |
| 3 | Peaks | All six states against the reference |
| 4 | Head and arms (optional) | Close-up and 1× |

Each phase is pushed after its tests pass, so any step can be reverted on
its own.

## Decisions (confirmed 17 Oct 2026)

All three as proposed: parting near zero when raised and gentler overall
(default strength 0.6) with a control; dark green border by default; full
length stays the default mundu.

## Decisions to confirm (original)

1. **Parting:** near zero when he's up, rising as he goes down. Overall
   gentler than today, with a strength control. Is that right?
2. **Border colour:** dark green by default, as in the reference, with
   gold available in the control?
3. **Mundu default:** keep "full" (your current setting), with "folded"
   as the alternative state?
