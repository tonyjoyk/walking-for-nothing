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
