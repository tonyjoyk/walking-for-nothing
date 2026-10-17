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

Run `npm run capture` (with the dev server running) to render every scene
beside the reference sheet, the walk in both mundu states and the field
depth strip into `captures/`.

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
    character.js       the man: IK rig, feet, gait, pendulum arms, look, rim light
    gaitData.js        measured hip/knee/ankle curves (UCI, CC BY 4.0)
    mundu.js           the mundu as a Verlet cloth that wraps the legs
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

**The walk.** One phase value drives the whole body, and it advances with
distance walked, not time, so the legs can never run ahead of the ground.
The default is a slow stroll: 0.42 m steps at about 67 steps a minute, about 33
seconds per screen crossing.
- **Legs:** hip, knee and ankle follow joint angles measured from real
  walkers (`gaitData.js`), scaled to the step length. While a foot is down
  it is pinned to the ground by two-bone IK and rolls heel, flat, toe. The
  knee's small bend after heel strike sets the hip height, so the body dips
  after each contact and rises over the planted foot.
- **Arms:** driven, damped pendulums hanging from shoulders that move with
  the trunk, pulled gently towards measured arm-swing ranges. They swing
  more behind than in front, the elbow bends on the forward swing, and they
  settle to a relaxed hang when he stops.
- **Mundu:** a small Verlet cloth (five chains from the waistband) that
  collides with the legs and drapes over the seat, so the legs never show
  through above the hem. Choose folded (knee) or full (ankle) length.
- **Light:** a low sun puts a rim light on the side of the figure facing it.

The **Character** section of the dev panel has groups for body, hair,
shirt, mundu and walk: height, build, skin, hair and beard, shirt colour,
sleeve and looseness, mundu and kasavu colours, mundu length, cloth
stiffness, walking speed, steps per minute, arm swing, knee lift, bob,
and a **ground offset** that moves the man and Juhu up or down together.

**Light and shadow.** The mountains follow flat landscape illustration:
one dominant peak with smaller peaks beside it (more continue past the
frame on wide screens). Each peak's sun-facing side is a single lit plane
that fades into the haze, and distant ranges are paler with less contrast.
The man and Juhu have soft contact shadows, and long shadows that fall
across the grass when the sun is low. Grass blades darken towards their
roots.

**Field depth.** The ground offset (Character → Body) also sets how deep
the figures are in the field. Raised, the grass in front of them is short
and barely moves, so he walks on a grassy field; lowered, the hay is tall
and parts as he wades through it. **Grass parting** (Field and grass) sets
the strongest it gets.

**The mundu** has two states. **Full** reaches the ankles and hides the
legs. **Folded** is hitched up and tucked at the front, so the hem rises
towards the front and the shins show. In both, the border (dark green by
default) runs along the hem and up the edge of the outer layer, and is
drawn from the cloth's own points so it moves with it.

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

## Credits

Gait curves are the mean of the unbraced trials in the UCI Machine Learning
Repository "Multivariate Gait Data"
(https://archive.ics.uci.edu/dataset/760/multivariate+gait+data),
licensed CC BY 4.0. The values were averaged and rounded.

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
