# Opening scene: random first visit, next scene on every reload

BMAD planning pack: analyst brief, PM requirements, UX, architect notes.
The implementation story is `docs/stories/1.1.shuffle-and-advance-opening.md`.
**Date:** 20 Oct 2026.

---

## 1. Analyst brief

**Request (Tony, 20 Oct 2026):**
- Every time the page is reloaded, move to the next scene.
- Randomise which scene appears when a visitor loads the page.
- Turn off live weather for now.

**Context today:**
- The site opens on Kerala's time-of-day scene, then (if live weather is on)
  eases to Pala's current weather.
- After that, each screen crossing moves to the next scene in the cycle:
  Dawn → Daylight → Windy → Rain → Sunset → Night.
- Live weather is on (`LIVE_WEATHER=true`, as of 18 Oct).

**Reading the two asks together.** They only conflict if "load" and "reload"
mean the same thing. They don't:

| What the visitor does | Intent | Behaviour |
| --- | --- | --- |
| Opens the site (new tab, link, typed URL, a later visit) | A fresh look | **Random** scene, one of the six |
| Reloads the same tab | "Show me something else" | **The next scene** after the one that was on screen |

**Why "the one that was on screen", not "the one it opened on":**
- If the visitor watched long enough for a crossing to change the scene, a
  reload should still move forward from what they last saw.
- A reload never shows the scene they were just looking at.

**Assumptions:**
- "Scenes" means the six presets. Overcast stays a weather-only variant and
  isn't in the shuffle.
- Live weather is switched off, not removed, so it can come back later.

---

## 2. Requirements (PM)

### Goals

1. A first visit opens on a random scene, so over time visitors see all six.
2. Each reload shows a different scene: the next in the cycle after the one
   on screen.
3. Live weather is off, with no network call for weather and no credit line,
   and can be turned back on with a setting, not a code change.
4. Nothing else changes: crossings still advance the scene, and forced scenes
   (`?weather=rain`, dev panel) still work.

### Functional requirements

- **FR1:** With no memory of a previous scene in this tab, the opening scene
  is chosen uniformly at random from the six.
- **FR2:** On a reload of the same tab, the opening scene is
  `next(last scene on screen)` in the cycle order.
- **FR3:** "Last scene on screen" is updated every time the scene changes:
  at opening, at each crossing, or by hand in the dev panel.
- **FR4:** The opening scene appears instantly, with no transition from
  another scene on the first frame.
- **FR5:** A forced scene (`?weather=<scene>` or the dev panel's opening
  scene) overrides FR1–FR2. It's also remembered, so a reload after it
  advances.
- **FR6:** Live weather is off:
  - the opening mode defaults to shuffle;
  - the published `weather.json` is switched off (`LIVE_WEATHER=false`);
  - weather mode stays available in the dev panel.

### Non-functional requirements

- **NFR1 (privacy):** memory is kept in the tab's `sessionStorage` only. No
  cookies, nothing sent anywhere, and it's cleared when the tab closes.
- **NFR2 (robustness):** if storage is unavailable (private mode, blocked),
  every load is random and nothing errors.
- **NFR3:** no added delay to the first frame.

### Out of scope

- Avoiding the same random scene on two separate visits. Random means it can
  repeat; with six scenes that's a one in six chance.
- Remembering across tabs or devices.

---

## 3. Experience (UX)

**First visit:** the page opens directly on, say, Sunset. The man walks; at
each crossing the day moves on (Night, then Dawn…).

**Reload:** whatever was on screen (Sunset, or Night if a crossing happened),
the page reopens on the next scene. Reloading repeatedly steps through the
day like turning pages:
**Dawn → Daylight → Windy → Rain → Sunset → Night → Dawn.**

**New tab or later visit:** a fresh random scene.

**Owner:**
- The dev panel's **Opening and journey** group gets an **opening mode**
  setting: shuffle (default), weather, or time of day.
- It shows what the page opened on and why ("random first visit" or "next
  after Sunset").

---

## 4. Architect notes

- **`src/weather.js`:**
  - Add `chooseShuffleScene(last, random)`, a pure function: `next(last)` if
    `last` is a known scene (overcast counts as rain), otherwise
    `CYCLE_ORDER[floor(random() * 6)]`.
  - Add `readLastScene(storage)` and `rememberScene(storage, name)`. Both
    take an injected storage object and swallow errors, for NFR2 and
    testability.
- **`Scene`:** an `onSceneChange(name)` hook, called from `applyScene` and
  when the preset is changed by hand. `main.js` points it at
  `rememberScene(sessionStorage, …)`.
- **`main.js` `chooseOpening()`:**
  - Forced scene first.
  - Then by mode: **shuffle** uses `chooseShuffleScene`; **time of day** and
    **weather** keep today's behaviour, with weather mode only fetching
    `weather.json`.
  - The opening is applied with `snap` (no easing).
- **Config:** replace `opening.liveWeather` with `opening.mode`: `'shuffle' |
  'weather' | 'time-of-day'`, default `'shuffle'`. Validation lists the
  options. Old exported JSON that still has `liveWeather` is simply ignored.
- **Turning off live weather:** set the repository variable
  `LIVE_WEATHER=false`; the next deploy publishes `weather.json` with
  `enabled: false`. The code default (shuffle) means the page doesn't fetch it
  anyway.
- **Tests:**
  - The shuffle chooser: next, wrap, overcast, unknown values, and the random
    spread over the six.
  - Storage helpers: with a throwing storage, and with none.
  - Scene hook: called on opening, crossings and hand changes.
  - Config: round-trip and validation.
