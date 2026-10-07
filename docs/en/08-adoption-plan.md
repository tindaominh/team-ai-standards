# 08. Adoption plan

## Purpose

How we introduce this standard to the team of about 10 developers, in three waves. Each wave has entry and exit criteria, a short retrospective and agreed metrics.

## Roles

| Role | Responsibility | Person |
| --- | --- | --- |
| **Owner of the standard** | Owns the documents and templates, decides changes, publishes versions, runs retrospectives | See 03, Named people |
| **Security owner** | Approves tools and client repositories, handles incidents | See 03, Named people |
| **Wave 1 champion** | Leads the pilot, collects metrics and feedback | See 03, Named people |
| **Wave 2 champion** | Supports the second group, collects metrics and feedback | See 03, Named people |
| **Wave 3 champion** | Supports the rest of the team | See 03, Named people |
| **Tech lead** | Approves pilot repositories, decides on process conflicts | See 03, Named people |

## Metrics

Measured for each wave and compared with a baseline from the 4 weeks before Wave 1 on the same repositories.

| Metric | Definition | Source |
| --- | --- | --- |
| **Lead time** | Ticket moved to "In progress" → PR merged | Backlog + GitHub |
| **Defects after merge** | Bugs traced to a merged PR within 30 days, per 10 PRs | Backlog (bug tickets linked to PR) |
| **Review time** | PR opened → first human review; and PR opened → approval | GitHub |
| **Evidence completeness** | % of PRs with all required evidence sections filled correctly | Wave champion samples every PR |
| Supporting: rework | Review rounds per PR | GitHub |
| Supporting: developer feedback | 1–5 rating and comments at each retro | Short survey |
| Supporting: AI cost | Spend per developer per week | Account dashboard |

Targets are set at the end of Wave 1, based on its data, not before.

## Wave 1: pilot (2–3 weeks)

**Scope:** 2 early adopters, 1 internal repository (not client-facing).

**Entry criteria:**

- [ ] Pilot repository chosen and approved by the tech lead.
- [ ] Baseline metrics collected.
- [ ] Repository has the standard installed with `scripts/adopt.mjs --profile standard` (00-quickstart): `TODO(adopt)` sections filled in, commands set in `.claude/project.json`, `compose-settings.mjs --check` passing.
- [ ] Claude Code listed as "Under evaluation" in the approved tools table, with the pilot repository named.
- [ ] Both early adopters read docs 01–05 and did a 1-hour walkthrough with the owner of the standard.

**Activities:**

- Use the full workflow (02) on every ticket in the pilot repository.
- Weekly 30-minute check-in: problems, unclear rules, false findings, missing commands.
- Record every rule or template change needed in a feedback list.
- Evaluate Claude Code's sandbox on the pilot repository as an extra, operating-system-level control (05). Record the result for the Wave 1 retrospective.
- Try the docs-check workflow and generated documentation sections (09) on the pilot repository.

**Exit criteria:**

- [ ] At least 10 PRs completed with the full workflow.
- [ ] Evidence completeness ≥ 80%.
- [ ] No security incidents, or every incident handled and fixed.
- [ ] Metrics compared with baseline and shared.
- [ ] Retrospective held; changes released as a new version of the standard.
- [ ] Decision recorded: continue, adjust or stop.

## Wave 2: half the team (3–4 weeks)

**Scope:** about 5 developers, 2–3 repositories, including **one client repository only if** the security owner approves AI use for it (client position recorded, strict profile).

**Entry criteria:**

- [ ] Wave 1 exit criteria met.
- [ ] Training session done for the new participants (see Training).
- [ ] For a client repository: written client position, strict profile, security owner approval, project lead informed.
- [ ] Tool status reviewed by the team lead and security owner (still under evaluation, or approved for the listed data).

**Activities:**

- Full workflow on all tickets in the selected repositories.
- Champion pairs with each new participant on their first PR.
- Weekly feedback collection; fortnightly 30-minute sync.

**Exit criteria:**

- [ ] At least 25 PRs across the selected repositories.
- [ ] Evidence completeness ≥ 85%.
- [ ] Defects after merge not higher than baseline.
- [ ] Review time not worse than baseline by more than 20%.
- [ ] No unhandled incidents; client repository used only within its approval.
- [ ] Retrospective; new version of the standard released.
- [ ] Formal decision on tool status (approved / restricted / not approved) recorded in doc 01.

## Wave 3: whole team

**Scope:** all developers and all repositories where AI use is allowed.

**Entry criteria:**

- [ ] Wave 2 exit criteria met.
- [ ] Tool formally approved (or restricted) in doc 01.
- [ ] Every repository classified: internal (standard profile) or client (strict profile, or no AI).
- [ ] Training sessions available for everyone.

**Activities:**

- Install the standard in each allowed repository with `scripts/adopt.mjs` (about 30 minutes per repository). One PR per repository, reviewed like code.
- From then on, repositories receive new versions through the update PRs described in 10.
- Champions available for questions; monthly sync.

**Exit criteria (end of first quarter):**

- [ ] Evidence completeness ≥ 90% on AI-assisted PRs.
- [ ] Metrics reported monthly.
- [ ] Standard in regular review cadence (below).

## Training

| Session | Length | For | Content |
| --- | --- | --- | --- |
| 1. Policy and security | 60 min | Everyone, before first use | Docs 01, 05: data classes, what never goes to AI, permission profiles, incidents |
| 2. Workflow hands-on | 90 min | Each wave | Doc 02 on a real ticket: plan, failing test, verify, fresh-context review, PR evidence |
| 3. Reviewing AI-assisted PRs | 45 min | All reviewers | Doc 04, with examples of weak tests and over-confident findings |
| 4. Context and cost | 30 min | Each wave | Doc 07: session hygiene, what goes where |
| 5. LLM in product | 45 min | When a feature needs it | Doc 06 |

Materials and recordings are stored with the standard.

## Feedback loop

- **Channel:** a dedicated team chat channel and a feedback list owned by the owner of the standard.
- **Per wave:** weekly check-ins and a 45-minute retrospective at the end ("keep / change / drop", metrics review, incidents).
- **Changes:** proposed as PRs to the standard repository, reviewed by the owner of the standard and one other developer. Security-related changes also need the security owner.

## Review cadence and versioning

- Versioning, releases and how repositories update are defined in 10-versioning-and-distribution.
- During waves: release after each retrospective.
- After Wave 3: quarterly review of all documents, and an immediate review after any security incident or major tool change.
