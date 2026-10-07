# 02. Development workflow

## Purpose

This is how we deliver a change with AI assistance. Each step produces evidence that goes into the PR, so the reviewer can check the work instead of trusting it.

## Overview

```text
Ticket → Plan → Failing test → Implement → Verify → Fresh-context review → PR → Human review → Merge
          ▲ human approves                                     human fixes / answers   ▲ human merges
```

| Step | Who leads | AI help | Output |
| --- | --- | --- | --- |
| 1. Understand the ticket | Developer | Summarise, list questions | Clear acceptance criteria in Backlog |
| 2. Plan | Developer | `std-plan` skill, `std-planner` subagent | Approved plan file |
| 3. Failing test | Developer + AI | `std-tdd-workflow` skill | Test that fails for the right reason |
| 4. Implement | Developer + AI | `std-tdd-workflow` skill | Minimal change, test passes |
| 5. Verify | AI runs, developer checks | `std-verification` skill | READY report with real output |
| 6. Fresh-context review | AI reviewer, developer decides | `std-code-review`, `std-security-review`, `std-db-migration-review` | Findings, fixes or answers |
| 7. PR | Developer | Draft description | PR with evidence sections filled |
| 8. Human review | Reviewer | Optional | Approval or change requests |
| 9. Merge | Developer / lead | None | Merged PR |

## Step details

### 1. Understand the ticket

- The Backlog ticket has acceptance criteria before work starts. If not, the developer asks the ticket owner.
- Create the branch `<type>/<PROJ-123>-<slug>`.

### 2. Plan

- **Required when** the change touches more than 2 files, a schema, a public API or event, or a marketplace adapter.
- **Optional** for small fixes. Write "plan not needed: <reason>" in the PR.
- Use Claude Code plan mode or the `std-plan` skill. The plan:
  - names existing code to follow,
  - lists files and tasks, each with a command that proves it works,
  - covers database and external API impact,
  - states whether personal or client data is involved.
- The developer reads and approves the plan explicitly. No code changes before approval.
- The plan is saved in `docs/plans/<PROJ-123>-<slug>.md`, unless the repository's CLAUDE.md says otherwise.

### 3. Failing test

- Write the test first. Run it. Confirm it fails because the behaviour is missing, not because of a typo or import error.
- Record the command and the failing lines.

### 4. Implement

- Make the smallest change that makes the test pass. Re-run the same test, then the module's suite.
- Follow the repository's existing patterns. Large or unrelated refactors go into a separate PR.

### 5. Verify

- Run the `std-verification` skill: build, typecheck, lint, unit tests, integration tests (if data access changed), migration check (if any), diff check.
- The result must be **READY**. Every result in the report comes from a real run in this session.

### 6. Fresh-context review

- Run the `std-code-review` skill. The reviewer is a separate subagent that sees only the diff, the changed files and the plan, not the conversation that wrote the code. This avoids the reviewer agreeing with the author's reasoning.
- Add `std-security-review` when auth, credentials, webhooks, outbound HTTP, S3/files, IAM/infra or personal data are touched.
- Add `std-db-migration-review` when a migration or entity change is included.
- CRITICAL and HIGH findings get a second, independent check. The developer then fixes each confirmed finding or writes why it is not a problem.
- After fixes, run verification again.

### 7. Open the PR

- Use the PR template. Fill every evidence section. Delete only sections that do not apply, and say why.
- In client repositories using the strict profile, the developer creates the commits and pushes. The AI only proposes commit messages.

### 8. Human review

- At least one human reviewer approves, using 04-pr-review-checklist.
- CI must be green: lint, typecheck, tests, commitlint, secret scan.

### 9. Merge

- The developer or lead merges after approval and green CI. Squash merge keeps the evidence in the PR description.

## Definition of Done

A change is done when all of the following are true:

- [ ] Acceptance criteria in the Backlog ticket are met.
- [ ] Plan approved (or "not needed" with a reason).
- [ ] Every behaviour change has a test that failed before and passes after.
- [ ] Verification report is READY.
- [ ] Fresh-context review done; every CRITICAL/HIGH finding is fixed or answered.
- [ ] Security and migration reviews done when triggered.
- [ ] Docs, OpenAPI and runbooks updated if behaviour changed.
- [ ] CI is green.
- [ ] At least one human approval.
- [ ] No secrets, personal data or production data anywhere in the change or the PR.

## Evidence trail

Each PR description contains:

| Evidence | Where it comes from | Required when |
| --- | --- | --- |
| Plan link or "not needed: reason" | `std-plan` skill | Always |
| Failing test (command + key lines) | `std-tdd-workflow` | Behaviour changes |
| Passing test (same command) | `std-tdd-workflow` | Behaviour changes |
| Verification table | `std-verification` | Always |
| AI review summary (found / confirmed / fixed / answered) | `std-code-review` | When AI was used |
| Security review | `std-security-review` | Trigger areas |
| Migration review | `std-db-migration-review` | Migrations |

Evidence must be real output. Reviewers may ask to re-run any command. Invented evidence is treated as a serious process violation.

## Session hygiene during the workflow

- One ticket per session where possible. Use `/clear` between unrelated tasks.
- Save the plan file before `/compact`.
- See 07-context-and-cost for details.
