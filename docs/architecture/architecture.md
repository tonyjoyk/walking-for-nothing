# Architecture

**Updated:** 20 Oct 2026. Decisions and what they supersede:
[`decisions.md`](decisions.md). Each epic edits only its own section.

## Overview

A static site built with Vite, using p5.js for the frame loop, with all
drawing done directly on the Canvas 2D context. There's no server. GitHub
Pages serves the build. Tests run in Node with `node:test` against the real
scene code, using a fake canvas.

```
index.html ─ src/main.js      boot, input, opening, sound, quality, ?dev loader
               ├─ config.js    presets, defaults, ranges, validation, rules
               ├─ weather.js   opening choice: shuffle (+ paused live weather), cycle order
               ├─ audio.js     generated wind, rain, chirps (Web Audio)
               ├─ scene/Scene.js        state, easing, cycle, render order, hit-test
               │    ├─ sky, clouds, terrain, field, life   landscape layers
               │    ├─ character.js     rig: IK legs, gait data, arms, look, turn
               │    ├─ mundu.js         Verlet cloth
               │    ├─ gaitData.js      UCI gait curves (CC BY 4.0)
               │    ├─ greeting.js      greeting state machine
               │    └─ dog.js           Juhu
               └─ controls/ControlPanel.js   Tweakpane, ?dev only
tests/        node:test suites (scene, weather and opening, greeting)
tools/        capture.mjs: headless Chrome visual captures (npm run capture)
scripts/      fetch-weather.mjs: Open-Meteo to weather.json (CI; paused feature)
.github/      deploy.yml: test, then build, then deploy to Pages
```

## Frame loop

`main.js` runs `scene.update(dt)` and then `scene.render(ctx)` each frame.

**Update:**
1. Ease scene values towards the current preset.
2. Update the greeting state, which sets the man's speed.
3. Advance the man by distance walked, with the gait cycle measured in
   stride lengths.
4. Step the cloth and the arm springs.
5. Detect crossings, which advance the scene cycle.
6. Update Juhu and the birds.

**Render, back to front:**
1. Sky, sun, clouds.
2. Far mountains, mist, near mountains, hills, birds, palms, treeline.
3. Field base, then the far grass band.
4. Contact shadows.
5. Juhu, then the man.
6. Middle grass band, cast shadows, front grass band.
7. Rain, leaves, lighting, grain.

## Epic 1: Opening and journey

- **`chooseOpening()` in `main.js`:**
  - A forced scene comes first (`?weather=` or the dev panel).
  - Otherwise, by `opening.mode`: `shuffle` (default), `weather` (paused,
    D-1.3) or `time-of-day`.
- **Shuffle:** `chooseShuffleScene(last)`. The last scene is read from and
  written to `sessionStorage` key `wfn.lastScene`, via
  `Scene.onSceneChange`.
- **Cycle:** `nextScene()` on each crossing (`cycle.crossingsPerScene`).
- **Live weather (paused):** `weather.json` is produced in CI by
  `scripts/fetch-weather.mjs`. It's only fetched in `weather` mode, with a
  2 s limit. The removal checklist is in D-1.3.

## Epic 2: The greeting

- `greeting.js` is a pure state machine: walking → stopping → settling →
  waiting → turning → looking → smiling → returning → starting. A hover
  clock (`dwellSeconds`) or a click (`greetNow`) moves him from waiting to
  turning (D-2.2).
- **Speech bubble (D-2.3):** `#bubble` in `index.html` holds the text.
  - `src/bubble.js` places it every frame from `Scene.headPoint()` (head
    top in CSS px) and shows it while `Scene.bubbleShown` is true (facing:
    `looking` or `smiling`).
  - It samples the canvas behind the words to choose the ink and veil
    (D-2.4).
  - Hovering the bubble counts as hovering him.
  - `greeting.js` holds the smile until `readSeconds` while the bubble is
    on.
- `Scene.pointer` holds the last mouse position. Hover is re-tested from it
  every frame, with the box widened behind him while greeting.
- `Scene` plans the stop at the next both-feet-down point and passes the
  `stopFraction`.
- `drawCharacter` morphs the profile outlines into front-view twins
  (`tracePath`) and projects the limbs (D-2.1).

## Epic 3: Character and motion

- **Legs:** gait curves plus IK foot pinning. Hip height comes from the
  loading leg.
- **Arms:** driven, damped pendulums.
- **Mundu:** a Verlet cloth with leg-capsule collision. The drawn
  construction (border, wrap, waistband) is built from the cloth points.

## Epic 4: Landscape and atmosphere

- **Undergrowth:** cached in bitmaps per band.
- **Blades:** curved, with noise-driven wind and parting around the legs.
  `fieldDepth()` is derived from the ground offset.
- **Mountains:** `terrain.js`, with one lit plane per peak.

## Epic 5: Platform and delivery

- **Deploy:** GitHub Pages via `deploy.yml`, with base path `/<repo>/`. It
  runs on push to `main` and on a 30-minute schedule (the schedule exists
  only for live weather; see D-1.3).
- **Quality:** set by device type, then adapted by frame rate (D-5.2).
- **Robustness:** zero-size canvas guard.

## Epic 6: Audio

Today: `audio.js`, generated sound. Planned: recorded beds and events, a
manifest, and a generated-sound fallback. See the
[audio architecture](../product/specs/audio/architecture.md) and decisions
D-6.1 to D-6.5.
