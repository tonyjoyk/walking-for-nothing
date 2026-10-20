# Epic 1: Opening and journey

**Goal:** Which scene a visitor sees when the page opens, and how scenes change while they watch.

## Requirements and decisions

- Opening: random on a fresh visit, next scene on each reload ([spec](../product/specs/opening-shuffle.md), D-1.4).
- Journey: one scene per crossing in the cycle order (D-1.2).
- Live weather opening: built, **paused**; deprecation review 31 Jan 2027 (D-1.3, [spec](../product/specs/live-weather.md)).

## Stories

| # | Title | Link | Status |
| --- | --- | --- | --- |
| 1.1 | Random opening, next scene on every reload | [story](../stories/1.1.shuffle-and-advance-opening.md) | Done ✅ |
| (pre-story) | Live weather Phases A–B: Kerala time, Open-Meteo job, kill switch | commits ee65394, 4438306 | Done, paused |
| (pre-story) | One scene per crossing | commit ee65394 | Done |

Next story: **1.2**. Register new stories in [`docs/README.md`](../README.md) before writing them.
