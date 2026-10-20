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
