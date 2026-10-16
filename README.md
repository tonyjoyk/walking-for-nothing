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
    field.js           three grass bands, batched by colour
    character.js       the man: rig, walk cycle, shirt and mundu
    dog.js             Juhu: state machine, walk and trot gaits
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

**The walk.** One phase value drives the legs, arms, torso bob and fabric.
Walk speed (ground travel) and cadence (steps) are separate controls.

**Juhu.** Her states are `absent → approaching → together → departing`.
She trots to catch up, eases into a walk beside him, walks one screen width
with him, then trots ahead and leaves. She is gone for two crossings, then
returns. Her first visit comes 20 seconds after load. Her walk uses a
four-beat pattern; her trot moves diagonal legs together. Leg speed is tied
to ground speed, so her feet don't skate.

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
