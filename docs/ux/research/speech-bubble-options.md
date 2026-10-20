# Speech bubble: four smaller options (UX, 20 Oct 2026)

**Owner's brief:** the first bubble (story 2.2) is too big and doesn't feel
right. The text and the bubble should be smaller and more minimal, and take
up less of the scene. Show four named options so one can be chosen.
**Story:** [2.3](../../stories/2.3.speech-bubble-restyle.md).
**Board:** https://miro.com/app/board/uXjVEXknK0w=/

**Outcome (20 Oct):** the owner picked **3. Air**, with smaller text and
ink that adapts to each scene for contrast (D-2.4). The other options and
the `?bubble=` switch have been removed. Final captures are in
`docs/media/bubble-air/`.

## Constraints held by every option

- The site's own language: system font, soft glass like the sound button,
  white type over the scene, and nothing decorative (UX principles 1–4).
- Smaller: 11.5–12 px type (was 15), 196–224 px wide (was 300), and roughly
  half the area of the first bubble.
- Readable in every scene. Captured in Daylight, Night, and Sunset on a
  phone.
- The copy, the timing (15 s hold) and the behaviour don't change. The cursor
  on the bubble still keeps him facing you.

## The options

| # | Name | Look | Strengths | Risks |
| --- | --- | --- | --- | --- |
| 1 | **Whisper** | The light glass bubble, made compact: 12 px, 216 px wide, 10 px corners, lighter shadow, small tail | Closest to the first version; reads in every scene | Still the most "UI-like" of the four |
| 2 | **Night glass** | The sound button's dark glass and hairline white border, with white type | Matches the one existing control; quiet at night and dusk | Darker block in bright daylight |
| 3 | **Air** | No box: white words in the sky, a soft text shadow, and a 1 px hairline down to his head | The most minimal; lets the scene through | The weakest contrast on the brightest daylight sky |
| 4 | **Side note** | A small paper card beside his head, no tail, 11.5 px. On a phone, where there's no room beside him, it sits above him | Doesn't cover the sky above him; reads like a caption | Covers part of the field and the hills beside him |

Captures: `docs/media/bubble-options/<name>-day.jpg`, `-night.jpg`, and
`-phone.jpg`. These were tried locally with a temporary `?bubble=<name>` switch (now removed).

## After the choice

- Make the chosen option the default style, and remove the other three and
  the `?bubble=` switch.
- Update the UX spec's epic 2 section, and close story 2.3.

## Revision (20 Oct): a plain plate instead of the veil

**Owner's feedback:** on Sunset and Rain, the blurred white veil behind the
words looks like a smudge. The owner wants a plain, consistent background
instead: a white rectangle with 8 px corners at about 40% opacity, or 60% if
40% isn't enough.

**UX evaluation.**
- **Why the veil looked wrong:** it only appeared in two scenes, and its
  soft edge read as an effect rather than an object. A plate in every scene
  is one shape that behaves the same way everywhere, which fits the site's
  flat, few-shapes style better.
- **Ink:** dark (#17211c) on a white plate in every scene, so the bubble no
  longer swaps colour from scene to scene.
- **Measured** (dark text over the 40% plate, worst tenth of the sky):
  Daylight 12.4, Sunset 8.0, Rain 6.8, Night 4.5, Dawn 12.8, Windy 12.8;
  on phones 12.7 / 13.7 / 4.6. **40% passes everywhere.** Night is the
  tightest.
- **Recommendation:** use 40% as the standard plate. Keep 60% only as an
  automatic safety net for any sky darker than the measured night, such as
  mid-transition, so contrast never drops below 4.5:1. The plate's look
  doesn't otherwise change.
- **Kept from Air:** 11 px type, the bold first line and the hairline down
  to his head (now white, like the plate).

Captures: `docs/media/bubble-plate/`. Decision: D-2.5. Story:
[2.4](../../stories/2.4.speech-bubble-plate.md).

