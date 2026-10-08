# 04. PR review checklist (AI-assisted changes)

## Purpose

Use this checklist when reviewing any PR in which AI helped. The bar is the same as for any other PR. These items cover the mistakes AI-assisted changes tend to make.

## Before you start

- [ ] CI is green: lint, typecheck, tests, commitlint, secret scan.
- [ ] The PR description has every evidence section filled, or a reason why a section does not apply.
- [ ] The diff size is reviewable. Ask to split PRs over about 600 changed lines of non-generated code.

## 1. Scope and intent

- [ ] The change matches the Backlog ticket and the approved plan.
- [ ] No unrelated edits: renames, reformatting, "while I was here" refactors, extra files.
- [ ] No invented requirements: behaviour that nobody asked for.

## 2. Correctness

- [ ] The logic is right for normal, edge and failure cases. Read the code, do not rely only on the tests.
- [ ] Errors are handled. No empty `catch`, no silent defaults, no lost promise rejections.
- [ ] Async code awaits what it should. No race conditions between workers on the same record.
- [ ] Multi-step writes use a transaction.
- [ ] Mapping (status, SKU, fields) handles unknown values explicitly.

## 3. Tests are meaningful

- [ ] The "before" run in the evidence actually fails for the expected reason.
- [ ] Tests assert behaviour and outcomes, not implementation details or mocks being called.
- [ ] Tests would fail if the new code were removed or broken. Mentally delete a line and check.
- [ ] Failure paths are tested: timeouts, 429/5xx, duplicates, out-of-order events, invalid input.
- [ ] Test data is synthetic. No real names, emails, phones, addresses or order data.
- [ ] No test was weakened, skipped or deleted to make the suite pass, unless the PR explains why.

## 4. Secrets and data

- [ ] No secrets, tokens, keys, connection strings or `.env*` files in the diff, tests, fixtures or PR text.
- [ ] No personal data in logs, error messages, metrics, S3 keys or fixtures.
- [ ] Queries on tenant data filter by tenant.
- [ ] New external calls go only to configured hosts.

## 5. Boundaries respected

- [ ] Code follows the module's existing patterns (data access, validation, errors, logging).
- [ ] No new dependency without justification. Check licence, maintenance status and `npm audit`.
- [ ] Layers respected: controllers do not query the database directly, adapters do not contain business rules.
- [ ] Public API, webhook and event contracts are unchanged or versioned.

## 6. Database and migrations

- [ ] Migration review section is filled (statements, algorithm/lock, metadata-lock risk, rollout).
- [ ] No `synchronize: true` anywhere except throwaway test setup.
- [ ] Migration is backward compatible with the version currently running.
- [ ] `down()` exists or the PR explains why not and how to restore.
- [ ] Backfills are batched, resumable and separate from schema changes.
- [ ] Large-table changes are agreed with whoever runs the release.

## 7. Marketplace integration

- [ ] Handlers are idempotent (dedupe key with unique constraint).
- [ ] Retries only on transient errors, with backoff and a maximum.
- [ ] Rate limits respected per shop/account, across all ECS tasks.
- [ ] Failed items reach a dead-letter queue or failure table.
- [ ] Reconciliation still covers the changed flow.

## 8. Infrastructure (if touched)

- [ ] IAM least privilege with specific resources.
- [ ] Secrets injected through ECS `secrets`.
- [ ] S3, RDS and CloudWatch settings follow the AWS rule.
- [ ] No deploy or apply was done by the AI.

## 9. Docs updated

- [ ] README, OpenAPI, runbook, ADR or CLAUDE.md updated where behaviour, commands or architecture changed.
- [ ] Plan file reflects what was actually built.

## 10. AI review handled honestly

- [ ] AI review summary present. CRITICAL/HIGH findings are fixed or answered with a reason.
- [ ] Refuted findings have a reason, not just "false positive".
- [ ] The author's checklist box "I have read and understood every line" is ticked. If you suspect it is not true, ask questions about specific lines.

## 11. Regression guards

- [ ] For a bug fix, the "Regression guard" section of the PR names what now prevents the bug from coming back: a test, a CI step, a lint rule, a type or a constraint, or explains why none is possible.
- [ ] The guard is real: the named test fails without the fix (see the test evidence), or the CI step, lint rule, type or constraint would have caught the original bug.
- [ ] New CI checks, regression tests and permission deny rules carry a short comment naming the failure they prevent (with the ticket key if any). A PR that removes or weakens one of these guards answers that comment.

## 12. Guard files

Guard files change what the commands the AI may run without asking actually do, or weaken the guardrails (05, section 3). The AI cannot edit them without asking, and `CODEOWNERS` gives them to the repository's owner, but a change approved once in a session still reaches the diff. Check them with extra care:

- [ ] `package.json` (every one, also in subfolders): new or changed scripts, `pre`/`post` hooks, scripts that call other scripts, new dependencies.
- [ ] Tool configs that allowed commands execute (`eslint.config.*`, `.eslintrc*`, `vitest.config.*`, `jest.config.*`, `tsconfig*.json`): no `require` or `import` of new local files, setup files, plugins or global setup that reach the network, credentials or files outside the repository.
- [ ] `.husky/**` and `.github/workflows/**`: no new commands that run on commit or in CI without a reason; jobs that use secrets keep their GitHub environment (09).
- [ ] `.claude/project.json` and `.claude/rules/local/**`: no loosened permission rule, no new `allow` rule for a command the profile asks about, no rule that tells the AI to ignore the standard.

## Outcome

- **Approve:** all applicable items pass.
- **Request changes:** any item in sections 2–7 or 12 fails, or a bug-fix PR has an empty or unconvincing regression guard, or the PR removes or weakens a guard without answering its comment (section 11).
- **Comment:** questions only.
