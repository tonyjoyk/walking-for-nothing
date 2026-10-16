# Living Landscape: visitor critique and realism plan

Reviewed: the sunset frame (man, Juhu, birds, field) and the source in
`src/scene/`. This is an expert review written from a visitor's point of
view. It is not a substitute for watching real visitors. Section 5 has a
short study to confirm it.

## 1. What a visitor sees in the first ten seconds

**Works.** The mood comes across at once. The palette is warm and
consistent, the composition is calm, and the man is the obvious focal
point. Juhu trotting in adds life. The birds and the seed heads catching
light are good details.

**Breaks the spell, in the order a visitor notices it:**

1. **His feet skate.** The legs swing, but the feet don't stay on the
   ground. It reads as gliding or moonwalking. The eye catches this fast
   because the brain is very sensitive to human gait.
2. **He has no feet.** The shins end in round caps, so the legs look like
   sticks pushed into the grass.
3. **He looks cut out of cardboard.** The torso has straight sides, the
   head is a perfect circle on a rectangle neck, and arms and legs are the
   same width from end to end. Nothing twists or tilts as he walks; only
   the limbs move.
4. **The field looks thin.** You can see the flat painted ground between
   the blades, so it reads as lines drawn over a colour rather than a
   meadow you could walk into.
5. **The grass is a set of straight wedges.** Every blade is a straight,
   rigid spike. Real grass curves and bends more towards the tip.
6. **He doesn't touch the world.** He walks through the grass without
   moving it, and he casts no shadow or rim light, even with a low sun
   behind him.

## 2. Why it happens (from the code)

### Legs and walk cycle (`character.js`, `Scene.js`)

- **Leg speed and walking speed aren't linked.** `Scene.js:127` advances
  `walkPhase` from `cadence` (0.62 cycles/s) alone. `walkSpeed` (38 px/s)
  moves the body separately. At the defaults, the body moves about
  30 px per step, but the planted foot sweeps about 90 px
  (`2 × 128 × sin 0.36`). So each foot slides backwards about 60 px every
  step. Juhu doesn't have this problem: `dog.js` already advances her
  phase by `distance / stride`.
- **The legs are pure sine waves (forward kinematics).** `legPose` swings
  the hip angle on a sine and folds the knee on a cosine. Feet are never
  pinned to the ground, so even with matched speeds the contact phase
  wobbles.
- **The body doesn't take part.** Only `bob` moves the torso. There's no
  hip tilt, no shoulders turning against the hips, no head staying level,
  and no lean that changes through the step.
- **No feet, and the thighs are hidden.** The mundu covers the thighs and
  its outline is rebuilt from the knee positions each frame. That's good,
  but its hem only flutters on a time sine; it doesn't trail the legs.

### Grass (`field.js`)

- **About 2,240 blades per 1920 px** across three bands (far 1,150,
  mid 850, fore 240), drawn one blade at a time on a Canvas 2D path. On
  `medium` and `low` quality, `grassScale` cuts that to 80% and 55%.
- **Each blade is a 5-point polygon** with one straight joint. The tip
  bend is a single lean value, so blades bend like rigid sticks, not like
  flexible leaves.
- **There's nothing between blades** except the flat `drawFieldBase`
  gradient. Clustering only changes where single blades land; it doesn't
  create clumps.
- **Wind moves every blade the same way** (one sine gust plus a sine
  sway), so the field moves like one sheet.

### Character shape (`character.js`)

- Limbs are `lineTo` strokes with fixed widths (8.6–15.5), so they look
  like tubes. The neck is `fillRect`, and the head is `arc`.
- The torso outline is symmetrical and upright, with no curve of the back
  or the line of the spine.
- Shading is a flat 50% overlay on the back half. It doesn't respond to
  where the sun is.

## 3. Established practices to use

### Walk cycle

| Practice | What it fixes | How, in this codebase |
| --- | --- | --- |
| **Phase from distance**, as games do | Foot skating | `walkPhase += 2π × distance / strideLength`, with `strideLength` worked out from the leg geometry. Keep `cadence` as a derived readout, not an input. |
| **Foot planting with 2-bone IK** (standard in game animation) | Feet sliding, wobbly contact | During stance, pin the foot at a world x and solve the knee with the law of cosines. During swing, move the foot along an eased arc to the next plant point. About 40 lines of code. |
| **Key poses, not sines** (*The Animator's Survival Kit*: contact, down, passing, up) | Mechanical, metronome feel | Write 4–8 key poses per joint as a small table and interpolate with Catmull–Rom splines. The low point comes just after contact; the high point is at passing. |
| **Counter-rotation and weight shift** | Rigid torso | Hips tilt towards the stance leg, shoulders turn against the hips, the head stays nearly level (damp `hb` more), and he leans slightly forward. |
| **Overlap and follow-through** (spring–damper on secondary parts) | Mundu and arms feel attached rather than alive | Give the mundu hem, shirt tail and hands a simple spring (`v += (target − x) × k; v *= damping`). The hands then trail the arm by about 10–15% of the cycle. |
| **Reference tracing** | Uncanny proportions of motion | Trace hip, knee and ankle angles from a side-view video of someone walking in a mundu into a curve table. Rotoscoping like this is the fastest way to make motion look real. |
| **Heel–toe roll** | Contact reads as flat | With feet drawn, rotate the foot heel-first on contact and toe-last on lift-off. |

### Grass

| Practice | What it fixes | How |
| --- | --- | --- |
| **Paint the mass first, then the blades** (how illustrators and games such as *Ghost of Tsushima* or *Alto's Odyssey* layer grass) | Ground showing through | Before the blades, draw a soft, noisy silhouette layer per band: a wavy filled shape slightly darker than the blades. Visual density goes up a lot for very little cost. |
| **Clumps, not single blades** | Thin, evenly scattered look | Each clump puts 6–15 blades on a shared base and fans them out. Same blade budget, much fuller look. |
| **Curved, tapered blades** | Rigid spikes | Build the blade as a quadratic Bézier with the bend growing towards the tip (`bend × t²`), narrowing to a point. |
| **Cached blade sprites** or **WebGL instancing** | Not enough blades for real density | Option A: pre-render 20–40 clump sprites to an `OffscreenCanvas` and draw them with `drawImage` and a skew for wind (5–10× more grass at the same cost). Option B: move the field to a p5 `WEBGL` layer or a shader with instanced blades (50k+ blades at 60 fps). Start with A. |
| **Noise-field wind** | The whole field moves as one sheet | Sample 2D Perlin or simplex noise scrolling in the wind direction, and give each blade its own stiffness. Gust waves then visibly roll across the field. |
| **Depth colour and backlight** | Flat look | Make far blades bluer and lighter (atmospheric perspective), and give the tips a warm rim when the sun is low. |
| **Interaction** | He doesn't touch the world | Push blades within ±40 px of each leg away from it, with a spring return. Visitors register this as "real" almost instantly. |

### Character silhouette

| Practice | What it fixes | How |
| --- | --- | --- |
| **Tapered limb shapes** | Tube limbs | Draw each limb segment as a filled shape with a different width at each end (thigh wider than knee, calf bulge, narrow wrist), not a fixed-width stroke. |
| **Line of action** | Upright, symmetrical torso | Give the back a gentle S-curve and the chest a slight forward lean, and let the shirt drape (a few creases at the waist and elbow). |
| **Organic head and neck** | Circle on a rectangle | A slightly egg-shaped head, a jaw line, and a neck that tapers into the trapezius. |
| **Light that matches the sky** | Flat cutout | Rim light on the edge facing the sun, and shade from the scene's light direction rather than a fixed half. |
| **Rig authored outside code** (optional, bigger change) | All of the above, faster | Draw the figure in Figma or Illustrator and animate it in Rive or Spine. Both have web runtimes that can sit over the p5 canvas. Only worth it if hand-drawn polish matters more than "all in code" (the README currently promises everything is drawn in code). |

## 4. Prioritised recommendations

| # | Change | Visitor impact | Effort |
| --- | --- | --- | --- |
| 1 | Drive `walkPhase` from distance travelled (like `dog.js`) | High: stops the skating | Very low |
| 2 | Add feet, plus IK foot planting with heel–toe roll | High | Medium |
| 3 | Grass mass layer under each band, plus clumps | High: field reads as dense | Low–medium |
| 4 | Curved, tapered blades and noise-field wind | Medium–high | Low–medium |
| 5 | Tapered limbs, S-curve torso, head and neck shape | Medium–high: less boxy | Medium |
| 6 | Hip tilt, shoulder counter-rotation, level head | Medium | Low |
| 7 | Spring-based secondary motion (mundu, shirt, hands, Juhu's tail and ears) | Medium | Low |
| 8 | Grass parting around legs and paws; sun rim light | Medium: "it's alive" moments | Medium |
| 9 | Cached sprites or WebGL for 5–10× more grass | Medium; needed if 3–4 aren't enough | Medium–high |
| 10 | Apply the same foot planting to Juhu | Low–medium | Low (reuses #2) |

Suggested order: 1 → 3 → 2 → 5/6 → 4 → 7 → 8. Items 1 and 3 alone fix the
two things visitors will notice first.

## Status (16 Oct 2026)

All ten recommendations are implemented; `npm test` covers the measurable
ones. Before/after captures are in `docs/compare/`.

| # | Result |
| --- | --- |
| 1 | Gait advances with distance. Planted-foot slide: 61.7 px → 0 px per step. |
| 2 | Feet drawn; heel–toe roll with IK; pivot point fixed on the ground (tested < 1 px). |
| 3 | Undergrowth layer plus clumps. After visitor feedback ("hay fields are more continuous") the undergrowth became the body of the field. |
| 4 | Curved, tapered blades; noise-field wind with per-blade stiffness; haze on far grass; backlit tips. |
| 5 | Tapered limbs with calf and forearm shape, S-curve torso, drape creases, egg-shaped head, tapered neck. |
| 6 | Hip height from the planted leg; shoulder counter-rotation; forward lean; level head. |
| 7 | Springs on mundu hem, shirt tail, Juhu's tail and ears; forearms trail. |
| 8 | Grass parts around legs and paws; sun-side rim light on the figure. |
| 9 | Undergrowth cached as bitmaps. Median frame 26 ms vs 54 ms for v0.1 in the same browser; 60 fps live. |
| 10 | Juhu's paws use the same IK planting (tested < 2 px). |

## 5. A light study to confirm this with real visitors

- **Who:** 5–6 people who don't know the project. Include at least two
  who know Kerala.
- **Method:** a 5-second test followed by a 10-minute moderated session,
  before and after each round of fixes.
- **5-second test:** show the page, then hide it. Ask: "What did you see?
  Where was it? What felt off?"
- **Session questions:**
  1. Describe the man. What's he doing, and how does he move?
  2. Did anything look fake or distracting? Point to it.
  3. How long would you leave this tab open? Why?
  4. Does it feel like Kerala to you? What adds to that, and what takes
     away from it?
- **Watch for:** where people look first, any mention of "sliding",
  "stiff", "cartoon" or "thin", and whether they keep watching after Juhu
  arrives.
- **Success:** nobody spontaneously mentions sliding feet or sparse grass,
  and at least 4 of 6 describe the walk as natural.
