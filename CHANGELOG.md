# Changelog

All notable changes to this standard are recorded here. Versions follow `MAJOR.MINOR.PATCH`; see `docs/en/10-versioning-and-distribution.md` for the rules.

## [Unreleased]

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
