# Creative Engineering Brief: A Living Landscape Personal Website

> **Revision 2 (16 Oct 2026).** Changes from revision 1:
> style set to soft painted shapes with subtle low-poly geometry;
> coconut palms made required; grass reference fixed (there is no
> "top-middle" panel); Juhu's rhythm set to two crossings alone, one
> with her, with an early first visit; dog gait specified; walk rig
> and Figma key poses added; Tweakpane replaces the custom panel and
> sits behind a `?dev` flag; wind sound made in code; a post-process
> shader pass added for painted texture; mobile prep moved to day one;
> build order cut down to the sunny scene first; sound sources listed.

## 1. Mission

Build a quiet, immersive personal website whose main experience is a
continuously looping illustrated landscape. A single South Indian man
walks through a field while the weather, light, sky, and small
environmental details change. The experience should feel like entering a
contemplative animated world---not browsing a portfolio, product landing
page, or conventional personal website.

Use the attached six-frame mood-board image as the primary visual
reference. It establishes the intended composition, atmosphere, palette
shifts, stylised landscape, character scale, and alternate environmental
states. Treat it as art direction, not as a literal image to reproduce.
The final scene must be generated in code: do not use the reference
image as a background, sprite sheet, or texture.

The central design principle is **one persistent place, experienced
under changing conditions**. Every scene should share the same geometry,
horizon, field, mountains, and character design. Weather and time of day
should be expressed primarily through parameters and restrained
overlays---not by rebuilding the scene from scratch.

## 2. Product and artistic intent

### Desired feeling

-   Calm, spacious, grounded, reflective, and quietly alive.
-   Minimal in composition, but not sterile or empty.
-   Cinematic environmental storytelling: the landscape should do most
    of the emotional work.
-   A stylised world of **soft painted shapes with subtle low-poly
    geometry**. Forms are flat and soft-edged, like a Ghibli background.
    Low-poly shows only as gentle facets on mountain faces, cloud
    undersides, and grass clusters. It should never read as a 3D
    low-poly render.
-   Organic enough to feel handmade; structured enough to render
    consistently in code.
-   A slow horizontal journey that can run indefinitely without an
    obvious reset.

### Visual references and boundaries

The mood board evokes the scale, solitude, simplified silhouettes,
geometric terrain, atmospheric light, and meditative pacing of
*Journey*, alongside the softness and environmental warmth associated
with Studio Ghibli. Use these as broad mood references only. Do not copy
specific characters, locations, assets, compositions, or proprietary
visual details.

The Kerala rural landscape reference suggests a person partly concealed
by tall paddy or hay-like grass. Do not turn this into a literal
photorealistic rice field. Keep the existing stylised hill-and-mountain
setting, but make the foreground read clearly as a field of tall grass or
grain.

**This place is Kerala.** The scene should feel like the Ghibli mood
transplanted to rural Kerala, not a generic meadow. The cheapest and
clearest signal is a sparse row of coconut palm silhouettes along the
middle ridge line, as in the mood board. Western Ghats-style layered
hills support this. Keep the palms few, small, and soft; they set the
place without becoming a subject.

### Avoid

-   A conventional portfolio aesthetic: cards, grids, project
    thumbnails, hero copy, navigation-heavy layouts, or decorative UI.
-   Photorealism, glossy 3D, hard outlines, chibi/anime proportions, or
    overly cute character design.
-   Dense vegetation that hides the entire scene.
-   Overly saturated colours, aggressive contrast, dramatic particle
    effects, or rapid movement.
-   A slanted ground plane. The field's overall walking line must be
    visually horizontal.
-   Changes in camera, character proportions, landscape geometry, or
    framing between weather states.
-   Using AI-generated raster artwork as the final scene. All core scene
    geometry and animation must be implemented procedurally in code.

## 3. Technical approach

### Recommended stack

Use **p5.js in JavaScript** for the procedural illustration and
animation. Build a small, maintainable web application around it.

Preferred baseline:

-   Vite for local development and bundling.
-   p5.js for drawing, animation, and input.
-   Plain JavaScript modules unless the existing project already uses
    TypeScript or React.
-   **Tweakpane** for the temporary tuning panel (see section 11).
-   Web Audio API for sound, started after user interaction.
-   No 3D engine for the initial version.

**Keep the drawing layer swappable.** p5 runs on 2D canvas, which has a
ceiling for thousands of animated blades on phones. All positions use
the scene's own units, and all state and timing live outside p5 calls.
If performance requires it later, the drawing can move to PixiJS
without rewriting scene logic, presets, or the dog state machine.

If the repository already has an established framework, preserve it
where practical. Do not introduce a large framework solely for this
scene.

### Rendering strategy

Use p5.js 2D Canvas as the default. Build the scene from layered vector
geometry, gradients, polygons, ellipses, lines, and controlled noise.
Use deterministic pseudo-random generation for static terrain and
vegetation so that objects do not flicker or rearrange on every frame.

Organise rendering into separate modules or clear functions, for
example:

-   `drawSky()`
-   `drawSunMoon()`
-   `drawClouds()`
-   `drawDistantMountains()`
-   `drawFarVegetation()`
-   `drawField()`
-   `drawCharacter()`
-   `drawDog()`
-   `drawBirds()`
-   `drawRain()`
-   `drawWindEffects()`
-   `drawAtmosphere()`

Keep scene state, rendering, animation, and UI controls separate. Avoid
a single monolithic `draw()` function full of hard-coded values.

**Painted finish.** Flat canvas fills look clean and digital. The
reference's softness comes from four things: smooth gradients, soft
cloud edges, haze, and a faint painted grain. Gradients can use the
canvas `createLinearGradient` / `createRadialGradient` API. Soft cloud
edges come from a few stacked low-alpha shapes, not blur filters. Grain
and a gentle sun glow come from **one post-process shader pass** over
the finished frame (p5 supports shaders). The grain texture is
generated in code once at startup, never loaded as an image. Expose
grain amount and glow strength as parameters, and allow the shader pass
to be switched off on the low quality tier.

### Resolution and responsiveness

Web is the priority, but mobile comes next. Do this mobile prep from day
one, since it is cheap now and costly to retrofit:

-   Draw in a fixed logical scene space of 1920 × 1080, then scale to
    the canvas.
-   Pin the field to the bottom of the viewport. On taller screens
    (portrait phones), extend the sky upward rather than cropping the
    sides. The character must never be cropped.
-   Fill the viewport with no scrollbars.
-   Use pointer events, not mouse events, so touch works for free.
-   Cap pixel density at 2. Expose one `quality` setting (low / medium /
    high) that also scales grass blade count and rain particle cap.
-   Render static far layers (sky gradient, mountains, palms, far grass)
    once into off-screen buffers. Animate only near grass, characters,
    clouds, birds, and weather.
-   Pause the loop and audio when the tab is hidden
    (`visibilitychange`) to save battery.
-   Respect `prefers-reduced-motion`: reduce or pause continuous motion
    when requested.
-   No interaction may depend on hover.
-   Avoid allocating large numbers of objects every frame.

## 4. Composition and fixed world geometry

The attached mood board contains six environmental states. The
reference's most important features are the small walking figure, broad
open sky, layered angular mountains, distant haze, and a grassy
foreground.

Build one persistent composition with these depth layers:

1.  **Sky:** a large, open field of colour. It should occupy a
    substantial portion of the frame.
2.  **Sun or moon:** a restrained luminous disc, with a configurable
    halo and position.
3.  **Clouds:** soft-edged but stylised clusters, with a few distinct
    layers at different depths.
4.  **Distant mountain silhouettes:** broad, angular, low-poly ridges in
    muted blue-green or atmospheric colours.
5.  **Middle-distance landscape:** subtle rolling terrain with a
    sparse row of coconut palm silhouettes and a few soft tree clumps.
    Palms are required (see section 2).
6.  **Field:** a mostly horizontal band across the lower portion of the
    frame. Individual grass or grain blades create rhythm and depth.
7.  **Character:** located in the lower third, walking steadily toward
    the right. The figure should be partly occluded by foreground grass.
8.  **Optional foreground accents:** a few pale seed heads or tiny
    flowers. These should be sparse.

### Horizon and ground

The field must read as level from left to right. Do not use the steep
diagonal slope seen in some earlier concepts. A small amount of organic
variation in individual grass tips is fine, but the overall top line of
the field should remain broadly horizontal.

The character should appear to move through the field rather than walk
on top of it. Grass should obscure the lower legs and most of the mundu
at times. A small visible section of the white mundu is enough to
communicate the garment and walking motion. Keep the upper body clearly
readable above the grass.

### Visual depth

Create depth with: - Reduced contrast and saturation for distant
elements. - Slight colour shifts by depth layer. - Soft atmospheric haze
near the horizon. - Subtle overlap between mountain layers. - More
detailed, darker, sharper grass in the foreground. - Simpler and lighter
grass in the distance.

Do not rely on blur filters for every layer. The style should remain
graphic and intentionally composed.

## 5. Character specification

The character represents a 34-year-old man from Kerala. It should feel
like a personal, grounded representation rather than a generic fantasy
traveller.

### Clothing and silhouette

-   A simple **brown full-sleeve shirt with sleeves folded/rolled to
    around the elbows**.
-   A traditional **white mundu**, folded up to around the knee or above
    the knee in the manner suggested by the supplied real-life clothing
    reference.
-   No cape, cloak, scarf, backpack, or fantasy accessories.
-   Barefoot or very understated footwear is acceptable; choose
    whichever reads best at the small scale and keep it consistent.
-   Natural, understated proportions. Avoid exaggerated limbs or an
    oversized head.

### Face and hair

-   Short dark hair.
-   A subtle short beard/stubble.
-   South Indian appearance conveyed respectfully through the
    character's overall design, not through caricature or exaggerated
    facial features.
-   Facial detail should be minimal at the intended scale. Prioritise
    the head shape, hair, beard silhouette, shirt, and mundu.

### Scale and visibility

-   The character should remain small relative to the landscape, similar
    to the figure in the mood board.
-   Keep the upper body visible above the grass.
-   Let the grass occlude the lower body naturally. Do not render the
    entire legs as a prominent focal point.
-   The character should be recognisable through a stable silhouette and
    clothing palette, not detailed facial rendering.

### Walking animation

Create a slow, loopable walk cycle with:

-   Subtle alternating arm movement, opposite to the legs.
-   A restrained torso bob.
-   Small alternating leg motion, mostly hidden by the field.
-   A little fabric movement at the shirt hem or mundu edge.
-   No exaggerated bounce or cartoon gait.

**Build the figure as a simple rig:** head, torso, upper and lower arm,
upper and lower leg, and a mundu shape. Each joint rotates on a smooth
curve driven by one shared phase value. Expose only high-level controls
(stride, cadence, bob, arm swing, fabric motion).

**Cadence:** a calm stroll is roughly 80 to 90 steps per minute. Start
slower than feels right and tune up.

**Key poses first:** before coding the rig, draw 3 or 4 key poses of the
man (contact, passing, and the mirrored pair) and of Juhu in Figma as
flat shapes. The rig is tuned to hit these poses. This keeps the motion
designed rather than guessed.

The walk cycle should be independent from horizontal movement. Use
a phase variable so that speed, stride, and body motion can be adjusted
separately.

The character should move continuously toward the right. When the
character exits the right edge, wrap them around to the left without a
visible jump. Use a small off-screen transition region or a second
smoothly positioned instance if needed. Avoid a moment where the
character visibly teleports across the centre of the screen.

## 6. Field and grass

The grass style should follow the **grass in the Sunny panel (top-left)
of the six-panel mood board**: stylised angular blades, layered green
shapes, a few pale seed heads, and enough texture to feel alive without
becoming dense or noisy.

Requirements: - The field is the visual foreground and should clearly
suggest tall grass or grain. - Use clusters of blades with varied
height, angle, width, and muted green-yellow tones. - Avoid a uniform
repeating pattern. Use seeded pseudo-random variation and deliberate
clustering. - Keep gaps between clusters so the field does not become a
solid wall. - Add only a small number of cream or pale yellow seed
heads/flowers. - Use a few depth bands: distant short blades, midground
blades, and foreground blades that overlap the character. - Animate
blade sway using smooth periodic functions rather than random per-frame
movement. - Wind should affect blade angle and bend amplitude; rain can
affect highlights and motion subtly. - Maintain the same vegetation
layout across all weather scenes. Only lighting, wind response, rain,
and a few optional details should change.

Provide parameters for density, average height, height variation, sway
amplitude, sway speed, foreground occlusion, and flower/seed-head
frequency.

## 7. Dog: Juhu

Juhu is the user's German Shepherd. The dog should be a supporting
detail, not a constant companion or a focal point.

### Appearance

-   Recognisable German Shepherd silhouette: upright ears, long muzzle,
    athletic body, bushy tail, dark saddle, and warm tan legs/underside.
-   Stylised to match the same low-poly / soft-vector world.
-   Do not use a photorealistic dog or a cute cartoon-dog design.
-   Keep details sparse at the target scale.

### Behaviour

-   The sunny state is dog-enabled. Which other states include Juhu is
    decided later and stays configurable.
-   Juhu enters from the left or approaches from behind, catches up,
    then walks alongside him.
-   **The catch-up gait is a trot, not a gallop.** A gallop at this
    scale looks frantic. German Shepherds have a long, low,
    ground-covering trot.
-   **Gait reference:** a dog's walk is a four-beat sequence: left hind,
    left fore, right hind, right fore. A trot moves diagonal pairs
    together (left hind with right fore, and so on).
-   The trot-to-walk blend is the part most likely to look fake. Give it
    its own duration and easing controls.
-   At the end of the appearance window, Juhu drifts ahead or falls
    behind and leaves the frame. The man remains alone.
-   Avoid having the dog suddenly pop into view.
-   Juhu is beside and slightly behind the man in a consistent depth
    relationship, and partly occluded by grass.

Implement this as a small state machine:
`absent → approaching (trot) → easing (trot to walk) → walkingTogether
→ departing → absent`.

**Rhythm:** the man walks alone for **two screen crossings**, then Juhu
joins for **one crossing**, then repeat. "Frame" in the user's original
notes means a screen crossing, not a rendered animation frame. Make
both counts configurable.

**Early first visit:** at a calm pace one crossing takes 60 to 90
seconds, so the rhythm alone would bring Juhu in only every few
minutes. Most visitors leave sooner. Juhu's first appearance should
start within about 20 seconds of page load, then fall into the rhythm.
Make this delay configurable.

**Testing:** the dev panel includes a "Call Juhu now" button that
starts the approach immediately, so her gait can be tuned without
waiting.

## 8. Birds

Birds should appear in the sunny scene only by default, with the option
to enable them elsewhere.

-   A small flock enters from the left edge, travels across the sky, and
    exits on the right.
-   Use a simple, elegant silhouette built from a few curved or angled
    strokes.
-   Vary bird size slightly to imply distance.
-   Use a restrained, asynchronous wingbeat; do not animate every bird
    identically.
-   Bird movement should be slow and unobtrusive.
-   Trigger optional bird chirps when a flock enters, not continuously.
-   Expose flock size, speed, altitude, spacing, wingbeat speed, and
    spawn interval.
-   Keep the sky spacious. Birds should occupy only a small portion of
    the frame.

## 9. The six environmental states

Create six named presets using the same underlying scene geometry. The
first five are required conditions; the sixth is an artistic choice that
complements the set.

### Scene A --- Sunny

This is the baseline and the most important state. Match the overall
mood of the top-left panel in the supplied six-frame mood board and the
low-poly style chosen earlier.

-   Clear pale blue / blue-green sky.
-   Warm, soft sunlight with a subtle halo.
-   Cream clouds with simple faceted forms.
-   Muted blue-green mountains.
-   Fresh green and yellow-green grass.
-   Warm brown shirt and white mundu.
-   Birds may cross the sky.
-   This state should feel bright but not harsh or oversaturated.

### Scene B --- Twilight

-   The same composition at sunset or dusk.
-   Sky transitions through muted peach, coral, dusty rose, and
    lavender.
-   Sun sits low near the horizon, or is partially hidden by a ridge.
-   Mountains shift toward muted mauve and deep blue.
-   Grass becomes warmer and slightly darker.
-   Keep the character silhouette legible.
-   Mood: reflective, still, quietly hopeful.

### Scene C --- Night

-   Deep navy and muted indigo sky.
-   A softly glowing moon and sparse stars.
-   Clouds and mountains remain visible as low-contrast silhouettes.
-   Grass is dark teal/green, with just enough edge light to preserve
    depth.
-   Use restrained moonlight on the character and mundu.
-   Avoid a black screen, excessive stars, neon colours, or dramatic
    fantasy effects.
-   Optional: very subtle cloud drift.

### Scene D --- Rain

-   Cool grey-blue sky, softened mountain contrast, and a low cloud
    ceiling.
-   Fine diagonal rain streaks at multiple depths; keep the effect
    sparse enough to preserve the illustration.
-   Slightly darker grass with gentle wind response.
-   A faint atmospheric veil near the horizon.
-   No thunderstorm flashes unless explicitly enabled.
-   Optional sound: quiet rainfall and wind.
-   The character remains in the same clothing; do not add an umbrella
    or change the silhouette.

### Scene E --- Wind

-   Bright but slightly cooler or hazier sky.
-   Clouds stretched or drifting more quickly in one direction.
-   Grass bends coherently with the wind, with layered movement at
    different depths.
-   A few leaves or loose seed particles can cross the frame, but use
    sparingly.
-   The shirt and mundu may show subtle wind response without changing
    their design.
-   No rain by default.
-   Optional sound: wind moving through grass.

### Scene F --- Dawn (recommended sixth state)

Use dawn as the sixth state because it adds a distinct emotional note
without introducing a new environment or distracting event.

-   Pale apricot and warm cream near the horizon, fading into cool
    blue-green above.
-   Low, diffuse sunlight with a long, gentle glow.
-   Light mist between the mountain layers.
-   Dew-like highlights may appear on a few grass tips, but do not
    create glittering particles.
-   The character and field remain exactly the same.
-   Juhu may appear in this state if the second dog-enabled state is not
    already assigned elsewhere.

### Build order for the states

Build and approve **Sunny first**. The other five (twilight, night,
rain, wind, dawn) are added only after the sunny scene's motion is
final. The preset system should still be designed for all six from the
start, so adding them is configuration work, not a rewrite.

### State consistency rule

The states are not six different illustrations. They are six parameter
sets applied to one world. Keep all geometry, object placement, camera
framing, character scale, and walking path stable. Any state-specific
additions must be minor and configurable.

## 10. Lighting and weather architecture

Do not implement each scene with separate hard-coded drawing logic.
Create a central scene configuration that can be blended between
presets.

A possible conceptual configuration:

``` js
const scenePresets = {
  sunny: {
    skyTop: "#83b8c7",
    skyHorizon: "#d6dfc2",
    sunVisible: true,
    sunElevation: 0.78,
    cloudOpacity: 0.95,
    mountainTint: "#718f96",
    grassTint: "#7f9d3f",
    atmosphere: 0.12,
    rain: 0,
    wind: 0.2,
    stars: 0,
    birdsEnabled: true,
    dogEnabled: true
  },
  twilight: {
    // Define the same parameter keys with dusk values.
  },
  night: {
    // Define the same parameter keys with night values.
  },
  rain: {
    // Define the same parameter keys with rainy values.
  },
  wind: {
    // Define the same parameter keys with windy values.
  },
  dawn: {
    // Define the same parameter keys with dawn values.
  }
};
```

The sample values are illustrative, not final art direction. Implement
the complete configuration with documented parameters and coherent
palettes.

### Required behaviour

-   Selecting a preset changes parameters, not the scene's geometry.
-   Transitions between states should interpolate smoothly over a
    configurable duration.
-   Use colour interpolation for sky, mountains, grass, and atmosphere.
-   Fade rain, stars, sun/moon glow, and other effects in or out rather
    than toggling them abruptly.
-   Wind strength should interpolate and affect both grass and fabric.
-   A scene transition must not reset the character's position or walk
    phase.
-   A manual override should allow the user to adjust lighting
    independently from the selected preset.
-   Provide a "Reset to preset" action so manual overrides can be
    discarded.
-   Keep all state transitions deterministic and avoid flicker.

## 11. Interactive control panel

Build a developer/art-director tuning panel so the scene can be tuned
without editing source code. **This panel is temporary and only for the
author.** It is not part of the visitor experience.

-   Use **Tweakpane**, not a hand-built HTML panel. It provides sliders,
    colour pickers, folders, and state export/import out of the box.
-   Keep all panel code in **one module**. The scene must never import
    from the panel; the panel only reads and writes the shared config.
    Removing it should mean deleting one file and one import.
-   Load the panel only when the URL contains `?dev`, and load it lazily
    so it adds nothing to the visitor's page weight. Inside dev mode,
    `H` toggles it.
-   **JSON export is the handoff.** When a scene is approved, export its
    values and commit them as the new defaults in `presets.js`. Tuning
    that is not exported is lost.
-   Keep the panel available behind `?dev` after launch rather than
    deleting it, since it will be needed again for new states.

For the sunny-first prototype, build only groups A (subset), D, E, F
and G below. Add the rest when their features are built.

### A. Presets and playback

-   Scene preset selector: Sunny, Twilight, Night, Rain, Wind, Dawn.
-   Play / pause animation.
-   Transition duration.
-   Animation speed multiplier.
-   Toggle looping movement.
-   Restart character position.
-   Toggle reduced motion / preview motion.
-   Toggle debug overlays.

### B. Lighting and palette

-   Sky top colour.
-   Sky horizon colour.
-   Sun/moon visibility.
-   Sun/moon position and elevation.
-   Sun/moon size.
-   Glow intensity and radius.
-   Overall brightness.
-   Warmth / coolness tint.
-   Atmosphere / haze amount.
-   Cloud opacity.
-   Mountain tint.
-   Grass tint.
-   Character brightness or rim light.
-   Reset lighting to selected preset.

Use colour pickers where useful and sliders for numeric values. Ensure
controls have readable labels and sensible min/max ranges.

### C. Clouds

-   Cloud amount.
-   Cloud scale.
-   Cloud opacity.
-   Cloud drift speed.
-   Cloud layer separation/parallax.
-   Optional cloud softness/facet balance.

Cloud positions should be generated deterministically and drift
continuously. Do not regenerate cloud shapes every frame.

### D. Field and grass

-   Grass density.
-   Average grass height.
-   Height variation.
-   Blade width.
-   Sway amplitude.
-   Sway speed.
-   Wind direction.
-   Wind strength.
-   Foreground occlusion.
-   Seed-head / flower frequency.
-   Optional variation seed, with a regenerate action.

### E. Character

-   Character horizontal position.
-   Character scale.
-   Walk speed.
-   Stride length.
-   Walk-cycle speed.
-   Torso bob amount.
-   Arm swing amount.
-   Fabric movement amount.
-   Height of grass occlusion.
-   Toggle character visibility for composition tests.

Do not expose sliders for every individual body point. The character
should be controlled through a compact set of high-level parameters.

### F. Dog

-   Enable/disable Juhu.
-   Choose which presets include Juhu.
-   Arrival interval / cycle frequency.
-   Approach speed.
-   Time to catch up.
-   Time walking alongside.
-   Departure duration.
-   Dog scale.
-   Dog-to-character spacing.
-   Toggle debug state display.

### G. Birds

-   Enable/disable birds.
-   Flock size.
-   Spawn interval.
-   Flight speed.
-   Flight altitude.
-   Wingbeat speed.
-   Bird scale.
-   Optional chirping sound.

### H. Weather and atmosphere

-   Rain intensity.
-   Rain angle.
-   Rain speed.
-   Rain density.
-   Wind strength.
-   Haze.
-   Mist amount.
-   Star density.
-   Moonlight intensity.
-   Optional ambient particles, disabled by default.

### I. Sound

-   Master volume.
-   Wind-in-grass volume.
-   Bird-chirp volume.
-   Rain volume.
-   Enable/disable individual layers.
-   Mute all.

Sound must be opt-in or begin only after a user gesture because of
browser autoplay restrictions. Provide graceful behaviour when audio is
unavailable.

### J. Save and share configuration

-   Save current configuration to a downloadable JSON file.
-   Load a previously saved JSON configuration.
-   Copy/export the current configuration as JSON.
-   Reset all controls to defaults.
-   Preset changes should be reflected in the panel.
-   Validate imported configuration and fall back safely if values are
    invalid.

If practical, support a URL query parameter for loading a named preset,
but do not make this a requirement for the initial version.

## 12. Sound design

Sound should be subtle and environmental. It should make the scene feel
alive without turning the site into a music player.

Suggested layers: - A low, soft wind moving through grass. - Occasional
bird chirps associated with bird flock entry. - Fine rain ambience for
the rain state. - Optional quiet night ambience, kept nearly
imperceptible.

**Wind is generated in code.** Use Web Audio to shape filtered noise
into a soft wind (noise source → band-pass / low-pass filter → gain,
with slow random movement on filter frequency and gain). It loops
forever with no seam and its strength follows the wind parameter.

Recorded sources to consider (licences vary per file; check each one
and keep a credits list in the README):

-   **Kerala river bed (CC0):** a phone recording from the banks of the
    Chalakudy River, Kerala, with water and birds (Freesound). Lower
    quality; use very quietly under the wind.
-   **Kerala birds:** xeno-canto has paddy field recordings from
    Alappuzha (for example XC338205, Pavukkara paddy field). Most
    require credit and forbid commercial use.
-   **Wind in long grass (backup):** Hidden Sound's free "Strong Wind
    Blowing Through Long Grass" pack via Rekkerd. Use only calm
    sections.
-   **Paid, best fit:** "Ambiences from Suburban India" by Potion Sound
    Effects (A Sound Effect, about USD 40), recorded in Kerala's
    backwaters.

Implementation guidance:

-   Use original, properly licensed, or public-domain sound assets. Do
    not scrape copyrighted game or film audio.
-   Keep loops seamless and low in volume.
-   Handle errors gracefully when audio is unavailable.
-   Provide mute and individual volume controls.
-   Start audio only after user interaction.
-   Do not play a sound on every animation frame.
-   Bird chirps are event-triggered with a cooldown.
-   Crossfade ambience when changing states.

The visual scene must remain complete and pleasant with sound disabled.

## 13. Continuous horizontal journey

The character walks and walks. The experience should never feel like a
short animation that ends.

-   The character advances horizontally at a stable, configurable speed.
-   On reaching the right side, the character loops to the left through
    an off-screen wrap or a seamless duplicate-instance handoff.
-   The walk cycle continues through the wrap; do not reset the
    character's pose.
-   The landscape itself can remain compositionally stable for the first
    version. Subtle parallax or looping cloud drift provides life
    without requiring an endless procedural world.
-   If the field or distant terrain is animated horizontally, tile it
    seamlessly with no visible seams.
-   Scene changes do not interrupt the journey.
-   The dog has its own independent state machine and can join and leave
    without stopping the character.
-   Birds cross from left to right and disappear beyond the frame.
-   The entire experience should still feel calm if observed for several
    minutes.

## 14. Animation quality

Use smooth, deterministic motion: - Prefer sine-based or interpolated
movement for grass, fabric, clouds, and walking. - Use `deltaTime` or
equivalent elapsed-time calculations so motion is consistent across
frame rates. - Avoid basing animation speed on raw frame count. - Keep
the walk cycle and world motion independent. - Avoid jitter caused by
per-frame random values. - Use easing for state transitions and dog
arrival/departure. - Ensure the scene looks good in a still frame as
well as during motion.

Target 60 FPS on a typical modern laptop where feasible, while allowing
a lower-cost mode. Limit the number of individual draw calls if grass
density becomes expensive; use precomputed geometry or cached layers
when appropriate.

## 15. Code architecture and maintainability

Suggested project structure:

``` text
src/
  main.js                 # App startup, canvas sizing, event wiring
  scene/
    Scene.js              # Scene lifecycle and render orchestration
    presets.js             # Six named environmental presets
    palette.js             # Colour interpolation and palette helpers
    sky.js                 # Sky gradient, sun, moon, stars
    clouds.js              # Deterministic cloud layers
    mountains.js           # Low-poly mountain geometry
    field.js               # Field layers and seeded grass geometry
    character.js           # Character geometry and walk cycle
    dog.js                 # Juhu geometry, animation, state machine
    birds.js               # Flock movement and wing animation
    weather.js             # Rain, wind, haze and weather overlays
    audio.js               # Optional ambient sound manager
  controls/
    ControlPanel.js        # UI and control bindings
    config.js              # Defaults, validation, import/export
  styles/
    main.css               # Page shell and responsive controls
public/
  audio/                   # Licensed/original sound assets, if used
index.html
README.md
```

Adapt the structure to the existing repository rather than creating
needless abstraction. Small projects should remain simple. Keep modules
focused and avoid circular dependencies.

### Engineering rules

-   Centralise tunable parameters; do not scatter magic numbers
    throughout drawing code.
-   Use named constants and documented coordinate conventions.
-   Use seeded randomness for reproducible geometry.
-   Separate static geometry from animated transforms.
-   Keep drawing functions pure where practical: provide state and
    parameters rather than mutating global variables.
-   Avoid hidden coupling between scene preset selection and character
    animation.
-   Clean up audio nodes and event listeners appropriately.
-   Ensure controls work with mouse, keyboard, and touch.
-   Include accessible labels, focus styles, and keyboard operation.
-   Avoid dependencies that do not materially improve the
    implementation.

## 16. Suggested data model

Use a validated configuration object as the single source of truth for
presets and live controls. A conceptual shape:

``` js
const defaultConfig = {
  activePreset: "sunny",
  playback: {
    playing: true,
    speed: 1,
    loopCharacter: true,
    transitionSeconds: 2.5
  },
  lighting: {
    skyTop: "#83b8c7",
    skyHorizon: "#d6dfc2",
    brightness: 1,
    warmth: 0.15,
    haze: 0.12,
    sunVisible: true,
    sunX: 0.76,
    sunY: 0.19,
    sunSize: 0.055,
    glow: 0.45
  },
  grass: {
    density: 1,
    averageHeight: 1,
    heightVariation: 0.35,
    swayAmplitude: 0.2,
    swaySpeed: 1,
    windStrength: 0.2,
    foregroundOcclusion: 0.55
  },
  character: {
    x: 0.25,
    scale: 1,
    walkSpeed: 1,
    stride: 1,
    bob: 0.15,
    armSwing: 0.3,
    fabricMotion: 0.15
  },
  dog: {
    enabled: true,
    aloneCrossings: 2,
    togetherCrossings: 1,
    firstVisitDelaySeconds: 20,
    scale: 0.8,
    approachSeconds: 3,
    togetherSeconds: 12,
    departureSeconds: 3
  },
  birds: {
    enabled: true,
    flockSize: 5,
    speed: 0.25,
    spawnIntervalSeconds: 24,
    chirpsEnabled: true
  },
  weather: {
    rainIntensity: 0,
    rainSpeed: 1,
    windStrength: 0.2,
    starDensity: 0,
    mist: 0
  },
  audio: {
    enabled: false,
    masterVolume: 0.25,
    windVolume: 0.2,
    rainVolume: 0.2,
    birdsVolume: 0.25
  }
};
```

This is an example schema, not a mandate to use these exact initial
values. Extend it with all fields needed by the finished controls. Use
normalized coordinates where helpful and validate numeric ranges.

## 17. Performance and visual quality safeguards

-   Do not regenerate mountains, clouds, or grass geometry on every draw
    call.
-   Use deterministic seeded generation for static scene elements.
-   Keep moving elements as lightweight transforms.
-   Avoid excessive transparency layers and large blur filters.
-   Make rain density adjustable and cap the maximum particle count.
-   Use cached off-screen graphics for complex static layers if it
    measurably improves performance.
-   Provide a debug mode showing layer boundaries, character anchor,
    field occlusion line, and coordinate axes.
-   Test at common desktop and mobile viewport sizes.
-   Check for visible seams at the character wrap and any tiled
    landscape.
-   Test state transitions in both directions, including rapid repeated
    preset changes.

## 18. Acceptance criteria

The initial implementation is complete only when all of the following
are true:

### Visual

-   [ ] The scene is drawn procedurally in p5.js; the reference image is
    not used as the scene background.
-   [ ] Coconut palm silhouettes sit along the middle ridge line.
-   [ ] The overall look follows the attached mood board: calm, low-poly
    / soft-vector landscape, atmospheric depth, and generous open sky.
-   [ ] The field is broadly horizontal, not diagonally slanted.
-   [ ] The foreground clearly reads as tall grass or grain, without
    overwhelming the scene.
-   [ ] The character wears a brown full-sleeve shirt with sleeves
    folded to the elbows and a folded white mundu.
-   [ ] There is no cape, cloak, or fantasy travel gear.
-   [ ] The character is small relative to the landscape and partly
    hidden by grass.
-   [ ] All six presets preserve the same underlying geometry and
    composition (verified once all six exist; the first milestone is
    Sunny only).

### Motion

-   [ ] The character walks smoothly and loops horizontally without a
    conspicuous jump.
-   [ ] Grass responds coherently to wind and does not flicker.
-   [ ] Clouds drift gently.
-   [ ] Birds enter from the left, cross the sunny sky, and exit to the
    right.
-   [ ] Juhu can run up to the character, walk alongside him, and leave
    naturally.
-   [ ] Dog and bird behaviour can be controlled without editing code.
-   [ ] Changing presets does not reset character position or walk
    phase.

### Controls

-   [ ] The tuning panel loads only with `?dev` and can be shown and hidden.
-   [ ] Presets can be selected and smoothly transitioned.
-   [ ] Controls exist for each feature that has been built.
-   [ ] Manual changes can be reset to preset values.
-   [ ] Configuration can be exported and imported as JSON.
-   [ ] Invalid configuration values are handled safely.

### Quality

-   [ ] Motion is time-based and stable at different frame rates.
-   [ ] The experience works with sound disabled.
-   [ ] Sound starts only after a user gesture.
-   [ ] The layout adapts to viewport changes.
-   [ ] Reduced-motion preferences are respected.
-   [ ] The README explains setup, controls, presets, and configuration
    export/import.
-   [ ] There are no major console errors, visible wrap seams, or
    flickering static elements.

## 19. Implementation sequence

Work in deliberate stages. The real risks are the man's walk and Juhu's
gait, not weather. Spend the time there.

### Step 1 --- Still frame in Figma (author)

The sunny scene, the man, Juhu, and the palms, drawn only with flat
shapes that can be built in code. Includes key poses for the man and
Juhu (section 5).

**Gate:** it works as a framed print.

### Step 2 --- Still frame in p5

Sky, sun, clouds, mountains, palms, level field, and the man partly
hidden in grass. Seeded so nothing changes between reloads. Logical
1920 × 1080 space, mobile prep from section 3, debug overlay.

**Gate:** it matches the Figma frame.

### Step 3 --- Core motion

Walk rig, smooth right-to-left wrap, grass sway, cloud drift. Tweakpane
behind `?dev` with walk, grass, and wind controls only.

**Gate:** five minutes of watching with nothing that bothers you.

### Step 4 --- Juhu

State machine, trot, trot-to-walk blend, walk, departure. Rhythm and
early first visit. "Call Juhu now" button.

**Gate:** her gait reads as a dog, not a toy.

### Step 5 --- Birds, wind sound, painted finish

Small flock with uneven wingbeats; chirps only on entry. Generated wind
audio. Post-process grain and glow pass.

### Step 6 --- Later

Preset blending, then twilight, night, rain, wind, and dawn. Remaining
panel groups and JSON import. README.

Do not skip the gates. The quality of the scene depends more on
composition, scale, silhouette, and restraint than on the number of
effects.

**Open item:** the brief does not yet say what a visitor finds besides
the scene (writing, links, an about line). Decide before Step 3 ends.

## 20. Final direction to the coding agent

Act as both a senior creative technologist and a careful visual artist.
First inspect the existing repository and report its current structure
before making changes. Then implement the project incrementally, keeping
the code readable and the art direction consistent.

Do not replace the concept with a generic animated landscape or a
standard portfolio template. Do not use a raster image as the final
scene. Do not invent new visual motifs unless they clearly serve the
quiet rural journey.

Prioritise these decisions in order:

1.  Composition and the horizontal field.
2.  Character silhouette and accurate clothing.
3.  Grass density, depth, and occlusion.
4.  Light and colour relationships.
5.  Slow, continuous movement.
6.  Optional dog, birds, weather, and sound.
7.  A reliable, well-organised control system.

Deliver a working project, not just a mock-up or isolated code snippet.
Include a concise README with install/run instructions, a control
reference, and a description of the architecture. Where a visual
decision is ambiguous, choose the simplest option that preserves the
intended mood, expose it as a parameter when appropriate, and document
the choice.
