# Living Landscape

A quiet personal site. A man walks through a field in Kerala, forever.
Juhu, his German Shepherd, joins him now and then. The weather changes.

Everything is drawn in code with p5.js. No images, no sound files.

![The six states](docs/preview-six-states.png)

## Run it

```bash
npm install
npm run dev
```

- Visitor view: `http://localhost:5173/`
- Tuning view: `http://localhost:5173/?dev`

Build for hosting with `npm run build`. The output is in `dist/`.

Run the regression tests with `npm test`. They render every preset, every
control extreme and several screen sizes headlessly, and check for NaN
geometry, sliding feet and paws, and config save/load.

## The dev panel

Add `?dev` to the URL to load it. Visitors never download it.

| Key | Action |
| --- | --- |
| `H` | Hide or show the panel |
| `Space` | Play or pause |

Panel groups: presets and playback, lighting and palette, clouds, field and
grass, character, Juhu, birds, weather, sound, and save and share.

Useful buttons:

- **Call Juhu now** starts her approach right away, so you can tune her gait.
- **Send birds now** spawns a flock.
- **Reset to preset** throws away your manual changes.
- **Download JSON** saves every setting. **Load JSON** restores them.
  Bad values in a loaded file are skipped and listed in the console.

### Locking in a look

When a scene looks right, export the JSON. Copy its `scene` values into
that preset in `src/config.js`, and any other changed values into
`createDefaultConfig()`. Tuning you don't export is lost on reload.

### Removing the panel

You don't need to. It only loads with `?dev`. If you want it gone:

1. Delete `src/controls/ControlPanel.js`.
2. Delete the `?dev` block at the bottom of `src/main.js`.
3. Remove `tweakpane` from `package.json`.

## How it works

```
src/
  main.js              p5 setup, resize, tab pause, sound button, ?dev loader
  config.js            six presets, defaults, control ranges, JSON validation
  audio.js             generated wind, rain and bird chirps (Web Audio)
  scene/
    Scene.js           state, parameter easing, wrap, render order, debug view
    util.js            coordinate constants, seeded random, colour helpers
    sky.js             sky gradient, sun or moon, stars
    clouds.js          painted cumulus clouds
    terrain.js         mountains with facets, hills, treeline, coconut palms
    field.js           grass: clumped blades, cached undergrowth, wind, parting
    character.js       the man: IK rig, feet, walk cycle, cloth springs, rim light
    dog.js             Juhu: state machine, IK legs, walk and trot gaits
    life.js            birds, rain, leaves, haze, mist, light, paint grain
  controls/
    ControlPanel.js    Tweakpane panel (dev only)
```

**One place, six conditions.** Each preset is the same set of keys:
colours and numbers. Changing preset eases every value toward the new one
over the transition time. Geometry never changes.

**Coordinates.** The scene is drawn in a 1920 × 1080 space. The field is
pinned to the bottom. Taller screens show more sky. Wider screens show more
land. Narrow screens show a centred slice, never less than 760 wide, so the
man stays readable.

**Seeded geometry.** Mountains, clouds, grass and palms come from a seed.
Same seed, same world. "New layout" in the grass group picks a new seed.

**Occlusion.** Grass is drawn in three bands. The far band sits behind the
man and Juhu. The mid and front bands sit in front, which hides their
lower legs.

**The field.** Each band has an undergrowth layer (staggered rows of fine
tufts) under its blades, so the ground never shows through. Undergrowth is
painted once into an offscreen bitmap per band and reused; it is redrawn
only when the view, colours or grass settings change. Blades grow in
fanned clumps, curve more towards the tip, and lean in a wind made of
noise drifting downwind, so gusts roll across in patches. Blades part
around the man's legs and Juhu's paws. Controls: **clumping** and
**undergrowth** in the grass group.

**The walk.** One phase value drives the legs, arms, torso and fabric, and
it advances with distance walked, not time, so the legs can never run
ahead of the ground. Walk speed and cadence (steps) are the controls;
step length follows from them. Each foot rolls heel, flat, toe while it is
down, and its pivot point stays fixed on the ground (two-bone IK). Hip
height comes from the planted leg, so the body rises over each step and
dips between them. Shoulders counter-rotate against the hips, the head
stays level, and the mundu hem and shirt tail follow on springs. The
**stride** control now sets how high the knee lifts. A low sun puts a rim
light on the side of the figure that faces it.

**Juhu.** Her states are `absent → approaching → together → departing`.
She trots to catch up, eases into a walk beside him, walks one screen width
with him, then trots ahead and leaves. She is gone for two crossings, then
returns. Her first visit comes 20 seconds after load. Her walk uses a
four-beat pattern; her trot moves diagonal legs together. Her legs use the
same IK planting as the man's, so paws stay put while they carry weight.
Her tail and ears follow her body on springs.

**Sound.** All generated, so nothing to license. Wind is shaped noise that
rises with the wind setting. Rain is filtered noise. Chirps play when a
flock enters, with a cooldown. Sound starts only after a tap on the button
in the corner.

## Swapping in recorded sound

The generated sound is a starting point. To use recordings, put loops in
`public/audio/` and play them through the same gain nodes in `audio.js`.
Candidates (check each licence and credit the recordist):

- Chalakudy River ambience, Kerala (Freesound, CC0)
- Paddy field birds, Alappuzha (xeno-canto, licence varies per file)
- "Ambiences from Suburban India", Kerala backwaters (A Sound Effect, paid)

## Notes and known limits

- The painted finish uses a generated grain overlay and gradient glows, not
  a shader. It is cheaper and works the same on every browser. A shader
  pass can come later if the look needs it.
- Mobile works but is not tuned. Quality "low" or "medium" lowers grass
  count and pixel density.
- The visitor UI is only the sound button. The site still needs a decision
  on what else a visitor finds.
