# BMAD on this project

BMAD splits work into roles that each produce one kind of artifact. No BMAD
plugin is installed. The roles are played by the chats, following the
method's templates. This page maps each role, and each artifact it produces,
to a place in `docs/`.

## Roles, artifacts and where they live

| Role | Artifact | Location | Template / notes |
| --- | --- | --- | --- |
| **Analyst** | Project brief; a feature brief | `product/brief.md`; `product/specs/<feature>.md` (brief section) | Problem, context, assumptions, how to read an ambiguous request |
| **PM** | PRD (project); feature requirements | `product/prd.md`; `product/specs/<feature>.md` | Goals, FR/NFR numbered per feature, out of scope |
| **UX expert** | UX spec; feature experience notes | `ux/ux-spec.md`; experience section in the feature spec | Principles, visual language, interaction rules |
| **Architect** | Architecture; decisions | `architecture/architecture.md`; `architecture/decisions.md` | Modules, data flow; each decision says what it supersedes |
| **PO** | Epic files, and keeping docs consistent | `epics/epic-<n>-<slug>.md`; `README.md` registry | Checks that PRD, UX, architecture and stories agree before stories start |
| **SM** | Stories | `stories/<epic>.<story>.<slug>.md` | BMAD story: Status, Story, Acceptance criteria, Tasks, Dev notes, Testing, Change log, Dev agent record, QA results |
| **Dev** | Code, tests, and the story's dev record | `src/`, `tests/`, the story file | Ticks tasks; fills in the dev agent record |
| **QA** | QA results; gate | The story's QA section; `qa/gates/<epic>.<story>-<slug>.yml` | PASS / CONCERNS / FAIL, with evidence per acceptance criterion |
| **Party mode** | A multi-role discussion of a question | `bmad/party-mode/YYYY-MM-DD-topic.md` | Each role's view, the agreement, and the decisions it produced, which are logged in `decisions.md` |

## Workflow for a new request

1. **Analyst and PM:** write or extend `product/specs/<feature>.md`
   (brief, requirements, experience, architecture notes). For a big or
   contested question, run party mode first and save the notes.
2. **PO:** register or extend the epic in `docs/README.md` and
   `epics/`, and check against the PRD, UX spec, architecture and decisions.
   Any conflict becomes a new decision.
3. **SM:** write the story with the next free number, `Status: Draft`, then
   `Approved`.
4. **Dev:** set the story `In Progress (chat name)`, implement, test, and
   fill in the dev record.
5. **QA:** review against every acceptance criterion; write QA results and
   the gate; set `Done`.
6. Commit and push per story.

## Story statuses

`Draft` → `Approved` → `In Progress (chat)` → `Review` → `Done`
(or `Blocked` with the reason).

## Conventions that prevent clashes between chats

See the rules in [`docs/README.md`](../README.md#rules-for-every-chat). In
short: register numbers, edit only your section, record conflicts as
decisions, and commit small.
