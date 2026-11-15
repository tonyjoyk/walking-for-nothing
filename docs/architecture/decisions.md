# Decision log

Every decision that changes or overrides an earlier document goes here,
newest last within each section. IDs are `D-<epic>.<n>`; project-wide ones
are `D-0.<n>` (see the rules in [`docs/README.md`](../README.md)).

**Format:** date · decision · why · what it supersedes · status.

## Project-wide (D-0)

### D-0.1 Everything is drawn in code
- **Date:** 16 Oct 2026. **Source:** brief.
- **Decision:** the landscape, figures and effects are drawn with Canvas 2D
  inside p5.js. There are no image assets in the site; reference images live
  only in `docs/ux/reference/`.
- **Status:** in force.

### D-0.2 No p5play or sprite sheets for the character
- **Date:** 17 Oct 2026.
- **Why:**
  - p5play's personal licence requires the whole site to be open source, and
    a paid licence for commercial use.
  - It draws sprites on top of everything, which breaks layering with the
    grass.
  - Stock sprites don't match the look.
  - A timer-driven sprite brings back foot sliding.
- **Status:** in force. If drawn frames are ever wanted, draw them into our
  own canvas and advance them by distance walked.

### D-0.3 Public repository; history kept as is
- **Date:** 17 Oct 2026.
- **Why:** GitHub Pages on the free plan needs a public repo.
- **Decision:** the owner chose to keep the commit history unchanged, so the
  work email stays in commit metadata. New commits use the GitHub no-reply
  address.
- **Status:** in force.

### D-0.4 The brief's post-processing shader pass is not used
- **Date:** 17 Oct 2026.
- **Why:** the painted finish comes from a grain overlay and gradients. They
  look the same in every browser and cost less.
- **Supersedes:** the shader pass in brief rev 2.
- **Status:** deferred; revisit only if the finish needs it.

### D-0.5 One quiet "Credits" link for all on-page credits
- **Date:** 20 Oct 2026 (confirmed by Tony).
- **Decision:**
  - Every on-page credit shares one small "Credits" link in the bottom-left
    corner. That includes Open-Meteo weather data and recorded sound.
  - The link opens one quiet list.
  - There's never more than one credit link on screen.
- **Supersedes:** the standalone "Weather: Open-Meteo" link
  (`#credit` in `index.html`).
- **Implementation:** the shared link and list are built in story 6.12
  (audio). That story also moves the weather credit into the list.
- **Answers:** audio PRD open question 5 (where the credits go).
- **Status:** in force.

## Epic 1: Opening and journey (D-1)

### D-1.1 Live weather is Kerala's (Pala), published by a scheduled job
- **Date:** 17 Oct 2026. **Spec:** [`product/specs/live-weather.md`](../product/specs/live-weather.md).
- **Decision:**
  - The weather comes from Open-Meteo, for Pala, Kottayam.
  - A GitHub Actions job writes `weather.json` every 30 minutes.
  - Visitors never contact the weather service.
- **Status:** built; **paused** by D-1.3.

### D-1.2 Each crossing moves to the next scene
- **Date:** 17 Oct 2026.
- **Decision:** the scenes cycle in the order Dawn → Daylight → Windy → Rain
  → Sunset → Night, one per crossing (configurable).
- **Status:** in force.

### D-1.3 Live weather paused; deprecation review
- **Date:** 20 Oct 2026 (owner's request).
- **Decision:**
  - The default opening is the shuffle (D-1.4).
  - Live weather stays in the code as the `weather` opening mode.
  - The repository variable `LIVE_WEATHER` is `false`.
  - In shuffle mode the page never requests `weather.json`.
- **⚠ Deprecation review: 31 Jan 2027.** If live weather hasn't been switched
  back on and used by then, remove it rather than keep carrying it. To
  remove:
  1. **`src/weather.js`:** remove `validateWeather`, `chooseOpeningScene`,
     `approxSunTimes` and `keralaMinutes`. Keep the shuffle and cycle
     functions, and consider moving them to a `scenes.js`.
  2. **`src/main.js`:** remove the weather and time-of-day branches of
     `chooseOpening()`, the `?weather=live` preview and the credit link
     handling.
  3. **`src/config.js`:** remove `WEATHER_RULES`, and the `'weather'` and
     `'time-of-day'` values of `opening.mode`.
  4. **`scripts/fetch-weather.mjs`, `public/weather.json`:** delete.
  5. **`.github/workflows/deploy.yml`:** remove the "Fetch the weather" step,
     the 30-minute `schedule` trigger (deploy on push only) and the
     `LIVE_WEATHER` variable.
  6. **`index.html`, `src/styles/main.css`:** remove the Open-Meteo credit
     link and its styles; also remove the credit from the README.
  7. **`tests/weather.test.mjs`:** remove the weather tests, and keep the
     shuffle and cycle tests.
  8. **Docs:** mark `product/specs/live-weather.md` as *Retired*, move it to
     `archive/`, and close this decision.
- **Until then:**
  - The scheduled job still runs every 30 minutes and keeps `weather.json`
    current, switched off. It's harmless on a public repo.
  - To turn live weather back on: set the opening mode to `weather` in
    `config.js` and set `LIVE_WEATHER=true`.
- **Status:** paused, with review due 31 Jan 2027.

### D-1.4 Opening: random on a fresh visit, next scene on each reload
- **Date:** 20 Oct 2026. **Story:** [1.1](../stories/1.1.shuffle-and-advance-opening.md).
- **Decision:**
  - A new tab opens on a random scene.
  - A reload opens on the scene after the one last on screen.
  - The tab's memory is kept in `sessionStorage` only.
- **Supersedes:** "open on the weather" (D-1.1) as the default.
- **Status:** in force.

### D-1.5 A time-of-day picker for visitors
- **Date:** 15 Nov 2026. **Story:** [1.2](../stories/1.2.scene-picker.md).
- **Decision:**
  - A round glass button above the sound button shows the current scene's
    icon. A click or tap opens six minimal line icons: Dawn, Day, Windy,
    Rain, Sunset, Night.
    - The current one is shown as selected.
    - All six are disabled while a scene change is still easing in
      (`transitionSeconds`, 4 s).
    - Escape or a click elsewhere closes it, and so does picking a scene.
  - Picking a scene calls `scene.applyScene`, so the change eases in and is
    remembered for the next reload. Crossings carry on through the cycle
    from there.
  - **Mobile:** every button is a 44 px target. The six open upwards, or
    leftwards as a row when the screen is short (a phone on its side, 520 px
    tall or less).
  - **Placement:** because this button sits above the speaker, the volume
    slider (D-6.13) slides out to the left of the speaker as a horizontal
    pill, rather than rising above it.
- **Why:** the owner wants visitors to be able to choose the time of day.
- **Supersedes:** UX principle 1's "no buttons except the sound toggle"
  (the controls are now sound and time of day), and D-6.13's slider
  placement.
- **Status:** revised by D-1.6 before release: labelled options, a menu
  button, a loop, and no auto-close or lock.

### D-1.6 The picker: labelled options, a menu button, and a loop
- **Date:** 15 Nov 2026. **Story:** [1.3](../stories/1.3.scene-picker-labels-and-loop.md).
  **Audit:** in the story.
- **Decision:**
  - **Closed:** a menu (hamburger) icon. **Open:** a close icon (×).
  - **The list stays open** until the visitor closes it: with ×, or Escape
    on a keyboard. A pick or a tap elsewhere doesn't close it.
  - **Options:** glass pills with an icon and a name. "All scenes" comes
    first, then Dawn, Day, Windy, Rain, Sunset and Night.
    - Labels are white on darker glass (62%): at least 5:1, measured, over
      the brightest sky.
    - The selected option is a white pill with dark text.
  - **Picking a scene** eases to it and loops it (`cycle.enabled` off). It's
    remembered for the tab (`sessionStorage` `wfn.sceneLock`), so a reload
    stays on it.
  - **"All scenes"** restarts the journey from the current scene and clears
    the memory.
  - **No lock after a pick:** a new pick eases from wherever the scene is.
  - **Short screens** (520 px tall or less): a two-column grid to the left
    of the button.
- **Why:** owner feedback and a usability audit. The icons alone were
  ambiguous, the list closed too eagerly, a pick didn't hold, and the 4 s
  lock blocked moving between scenes.
- **Supersedes:** D-1.5's icon-only options, auto-close and 4 s lock; and,
  for a picked scene, D-1.2's "each crossing moves to the next scene".
- **Status:** in force.

## Epic 2: The greeting (D-2)

### D-2.1 The turn is a morph of the profile rig, not a second drawing
- **Date:** 18 Oct 2026. **Spec:** [`product/specs/greeting.md`](../product/specs/greeting.md).
- **Decision:**
  - Each profile outline has a front-view twin with the same path commands.
  - Limbs and features are projected from 3D positions; the head leads the
    turn.
  - The stop is planned to land with both feet down.
- **Status:** in force.

### D-2.2 Pause on hover; turn after a 2 s rest or a click
- **Date:** 20 Oct 2026. **Story:** [2.1](../stories/2.1.pause-on-hover-turn-on-rest-or-click.md).
  **Discussion:** [party mode](../bmad/party-mode/2026-10-20-greeting-hover-dwell-click.md).
- **Decision:**
  - The cursor on him makes him stop and stand (a new `waiting` state). He
    turns only when the cursor has stayed on him for `dwellSeconds`
    (default 2 s, timed from its arrival), or on a click.
  - A mouse click on him works like a tap: he turns as soon as he's
    standing and plays the whole greeting. A click elsewhere ends it.
  - If the cursor leaves before he turns, he walks on with no cooldown, and
    stops again if it comes back.
  - Hover is re-tested every frame. While a greeting is under way, the box
    is widened behind him by 0.6 of a stride, so he can't stop out from
    under the cursor.
  - The stop lands on the first both-feet-down moment at least 0.1 of a
    stride ahead (was 0.2).
- **Why:** measured, he walked 33–87 px past a ±30 px box before standing,
  and a stale hover then cancelled the greeting mid-turn. The owner also
  asked for a pause first, and a deliberate turn.
- **Supersedes:** in the [greeting spec](../product/specs/greeting.md):
  "hover starts the greeting" (P0.1), the state list (P0.2), the stop rule
  "a fifth of a stride", and mouse clicks doing nothing. Cooldown after an
  unturned pause is removed.
- **Status:** in force.

### D-2.3 A speech bubble when he faces you
- **Date:** 20 Oct 2026. **Story:** [2.2](../stories/2.2.speech-bubble.md).
- **Decision:**
  - When he has turned to face the visitor, a small speech bubble shows a
    short introduction from Tony. It fades in and out over 0.8 s.
  - While the bubble is on, he faces the visitor for at least
    `readSeconds` (15 s) in all, instead of 3 s + 4 s. The cursor on the
    bubble counts as being on him.
  - The bubble is HTML, not drawn on the canvas, so the text is sharp,
    selectable and read by screen readers. It's placed every frame above his
    head.
  - Style: the site's existing look. It uses the system font, a soft,
    translucent light surface with a blur like the sound button, a small
    tail, and no border or icons.
- **Why:** the owner wants visitors to get a sense of who he is, kept
  minimal.
- **Supersedes:** UX principle 1 ("no text") for this one bubble, which
  appears only after the greeting is discovered (principle 3 still holds).
  The 3 s + 4 s timing applies only with the bubble off.
- **Status:** in force.

### D-2.4 The bubble is "Air": no box, ink chosen from the sky
- **Date:** 20 Oct 2026. **Story:** [2.3](../stories/2.3.speech-bubble-restyle.md).
  **Options:** [four options](../ux/research/speech-bubble-options.md) (owner picked
  option 3, Air).
- **Decision:**
  - The bubble is just words: 11 px system font, 188 px wide, with a 1 px
    hairline down to his head. No box, border or tail shape.
  - The ink follows the scene. About every 0.4 s while the bubble shows,
    `bubble.js` reads the canvas pixels behind the words. It picks light or
    dark ink by the worst tenth of that patch, keeping the current ink when
    the two are close.
  - If neither ink reaches 4.5:1, a soft blurred veil with no edge is added
    behind the words, only as strong as needed (dark behind light ink, pale
    behind dark ink).
- **Why:** the owner wanted it smaller and more minimal, and the same style
  in every scene with enough contrast. Measured: Sunset was 3.4:1 and Rain
  4.3:1 without the veil.
- **Supersedes:** D-2.3's light glass bubble (its style only; its behaviour
  stands).
- **Status:** in force.

### D-2.5 The bubble sits on a plain 40% white plate
- **Date:** 20 Oct 2026. **Story:** [2.4](../stories/2.4.speech-bubble-plate.md).
  **Evaluation:** [options doc, revision](../ux/research/speech-bubble-options.md#revision-20-oct-a-plain-plate-instead-of-the-veil).
- **Decision:**
  - Dark words (#17211c) on a white plate with 8 px corners at 40%
    opacity, in every scene. The adaptive ink and the blurred veil are gone.
  - `bubble.js` still reads the sky behind the plate. It steps the plate up
    to 60% only if 40% would give under 4.5:1, which no current scene needs.
- **Why:** the owner found the veil unattractive on Sunset and Rain, and
  asked for one simple, consistent background. 40% measured at least 4.5:1
  in all six scenes.
- **Supersedes:** D-2.4's adaptive ink and veil. Its size (11 px) and
  hairline stay.
- **Status:** in force.

### D-2.6 A "View my work" link in the bubble
- **Date:** 20 Oct 2026. **Story:** [2.5](../stories/2.5.view-my-work-link.md).
- **Decision (UX):**
  - A plain text link, "View my work", as the last line of the bubble,
    left-aligned. It uses the same dark 11 px ink, in semibold with a thin
    underline, and has no button, icon or arrow.
  - It opens in a new tab (`rel="noopener"`), so the walk keeps going
    where the visitor left it.
  - It has a visible focus ring for the keyboard. It sits on the plate, so
    it gets the same 4.5:1 or better contrast.
  - Clicks and taps on it don't end the greeting (the bubble is already
    excluded from scene clicks).
- **Why:** the owner wants visitors who meet him to be able to find his
  portfolio. A quiet link at the end of what he says keeps the "discovered,
  not announced" feel.
- **Supersedes:** widens UX principle 1's bubble exception (D-2.3) to
  include this one link.
- **Status:** in force.

### D-2.7 A hover bridge, a hold after the reveal, and a staggered reveal
- **Date:** 20 Oct 2026. **Story:** [2.6](../stories/2.6.bubble-reach-hold-reveal.md).
- **Decision (UX):**
  - **Hover bridge:** while the bubble shows, the hover area is the box
    around him and the bubble together, plus 12 px. This makes a single
    target, so the cursor can travel from him to the link along any path
    (the usual fix for "menu closes on the way to it"). It also counts for
    taps, so a near miss on touch doesn't dismiss.
  - **Hold (owner's call):** short, so it never keeps the visitor from the
    walk. 4 s (`readSeconds`) after the reveal, about 5 s on screen in all,
    with or without the cursor; then he turns back.
    - While the cursor is on the bubble itself, the 4 s pauses. Content
      that appears on hover shouldn't vanish while the pointer is on it
      (WCAG 1.4.13), and it gives time to reach the link.
    - 4 s is a glance, not a full read of about 50 words; the pause on the
      bubble covers anyone who wants to read it all.
  - **Dismiss:** while he faces the visitor, a click or tap on him (not the
    bubble) sends him on his way at once.
  - **Reveal timing**, following common UI motion guidance (Material and
    NN/g: entrances of about 200–500 ms, items staggered, the whole thing
    in about a second so reading isn't delayed), within the site's "nothing
    snaps" rule (UX principle 2):
    - the plate fades in over 0.4 s;
    - each of the four lines rises 4 px and fades in over 0.5 s, ease-out;
    - the lines are staggered 0.15 s apart, starting at 0.15 s;
    - the reveal is complete at about 1.1 s.
  - **Reduced motion:** the text fades in once, with no rise and no stagger.
  - It's revealed by paragraph, not letter by letter: a typing effect is
    slow to read and noisy for screen readers.
- **Why:** owner testing found the bubble vanished on the way to it. The
  owner asked for a reveal, a short stay (about 4–5 s), and for a click on
  him to dismiss it.
- **Supersedes:** the Revision 3 non-goal "animation of the text". The
  15 s hold (D-2.3): now 4 s after the reveal, pausable on the bubble. The
  3 s look and 4 s smile no longer set the length while the bubble is on.
- **Status:** in force.

### D-2.8 A sooner greeting
- **Date:** 15 Nov 2026. **Story:** [2.7](../stories/2.7.greeting-sooner.md).
- **Decision:**
  - `dwellSeconds` is 1.5 (was 2).
  - The settle into a stand takes 0.65 s (was 0.8).
  - The bubble shows from 60% of his turn (`BUBBLE_AT_TURN`), and its
    reveal-plus-4 s hold counts from that moment.
- **Why:** the owner wants the bubble sooner. Measured, it falls from about
  3.5 s to about 3.0 s after the hover.
- **Supersedes:** D-2.2's 2 s default; the spec's 0.8 s settle; and D-2.3
  and D-2.7's "the bubble shows once he faces the visitor".
- **Status:** in force.

### D-2.9 Two quiet signifiers: a hand cursor, and Juhu looking up
- **Date:** 15 Nov 2026. **Story:** [2.9](../stories/2.9.interaction-signifiers.md).
  **Research:** [inspiration board](https://miro.com/app/board/uXjVENr-NAc=/).
- **Decision:**
  - **Hand cursor:** a minimal hand cursor (custom 24 px SVG, with
    `pointer` as a fallback) shows while the pointer is on him. It uses the
    greeting's hover box but not the bubble's area.
  - **Juhu's reaction:** while the visitor hovers him or he's greeting (and
    she's with him), she attends:
    - she stands about 60 units further back, taking a slow step back if
      needed;
    - her head tips up toward his face;
    - her ears go forward;
    - her tail rises and wags at about 2.4 Hz.
- **Why:** the owner wants a subtle hint that he can be hovered or clicked.
  Two quiet cues, a familiar one (the cursor) and one in the world (the
  dog's attention), keep it "discovered" rather than announced.
- **Supersedes:** "no cursor change" (UX spec, D-2.2), and the greeting
  spec's non-goal "Juhu greeting the visitor".
- **Status:** in force.

## Epic 3: Character and motion (D-3)

### D-3.1 Natural steps over the brief's slow crossing
- **Date:** 17 Oct 2026; tuned by the owner on 17 Oct.
- **Decision:**
  - Steps are about 0.42 m at about 67 steps a minute (walk speed 70,
    cadence 0.56).
  - A crossing takes about 33 s.
- **Supersedes:** brief §5 "80–90 steps per minute" together with "60–90 s
  per crossing", which force tiny, shuffling steps at this scale.
- **Status:** in force.

### D-3.2 Legs follow measured gait data
- **Date:** 17 Oct 2026.
- **Decision:** the legs follow the UCI Multivariate Gait Data (CC BY 4.0),
  with IK foot planting.
- **Status:** in force.

### D-3.3 The mundu is a Verlet cloth with a designed silhouette
- **Date:** 17 Oct 2026.
- **Decision:** the cloth simulation provides motion and keeps the legs
  hidden. Its look (border, wrap panel, waistband, folded state) is drawn on
  top of the cloth points.
- **Supersedes:** the external feedback "do not simulate cloth physics".
- **Status:** in force.

### D-3.4 The owner's tuned character defaults
- **Date:** 17 Oct 2026.
- **Decision:**
  - Full-length mundu, ground offset +20 (in the hay), knee lift 0.41,
    bob 0.54, arm swing 0.67.
  - Border colour dark green (changed 17 Oct, from gold kasavu).
- **Status:** in force.

### D-3.5 Juhu joins in the first scene, in every scene, every fourth scene
- **Date:** 15 Nov 2026. **Story:** [3.1](../stories/3.1.juhu-every-scene.md).
- **Decision:**
  - She's allowed in every scene. Her colours already follow each scene's
    light, the same tint and brightness as the man.
  - **First visit:** at least `firstVisitDelay` after load, once he's past
    `firstVisitFrom` of the width. She trots in from the left, joins him in
    the first scene and walks on with him into the second. (Timing changed
    by D-3.6.)
  - **Leaving:** after `togetherCrossings` (1) scene change, once he's past
    the middle of the screen. A scene change alone never sends her away.
  - **Returning:** after `aloneCrossings` (3) crossings. The rhythm is with
    him in scenes 1–2, alone in 3–4, with him in 5–6, and so on.
- **Why:** the owner wants visitors to meet Juhu straight away, and in any
  scene.
- **Supersedes:** "Dawn and Daylight only"; the 20 s first visit; "2
  crossings alone"; and leaving after one screen-width together.
- **Status:** in force, except the first-visit timing (see D-3.6).

### D-3.6 Juhu catches him around the middle of the first scene
- **Date:** 15 Nov 2026.
- **Decision:** `firstVisitDelay` 2 s and `firstVisitFrom` 33% (were 6 s
  and 50%). She sets off when he's two-thirds of the way to the middle and
  joins him just past it, at about 55% of the width on desktop (about 70%
  on a phone). She also brakes faster than she speeds up, so arriving at a
  trot doesn't carry her past her place and leave her walking backwards.
- **Why:** starting from the middle, she only caught him at about 80% of
  the width, and off-screen on phones, so they barely walked together. The
  owner wants her to set off before he reaches the middle and join him
  around it, so they walk together for longer. Setting off at 20% felt too
  soon.
- **Supersedes:** the first-visit timing in D-3.5 (6 s, past 50%).
- **Status:** superseded by D-3.7 (she now sets off at the middle).

### D-3.7 Juhu sets off once he reaches the middle
- **Date:** 15 Nov 2026 (owner: "let him reach the middle of the frame
  before Juhu starts joining; she joins too soon").
- **Decision:** `firstVisitFrom` 50% (was 33%); `firstVisitDelay` stays at
  2 s. She sets off from the left edge once he reaches the middle.
  Simulated, she catches him at about 83% of the width on desktop (about
  89% on a phone), a few seconds before the first scene change, and walks
  on with him into scene 2 as before.
- **Considered:** a quicker trot (150 instead of 120) only moved the
  meeting point to about 78% and looked rushed, so it was rejected.
- **Supersedes:** D-3.6's first-visit start (33%).
- **Status:** in force.

## Epic 4: Landscape and atmosphere (D-4)

### D-4.1 Mountains follow the six-scene reference
- **Date:** 17 Oct 2026.
- **Decision:** one dominant peak with smaller peaks, and a single lit plane
  per peak fading into haze.
- **Supersedes:** the ridge-following faceted shading of 17 Oct (character
  study §5).
- **Status:** in force.

### D-4.2 Ground offset sets field depth
- **Date:** 17 Oct 2026.
- **Decision:** raised, he walks on a grassy field; lowered, he wades
  through hay. Grass parting stays gentle (0.6).
- **Status:** in force.

### D-4.3 Keep the hay-field style
- **Date:** 17 Oct 2026.
- **Decision:** a continuous canopy over undergrowth. The reference sheet's
  sparser grass was not adopted.
- **Status:** in force.

## Epic 5: Platform and delivery (D-5)

### D-5.1 Hosted on GitHub Pages under the repo name
- **Date:** 17 Oct 2026.
- **Decision:** https://tonyjoyk.github.io/walking-for-nothing/, deployed on
  every push to `main` (tests, then build). The scheduled weather refresh is
  covered by D-1.3.
- **Status:** in force.

### D-5.2 Mobile quality adapts automatically
- **Date:** 17 Oct 2026.
- **Decision:** touch devices start at medium quality, and any device steps
  down if it stays under about 40 fps.
- **Status:** in force.

## Epic 6: Audio (D-6)

Added 20 Oct 2026 by the audio chat. Full text:
[`product/specs/audio/architecture.md` §7](../product/specs/audio/architecture.md).

### D-6.1 Recorded ambience becomes the main audio
- **Date:** 20 Oct 2026.
- **Decision:** recorded ambience replaces generated sound as the main audio.
  Generated wind and rain stay in `SynthFallback`, used while a recording
  loads or if one is unavailable.
- **Supersedes:** brief §12, "wind sound made in code". The brief is left
  unchanged.
- **Status:** planned (epic 6).

### D-6.2 Licence policy for audio
- **Date:** 20 Oct 2026.
- **Decision:**
  - Only CC0, CC BY, CC BY-SA and CC BY-NC files ship; CC BY-NC only while
    the site is non-commercial.
  - Files derived from BY-SA sources ship as CC BY-SA.
  - Not used: BBC, Sonniss, Pixabay, Zapsplat, Macaulay, and paid packs that
    forbid redistribution.
  - A test enforces the allowlist.
- **Status:** planned; **narrowed by D-6.6** (no CC BY-NC).

### D-6.3 No religious sound by default
- **Date:** 20 Oct 2026.
- **Decision:** no temple music, azaan or bells.
- **Open question for Tony:** a church bell at sunset.
- **Status:** planned.

### D-6.4 Audio delivery
- **Date:** 20 Oct 2026.
- **Decision:**
  - Opus in WebM, with AAC in M4A as the fallback.
  - Beds about −28 LUFS, events about −24, thunder about −22.
  - Equal-power loop crossfades baked in at build time.
  - Lazy loading after the tap, current scene first.
  - Total ≤ 6 MB.
- **Status:** planned.

### D-6.5 Audio originals stay out of git
- **Date:** 20 Oct 2026.
- **Decision:**
  - Original recordings live in `audio-src/` (git-ignored).
  - `audio/sources.json` records the source, licence and edits for each.
  - The processed outputs and `manifest.json` are generated.
- **Status:** planned.

### D-6.6 Open-only sound set
- **Date:** 20 Oct 2026 (chosen by Tony). **Source:** [audio architecture §7](../product/specs/audio/architecture.md).
- **Decision:** ship only CC0, CC BY and CC BY-SA recordings. No CC BY-NC, so
  the site can be monetised later. The licence test enforces this.
- **Dropped (CC BY-NC):** 27492 Asian koels, 808117 Farmlife, 28107 Boat
  trip, 28263 Odayam evening, 31948 Paddy frogs, 28264 Odayam night.
- **Replacements:**
  - dawn: 787307 (Goa, CC0);
  - sunset crows: 249567 (CC0);
  - night: 803557 Goa crickets (CC BY), plus the Kerala owlet and nightjar
    calls (CC BY-SA).
  - Final picks follow Tony's listening notes (story 6.1).
- **Supersedes:** narrows D-6.2 (removes CC BY-NC from the allowlist).
- **Status:** in force.

### D-6.13 A volume slider for visitors
- **Date:** 15 Nov 2026. **Story:** [6.14](../stories/6.14.volume-slider.md).
- **Decision:**
  - A slim glass pill with a vertical slider rises above the sound button.
    It opens on hover (with a real pointer), on keyboard focus, or for
    3.5 s after a tap on touch screens.
  - The speaker button still mutes and unmutes.
  - The slider sets `config.audio.master` (0–100%, default 60%), which the
    sound director already glides to. The level is remembered in
    `localStorage` (`wfn.volume`).
  - Raising it while sound is off turns sound on. At 0 the speaker shows
    the muted icon.
  - All round buttons share one `.ctl` glass style with hover, press,
    keyboard-focus and disabled states. The sound button is disabled if the
    browser can't play audio.
- **Why:** a visitor in a meeting can keep the site quiet and their laptop
  loud.
- **Supersedes:** the audio PRD's out-of-scope item "a sound settings UI
  for visitors beyond the existing on/off button".
- **Status:** in force. Placement amended by D-1.5: the slider now slides
  out beside the speaker.

### D-6.14 Sound on by default, with a first-visit hint
- **Date:** 15 Nov 2026. **Story:** [6.15](../stories/6.15.sound-on-and-first-visit-hint.md).
- **Decision:**
  - **Sound on by default:** sound is on unless the visitor turned it off
    (`localStorage` `wfn.sound`).
    - Browsers only allow audio after an interaction, so it starts on the
      visitor's first click, tap or key anywhere. Only events the browser
      counts as permission are used (`navigator.userActivation`).
    - A first click on the speaker starts the sound rather than turning it
      off.
  - **First-visit hint:** once per visitor (`wfn.hintSeen`), a small
    dark-glass card to the left of the controls, with an arrow.
    - Copy: "Sound is on. It starts with your first click. Set the volume
      or time of day here." The middle sentence drops once sound is
      playing.
    - It appears after 1.5 s and fades after 6 s; the countdown pauses
      while it's hovered or focused.
    - It closes with ×, or when the controls are used. It isn't shown if
      the controls were used first.
    - `role="status"`.
- **Why:** the owner wants music on from the start, and a minimal, familiar
  pointer to the sound and scene controls.
- **Supersedes:** "Sound is opt-in" (UX spec, audio section, and the audio
  PRD's starting state).
- **Status:** in force.

### D-6.15 How the credits are built and shown
- **Date:** 15 Nov 2026. **Stories:** [6.4](../stories/6.4.manifest-and-credits.md), [6.12](../stories/6.12.sound-credits-on-page.md).
- **Decision:**
  - **One source:** `public/audio/manifest.json`. The README's "Sound
    credits" block and the page's list are both generated from it
    (`src/audio/credits.js`); `audio/sources.json` stays the input.
  - **Loop points in samples:** each file has `samples`, and each bed's
    `loop` has `startSample` and `endSample` beside the seconds.
  - **One entry per recording**, not per cut file. CC0 recordings are listed
    too, as a courtesy, so the list is every sound the site plays.
  - **On the page:** the D-0.5 link is a small text button ("Credits"), a
    disclosure. It opens a short list on the hint's dark glass, read from
    the manifest on first open. Escape, the button, or a click elsewhere
    closes it. The Open-Meteo credit joins the list only when live weather
    was used.
  - The build fails, and a test fails, on a licence outside the allowlist,
    a missing credit field, or a README block that has drifted.
- **Why:** the licences need title, recordist, link and licence; one
  generated list can't fall out of step with the files.
- **Status:** in force.

### D-6.16 Lightning before thunder
- **Date:** 15 Nov 2026. **Story:** [6.11](../stories/6.11.lightning.md).
- **Decision:**
  - Each thunder strike in Rain is a soft sky flash now and its roll
    distance ÷ 0.343 s later (8.7 s at 3 km, 35 s at 12 km). The next strike
    is timed from when the roll lands, so rolls stay ≥ 25 s apart and never
    overlap. The first roll still comes ≥ 15 s after rain starts.
  - **Lightning shows whether or not sound is on.** The thunder schedule
    runs every frame; rolls only play while sound is on.
  - A roll already on its way still lands if the scene leaves Rain (the
    flash promised it).
  - Brightness falls with distance (1 at 3 km to 0.35 at 12 km). The flash
    is drawn over the sky and clouds only, behind the hills, rising over
    0.18 s and falling over 0.9 s, at most one a second.
  - **Reduced motion:** 30% strength, rise 0.45 s and fall 1.6 s.
  - Switch: `config.audio.lightning` (default on), also in the dev panel.
- **Why:** the gap between light and sound makes the storm feel real and
  distant; showing it without sound keeps the rain alive for the many
  visitors who never turn sound on.
- **Supersedes:** nothing. Follows the UX spec's cross-epic rule on flashes.
- **Status:** in force.

### D-6.17 Sound only while the visitor is on the page
- **Date:** 15 Nov 2026. **Story:** [6.16](../stories/6.16.sound-only-on-the-page.md).
- **Decision:**
  - **Hidden tab or minimised window:** everything pauses, the scene and
    the sound (as before, for battery on phones).
  - **Another app or window in front** (the page visible, but the browser
    not focused): the sound fades out over about 2 s, and the scene keeps
    moving. It fades back in when the visitor returns.
    `SoundDirector.setAway()` is driven by window `blur`/`focus` and
    `visibilitychange`.
- **Why:** the owner: "when I'm not on the browser page, the sound should
  not play". They chose this over keeping sound as background ambience
  while working.
- **Supersedes:** sound continuing while the page is visible but not
  focused.
- **Status:** in force.

