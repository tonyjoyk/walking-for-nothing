# Spec: opening on today's weather

**Status:** built and live 17–18 Oct 2026; **paused 20 Oct 2026**. The default opening is now shuffle (story 1.1); live weather is the 'weather' opening mode, and `LIVE_WEATHER=false` · **Owner:** Tony · **Decision:** Kerala's weather (option A)

## Summary

When someone opens the site, the scene matches the real weather and time of
day right now: sunny, overcast, raining, windy, dawn, sunset or night. After
that first impression, the scene returns to its slow journey: each time the
man walks off one side of the screen and back in, it moves on to the next of
the six scenes.

## Problem statement

The site is meant to feel alive, but today it opens on the same sunny scene
every time and then stays there. Visitors have no reason to feel that this
place exists *now*, alongside them, and repeat visitors always see the same
first frame.

A first frame that matches the real weather is a small moment of
recognition: "it's raining there too", or "it's evening". It costs a visitor
nothing, and it gives each visit a different opening without adding any
interface.

## Goals

1. **Correct opening scene.** On at least 95% of loads, the opening scene
   matches current conditions at the chosen location (mapping below).
2. **No waiting.** The page never waits for weather data. The first frame
   appears as fast as it does today, and the weather scene, if different,
   eases in within 2 seconds.
3. **Graceful failure.** If weather data is missing, slow or stale, the
   visitor sees a normal scene with no errors and no gaps in motion. On 100%
   of failed fetches the site still opens on a sensible scene for the local
   time.
4. **The journey resumes.** After the opening scene, the six scenes cycle,
   one per crossing, every time.
5. **Nothing intrusive.** No permission prompts, no cookies, no
   personally identifying data stored or sent anywhere we control.

## Non-goals

- **Live updates during a visit.** The weather is read once, at load. A
  visit is minutes long, and the cycle takes over after the first crossing
  anyway.
- **Forecasts, temperatures or any on-screen weather text.** The site has no
  interface beyond the sound button, and the scene *is* the readout.
- **New weather types (fog, thunderstorm, hail, snow).** These map to the
  closest of the six existing scenes. A dedicated overcast or fog scene is
  listed under P2.
- **Precise location of the visitor.** We never ask for browser geolocation;
  the prompt alone would break the mood of the site.
- **Analytics infrastructure.** We measure what we can without adding a
  tracker (see Success metrics).

## Key decision: whose weather?

This decides privacy, permissions and architecture. **It blocks work.**

| Option | What the visitor sees | Privacy and permissions | Effort |
| --- | --- | --- | --- |
| **A. Kerala's weather** (fixed location, e.g. Kochi or Thrissur) **— recommended** | The weather where the man is walking, right now. It fits the story: a window onto a real place. | No prompt. If data is fetched on a schedule (below), the visitor's browser makes no third-party calls at all. | Smallest |
| B. The visitor's local weather (approximate, from IP) | Their own sky reflected back | IP-based lookup sends their IP to a third party; needs a privacy note | Medium |
| C. The visitor's precise local weather (browser geolocation) | Most accurate for them | A permission prompt on an ambient art site; most decline | Medium, and poor experience |

**Recommendation: A.** The landscape is explicitly Kerala. "It's raining in
Kerala right now" is a stronger idea than mirroring the visitor's window, and
it removes every privacy and permission problem. B can follow later as a P2
option if wanted.

## User stories

**First-time visitor**
- As a first-time visitor, I want the scene to reflect the real conditions
  in Kerala when I arrive, so that it feels like a live window rather than a
  loop.
- As a first-time visitor on a slow connection, I want the page to start
  immediately, so that I'm never looking at a blank or loading screen.

**Returning visitor**
- As a returning visitor, I want the opening to differ with the weather and
  the hour, so that the site rewards coming back.
- As a returning visitor who stays a while, I want the scene to keep
  changing as he walks, so that the site still has its slow rhythm.

**Visitor with reduced motion**
- As a visitor who prefers reduced motion, I want the scene changes to stay
  calm, so that nothing flashes or jumps. The existing reduced-motion
  setting continues to apply.

**Site owner (Tony)**
- As the owner, I want to force any weather in the dev panel, so that I can
  check how each condition opens without waiting for it to happen.
- As the owner, I want to switch the live weather off without a redeploy,
  so that a bad data day never spoils the site.

**Edge cases**
- Weather service down or slow → sensible scene for Kerala's local time.
- Data older than 3 hours → treat as missing.
- Visitor's clock or timezone differs from Kerala → time of day uses
  Kerala's time (with option A).
- Page opened in a background tab → the opening scene is still decided
  correctly when the tab is first shown.

## How the scene is chosen

### Mapping current conditions to the six scenes

Inputs:
- **WMO weather code:** the standard code most weather APIs return.
- **Wind speed.**
- **Sunrise and sunset** for the day.
- **Local time in Kerala.**

Rules, in priority order:

| Priority | Condition | Scene |
| --- | --- | --- |
| 1 | Rain, drizzle, showers or thunderstorm (WMO 51–67, 80–82, 95–99) | **Rain** |
| 2 | After sunset + 45 min and before sunrise − 45 min | **Night** |
| 3 | Within 45 min either side of sunrise | **Dawn** |
| 4 | Within 75 min before sunset to 45 min after | **Sunset** |
| 5 | Wind ≥ 30 km/h, or gusts ≥ 45 km/h | **Windy** |
| 6 | Overcast or fog (WMO 3, 45, 48) | **Rain scene with the rain turned off** (an "overcast" look), until a dedicated overcast scene exists (P2) |
| 7 | Anything else (clear, mainly clear, partly cloudy) | **Daylight** |

Rain outranks time of day, so a rainy night opens on Rain. All thresholds
live in `config.js` so they can be tuned.

### After the opening scene

- The opening scene holds until the man's first full crossing. That's about
  33 seconds at the default pace.
- From then on, each crossing moves to the next scene in a fixed, natural
  order:

  **Dawn → Daylight → Windy → Rain → Sunset → Night → Dawn …**

- The cycle starts from wherever the opening scene sits in that order, so
  the day keeps moving forward from what the visitor first saw.
- The overcast variant re-enters the cycle at Rain.
- Each change uses the existing eased transition (4 s by default), which
  starts as he re-enters from the left, so it never happens mid-stride in
  full view.

## Requirements

### P0: must have

**P0.1 Scene chooser**
- A pure function `chooseOpeningScene(weather, now)` returns one of the six
  scenes (plus the overcast variant), following the table above.
- Acceptance:
  - [ ] Unit tests cover every row, each boundary (sunrise ± 45 min, sunset
    windows), rain at night and missing fields.
  - [ ] Missing or invalid input returns the time-of-day scene, never throws.

**P0.2 Fast, non-blocking start**
- The page starts immediately with a time-of-day scene computed locally
  (Kerala time against approximate sunrise and sunset). When weather arrives,
  it eases into the chosen scene.
- Acceptance:
  - [ ] Given the weather request takes 5 s or fails, when the page loads,
    then the first frame appears with no added delay.
  - [ ] Given weather arrives within 2 s, then the scene eases into the
    weather scene.
  - [ ] Given it arrives later than 2 s, then it is ignored for this visit
    (no late, unexplained change).

**P0.3 Weather data source** (architecture under "How it goes live")
- One small JSON document with code, wind, gusts, sunrise, sunset and an
  observation time.
- Acceptance:
  - [ ] Data older than 3 hours is treated as missing.
  - [ ] A malformed file is ignored, and the site works normally.

**P0.4 Cycling through the six scenes**
- After the first crossing, each crossing advances to the next scene in the
  order above.
- Acceptance:
  - [ ] Over 7 crossings, every scene appears once and the cycle wraps.
  - [ ] Each transition starts as he re-enters from the left.
  - [ ] Juhu and the birds follow each scene's existing settings.

**P0.5 Owner controls (dev panel)**
- Live weather on/off.
- Force a condition (each row of the table).
- Cycling on/off, plus a "crossings per scene" setting (default 1).
- All saved in exported JSON and validated on import.
- Acceptance:
  - [ ] With live weather off, the site opens on the default scene, as it
    does today.
  - [ ] Forcing a condition opens that scene on reload.

**P0.6 Kill switch without redeploy**
- The weather JSON carries `enabled: true/false`. When it's false, the site
  ignores live weather.
- Acceptance:
  - [ ] Setting it to false and refreshing the data disables live weather
    on the next load.

### P1: nice to have

- **P1.1 Overcast look:** a tuned variant of the Rain scene with no rain
  and lower contrast, rather than reusing Rain as-is.
- **P1.2 Bias the cycle to the day's real weather:** for example, on a
  rainy day, Rain comes round more often. Off by default.
- **P1.3 `?weather=` URL override:** for example `?weather=rain`, for
  sharing and testing.

### P2: future (design so these stay possible)

- **P2.1 A dedicated overcast/fog scene.** That makes seven scenes; the
  mapping and cycle already treat scenes as a list.
- **P2.2 Visitor's local weather (option B).** The chooser takes a weather
  object, so the data source can change without touching scene logic.
- **P2.3 Live intensity:** rain heaviness and wind strength scaled by the
  measured values, not just which scene is chosen.

## How it goes live

### Data pipeline (recommended): fetched on a schedule, served as a static file

1. A scheduled job (GitHub Actions, every 30 minutes) fetches the current
   weather for the chosen Kerala location from **Open-Meteo**:
   - free;
   - no API key;
   - CORS-enabled;
   - data CC BY 4.0, so we credit it in the README and site footer or
     credits;
   - its free tier is for non-commercial use, which fits a personal site.
     Confirm the current terms before launch.
2. The job writes a tiny `weather.json` (under 1 KB) and publishes it with
   the site.
3. The page reads `/weather.json` from its own origin.

**Why this design:**
- **No third-party calls:** no visitor's IP or browser ever contacts a
  weather service.
- **No rate limits:** one fetch per half hour, regardless of traffic.
- **No key to protect.**
- **Instant:** a same-origin file, served fresh with a short cache lifetime
  (about 15 minutes).
- **Resilient:** if a scheduled run fails, the previous file stays and simply
  ages out after 3 hours.

**Alternative, if hosting can't take scheduled publishes:** the page calls
Open-Meteo directly. That's simpler, but each visitor's IP goes to
Open-Meteo, and the site depends on Open-Meteo being up at load time.

### Rollout

| Step | What | Exit criteria |
| --- | --- | --- |
| 1 | Chooser and cycling, driven by a hand-written `weather.json` (no network) | Tests pass; forcing each condition opens the right scene; 7-crossing cycle verified with `npm run capture` |
| 2 | Scheduled job producing the real `weather.json` | 48 hours of successful runs; file valid and under 1 KB; credit added |
| 3 | Deploy with live weather **off** (`enabled: false`), file still published | Site unchanged for visitors; file served with the right cache header |
| 4 | Turn on for the owner only via `?weather=live` | A few days of checks at different times (dawn, rain, night) |
| 5 | Turn on for everyone (`enabled: true`) | Watch the file and job for a week; kill switch tested |

## Success metrics

This is a personal site with no analytics, so measures are deliberately
light. We add no tracker for this feature.

**Leading (first week)**

| Metric | Target | How measured |
| --- | --- | --- |
| Scheduled job success rate | ≥ 98% of runs | GitHub Actions history |
| `weather.json` freshness at load | < 45 min old on ≥ 95% of checks | Spot checks, plus age logged in the dev panel |
| Opening scene matches the real sky | ≥ 9 of 10 owner spot checks across times of day | Manual: compare with Kerala webcams or reports |
| Added time to first frame | 0 ms (not on the critical path) | `npm run capture` timing and DevTools |

**Lagging (first month)**
- Qualitative: unprompted visitor comments about the weather or time
  matching ("it's raining there too").
- If basic hosting stats exist: whether average visit length changes.
  Visitors who stay past the first crossing see the cycle.

## Open questions

| # | Question | Who | Blocking? |
| --- | --- | --- | --- |
| 1 | Whose weather: Kerala (recommended), the visitor's, or both? | Tony | **Yes** |
| 2 | If Kerala: which place? Kochi, Thrissur, or a specific village that matters to the story? | Tony | **Yes** (needs coordinates) |
| 3 | Where will the site be hosted (GitHub Pages, Netlify, Vercel, other)? This decides whether a scheduled job can publish `weather.json`. | Tony / engineering | **Yes** for step 2 |
| 4 | Should a rainy night show Rain (as specified) or Night with rain? Combining scenes would need a new scene. | Tony / design | No |
| 5 | Is about 33 s per scene the right rhythm, or should a scene last 2 crossings? | Tony | No (setting) |
| 6 | Where does the Open-Meteo credit live (README only, or a small credits line)? | Tony | No |
| 7 | Should Juhu's and the birds' per-scene rules change now that scenes cycle (e.g. Juhu out in the rain)? | Tony | No |

## Timeline

There are no hard deadlines.

| Phase | Work | Size |
| --- | --- | --- |
| **Phase A** (code, no network) | Chooser, local time-of-day start, cycling, dev panel controls, tests | ~1 day |
| **Phase B** (data) | Scheduled job and `weather.json`, credit | ~0.5 day, after open question 3 |
| **Phase C** (rollout) | Steps 3–5 above | ~1 week of observation, very little effort |

**Dependencies:** hosting choice (open question 3) and location (questions
1–2). Phase A can start now, because it doesn't depend on either.
