# Audio PRD: authentic, calm sound for every scene

**Status:** for review · **Date:** 20 Oct 2026 · **Inputs:** `brief.md`

## Problem

The scenes change from dawn to night and from sun to rain, but the sound is
the same generated noise and synthetic chirps throughout. It doesn't sound
like Kerala, and visitors who turn sound on get no sense of time, weather or
place.

## Goals

1. **Each scene sounds like its moment in Pala.** Dawn, Daylight, Windy,
   Rain, Sunset and Night each have a distinct, recognisable soundscape
   built from real recordings, from Kerala or South India where possible.
2. **Calm, never busy.** Beds sit low; bird calls and thunder are sparse,
   natural events. No sound repeats so regularly that a visitor notices
   the pattern.
3. **Rain has character.** Occasional distant thunder, at varied distances,
   with a natural gap between flash and sound if a flash is shown.
4. **Light and safe.** Nothing loads until sound is on. Under 6 MB in
   total. The site never breaks, stalls or plays sound unasked.
5. **Properly licensed and credited.** Every file is traceable to its
   source and licence, and credited on the site and in the README.

## Non-goals

- **Music, voices or any religious sound** (temple music, azaan, bells).
  A church bell at sunset is an open question.
- **Sound tied to the greeting.** It might be a nice later touch (sound
  ducking a little when he turns to you), but it isn't part of this.
- **Live weather sound beyond the scene.** Rain intensity follows the scene
  already; no extra weather data.
- **A sound settings UI for visitors** beyond the existing on/off button.

## Users and stories

- As a **visitor who turns sound on at dawn**, I hear birds waking (koels,
  bulbuls, a barbet) over a soft morning bed, so the scene feels like early
  morning in Kerala.
- As a **visitor during rain**, I hear steady monsoon rain on leaves and,
  now and then, a long distant roll of thunder, so the rain feels heavy and
  real but still calm.
- As a **visitor at night**, I hear paddy frogs and crickets, with the odd
  owlet, so the night feels alive but quiet.
- As a **visitor watching the scenes change**, I hear one soundscape blend
  into the next over a few seconds, with no cuts or gaps.
- As a **visitor on a phone**, sound starts only when I tap it, loads
  quickly, and doesn't drain the battery in a background tab.
- As a **visitor whose browser can't play the files** (old, offline, or
  blocked), I still get the current generated wind and rain, or silence,
  and nothing breaks.
- As the **owner**, I can rebalance each layer, change how often thunder
  and birds happen, and trigger them on demand in the dev panel.
- As the **owner**, I can swap a recording by editing one manifest entry
  and re-running one script, with credits updated automatically.

## Requirements

### P0

**P0.1 Scene soundscapes**
- Each scene has a mix: which looping layers play and at what level.

  | Scene | Beds (loops) | Events |
  | --- | --- | --- |
  | Dawn | dawn chorus + Kerala koels; a low breeze | koel, bulbul, barbet, kingfisher |
  | Daylight | daytime paddy/rural bed (crickets, distant birds); low palm wind | myna, barbet, coucal, kingfisher; parakeet or myna flocks with the visual birds |
  | Windy | palm wind + grass wind (strong); a faint day bed | sparse birds |
  | Rain | steady rain (heavy or light by rain intensity); faint frogs | **thunder**; no birds |
  | Sunset | evening bed (crows settling, crickets starting) | crows, myna roost |
  | Night | paddy frogs + crickets (+ the Kerala night bed) | jungle owlet, nightjar |

- Acceptance:
  - [ ] Every scene, including the overcast variant, has a mix.
  - [ ] No silent scene.
  - [ ] Levels are set from one table in config.

**P0.2 Crossfades**
- When the scene changes (each crossing, or the opening weather scene),
  the beds crossfade with equal power over the scene transition time
  (4 s by default).
- Rain and wind levels also follow the scene's eased rain and wind values,
  so the sound tracks the visuals.
- Acceptance:
  - [ ] No click, gap or volume dip at a scene change.
  - [ ] Loops are seamless.

**P0.3 Events**
- Bird calls are scheduled randomly per scene (an average interval, with a
  minimum gap).
  - The variant is random, never the same one twice in a row.
  - Each play gets slight changes in level (about ±3 dB), pitch (about
    ±4%) and pan.
- Passing flocks play a flock call when the visual birds enter, replacing
  the synthetic chirps.
- Acceptance:
  - [ ] In 10 minutes of any scene, no two consecutive events use the same
    file.
  - [ ] Event density matches config (tested with a fixed random seed).

**P0.4 Thunder**
- Only during Rain.
  - The first roll comes at least 15 s after rain starts; after that,
    every 40–120 s on average.
  - Each roll gets a random distance of 3–12 km. Further means quieter,
    duller (lower low-pass filter) and longer.
  - Rolls never overlap.
- Acceptance:
  - [ ] Thunder never plays outside Rain.
  - [ ] It stops cleanly, finishing its roll, when the scene leaves Rain.
  - [ ] Its peak is no more than about 6 dB above the rain bed.

**P0.5 Loading and formats**
- Nothing is fetched until sound is turned on.
- The current scene's files load first, then the rest in the background.
- Opus (`.webm`) is the main format, with AAC (`.m4a`) as the fallback,
  chosen by what the browser can play.
- Acceptance:
  - [ ] With sound off, there are zero audio requests.
  - [ ] Sound is audible within 2 s of tapping on a normal connection.
  - [ ] Total shipped audio is ≤ 6 MB.

**P0.6 Fallback**
- If files fail to load or decode, the current generated wind and rain
  carry on.
- No errors are shown to visitors.
- Acceptance:
  - [ ] Blocking audio requests leaves the generated sound working, with
    no console errors.

**P0.7 Licences and credits**
- `audio/manifest.json` lists every shipped file: source URL, recordist,
  licence and the edits made.
- A test fails if any file is missing a licence, or has one outside the
  allowed list (CC0, CC-BY, CC-BY-SA, CC-BY-NC).
- Credits are generated from the manifest into the README, and into the
  site's single "Credits" list (D-0.5).
- Acceptance:
  - [ ] Every CC BY, BY-SA and BY-NC file is credited on the site.
  - [ ] BY-SA files are marked as BY-SA.

**P0.8 Owner controls**
- In the dev panel:
  - per-layer volumes;
  - bird event density;
  - thunder frequency;
  - "thunder now" and "bird now" buttons.
- Settings save and validate like the rest.

### P1

- **P1.1 Lightning:** a soft sky flash before each thunder roll. The roll
  follows after distance ÷ 343 m/s, so it arrives about 3 s per km later.
  The flash respects reduced motion and is never strobing.
- **P1.2 Rain tail:** the "end of the rainstorm" bed as Rain hands over to
  the next scene.
- **P1.3 Night variety:** two night beds alternating per visit.
- **P1.4 Sound credits panel** styled to match the site.

### P2

- **P2.1** Sound reacts to the greeting (ambience ducks a little while he
  looks at you).
- **P2.2** Seasonal variation (monsoon vs dry season) from the date.
- **P2.3** Live rain intensity from the weather data.

## Success metrics

The site has no analytics, so these are measured in review:
- **Listening review:** for each scene, you agree it sounds like that moment
  in Kerala (6/6). Tested on laptop speakers, headphones and a phone
  speaker.
- **No pattern:** in a 15-minute listening session, no repetition is
  noticeable.
- **Size:** shipped audio ≤ 6 MB; the first scene audible ≤ 2 s after
  tapping.
- **Licences:** a credits test passes in CI on every deploy.

## Open questions

| # | Question | Who | Blocking? |
| --- | --- | --- | --- |
| 1 | ~~Kerala-authentic or open-only set?~~ **Resolved (D-6.6): open-only set** (CC0, CC BY, CC BY-SA). No CC BY-NC files, so the site stays free to monetise. | Tony | Resolved |
| 2 | Freesound originals need a logged-in account to download. Will you download the shortlisted files, or set up a Freesound API key for a script? | Tony | **Yes**, for the build |
| 3 | A distant church bell at sunset (authentic to Pala), or no religious sound at all (the default)? | Tony | No |
| 4 | Lightning flash (P1.1) in this round, or later? | Tony | No |
| 5 | ~~Where should the "Sound credits" link sit?~~ **Resolved by D-0.5:** one quiet "Credits" link at the bottom left, shared by sound and Open-Meteo credits, opening one list. | Tony | Resolved |

## Phasing

1. **Sourcing:** a listening pass, pick and download.
2. **Pipeline:** trim, loop, normalise and encode, with a manifest.
3. **Runtime:** beds, crossfades, events, thunder and fallback.
4. **Polish:** lightning, credits panel and a listening QA pass.

Phases 2 and 3 can start with two or three files while sourcing finishes.
