# Epic 6: Audio — authentic, calm sound for every scene

**Status:** planned · **Spec:** `docs/product/specs/audio/` (brief, PRD, architecture) · **Decisions:** D-6.1 to D-6.5

## Goal

Each scene sounds like that moment in a field in Pala, built from real
recordings (from Kerala or South India where possible):
- Dawn birds, a daytime paddy field and wind in the palms.
- Monsoon rain with occasional distant thunder.
- Evening crows and crickets, and night frogs.

Sound stays opt-in and light (≤ 6 MB, loaded after a tap). Every file is
openly licensed and credited.

## Stories

| Story | Title | Owner |
| --- | --- | --- |
| [6.1](../stories/6.1.listening-pass-and-picks.md) | Listening pass and final picks | Tony (owner) with Claude |
| [6.2](../stories/6.2.download-originals.md) | Download the originals | Tony (or a script with a Freesound API token) |
| [6.3](../stories/6.3.build-audio-pipeline.md) | Audio build pipeline | Claude |
| [6.4](../stories/6.4.manifest-and-credits.md) | Manifest and credits | Claude |
| [6.5](../stories/6.5.split-audio-module.md) | Split audio.js into src/audio/ (no change in behaviour) | Claude |
| [6.6](../stories/6.6.asset-loader.md) | Asset loader | Claude |
| [6.7](../stories/6.7.bed-mixer-and-scene-mixes.md) | Bed mixer and scene mixes | Claude |
| [6.8](../stories/6.8.bird-events-and-flocks.md) | Bird events and flocks | Claude |
| [6.9](../stories/6.9.thunder.md) | Thunder in the rain | Claude |
| [6.10](../stories/6.10.sound-controls.md) | Sound controls in the dev panel | Claude |
| [6.11](../stories/6.11.lightning.md) | Lightning before thunder (P1) | Claude |
| [6.12](../stories/6.12.sound-credits-on-page.md) | Sound credits on the page | Claude |
| [6.13](../stories/6.13.listening-qa.md) | Listening QA and final balance | Tony with Claude |

## Order

```
6.1 → 6.2 → 6.3 → 6.4
        6.5 → 6.6 → 6.7 → 6.8 → 6.9 → 6.10 → 6.11 → 6.12 → 6.13
```

Story 6.5 can start at once. Stories 6.6–6.9 can be built with two or
three placeholder files while 6.1 and 6.2 finish.

## Blocking questions (from the PRD)

1. Kerala-authentic set (includes CC BY-NC) or open-only set?
2. Who downloads the originals: you by hand, or a script with a Freesound
   API token?
