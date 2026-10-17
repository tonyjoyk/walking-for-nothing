# Character and scene study

**Date:** 17 Oct 2026. **Scope:** the man's walk, arm swing, mundu, shirt
and customisation; a ground-offset control; grass density; mountain
shading; small changes that make the scenes feel more natural.

**How this was done:**
- I captured close-ups of the current build (`docs/study/current-walk-cycle.png`).
- I read the rig, field and terrain code.
- I reviewed published gait data, animation practice and 2D cloth and
  landscape techniques. Sources are at the end.

This is an expert review from a visitor's point of view, not a study with
real visitors. The visitor test plan in `visual-critique.md` still
applies.

No code has been changed. Everything below is a proposal.

---

## 1. Why the walk still doesn't look natural

From a visitor's point of view he shuffles. The legs move, but he covers
almost no ground per step, and the arms swing more than the legs.

Measured from the code at the default settings:

| Measure | Now | A real slow stroll | Source |
| --- | --- | --- | --- |
| Step length | **0.20 m** (31 px; 150 px = 1 m for a 1.75 m man) | 0.50–0.60 m | Winter; Senden 2024 |
| Walking speed | 0.25 m/s (38 px/s) | 0.6–0.9 m/s | Senden 2024 |
| Cadence | 74 steps/min | 80–95 steps/min | brief; Winter |
| Hip swing (thigh angle) | ±8° | +30° to −10° (40° range) | Winter |
| Knee bend while carrying weight | ~5°, constant | 10–20° just after heel strike, then straightens | Winter |
| Knee bend at peak swing | ~40° | 55–60° | Winter |
| Arm swing (shoulder) | ±20°, symmetric | +8° forward to −25° back (~30°) | Murray 1967 |
| Elbow bend | 11–28° | 8° at back swing, 35–45° at front swing | Murray; 2023 study |

**Root cause: the pace.** The brief asks for a 60–90 second screen
crossing and 80–90 steps a minute. For a figure this size, those two
together force tiny steps. Every other number in the table follows from
that.

**Decision for you:**
- Option A: longer steps, faster crossing. About 0.47 m steps at 60
  steps/min means a crossing of about 33 s.
- Option B: keep the slow crossing and accept a shuffle.
- Option C: make the man smaller, about 0.7×. That keeps a slow crossing
  with natural steps, but he gets smaller on screen.

**My recommendation:** Option A. The slow, calm feel then comes from a
low cadence, not from short steps.

**Other gaps, smaller than the pace:**
- **No "down" pose after contact.** Real stance knees flex 10–20° at
  loading, then straighten. Ours stay straight, so the walk looks stiff
  and weightless (*The Animator's Survival Kit*: contact → down → passing
  → up).
- **Swing is a symmetric arc.** Real swing lifts the heel sharply first,
  peaks the knee at about 72% of the cycle, then extends the shin before
  contact.
- **Arms are a plain sine.** They don't respond to the body, so they look
  attached rather than carried.

### What to reuse

| Resource | Use | Licence |
| --- | --- | --- |
| **UCI "Multivariate Gait Data"**: 10 healthy subjects, hip, knee and ankle angles at 101 points per cycle | **Use it.** Average the unbraced trials into three 101-value curves stored as JS arrays. They drive the joint targets directly and replace our hand-made ones. | CC BY 4.0 (credit in README) |
| Winter / Perry normative values (table above) | Check our curves against these numbers, and use them in the tests | Textbook values |
| David Rosen, *An Indie Approach to Procedural Animation* (GDC 2014) | The approach: phase advances with distance travelled (we already do this), a few key poses blended by phase, springs on top for weight, IK for foot contact | Talk; ideas only |
| *The Animator's Survival Kit* walk poses | Check the cycle against them, especially the "down" pose | Book |
| Collins, Adamczyk and Kuo 2009; Pontzer 2009 | Arm swing is mostly **passive**: a pendulum driven by the shoulder's motion, with light muscle control | Papers |
| Jakobsen, *Advanced Character Physics*; verlet-js | Verlet cloth with distance constraints and collision pushing; about 80 lines, no dependency | Article; MIT |
| Spine, Rive | Skip. Both need a separate editor, and the man is drawn in code. | Paid; MIT |

### Proposed walk changes

1. **Joint angles from data.**
   - Hip, knee and ankle angles come from the UCI curves, scaled by how
     long the step is.
   - IK still pins the planted foot, so it never slides. It only
     corrects where the foot lands; the leg shape comes from the data.
   - This adds the "down" pose, the sharp toe-off and the late knee peak
     in swing.
2. **Pace defaults.** Per your decision above: about 60 steps/min with
   0.45–0.5 m steps. The hip and knee ranges then grow to about 70% of
   normal-walk values.
3. **Arm swing as a driven pendulum.**
   - The upper arm and forearm form a damped double pendulum hanging from
     the shoulder, driven by the shoulder's movement.
   - A weak spring pulls it towards the gait curve (shoulder +8°/−25°,
     elbow 8–45°) so it stays in step with the legs.
   - Damping: about 0.2 at the shoulder and 0.4 at the elbow.
   - The arm lags the opposite leg by 5–10% of the cycle, and the forearm
     lags the upper arm by a further 5–10%.
   - The result: the arms respond to speed changes and settle when he
     stops, instead of swinging like a metronome.
4. **Pelvis and trunk.**
   - The pelvis tilts ±2°, twice per cycle.
   - The trunk rotates slightly against the pelvis.
   - The centre of mass rises and falls about 4 cm, highest over each
     planted foot. We already do this; only the amount needs tuning.

---

## 2. The mundu

**What the visitor sees:** "I can see his legs through it." That
impression comes from three things in the drawing:

- **The shaded back panel.** It's a 45%-opaque rectangle whose edge is
  placed from the rear knee, so a vertical line tracks the leg.
- **The two fold lines.** They are positioned from each knee, so they
  move exactly like thighs.
- **The hem.** It's a rigid bell-shaped curve between the knees, so it
  reads as a skirt on a frame, not cloth.

**Proposal: a small Verlet cloth.**
- **Structure:** 5 vertical chains (front edge, 3 middle, back edge), 6
  points each, pinned to the waistband.
  - Distance constraints run along each chain, with looser ties between
    neighbouring chains.
  - Light bending stiffness keeps it reading as cloth, not rope.
  - 6 constraint passes, damping 0.97, gravity, and slight drag from the
    walking speed so the hem trails behind.
- **Leg collision:** after each pass, any cloth point inside a thigh or
  shin capsule (leg width plus 3 px) is pushed out. The striding knee
  pushes the front of the hem forward, and the cloth settles back on its
  own.
- **Drawing:**
  - Fill a smooth curve through the chain points, fully opaque.
  - Shade the cloth only from the light direction, never from leg
    positions.
  - Draw one or two folds that follow the cloth points between the
    chains, so they don't track the legs.
  - The kasavu border follows the hem points.
- **Draw order:** far leg, cloth, then the near leg below the hem only.
  No leg line is ever drawn above the hem.
- **New option: mundu length**, folded (knee) or full (ankle). Full
  length hides the legs completely, which also hides any remaining
  awkwardness in the walk.

---

## 3. A control to raise or lower the man and Juhu

- Add **"ground offset"**, −20 to +20 px, in a new **Character** section
  of the dev panel.
- It moves the man and Juhu together, along with their grass parting and
  shadows.
- Lowering them a little sinks the feet into the grass, which hides foot
  contact if it ever looks wrong.
- It's saved in exported JSON and checked on import, like every other
  setting.

---

## 4. Grass density

- The slider tops out at 1.0, which is the default field.
- **Proposal:** generate twice as many blades up front and allow density
  up to **2.0**. Blades are assigned ranks so that 1.0 looks exactly like
  today. The undergrowth also gets thicker as density goes up.
- **Cost:** blades are about 1.5 ms of a ~26 ms frame today, so at 2.0
  that cost roughly doubles. Fine on desktop. "Medium" and "low" quality
  still scale density down for phones.

---

## 5. Mountains: simple but natural

**Why the shadows look wrong:**
- Each peak gets one bright triangle and one dark triangle. Their sides
  run straight from the peak to the ground, ignoring the actual ridge
  line, so they don't follow the terrain.
- The shadow colour is the base colour darkened to 82%. Outdoor shadow
  is lit by the sky, so it should be cooler, take the sky's hue, and be
  less saturated, not just darker.
- The far and near ranges get the same strength of light/shadow
  contrast, so there's no sense of depth between them.

**Proposal** (keeps the flat, faceted style):
1. **Light each ridge segment by its slope.** Compare each segment's
   facing with the sun direction (standard hillshading in 2D), then fill
   the band under that segment with a lit or shadow colour.
   - Two or three flat tones per range, not gradients, to keep the flat
     style.
2. **Shadow colours from the sky:**
   - Shadow: base colour mixed 40% towards the sky's zenith colour, then
     about 20% darker.
   - Lit side: base colour mixed 20% towards the sun colour.
   - Every preset gets correct shadows automatically, including night and
     rain.
3. **Atmospheric perspective.** Shading contrast drops with distance: the
   far range shows about 40% of the near range's contrast.
4. **Gully lines.** From each peak, and more faintly from each saddle, a
   jittered line drops down the shadow side. The shadow fills the area
   between that line and the slope facing away from the sun.
5. **Rim light on the near range only.** A 1–2 px warm line along crests
   that face a low sun.

All of this stays inside `terrain.js`; the generated mountain shapes
don't change.

---

## 6. Small changes that make every scene feel more natural

In order of payoff for the effort:

| Change | Why it reads as natural | Effort |
| --- | --- | --- |
| **Contact shadow** under the man and Juhu: a soft ellipse in a darkened ground colour, blended to darken | Today he floats on the field. A shadow ties him to the ground. | Tiny |
| **Long cast shadow when the sun is low:** his squashed, skewed silhouette falling away from the sun, fading out | Twilight and dawn get depth for free | Small |
| **Darker blade roots:** each blade shades from undergrowth colour at the root to full colour by about 30% of its height | Blades grow out of the ground instead of sitting on it | Small |
| **Soft shadow strip** at the foot of each undergrowth row (6–12 px) | Layers read as depth, not stacked cards | Tiny |
| **Light wrap:** a 1–2 px sky-coloured edge on the treeline and hill crests facing the sun | Softens cut-out edges | Tiny |
| **Bounce light:** warm the bottom 15% of the near hills and treeline about 10% towards the field colour | Hills sit in the landscape | Tiny |
| **One palette rule:** take shadow, haze and rim colours from the sky colours rather than separate constants | Every preset stays coherent | Small |

---

## 7. Character visuals and a "Character" control section

### Shirt

The waist creases today are fixed lines.

- **Folds that follow the body:** draw two or three creases from the
  armpit towards the opposite hip. Their angle follows the arm swing, and
  they stretch on the side where the arm swings back.
- **Hem flutter:** add a little ripple on the shirt hem from the same
  spring that drives the shirt tail.
- **Shading:** shade the back half of the shirt from the light direction,
  not as a fixed half.

### Arms

- The pendulum arm from section 1.
- A slightly bent, relaxed elbow when the arm hangs.
- The hand rotates a little with the forearm, not as a fixed oval.

### New "Character" section in the dev panel

| Group | Controls |
| --- | --- |
| Body | height, build (shoulder width and belly), skin tone, ground offset |
| Hair | hair colour, beard on/off, beard colour |
| Shirt | colour, sleeve (short / elbow / long), how loose it is |
| Mundu | colour, kasavu colour, length (folded / full), cloth stiffness |
| Walk | step length, steps per minute, arm swing, knee lift, bob |

Each control saves to exported JSON and is validated on import, as now.

---

## 8. A bug found during the study

If the page loads while its tab or pane has zero size, the view
calculation produces NaN. The man's position then stays NaN even after the
window gets a real size, so he disappears.

This bug was already in v0.1. The fix: skip the view update when the
canvas size is 0, and add a test that covers it.

---

## Recommended order and size

| Step | What | Size |
| --- | --- | --- |
| 1 | Decide the pace (section 1) | Your call |
| 2 | Ground offset control, density up to 2.0, zero-size bug fix | Small |
| 3 | Contact and cast shadows, blade roots, row shadow strips | Small |
| 4 | Mountain shading by slope, sky-coloured shadows, gully lines, rim light | Medium |
| 5 | Verlet mundu with leg collision and length option | Medium |
| 6 | Data-driven leg angles (UCI curves) on top of the IK | Medium |
| 7 | Pendulum arms; shirt folds that follow the arm | Medium |
| 8 | Character section in the dev panel (colours, build, hair, garment options) | Medium |

Each step lands with tests (`npm test`) and before/after captures, as in
the last round.

---

## Sources

- UCI Multivariate Gait Data (CC BY 4.0): https://archive.ics.uci.edu/dataset/760/multivariate+gait+data
- CGA Normative Gait Database: https://clinicalgaitanalysis.com/data/
- Senden et al. 2024, gait at several speeds: https://pmc.ncbi.nlm.nih.gov/articles/PMC10912446
- Collins, Adamczyk and Kuo 2009, arm swing dynamics: https://pmc.ncbi.nlm.nih.gov/articles/PMC2817299
- Pontzer et al. 2009, arms as passive dampers: https://pubmed.ncbi.nlm.nih.gov/19181900/
- David Rosen, GDC 2014: https://gamedeveloper.com/design/video-an-indie-approach-to-procedural-animation
- Jakobsen, Advanced Character Physics: https://gamedeveloper.com/programming/advanced-character-physics
- verlet-js (MIT): https://github.com/subprotocol/verlet-js
- Outdoor lighting (key, sky fill, bounce): https://iquilezles.org/articles/outdoorslighting/
- Colour of shadows: https://bradteare.com/18-the-color-of-shadows/
- Hillshade formula: https://pro.arcgis.com/en/pro-app/latest/tool-reference/3d-analyst/how-hillshade-works.htm
- Firewatch art notes: https://blogs.ulster.ac.uk/bethbuchanan/2021/03/05/ixd104-further-looking-into-the-art-of-firewatch
- Alto's Adventure art: https://80.lv/articles/altos-adventure-a-game-with-style
- Stylised grass ambient occlusion: https://godotshaders.com/shader-tag/ambient-occlusion/

Not every figure in section 1 was checked against its original source:
the Winter and Murray values are standard textbook figures. Before
tuning, the UCI dataset will be the reference we actually measure
against.
