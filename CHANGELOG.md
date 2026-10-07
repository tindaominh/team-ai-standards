# Changelog

All notable changes to this standard are recorded here. Versions follow `MAJOR.MINOR.PATCH`; see `docs/en/10-versioning-and-distribution.md` for the rules.

## [Unreleased]

## [0.3.0] - 2026-10-07

Adoption kit: one command plus about 30 minutes of project details. **Breaking** for any repository set up by hand from 0.2.0 templates: re-adopt with `scripts/adopt.mjs` (no repository uses the standard yet; the pilot has not started).

### Added

- `scripts/adopt.mjs`: run from a project repository with `--profile`, the stack selection flags, optional `--with-docs`, `--dry-run` and `--yes`. Detects the stack from `package.json`, shows the detected selection with its source, and never applies it silently: a real run needs `--yes` or explicit flags; ambiguous detection, or a dependency without a fragment, stops with the options. Creates the standard files, `.claude/project.json` (selection, commands pre-filled from `package.json` scripts), a `CLAUDE.md` skeleton with `TODO(adopt)` sections, `.claude/STANDARD_VERSION` and a manifest. Never overwrites existing files: writes `*.proposed` files and `.claude/std-adoption-checklist.md`. Refuses to run while the standard's CODEOWNERS block has placeholder owners. No network, no git writes.
- Three layers in project repositories (doc 10, README): Standard (synced, never edited in the repository), Project (`CLAUDE.md`, `.claude/project.json`, `.claude/rules/local/`), Personal (`.claude/settings.local.json`). Doc 10 lists what may be set in personal settings and quotes the official documentation on why project deny rules still apply.
- `.claude/std/compose-settings.mjs` (in every repository): generates `.claude/settings.json` from the base profile and `.claude/project.json`, and the `CLAUDE.md` command table; `--check` fails when generated files are stale or a standard file was edited (hashes in `.claude/std/manifest.json`). Rejects command values that chain commands.
- `.github/workflows/std-check.yml` (in every repository): runs that check on every pull request. It also fails when a `*.proposed` file, the adoption checklist or `.claude/settings.local.json` is tracked by git, and warns when the stack selection in `project.json` differs from the installed fragments. The comparison ignores key order and array order.
- Composable stack fragments (`templates/fragments/`, registry `fragments.json`) for what the team uses: framework `nestjs | express | none` (`none` has its own fragment for a Node.js service without a web framework, used by the pilot repository), databases `mysql | postgres` (one or more), data access `typeorm | raw | none` (`none` = no database, no fragment), optional `aws`. Each fragment has a rule of at most 150 words in `.claude/rules/std/fragments/<dimension>-<value>.md` and optional examples next to the `std-tdd-workflow` and `std-db-migration-review` skills. Combinations are validated (for example a data-access library needs a database); unusual ones warn. Selection flags `--framework`, `--db`, `--data-access`, `--with`, `--without-optional`; the aliases `--stack nestjs-mysql`, `nestjs-postgres`, `node-postgres` (= framework none + PostgreSQL + TypeORM, each with AWS) expand to selections. New fragments are added through doc 11.
- Dependencies without a fragment (the registry's `unsupported` list: Fastify, Koa, hapi, Prisma, Drizzle, Kysely, Knex, Sequelize, Mongoose, MongoDB) stop adoption with a message that names the dependency, says no fragment exists, and points to doc 11 or the explicit flag. An explicit flag overrides it and records the dependency in `.claude/project.json` as `acknowledgedUnsupported`; `std-check` and update PRs warn only about unsupported dependencies that are not acknowledged. The list ships to repositories as `.claude/std/unsupported.json`.
- PostgreSQL client commands (`psql`, `pg_dump`, `pg_dumpall`, `pg_restore`) denied in both profiles.
- Docs `00-quickstart` (linked first in the README) and `11-adding-a-stack-fragment`, in English and Vietnamese, and the fragment template `templates/fragments/_TEMPLATE.md`.
- Smoke tests (117 checks): placeholder refusal, dry run and confirmation, detection for each supported dependency set, ambiguous detection, unsupported dependencies (stop, acknowledged override, warning only for newly added ones in std-check and sync), alias expansion, invalid and removed values, existing files, compose and std-check (edits, committed proposals and personal settings, reordered keys and arrays), and sync adding and removing fragments while leaving Layer 2 and 3 files unchanged byte for byte.

### Changed

- **Breaking:** standard files use reserved names: `.claude/rules/std/**`, agents `std-planner`, `std-code-reviewer`, `std-security-reviewer`, skills `std-plan`, `std-tdd-workflow`, `std-verification`, `std-code-review`, `std-security-review`, `std-db-migration-review` (invoked as `/std-…`).
- **Breaking:** the command table moves from hand-edited `CLAUDE.md` to `.claude/project.json`; `CLAUDE.md` shows a generated copy. Templates mirror the project layout; base settings are `templates/.claude/std/settings.strict.json` and `settings.standard.json`; hooks live in `.claude/std/hooks/` and are enabled with `"hooks": true`.
- **Breaking:** `scripts/sync-standard.mjs` writes only standard files: it reads the stack selection and profile from the repository's `.claude/project.json`, installs exactly the selected fragments and removes deselected ones, regenerates `settings.json`, deletes standard files removed upstream, updates the PR template and the CODEOWNERS block only where the managed marker is present, and never touches `CLAUDE.md`, `project.json`, local rules or personal settings. When a release changes the generated command table, the update PR has an "Action required" section with the exact command and the reason. `standard-targets.json` no longer has a `profile` field.
- Shared rules and agents no longer contain framework, database or data-access specifics; the TypeORM rule and the AWS rule became fragments; the reviewers read the selected fragment rules.
- Doc 10: a change to the generated command-table format is a MAJOR change.
- `check-context-budget.mjs` checks every valid fragment combination (42) and the 150-word limit per fragment rule: always loaded about 1,640 words; the largest combination, Express + MySQL + PostgreSQL + TypeORM + AWS, is about 2,150 words; limits 2,300.
- CODEOWNERS template split into a project part and a managed block that must stay last.

## [0.2.0] - 2026-10-07

### Added

- Docs 09 (keeping documentation current) and 10 (versioning and distribution), in English and Vietnamese.
- Named people table in doc 03: the single place for owner, security owner, tech lead and wave champions.
- Templates:
  - `.claude/STANDARD_VERSION`
  - `.github/CODEOWNERS` example
  - workflows `docs-check.yml` (with reviewer-only `docs-not-needed` bypass), `docs-notify.yml` (Slack by default, Microsoft Teams as alternative via `CHAT_PROVIDER=teams`; webhook URLs only from GitHub Secrets), `docs-ai-proposal.yml` (optional, disabled by default, out of scope for the pilot, needs security owner approval)
  - `scripts/generate-docs.mjs` (idempotent generated sections between markers; reads the JSON Schema exported from zod and fails clearly when it is missing or stale), `scripts/check-docs-updated.mjs`, `scripts/export-env-schema.ts` (zod v4 `z.toJSONSchema`, records a hash of the source)
  - `tools/docs-ai/package.json`: pinned CLI for the optional AI job, installed only with a lockfile and `npm ci --ignore-scripts`
- Tooling for this repository:
  - `package.json` with pinned dev dependency `markdownlint-cli2@0.23.3` and `.markdownlint-cli2.jsonc`
  - `scripts/check-parity.mjs`, `check-context-budget.mjs`, `check-json.mjs`, `build-settings.mjs`, `sync-standard.mjs`, `smoke-test.mjs`
  - `.github/workflows/standard-ci.yml`, including actionlint 1.7.12 and shellcheck 0.11.0 (pinned, checksum-verified) for this repository's and the templates' workflows
  - `.github/workflows/standard-update.yml` (one update PR per target repository on release; targets in `.github/standard-targets.json`; GitHub App token recommended, fine-grained token as fallback)
  - `audit-exceptions.json` and `scripts/check-audit-exceptions.mjs`: the three npm audit advisories in markdownlint-cli2's dependencies (GHSA-vfj7-8cjw-p6xm, GHSA-r4xh-jqrq-34v2, GHSA-238p-pmpm-9mq7) accepted as dev-only, review by 2027-01-07; CI fails on any other advisory or after the review date

### Changed

- **Breaking:** command names are placeholders (`<build-cmd>`, `<lint-cmd>`, `<typecheck-cmd>`, `<unit-test-cmd>`, `<integration-test-cmd>`, `<migration-show-cmd>`, `<migration-generate-cmd>`, `<migration-run-cmd>`, `<migration-revert-cmd>`). Each repository fills in the command table in CLAUDE.md and replaces the same placeholders in `.claude/settings.json`. Skills and the PR template refer to the table.
- **Breaking:** NestJS is the assumed framework, with zod for configuration. `rules/typescript/typeorm.md` and `coding-style.md` are short, checkable statements (`forFeature` + `@InjectRepository`, transactions in services, no `synchronize`/`migrationsRun`, migrations through the TypeORM CLI as a one-off task, zod-validated config). Code examples moved to the skills: `tdd-workflow` (testing module with `getRepositoryToken`, transaction and `QueryRunner` patterns) and `db-migration-review` (`TypeOrmModule.forRootAsync` with `ConfigService`, CLI data source). The `code-reviewer` agent checks the same points.
- **Breaking:** hook `format-on-edit.js` replaced by `format-check-on-edit.cjs`, which only checks and reminds Claude (no file writes). Both hooks now use `.cjs` so they also run in ES-module projects. Team hooks may only check or remind (doc 05, hooks README).
- Settings profiles are generated from `scripts/build-settings.mjs`. The broad `* deploy *` deny rule is replaced with explicit deploy commands (`npm/pnpm/yarn run deploy*`, `cdk deploy`, `serverless`/`sls deploy`, `terraform apply`, `aws ecs update-service`, `aws ecs run-task`, and others). Duplicate rule forms removed (`Bash(x *)` already matches bare `x`). Generating, running and reverting migrations now ask first.
- Doc 05: permission limits rewritten with facts from the official Claude Code documentation (`disableBypassPermissionsMode` value, deny rules apply to subagents, what Read deny rules do and do not cover, Bash rules are not a security boundary).
- Doc 07 and `check-context-budget.mjs`: two limits, both checked in CI: always loaded ≤ 2,300 words (now about 1,790) and worst case with all path-scoped rules ≤ 2,300 words (now about 2,210). Note that the marketplace-integration rule may become path-scoped after the pilot.
- Doc 09: zod env schema → JSON Schema export → generated env-var table; Slack default, Teams alternative; AI docs job requirements (security owner approval, lockfile, `npm ci --ignore-scripts`, never `npx`).
- Doc 10: GitHub App recommended for the update job, fine-grained token as fallback; final choice by the security owner.
- Doc 08: Wave 1 adds sandbox evaluation and the docs check; versioning moved to doc 10; names moved to doc 03.
- CLAUDE.md template: NestJS layout, command table, version in `.claude/STANDARD_VERSION`.
- Markdown tables use `| --- |` delimiter rows (lint).

### Removed

- `templates/hooks/format-on-edit.js` (replaced, see Changed).

## [0.1.0] - 2026-10-07

### Added

- Human-facing documents in English and Vietnamese (`docs/en`, `docs/vi`):
  - 01 AI usage policy
  - 02 development workflow
  - 03 roles and responsibilities
  - 04 PR review checklist
  - 05 security guidelines
  - 06 LLM-in-product pattern
  - 07 context and cost
  - 08 adoption plan
- `docs/vi/ai-files-explained.md`.
- Repository templates:
  - `CLAUDE.md`
  - `.claude/settings.json` (strict profile, default for client repositories)
  - `.claude/settings.standard.json` (internal repositories)
  - rules (common, TypeScript, TypeORM, marketplace integration, AWS)
  - subagents (`planner`, `code-reviewer`, `security-reviewer`)
  - six skills (`plan`, `tdd-workflow`, `verification`, `code-review`, `security-review`, `db-migration-review`)
  - GitHub PR template
- Optional, opt-in hooks: format on edit, typecheck on stop.
