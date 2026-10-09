# 12. Starting a new project

## Purpose

How to start a new repository under the standard: create the application, adopt the standard, fill in the project context, and work ticket by ticket. For adopting an existing repository, see the README section [Running adoption](../../README.md#running-adoption).

## 1. What the standard provides vs what you provide

Provided automatically by the standard:

- rules, the workflow and its skills, and permissions (`.claude/rules/std/`, `std-*` skills and agents, `.claude/settings.json`);
- stack detection and the command list in `CLAUDE.md`, from `package.json` and `.claude/project.json`;
- once code exists, the structure Claude can read from the code itself (modules, entities, tests).

Must come from people:

- purpose, users, scope and non-goals;
- domain terms;
- external systems (APIs, marketplaces, queues) and their limits;
- data classification;
- architecture decisions and the reasons for them;
- the requirements and acceptance criteria of each ticket.

A new project has no code to read, so almost all of its context comes from people. Prompts 01 and 02 turn this into an interview: Claude asks, you answer and approve, instead of writing the text from scratch. You can give Claude existing documents (client requirements, API documentation, meeting notes), following [01, AI usage policy](01-ai-usage-policy.md): never secrets, credentials, real customer data or personal data.

Context has three layers:

| Layer | Where | Loaded |
| --- | --- | --- |
| Stable | `CLAUDE.md`, short | Always, in every session |
| Detailed | `docs/PROJECT_SPEC.md` and design notes | On demand, when imported or read |
| Per task | The ticket prompt (prompt 04) | For that session only |

Keep every layer current. Outdated context is worse than none, because the AI follows it confidently. When a decision changes, update `CLAUDE.md` or the spec in the same pull request.

## 2. Choose a path

| Path | When | Stack |
| --- | --- | --- |
| **a. Scaffold first (recommended)** | The framework has an official CLI (NestJS) and you know the database | Detected from `package.json` |
| **b. Empty repository** | You want Claude Code to create the skeleton under the standard's rules, or the repository must exist before the stack is final | Given with flags; commands filled when adopt runs again |

Both paths keep the standard checkout next to the project (`../team-ai-standards`) on a release tag: `git -C ../team-ai-standards describe --tags` prints `vX.Y.Z` and `git -C ../team-ai-standards status` is clean. Otherwise `--yes` refuses (section 5).

## 3. Path a: scaffold first

```bash
pnpm dlx @nestjs/cli new orders-service --package-manager pnpm --skip-git
cd orders-service
pnpm add @nestjs/typeorm typeorm mysql2 @nestjs/config zod
git init -b main
git add -A
git commit -m "chore: scaffold NestJS application"
git switch -c chore/adopt-ai-standard
node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @<org>/<team> --dry-run
node ../team-ai-standards/scripts/adopt.mjs --profile strict --repo-owner @<org>/<team> --yes
```

- The dry run shows the detected stack (`nestjs + mysql + typeorm`, sources `detected`) and the commands found in the Nest scripts (`pnpm build`, `pnpm lint`, `pnpm test`). Use `--db postgres` with `pg` instead of `mysql2` for PostgreSQL. Resolve anything under "Decisions required" and run `--dry-run` again before `--yes`.
- Commit the result and open a pull request. Then continue with section 6.

## 4. Path b: empty repository

```bash
mkdir orders-service && cd orders-service
git init -b main
git commit --allow-empty -m "chore: initial commit"
git switch -c chore/adopt-ai-standard
node ../team-ai-standards/scripts/adopt.mjs --profile strict --framework nestjs --db mysql --data-access typeorm --without-optional --repo-owner @<org>/<team> --dry-run
node ../team-ai-standards/scripts/adopt.mjs --profile strict --framework nestjs --db mysql --data-access typeorm --without-optional --repo-owner @<org>/<team> --yes
git add -A
git commit -m "chore: adopt team AI standard"
```

- There is no `package.json`, so every command is `not set`. Open Claude Code in the repository and send prompt 05 (section 8.5): it scaffolds with the official CLI under the standard's rules, then stops.
- Commit the skeleton, then run adopt again without flags (the stored values are reused). Commands that are still `null` in `.claude/project.json` are filled from `package.json`; commands already set are never replaced:

```bash
git add -A
git commit -m "chore: scaffold NestJS application"
node ../team-ai-standards/scripts/adopt.mjs --dry-run
node ../team-ai-standards/scripts/adopt.mjs --yes
```

## 5. What adopt checks

- **The standard checkout:** `--yes` refuses when the checkout it runs from has changed or untracked files, or HEAD is not on the tag `v<version>` of its `package.json`. `--dry-run` shows the same problem as a warning with the git commands that fix it. `--allow-unreleased` is for maintainers testing unreleased changes and is printed in the output.
- **The project repository:** `--yes` refuses a directory that is not a git repository, a dirty working tree, or the default branch, whenever it would write anything, even when it only creates files. Paths a and b commit and switch to a branch before adopt for this reason; the change is reviewed in a pull request. If a write fails, every change is rolled back and the reviewed plan is kept (doc 10, section 6).

## 6. After adoption

- **CLAUDE.md:** fill the `TODO(adopt)` sections with prompt 01. adopt prints this as the first next step when `CLAUDE.md` has no project content yet. Keep it short; detail goes in `docs/`.
- **Specification (optional):** prompt 02 writes `docs/PROJECT_SPEC.md` and imports it from `CLAUDE.md` with the line `@docs/PROJECT_SPEC.md`.
- **Project rules:** one file per topic in `.claude/rules/local/`.
- **Commands:** edit `.claude/project.json` → `commands`, then run `node .claude/std/compose-settings.mjs`; it regenerates `.claude/settings.json` and the `commands` block in `CLAUDE.md`.
- **First plan:** prompt 03, in plan mode, before any application code.

## 7. The daily loop

For each ticket, prompt 04 runs the loop:

1. `std-plan`: a plan, approved before code.
2. `std-tdd-workflow`: a failing test with RED evidence, then the code.
3. `std-verification`: until it reports READY.
4. `std-code-review` in a fresh context (plus `std-security-review` or `std-db-migration-review` when they apply).
5. The pull request body from the PR template, with the evidence.
6. A human reviews and merges.

## 8. Prompts

The prompts live in the standard checkout, `templates/prompts/`. They are not copied into project repositories. Paste one into Claude Code and replace each `<placeholder>`. The text below is generated from those files.

### 8.1 Fill CLAUDE.md (01)

Claude asks one question at a time (at most 10), then proposes the filled sections and waits for approval.

<!-- AUTO-GENERATED:prompt-01 START -->

```text
When to use: right after adoption, when `CLAUDE.md` still has `TODO(adopt)` items. Replace each `<placeholder>` before sending.

We are filling in `CLAUDE.md` for the repository <repository-name>. Interview me first, then propose the text.

1. Read `CLAUDE.md`, `.claude/project.json` and the folder layout. Do not read `.env` or any secret.
2. Ask me one question at a time, at most 10 in total, and wait for each answer. Cover: purpose, users, main flows, architecture, external systems (APIs, marketplaces, queues), data classification (internal, client code, personal data), environments, local setup, non-goals. Skip a question when the repository already answers it.
3. Then propose the filled `TODO(adopt)` sections as one diff of `CLAUDE.md` and wait for my approval before writing.

Rules:

- Change only text outside the `<!-- std:begin ... -->` / `<!-- std:end ... -->` blocks. Never edit standard files: `.claude/rules/std/`, `std-*` agents and skills, `.claude/std/`, `.claude/settings.json`.
- Keep `CLAUDE.md` short: facts Claude needs in every session. Put detail in `docs/` and link to it. Longer project rules go in `.claude/rules/local/`.
- Where I do not know an answer, leave `TODO(adopt): <what is missing>` instead of guessing.
```

<!-- AUTO-GENERATED:prompt-01 END -->

### 8.2 Project specification (02)

Turns the interview and your notes into `docs/PROJECT_SPEC.md`.

<!-- AUTO-GENERATED:prompt-02 START -->

```text
When to use: after prompt 01, when the project needs a written specification that Claude reads at the start of each session.

Write `docs/PROJECT_SPEC.md` for <repository-name> from our interview and these notes: <paste notes, links to tickets or documents>.

Sections: Goals, Non-goals, Constraints (client, security, data, performance, deadlines), Architecture, Data (entities, classification, retention), Phases (milestones with a short outcome each), Open questions.

Rules:

- Use only what I said or wrote; mark anything assumed as "Assumption:" and list it under Open questions.
- Keep it to what a developer needs to make decisions; no marketing text.
- Add one line `@docs/PROJECT_SPEC.md` to the Project section of `CLAUDE.md` (outside the `std:` blocks) so the spec is imported.
- Show me the file and the `CLAUDE.md` change, and wait for my approval before writing.
```

<!-- AUTO-GENERATED:prompt-02 END -->

### 8.3 Kickoff plan (03)

Plans the first milestone in phases, Phase 0 being setup, and saves it under `docs/plans/`.

<!-- AUTO-GENERATED:prompt-03 START -->

```text
When to use: before the first line of application code, to plan the first milestone in plan mode.

Plan the first milestone of <repository-name>: <milestone, for example "orders can be imported from <marketplace>">.

1. Read `CLAUDE.md` and `docs/PROJECT_SPEC.md` (if it exists).
2. Use the `std-plan` skill. Split the milestone into phases, each small enough for one pull request:
   - Phase 0: setup — project skeleton, configuration validated at startup, lint, typecheck and test commands, CI, local environment (database in Docker, `config/env.example`).
   - Later phases: one slice of behaviour each, with its tests and acceptance criteria.
3. For each phase: goal, files or modules touched, tests to write first, risks, and what a reviewer checks.
4. Save the plan as `docs/plans/<yyyy-mm-dd>-<milestone-slug>.md`.
5. Stop and wait for my approval. Do not write application code in this session.
```

<!-- AUTO-GENERATED:prompt-03 END -->

### 8.4 Feature ticket (04)

One prompt per ticket: the full loop of section 7, no git writes.

<!-- AUTO-GENERATED:prompt-04 START -->

```text
When to use: for each ticket, at the start of a new session.

Ticket <PROJ-123>: <title>.
Goal: <one or two sentences>.
Acceptance criteria:

- <criterion 1>
- <criterion 2>

Follow the full loop and stop at each approval point:

1. `std-plan`: a short plan for this ticket. Wait for my approval.
2. `std-tdd-workflow`: write the failing test first and show the RED output (the test fails for the right reason), then the code, then GREEN.
3. `std-verification`: run it until it reports READY, and show the report.
4. `std-code-review` in a fresh context (a subagent), plus `std-security-review` or `std-db-migration-review` when they apply. Fix or answer every CRITICAL and HIGH finding.
5. Write the pull request body from `.github/pull_request_template.md`, with the evidence it asks for.

Do not run git commands that write (commit, push, branch, merge, rebase); I do those. Never read `.env` or paste secrets or customer data.
```

<!-- AUTO-GENERATED:prompt-04 END -->

### 8.5 Scaffold an empty repository (05)

Path b only: scaffolds with the official CLI, then tells you to run adopt again.

<!-- AUTO-GENERATED:prompt-05 START -->

```text
When to use: path b of doc 12 only — the standard was adopted in an empty repository and the application does not exist yet.

Scaffold the application for <repository-name> with the official CLI, under the rules of this repository.

Stack: <for example NestJS + MySQL + TypeORM, pnpm>. Extra packages: <for example @nestjs/config zod>.

1. Read `CLAUDE.md` and `.claude/project.json`. Follow `.claude/rules/`.
2. Propose the exact commands first (for example `pnpm dlx @nestjs/cli new . --package-manager pnpm --skip-git`, then `pnpm add ...`) and wait for my approval. Use the official CLI; do not write the skeleton by hand.
3. Do not overwrite `CLAUDE.md`, `.claude/`, `.github/` or `.gitignore` entries the standard added; if the CLI wants to, stop and tell me.
4. Do not run git commands that write.
5. When the skeleton builds, stop. Tell me to commit it and re-run adoption (`node <path-to-standard>/scripts/adopt.mjs --dry-run`, then `--yes`) so the command list in `.claude/project.json` and `CLAUDE.md` is filled from `package.json`.
```

<!-- AUTO-GENERATED:prompt-05 END -->

## 9. Team tip: a template repository

A team that starts many similar services can keep a GitHub template repository that is already scaffolded (path a) and adopted. A new project starts with **Use this template**, then:

- set `repoOwner` with `node ../team-ai-standards/scripts/adopt.mjs --repo-owner @<org>/<team> --dry-run`, then `--yes`;
- fill `CLAUDE.md` with prompt 01;
- ask the owner of the standard to add the repository to `.github/standard-targets.json`.

The template repository is registered too, so it receives update pull requests like any other repository and new projects start on the current version.
