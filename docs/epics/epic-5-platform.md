# Epic 5: Platform and delivery

**Goal:** Hosting, deploy pipeline, mobile, performance, tests and dev tooling.

## Requirements and decisions

- [Architecture](../architecture/architecture.md), decisions D-0.3, D-5.1, D-5.2.

## Stories

| # | Title | Link | Status |
| --- | --- | --- | --- |
| (pre-story) | GitHub Pages deploy, mobile quality, zero-size fix, capture tool, test suite | commits e2fc5e9, 4438306, b46fe04 | Done |
| 5.1 | Zero-size window guard (no NaN man after a 0 x 0 start) | [5.1](../stories/5.1.zero-size-window-guard.md) | Done ✅ |

Next story: **5.2**. When live weather is retired (D-1.3), drop the 30-minute schedule from deploy.yml. Register new stories in [`docs/README.md`](../README.md) before writing them.
