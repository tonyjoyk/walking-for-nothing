# UX spec: Walking for Nothing

**Updated:** 20 Oct 2026. Each epic owns its own section; edit only yours
(rules in [`docs/README.md`](../README.md)).

## Principles

1. **The scene is the interface.** No menus, text or buttons, except the
   sound toggle and a credit line when third-party data is shown.
2. **Calm over spectacle.** Nothing snaps; every change eases over at least
   about 0.8 s.
3. **Discovered, not announced.** Interactions (the greeting) are found by
   chance and never explained on screen.
4. **Judge at real size.** Detail that doesn't read at 1× is removed, not
   sharpened.

## Cross-epic rules

These apply to every epic; they came up when the PO checked epics against
each other on 20 Oct 2026.

- **Credits: one quiet link.** Anything that needs on-page credit (Open-Meteo
  while live weather is on; recorded sound, story 6.12) shares a single small
  "Credits" link in the bottom-left corner. It opens one quiet list; there's
  never more than one credit link on screen. **Confirmed by Tony, 20 Oct
  2026 (D-0.5).**
- **Flashes (lightning, story 6.11)** are the only allowed exception to
  "nothing snaps":
  - a soft brightening of the sky only, never a full-screen white;
  - rise and fall each at least 0.15 s;
  - no more than one flash per thunder roll;
  - never more than 3 flashes in any second (WCAG 2.3.1);
  - much gentler with reduced motion, and can be switched off.
  - The flash is drawn by the sky and lighting layers (epic 4 code), so
    changes there go through epic 4's section of the architecture.

## Visual language

Reference: [`reference/six-scenes.png`](reference/six-scenes.png). Mundu
construction: [`reference/mundu-construction.png`](reference/mundu-construction.png).

- **Style:** flat editorial illustration with soft gradients and few shapes.
- **Mountains:** one dominant peak, smaller peaks beside it, one lit plane
  per peak fading into haze, and distant ranges paler (D-4.1).
- **Field:** a continuous hay canopy over undergrowth. Blades darken towards
  their roots (D-4.3).
- **Figure:**
  - the darkest, clearest shape in each frame;
  - a profile face, tapered limbs;
  - a white mundu with a dark green border (D-3.4).
- **Light:** soft contact shadows; long shadows when the sun is low; rim
  light on the side facing the sun.

## The six scenes (epics 1 and 4)

Dawn → Daylight → Windy → Rain → Sunset → Night (the cycle order, D-1.2).
Overcast is a variant of Rain without the rain, used only by live weather.
Every scene shares one design; only the palette, light and weather effects
change.

## Opening and journey (epic 1)

- **Fresh visit:** a random scene, from the first frame.
- **Reload:** the next scene after the one that was on screen.
- **While watching:** each crossing moves to the next scene, starting as he
  re-enters from the left, with a 4 s eased transition.
- Spec: [opening-shuffle](../product/specs/opening-shuffle.md). Live weather
  opening: paused (D-1.3).

## The greeting (epic 2)

- **Hover (or tap on touch):** he stops with both feet down, turns head
  first, looks for 3 s, then smiles. About 4 s later he turns back and walks
  on.
- **Leaving:** he turns back smoothly from wherever he is.
- **No cursor change:** the cursor doesn't change over him; it isn't a
  button.
- Spec: [greeting](../product/specs/greeting.md).

## Field depth (epic 4)

The ground-offset control moves the man and Juhu between walking on a grassy
field (raised: short grass, almost no parting) and wading through hay
(lowered, the default) (D-4.2).

## Audio (epic 6)

Sound is opt-in, and the visuals must stand on their own. The plan is calm,
recorded sound for each scene, with no religious sound by default (D-6.3).
Details: [audio PRD](../product/specs/audio/prd.md).
