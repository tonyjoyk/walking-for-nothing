# Audio architecture (Epic 6)

**Status:** for review · **Inputs:** `brief.md`, `prd.md`

## Overview

```
 originals (audio-src/, git-ignored)            the site (public/audio/)
 ┌──────────────────────────────┐   build     ┌────────────────────────────┐
 │ downloaded WAV/FLAC + notes  │ ─────────▶ │ *.webm (Opus) + *.m4a (AAC) │
 └──────────────────────────────┘  ffmpeg    │ manifest.json (+ credits)   │
        audio/sources.json (in git)          └──────────────┬─────────────┘
        what to cut, loop, level                            │ fetch on sound-on
                                                            ▼
  Scene ──scene name, eased rain/wind──▶ SoundDirector ──▶ BedMixer (loops)
                                              │        ──▶ EventScheduler (birds)
                                              │        ──▶ ThunderDirector (rain)
                                              └──▶ SynthFallback (current audio.js)
```

## 1. Asset pipeline (build time)

**`audio/sources.json` (in git)** is the single source of truth. Each entry
records:
- `id`, `role` (`bed`, `event` or `thunder`) and the scenes it belongs to;
- source URL, recordist, licence and original title;
- edits: `start`/`end` seconds, `loopCrossfade`, `highpass` (Hz), a
  `gain` trim, and `mono` (true or false).

**Originals** go in `audio-src/` (git-ignored), named by `id`. They're
downloaded by hand from Freesound and xeno-canto (both need a login for
originals), or with a Freesound API token.

**`scripts/build-audio.mjs`** runs `ffmpeg` for each entry:
1. Trim to `start`–`end`, apply the high-pass (60–80 Hz, to remove wind
   rumble) and remove DC offset.
2. **Loop prep for beds:** take the last *X* seconds and crossfade them
   equal-power into the start, so the file's end flows into its beginning.
   *X* is `loopCrossfade` (2–3 s).
3. **Loudness:**
   - beds to about −28 LUFS integrated, true peak ≤ −3 dBTP;
   - events to about −24 LUFS short-term;
   - thunder at about −22 LUFS, so its peak sits roughly 6 dB above the
     rain bed.
4. **Encode:**
   - Opus in WebM: beds at 56 kbps stereo, events at 48 kbps mono;
   - AAC in M4A at 80 kbps as the fallback.
5. **Write `public/audio/manifest.json`:** file names, durations, roles,
   scenes and loop points (in samples), plus credits (title, recordist, URL,
   licence and an "edited" note).
6. **Fail the build** if a licence isn't on the allowed list, or the total
   size goes over budget.

**Credits:**
- `scripts/build-audio.mjs` also rewrites the README's "Sound credits"
  block from the manifest.
- The page reads the same manifest for its credits link.
- **BY-SA:** outputs derived from BY-SA sources are labelled CC BY-SA 4.0
  in the manifest.

**Budget** (with headroom against 6 MB):

| Role | Count | Size each | Total |
| --- | --- | --- | --- |
| Beds | 6–8 loops, 60–120 s | ~0.4–0.8 MB | ~4 MB |
| Events | 12–16 one-shots | ~25 KB | ~0.4 MB |
| Thunder | 6 rolls | ~80 KB | ~0.5 MB |

## 2. Runtime (in the browser)

The current `src/audio.js` becomes `src/audio/`:

- **`AudioEngine`** (from today's `AudioManager`)
  - Owns the `AudioContext` and master gain, created only on the user's tap.
  - Suspends when the tab is hidden.
  - Exposes `bus(name)` for beds, events and thunder, each with its own
    gain, wired to the dev panel and config.
- **`AssetLoader`**
  - Picks the format with `canPlayType('audio/webm; codecs=opus')`, falling
    back to `.m4a`.
  - Fetches the manifest, then **the current scene's files first**, then
    the rest when idle (`requestIdleCallback`, falling back to `setTimeout`).
  - Decodes with `decodeAudioData`.
  - Caches decoded buffers per `id`.
  - A failure marks that file unavailable; nothing throws.
- **`BedMixer`**
  - One looping `AudioBufferSourceNode` per active bed (`loop = true`, with
    `loopStart`/`loopEnd` from the manifest) → a gain per bed → the bed bus.
  - The target gain of each bed is:
    ```
    scene mix weight
      × layer volume
      × intensity coupling
          rain beds × eased P.rain
          wind beds × (0.2 + 0.8 × eased P.wind)
      × fallback switch (0 when its file failed)
    ```
  - Gains move with `setTargetAtTime`, using a time constant of the
    transition time ÷ 3.
  - Fading in and out at the same time keeps total loudness steady: an
    equal-power crossfade.
  - Sources start when first needed and stop about 2 s after their gain
    reaches zero, to save CPU.
- **`EventScheduler`**
  - Each scene has pools: `{ ids: [...], meanInterval, minGap }`.
  - The next event time is drawn from an exponential distribution
    (Poisson events), clamped to `minGap`, from a seeded random generator
    (testable).
  - The variant is random, excluding the last one played.
  - Each play gets gain ±3 dB, `playbackRate` 0.96–1.04 and a stereo pan
    of −0.6 to 0.6 (a `StereoPannerNode`).
  - The visual bird flocks call `onFlock()`, which plays a flock variant
    panned from the side the flock enters.
- **`ThunderDirector`**
  - Active only while the scene is Rain.
  - Schedules rolls with an average interval of 40–120 s from config,
    clamped to ≥ 30 s apart. The first roll comes ≥ 15 s after rain starts.
  - Each roll picks a distance *d* from 3–12 km:
    - gain −(d − 3) × 1 dB;
    - low-pass cutoff `lerp(3000, 600, (d − 3) / 9)` Hz;
    - a slight `playbackRate` drop for far rolls (0.92–1.0).
  - With lightning (P1.1), it emits a `flash` event first and starts the
    roll `d / 0.343` seconds later.
  - When the scene leaves Rain, no new rolls start; a roll already playing
    finishes.
- **`SynthFallback`**
  - Today's generated wind and rain, kept in the code.
  - Used only while the matching recorded layer is missing (still loading,
    failed, or unsupported), then crossfaded out once it arrives.
- **`SoundDirector`**
  - Called by `main.js` about 10 times a second with
    `{ sceneName, P (eased params), dt }`.
  - Routes the current scene to the BedMixer, EventScheduler and
    ThunderDirector.

### Scene mix table (config)

`AUDIO_MIX` in `src/config.js` gives each scene a weight per bed id. These
are starting levels for the listening pass.

| Scene | Weights (ids from `audio/sources.json`) |
| --- | --- |
| `dawn` | `dawnOrchard` 1.0, `windGrass` 0.1 |
| `sunny` | `dayField` 1.0, `windGrass` 0.15 |
| `wind` | `windGrass` 0.6 (already −8 dB at build), `dayField` 0.25 |
| `rain` | `rainSteady` 1.0 (× eased P.rain) |
| `overcast` | `dayField` 0.5, `windGrass` 0.2 |
| `twilight` | `eveningBirdsToCrickets` 1.0 |
| `night` | `nightCrickets` 1.0 |

These follow Tony's picks (story 6.1, 20 Oct 2026). Since there's one bed
per scene, heavier rain comes from level rather than a second file.

Event pools also live in config.

| Scene | Events | Mean interval |
| --- | --- | --- |
| Dawn | `koel`, `kingfisher` | 12 s |
| Daylight | `koel`, `kingfisher` | 25 s |
| Sunset | `crowsHouse` (Tony: sparingly) | 90 s |
| Windy, Night, Rain | none (Rain has thunder) | n/a |

Thunder uses `thunderDistant` cuts for most rolls and `thunderClose`
only for near distances.

**Passing flocks:** none of the flock calls were picked, so flocks stay
silent for now. Egrets rarely call, so a silent flock is authentic.

## 3. Interfaces

```js
// main.js
const sound = new SoundDirector(config);
soundButton.onclick = () => sound.start();             // user gesture
sound.update({ sceneName: scene.sceneName, P: scene.P, dt });  // ~10/s
scene.onBirdsEnter = (side) => sound.onFlock(side);
sound.onFlash = (strength) => scene.flash(strength);   // P1.1 lightning
```

## 4. Config and controls

`config.audio` grows to hold:
- per-bus volumes (`beds`, `birds`, `thunder`);
- `eventDensity` (0–2);
- `thunderEvery` (seconds);
- `lightning` (true or false).

All of these go into `RANGES` and validation like the other settings. The
dev panel's **Sound** group gets those controls plus **Thunder now**,
**Bird now** and a readout of which beds are playing.

## 5. Testing

- **Unit (node, no audio):**
  - the manifest schema;
  - the licence allowlist;
  - each scene has a mix and every mix id exists;
  - the EventScheduler (seeded) gives the right average interval, never
    plays the same file twice in a row, and respects `minGap`;
  - the ThunderDirector plays only in Rain, keeps the first-roll delay and
    the gap between rolls, and maps distance to gain and filter
    monotonically.
- **Integration (headless Chrome via `tools/capture.mjs`):**
  - with sound off, no audio requests;
  - after a tap, the AudioContext is running;
  - after forcing Rain and calling "thunder now", a roll is scheduled.
- **Manual:** listening checklist per scene on three playback systems
  (laptop speakers, headphones, phone).

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| Distant traffic, voices or music in the Kerala recordings | Trim in `sources.json`; the listening pass rejects bad takes |
| Seams at loop points | Equal-power crossfade baked in at build time, plus sample-accurate loop points |
| Safari Opus support | M4A fallback chosen by `canPlayType` |
| Licence drift (a recordist changes the licence later) | The manifest records the licence and download date; the test enforces the allowlist |
| Phone battery | Context suspended when hidden; inactive beds stopped; about 10 updates per second |

## 7. Decisions (D-6.x)

These are for the project decision log (`docs/architecture/decisions.md`).

- **D-6.1 Recorded ambience replaces generated sound as the main audio;
  generated sound stays as a fallback.**
  - This supersedes the brief's "wind sound made in code"
    (`docs/product/brief.md`, §12). The brief is left unchanged.
  - Generated wind and rain remain in `SynthFallback`, used while a
    recording is loading or unavailable.
- **D-6.2 Licence policy:**
  - Only CC0, CC BY, CC BY-SA and CC BY-NC files ship, because the repo and
    site are public, so every file is redistributed.
  - CC BY-NC is allowed only while the site stays non-commercial.
  - Files derived from BY-SA sources ship as CC BY-SA.
  - Not used: BBC, Sonniss, Pixabay, Zapsplat, Macaulay, and paid packs
    that forbid redistribution.
  - A test enforces the allowlist.
- **D-6.3 No religious sound by default** (temple music, azaan, bells).
  A church bell at sunset is an open question for Tony.
- **D-6.4 Delivery:**
  - Opus in WebM, with AAC in M4A as the fallback.
  - Beds about −28 LUFS, events about −24, thunder about −22.
  - Equal-power loop crossfades baked in at build time.
  - Lazy loading after the tap, current scene first.
  - Total ≤ 6 MB.
- **D-6.5 Originals stay out of git** (`audio-src/`, git-ignored).
  `audio/sources.json` records the source, licence and edits, and the
  processed outputs plus `manifest.json` are generated.
- **D-6.6 Open-only sound set** (Tony, 20 Oct 2026).
  - Ship only CC0, CC BY and CC BY-SA recordings: no CC BY-NC, so the site
    can be monetised later.
  - This narrows D-6.2's allowlist; the licence test enforces it.
  - **Dropped (CC BY-NC):** 27492 Asian koels, 808117 Farmlife, 28107 Boat
    trip, 28263 Odayam evening, 31948 Paddy frogs, 28264 Odayam night.
  - **Replacements:**
    - dawn: 787307 (Goa, CC0);
    - sunset crows: 249567 (CC0);
    - night: 803557 Goa crickets (CC BY), plus the Kerala owlet and
      nightjar calls (CC BY-SA).
  - **Final picks** (story 6.1, Tony):
    - Tropical Orchard in Spring (dawn bed);
    - crickets and tropical birds (day);
    - Wind in the African bush (−8 dB: Tony found it too loud);
    - Light rain in banana trees;
    - two TRP thunder recordings (parts of 578230, plus 574386);
    - Birds to Crickets (sunset);
    - house crows (sparingly);
    - Goa night crickets;
    - Asian koel;
    - white-throated kingfisher.

    Recorded in `audio/sources.json`.
  - Not used: the palm wind, heavy and easing-off rain, the Goa dawn, owlet
    and nightjar, and the parakeet, myna, barbet, bulbul and coucal calls.
- **D-6.7 to D-6.12: how the sounds play together** (party mode,
  20 Oct 2026; notes in `docs/bmad/party-mode/2026-10-20-sound-mix.md`).
  - **D-6.7:** scene changes crossfade over 8 s, equal-power. Shared beds
    carry across.
  - **D-6.8:** a returning bed starts at a random offset.
  - **D-6.9:** koel plays in rising phrases of 2–4 calls. One-shots are
    placed by pan and distance.
  - **D-6.10:** bird density: dawn mean 16 s, sunny 14 s, twilight crows
    90 s. No one-shots in wind, rain or night.
  - **D-6.11:** thunder: the first roll 6–14 s into rain, then a mean of
    40 s, at least 25 s apart, at 3–12 km. The close roll plays only under
    5 km, once per visit. Birds duck under thunder.
  - **D-6.12:** release gate: no push or deploy of the sound until the
    on-page Credits link (story 6.12) ships.
  - This supersedes the means in §2's event table (dawn 12 s, daylight 25 s)
    and the thunder timing in §2 (a mean of 40–120 s, the first roll at
    least 15 s in). The reason: a scene lasts only about 35 s.
