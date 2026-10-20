# Walking for Nothing: project docs

Start here. This index is the single source of truth for where every
planning document lives, and which epic and story numbers are taken.
Several chats work on this project in the same folder, so **read the rules
at the bottom before creating or editing a doc.**

Live site: https://tonyjoyk.github.io/walking-for-nothing/ ·
Repo: https://github.com/tonyjoyk/walking-for-nothing

## Map

| Area | BMAD role | Where | What's in it |
| --- | --- | --- | --- |
| Brief | Analyst | [`product/brief.md`](product/brief.md) | The original creative and engineering brief (rev 2, 16 Oct 2026). Historical intent; later decisions override it (see the decision log). |
| Requirements | PM | [`product/prd.md`](product/prd.md) | Project PRD: goals, epics, cross-cutting requirements, current status. |
| Feature specs | PM / Analyst | [`product/specs/`](product/specs/) | One spec, or planning pack, per feature: [greeting](product/specs/greeting.md), [live weather](product/specs/live-weather.md), [opening shuffle](product/specs/opening-shuffle.md), [audio/](product/specs/audio/) (brief, PRD, architecture). |
| Experience | UX | [`ux/ux-spec.md`](ux/ux-spec.md) | Experience principles, visual language, interaction rules, the six scenes. |
| UX research | UX | [`ux/research/`](ux/research/) | Visitor critique (16 Oct), character and scene study (17 Oct). Historical. |
| UX reference | UX | [`ux/reference/`](ux/reference/) | Reference sheets: six scenes, mundu construction. |
| Architecture | Architect | [`architecture/architecture.md`](architecture/architecture.md) | How the system is built: modules, data flow, rendering, deploy. |
| Decisions | Architect / PM | [`architecture/decisions.md`](architecture/decisions.md) | Decision log, including what each decision supersedes and any **deprecation reviews**. |
| Epics | PM / SM | [`epics/`](epics/) | One file per epic (registry below). |
| Stories | SM / Dev / QA | [`stories/`](stories/) | `<epic>.<story>.<slug>.md`, in BMAD story format. |
| QA gates | QA | [`qa/gates/`](qa/gates/) | One gate per reviewed story. |
| BMAD how-to | All | [`bmad/README.md`](bmad/README.md) | How the method is used here: roles, workflow, party mode. |
| Party mode | All | [`bmad/party-mode/`](bmad/party-mode/) | Notes from multi-role discussions (`YYYY-MM-DD-topic.md`). |
| Archive | — | [`archive/`](archive/) | Finished implementation plans (e.g. plan v3). Read-only. |
| Media | — | [`media/`](media/) | Before/after captures and previews referenced by docs. |

## Epic and story registry

To take a number, add your row here **in the same commit** that creates the
file.

| Epic | Title | File | Stories | Status | Owner (chat) |
| --- | --- | --- | --- | --- | --- |
| 1 | Opening and journey | [epic-1](epics/epic-1-opening-and-journey.md) | 1.1 Shuffle opening ✅ | Active | Setup chat (fork) |
| 2 | The greeting | [epic-2](epics/epic-2-greeting.md) | Built before stories were used (see spec) | Done | Setup chat |
| 3 | Character and motion | [epic-3](epics/epic-3-character.md) | Built before stories were used | Done | Setup chat |
| 4 | Landscape and atmosphere | [epic-4](epics/epic-4-landscape.md) | Built before stories were used | Done | Setup chat |
| 5 | Platform and delivery | [epic-5](epics/epic-5-platform.md) | Built before stories were used | Done | Setup chat |
| 6 | Audio | [epic-6](epics/epic-6-audio.md) | 6.1–6.13 (all Draft); spec: [product/specs/audio/](product/specs/audio/) | Planned | Audio chat |

**Next free epic:** 7. **Next free story:** 1.2 in epic 1, 2.1, 3.1, 4.1, 5.1, 6.14 in epic 6. **Next free decision:** D-0.6, D-1.5, D-2.2, D-3.5, D-4.4, D-5.3, D-6.6.

## Open cross-chat items

- **Audio (epic 6)** is planned by the audio chat:
  - spec in `product/specs/audio/`;
  - stories 6.1–6.13, all Draft;
  - blocking questions for Tony are in [epic-6](epics/epic-6-audio.md).
- **D-6.3 open question:** a church bell at sunset.
- **Live weather is paused** (20 Oct 2026). Deprecation review is due
  **31 Jan 2027**. See [D-1.3](architecture/decisions.md#d-13-live-weather-paused-deprecation-review).

## Rules for every chat

1. **Check the registry before numbering.** Take the next free epic, story or
   decision number and register it in the same commit. Decision IDs are
   `D-<epic>.<n>`; project-wide ones are `D-0.<n>`.
2. **Edit only what your epic owns.** For shared docs (`prd.md`,
   `architecture.md`, `ux-spec.md`), add or edit only your epic's section.
   Don't rewrite other sections.
3. **Record conflicts, don't overwrite them.** If your work contradicts the
   brief, a spec or another epic, add a decision to `decisions.md` that says
   what it supersedes, and link it from the affected doc's status line. Don't
   edit the older text.
4. **One story, one chat.** Before starting a story, set its status to
   `In Progress` with the chat name. Don't edit a story another chat has in
   progress.
5. **Small commits, pull first.** Run `git status` and `git pull` before
   editing. Commit per story, or per doc change, so parallel chats can merge
   cleanly.
6. **Don't move other chats' files.** Moves and renames of shared docs go
   through this index, in one commit, with links updated.
7. **Code and docs move together.** A story is `Done` only when its tests
   pass, the build passes, and its QA gate is written.
