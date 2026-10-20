# Epic 2: The greeting

**Goal:** Hover (or tap) the man: he stops, turns to face the visitor, looks, smiles and walks on.

## Requirements and decisions

- Spec and implementation plan: [greeting](../product/specs/greeting.md) (D-2.1).
- Speech bubble introducing Tony: D-2.3; style "Air" with adaptive ink: D-2.4.
- Pause on hover, turn on a 2 s rest or a click: D-2.2 ([party mode](../bmad/party-mode/2026-10-20-greeting-hover-dwell-click.md)).

## Stories

| # | Title | Link | Status |
| --- | --- | --- | --- |
| (pre-story) | Greeting state machine, planned stop, morph turn, face and smile | commits df15a72, e85a6c2 | Done |
| 2.1 | Pause on hover; turn on a 2 s rest or a click | [2.1](../stories/2.1.pause-on-hover-turn-on-rest-or-click.md) | Done |
| 2.2 | A speech bubble when he faces you | [2.2](../stories/2.2.speech-bubble.md) | Done |
| 2.3 | A smaller, more minimal speech bubble | [2.3](../stories/2.3.speech-bubble-restyle.md) | Done |

Next story: **2.4**. Candidate follow-ups (spec P1/P2): Juhu reacts; a blink while looking. Register new stories in [`docs/README.md`](../README.md) before writing them.
