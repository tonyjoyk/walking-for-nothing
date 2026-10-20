# PRD: Walking for Nothing

**Owner:** Tony · **Updated:** 20 Oct 2026 · **Brief:** [brief.md](brief.md)
(historical; overridden where the [decision log](../architecture/decisions.md) says so)

## Vision

A quiet personal site. A man in a white mundu walks through a field in Pala,
Kerala, forever. Juhu, his German Shepherd, joins him now and then. The
light and weather move through the day. Everything is drawn in code, and
the only interface is the scene itself.

## Goals

1. A calm, believable scene that rewards watching for minutes, not seconds.
2. A figure who moves like a real person (natural steps, weight, cloth).
3. Small moments of contact that the visitor discovers rather than is told
   about (the greeting).
4. A fresh view on every visit and every reload.
5. Runs smoothly on desktop and phone, with nothing to install, and is free
   to host.

## Epics

Status and numbers: see the registry in [`docs/README.md`](../README.md).

| Epic | Scope | Requirements |
| --- | --- | --- |
| 1 Opening and journey | Which scene opens, and how scenes change | [opening-shuffle](specs/opening-shuffle.md) (current); [live-weather](specs/live-weather.md) (paused, D-1.3) |
| 2 The greeting | Hover the man and he stops; rest 2 s, click or tap and he turns, smiles, walks on | [greeting](specs/greeting.md) |
| 3 Character and motion | Walk, arms, mundu, look, character controls | [character study](../ux/research/character-study.md) and decisions D-3.x |
| 4 Landscape and atmosphere | Mountains, field, grass, shadows, the six scenes | [UX spec](../ux/ux-spec.md) and decisions D-4.x |
| 5 Platform and delivery | Hosting, deploy, mobile, performance, tests, dev tools | [architecture](../architecture/architecture.md) and decisions D-5.x |
| 6 Audio | Recorded, calm sound for every scene | [specs/audio/](specs/audio/) (brief, PRD, architecture), decisions D-6.1 to D-6.5 |

## Cross-cutting requirements

- **NFR-1 Performance:** median frame under 30 ms in the reference browser.
  60 fps on desktop; phones adapt quality (D-5.2).
- **NFR-2 Privacy:**
  - no cookies, trackers or analytics;
  - the only stored state is per-tab `sessionStorage` (D-1.4);
  - the page makes no third-party requests in the default mode.
- **NFR-3 Robustness:** the scene never shows NaN geometry; it handles a
  zero-size canvas, a hidden tab and blocked storage.
- **NFR-4 Accessibility:**
  - reduced motion is respected;
  - sound only starts after a tap;
  - touch targets are at least 44 px;
  - the canvas has an `aria-label`.
- **NFR-5 Licences:** only openly licensed data and code; credits in the
  README (gait data CC BY 4.0, weather data CC BY 4.0 while it's in use).
- **NFR-6 Quality gate:** `npm test` and `npm run build` must pass before
  any deploy (enforced by the deploy workflow).

## Where the brief no longer applies

| Brief says | Now | Decision |
| --- | --- | --- |
| 80–90 steps/min and a 60–90 s crossing | ~67 steps/min, ~33 s crossing | D-3.1 |
| Post-processing shader pass | Grain overlay and gradients | D-0.4 |
| Wind and rain sound generated in code | Recorded ambience, with generated sound as a fallback (planned) | D-6.1 |

Everything else in the brief still stands (six states, Juhu's rhythm, drawn
in code, the `?dev` panel).

## Status

| Feature | Status |
| --- | --- |
| Six scenes, landscape, field depth | Live |
| Natural walk, cloth mundu, look controls | Live |
| Greeting | Live |
| Shuffle opening (story 1.1) | Live |
| Live weather | Paused (deprecation review 31 Jan 2027) |
| Audio (recorded) | Planned: epic 6, stories 6.1–6.13 Draft |
